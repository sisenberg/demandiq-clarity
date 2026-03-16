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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active demand
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

    const systemPrompt = `You are a medical records analyst specializing in personal injury case treatment chronologies.
Extract every distinct treatment event/visit from the medical record.
For each event extract:
- provider_name: treating provider or facility
- visit_date: date of visit (YYYY-MM-DD format if possible)
- event_type: one of "office_visit", "emergency", "imaging", "injection", "physical_therapy", "chiropractic", "surgery", "consultation", "follow_up", "diagnostic_test", "medication_management", "other"
- specialty: medical specialty if identifiable (e.g., "orthopedics", "neurology", "pain_management")
- body_part_reference: body part(s) referenced (e.g., "cervical spine", "lumbar", "right knee")
- symptoms_or_complaints: chief complaint or symptoms noted
- treatment_plan_notes: treatment provided or plan documented
- event_summary: one-sentence summary of the visit
- confidence: extraction confidence (0.0 to 1.0)
- source_page: page number
- source_snippet: brief quoted supporting text

Be thorough — extract every visit, encounter, or treatment event mentioned.`;

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
          { role: "user", content: `Extract all treatment events from this medical record:\n\n${fullText.slice(0, 30000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_treatment_events",
            description: "Extract structured treatment events from a medical record",
            parameters: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      provider_name: { type: "string" },
                      visit_date: { type: "string" },
                      event_type: { type: "string" },
                      specialty: { type: "string" },
                      body_part_reference: { type: "string" },
                      symptoms_or_complaints: { type: "string" },
                      treatment_plan_notes: { type: "string" },
                      event_summary: { type: "string" },
                      confidence: { type: "number" },
                      source_page: { type: "integer" },
                      source_snippet: { type: "string" },
                    },
                    required: ["provider_name", "visit_date", "event_type", "event_summary", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["events"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_treatment_events" } },
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
    const events: Array<{
      provider_name: string;
      visit_date: string;
      event_type: string;
      specialty?: string;
      body_part_reference?: string;
      symptoms_or_complaints?: string;
      treatment_plan_notes?: string;
      event_summary: string;
      confidence: number;
      source_page?: number;
      source_snippet?: string;
    }> = extracted.events ?? [];

    // Insert treatment events
    const records = events.map((ev) => ({
      tenant_id,
      case_id,
      linked_demand_id: activeDemand?.id ?? null,
      source_document_id: document_id,
      provider_name: ev.provider_name || "",
      visit_date: ev.visit_date || "",
      event_type: ev.event_type || "office_visit",
      specialty: ev.specialty || null,
      body_part_reference: ev.body_part_reference || null,
      symptoms_or_complaints: ev.symptoms_or_complaints || "",
      treatment_plan_notes: ev.treatment_plan_notes || "",
      event_summary: ev.event_summary || "",
      source_page: ev.source_page ?? null,
      source_snippet: ev.source_snippet ?? "",
      extraction_confidence: ev.confidence,
      verification_status: "unverified",
    }));

    if (records.length > 0) {
      const { error: insertErr } = await supabase.from("treatment_events").insert(records);
      if (insertErr) throw insertErr;
    }

    // Update demand timeline aggregates
    if (activeDemand?.id) {
      const { data: allEvents } = await supabase
        .from("treatment_events")
        .select("visit_date, provider_name")
        .eq("linked_demand_id", activeDemand.id)
        .order("visit_date", { ascending: true });

      const validDates = (allEvents ?? [])
        .map((e: any) => e.visit_date)
        .filter((d: string) => d && /^\d{4}-\d{2}-\d{2}/.test(d))
        .sort();

      const firstDate = validDates[0] ?? null;
      const lastDate = validDates[validDates.length - 1] ?? null;
      let durationDays = 0;
      if (firstDate && lastDate) {
        const ms = new Date(lastDate).getTime() - new Date(firstDate).getTime();
        durationDays = Math.max(0, Math.round(ms / 86400000));
      }

      const uniqueProviders = new Set(
        (allEvents ?? []).map((e: any) => (e.provider_name || "").toLowerCase().trim()).filter(Boolean)
      );

      await supabase
        .from("demands")
        .update({
          first_treatment_date: firstDate,
          last_treatment_date: lastDate,
          treatment_duration_days: durationDays,
          total_treatment_events: (allEvents ?? []).length,
          treatment_provider_count: uniqueProviders.size,
        })
        .eq("id", activeDemand.id);
    }

    // Mark intake job complete
    await supabase
      .from("intake_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("document_id", document_id)
      .eq("job_type", "treatment_extraction")
      .eq("status", "queued");

    console.log("[extract-treatment-timeline] Extracted", records.length, "events from", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        events_created: records.length,
        linked_demand_id: activeDemand?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[extract-treatment-timeline] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
