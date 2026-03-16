import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMAND_FIELDS = [
  "demand_date",
  "claimant_name",
  "attorney_name",
  "law_firm_name",
  "represented_status",
  "demand_amount",
  "demand_deadline",
  "loss_date",
  "insured_name",
  "claim_number",
  "demand_summary_text",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
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

    // Gather document text from pages
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
        JSON.stringify({ error: "No extracted text available for this document" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI to extract demand fields
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a legal document analyst specializing in insurance demand letters.
Extract structured data from the demand letter text provided.
Return the extracted fields using the tool provided. For each field, include:
- The extracted value
- A confidence score (0.0 to 1.0)
- The page number where the information was found
- A brief source snippet (the exact text that supports the extraction)

For represented_status, use one of: "represented", "unrepresented", "unknown".
For demand_amount, extract the numeric value only (no $ or commas).
If a field cannot be found, use empty string with confidence 0.`;

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
          { role: "user", content: `Extract demand letter fields from this document:\n\n${fullText.slice(0, 30000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_demand_fields",
              description: "Extract structured fields from a demand letter",
              parameters: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field_name: { type: "string", enum: [...DEMAND_FIELDS] },
                        value: { type: "string" },
                        confidence: { type: "number" },
                        source_page: { type: "integer" },
                        source_snippet: { type: "string" },
                      },
                      required: ["field_name", "value", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["fields"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_demand_fields" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
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
    const fields: Array<{
      field_name: string;
      value: string;
      confidence: number;
      source_page?: number;
      source_snippet?: string;
    }> = extracted.fields ?? [];

    // Build demand record from extracted fields
    const fieldMap: Record<string, string> = {};
    for (const f of fields) {
      fieldMap[f.field_name] = f.value;
    }

    // Deactivate any existing active demand for this case
    await supabase
      .from("demands")
      .update({ is_active: false })
      .eq("case_id", case_id)
      .eq("is_active", true);

    // Insert new demand
    const { data: demand, error: demandErr } = await supabase
      .from("demands")
      .insert({
        tenant_id,
        case_id,
        source_document_id: document_id,
        is_active: false, // user must manually activate after review
        demand_date: fieldMap.demand_date ?? "",
        claimant_name: fieldMap.claimant_name ?? "",
        attorney_name: fieldMap.attorney_name ?? "",
        law_firm_name: fieldMap.law_firm_name ?? "",
        represented_status: fieldMap.represented_status ?? "unknown",
        demand_amount: fieldMap.demand_amount ? parseFloat(fieldMap.demand_amount) : null,
        demand_deadline: fieldMap.demand_deadline ?? null,
        loss_date: fieldMap.loss_date ?? "",
        insured_name: fieldMap.insured_name ?? "",
        claim_number: fieldMap.claim_number ?? "",
        demand_summary_text: fieldMap.demand_summary_text ?? "",
      })
      .select("id")
      .single();

    if (demandErr) throw demandErr;

    // Insert field-level extractions
    const fieldRows = fields.map((f) => ({
      tenant_id,
      demand_id: demand.id,
      field_name: f.field_name,
      extracted_value: f.value,
      confidence: f.confidence,
      source_page: f.source_page ?? null,
      source_snippet: f.source_snippet ?? "",
    }));

    if (fieldRows.length > 0) {
      await supabase.from("demand_field_extractions").insert(fieldRows);
    }

    // Update intake job status
    await supabase
      .from("intake_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("document_id", document_id)
      .eq("job_type", "demand_extraction")
      .in("status", ["queued", "running"]);

    console.log("[extract-demand] Created demand", demand.id, "with", fields.length, "field extractions");

    return new Response(
      JSON.stringify({ success: true, demand_id: demand.id, fields_extracted: fields.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[extract-demand] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
