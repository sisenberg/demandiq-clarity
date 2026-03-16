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

    const { data: activeDemand } = await supabase
      .from("demands")
      .select("id")
      .eq("case_id", case_id)
      .eq("is_active", true)
      .maybeSingle();

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

    const systemPrompt = `You are a medical-legal analyst specializing in personal injury claim evaluation.
Extract every distinct injury, diagnosis, and clinical indicator from the medical/legal document.
For each injury extract:
- injury_description: description of the alleged injury
- body_part: specific body part (e.g., "cervical spine", "right knee", "lumbar")
- icd_codes: array of ICD-10 codes if present
- diagnosis_description: formal diagnosis text
- imaging_references: any imaging mentioned (MRI, X-ray, CT scan details)
- surgery_mentions: any surgical procedures mentioned
- injections_or_procedures: injections, epidurals, nerve blocks, etc.
- therapy_mentions: PT, chiropractic, occupational therapy references
- residual_symptom_language: language describing ongoing/permanent symptoms
- work_restrictions: any work limitations documented
- functional_limitations: ADL or functional limitations documented
- objective_support_flag: true if objective medical evidence supports the injury (imaging findings, clinical tests)
- invasive_treatment_flag: true if surgery, injections, or invasive procedures occurred
- residual_symptom_flag: true if residual/permanent symptoms are documented
- functional_impact_flag: true if functional limitations or work restrictions exist
- confidence: extraction confidence (0.0 to 1.0)
- source_page: page number
- source_snippet: brief quoted supporting text

Be thorough — extract every distinct injury, diagnosis, and clinical finding.`;

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
          { role: "user", content: `Extract all injuries, diagnoses, and clinical indicators:\n\n${fullText.slice(0, 30000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_injuries",
            description: "Extract structured injury and diagnosis records from a medical/legal document",
            parameters: {
              type: "object",
              properties: {
                injuries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      injury_description: { type: "string" },
                      body_part: { type: "string" },
                      icd_codes: { type: "array", items: { type: "string" } },
                      diagnosis_description: { type: "string" },
                      imaging_references: { type: "string" },
                      surgery_mentions: { type: "string" },
                      injections_or_procedures: { type: "string" },
                      therapy_mentions: { type: "string" },
                      residual_symptom_language: { type: "string" },
                      work_restrictions: { type: "string" },
                      functional_limitations: { type: "string" },
                      objective_support_flag: { type: "boolean" },
                      invasive_treatment_flag: { type: "boolean" },
                      residual_symptom_flag: { type: "boolean" },
                      functional_impact_flag: { type: "boolean" },
                      confidence: { type: "number" },
                      source_page: { type: "integer" },
                      source_snippet: { type: "string" },
                    },
                    required: ["injury_description", "body_part", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["injuries"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_injuries" } },
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
    const injuries = extracted.injuries ?? [];

    const records = injuries.map((inj: any) => ({
      tenant_id,
      case_id,
      linked_demand_id: activeDemand?.id ?? null,
      source_document_id: document_id,
      injury_description: inj.injury_description || "",
      body_part: inj.body_part || "",
      icd_codes: inj.icd_codes ?? [],
      diagnosis_description: inj.diagnosis_description || "",
      imaging_references: inj.imaging_references || "",
      surgery_mentions: inj.surgery_mentions || "",
      injections_or_procedures: inj.injections_or_procedures || "",
      therapy_mentions: inj.therapy_mentions || "",
      residual_symptom_language: inj.residual_symptom_language || "",
      work_restrictions: inj.work_restrictions || "",
      functional_limitations: inj.functional_limitations || "",
      objective_support_flag: inj.objective_support_flag ?? false,
      invasive_treatment_flag: inj.invasive_treatment_flag ?? false,
      residual_symptom_flag: inj.residual_symptom_flag ?? false,
      functional_impact_flag: inj.functional_impact_flag ?? false,
      source_page: inj.source_page ?? null,
      source_snippet: inj.source_snippet ?? "",
      extraction_confidence: inj.confidence,
      verification_status: "unverified",
    }));

    if (records.length > 0) {
      const { error: insertErr } = await supabase.from("injury_records").insert(records);
      if (insertErr) throw insertErr;
    }

    // Mark intake job complete
    await supabase
      .from("intake_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("document_id", document_id)
      .eq("job_type", "injury_extraction")
      .eq("status", "queued");

    console.log("[extract-injuries] Extracted", records.length, "injuries from", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        injuries_created: records.length,
        linked_demand_id: activeDemand?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[extract-injuries] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
