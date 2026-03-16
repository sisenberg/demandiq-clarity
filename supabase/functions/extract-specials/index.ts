import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id, case_id, tenant_id } = await req.json();
    if (!document_id || !case_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active demand for this case
    const { data: activeDemand } = await supabase
      .from("demands")
      .select("id")
      .eq("case_id", case_id)
      .eq("is_active", true)
      .maybeSingle();

    // Gather page text
    const { data: pages } = await supabase
      .from("document_pages")
      .select("page_number, extracted_text")
      .eq("document_id", document_id)
      .order("page_number", { ascending: true });

    const fullText = (pages ?? [])
      .map((p: any) => `--- PAGE ${p.page_number} ---\n${p.extracted_text ?? ""}`)
      .join("\n\n");

    if (!fullText.trim()) {
      return new Response(
        JSON.stringify({ error: "No extracted text available" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a medical billing analyst specializing in personal injury claims.
Extract every individual line item / charge from the medical bill or itemized statement.
For each line item extract:
- provider_name: the treating provider or facility name
- date_of_service: the date of service (YYYY-MM-DD if possible)
- cpt_or_hcpcs_code: CPT or HCPCS code if present, otherwise empty string
- description: description of the service/procedure
- billed_amount: the billed/charged amount as a number (no $ or commas)
- adjustments: any adjustment/write-off amount as a number, or null
- balance_due: the patient balance/amount due as a number, or null
- confidence: your confidence in this extraction (0.0 to 1.0)
- source_page: the page number where this line item appears
- source_snippet: brief quoted text supporting this extraction

Extract ALL line items, even if amounts are small. Be thorough.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract all bill line items from this document:\n\n${fullText.slice(0, 30000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_bill_lines",
              description: "Extract structured bill line items from a medical bill or itemized statement",
              parameters: {
                type: "object",
                properties: {
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        provider_name: { type: "string" },
                        date_of_service: { type: "string" },
                        cpt_or_hcpcs_code: { type: "string" },
                        description: { type: "string" },
                        billed_amount: { type: "number" },
                        adjustments: { type: "number", nullable: true },
                        balance_due: { type: "number", nullable: true },
                        confidence: { type: "number" },
                        source_page: { type: "integer" },
                        source_snippet: { type: "string" },
                      },
                      required: ["provider_name", "date_of_service", "description", "billed_amount", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["line_items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_bill_lines" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const extracted = JSON.parse(toolCall.function.arguments);
    const lineItems: Array<{
      provider_name: string;
      date_of_service: string;
      cpt_or_hcpcs_code?: string;
      description: string;
      billed_amount: number;
      adjustments?: number | null;
      balance_due?: number | null;
      confidence: number;
      source_page?: number;
      source_snippet?: string;
    }> = extracted.line_items ?? [];

    // Insert specials records
    const records = lineItems.map((item) => ({
      tenant_id,
      case_id,
      linked_demand_id: activeDemand?.id ?? null,
      source_document_id: document_id,
      provider_name: item.provider_name || "",
      date_of_service: item.date_of_service || "",
      cpt_or_hcpcs_code: item.cpt_or_hcpcs_code || null,
      description: item.description || "",
      billed_amount: item.billed_amount || 0,
      adjustments: item.adjustments ?? null,
      balance_due: item.balance_due ?? null,
      extraction_confidence: item.confidence,
      verification_status: "unverified",
      source_page: item.source_page ?? null,
      source_snippet: item.source_snippet ?? "",
    }));

    if (records.length > 0) {
      const { error: insertErr } = await supabase.from("specials_records").insert(records);
      if (insertErr) throw insertErr;
    }

    // Update demand aggregates if linked
    if (activeDemand?.id) {
      // Compute totals across ALL specials for this demand
      const { data: allSpecials } = await supabase
        .from("specials_records")
        .select("billed_amount, provider_name")
        .eq("linked_demand_id", activeDemand.id);

      const totalBilled = (allSpecials ?? []).reduce((sum: number, r: any) => sum + (r.billed_amount || 0), 0);
      const uniqueProviders = new Set((allSpecials ?? []).map((r: any) => r.provider_name.toLowerCase().trim()).filter(Boolean));

      await supabase
        .from("demands")
        .update({
          total_billed_specials: totalBilled,
          number_of_bills: (allSpecials ?? []).length,
          number_of_providers: uniqueProviders.size,
        })
        .eq("id", activeDemand.id);
    }

    // Mark intake job complete
    await supabase
      .from("intake_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("document_id", document_id)
      .eq("job_type", "specials_extraction")
      .eq("status", "queued");

    console.log("[extract-specials] Extracted", records.length, "line items from document", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        records_created: records.length,
        linked_demand_id: activeDemand?.id ?? null,
        total_billed: records.reduce((s, r) => s + r.billed_amount, 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[extract-specials] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
