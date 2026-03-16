import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const METADATA_FIELDS = [
  "claimant_name",
  "attorney_name",
  "law_firm",
  "provider_name",
  "facility_name",
  "claim_number",
  "loss_date",
  "treatment_date",
  "document_date",
  "bill_total",
  "charge_amount",
  "phone",
  "email",
  "address",
] as const;

const DOCUMENT_TYPES = [
  "demand_letter",
  "medical_bill",
  "medical_record",
  "itemized_statement",
  "narrative_report",
  "imaging_report",
  "wage_loss_document",
  "police_report",
  "correspondence",
  "legal_filing",
  "insurance_document",
  "employment_record",
  "expert_report",
  "photograph",
  "billing_record",
  "unknown",
  "other",
] as const;

// ── Workflow routing map ────────────────────────────────
// Maps document types to their downstream extraction workflow
const WORKFLOW_ROUTING: Record<string, string> = {
  demand_letter: "demand_extraction",
  medical_bill: "specials_extraction",
  itemized_statement: "specials_extraction",
  billing_record: "specials_extraction",
  medical_record: "treatment_extraction",
  narrative_report: "treatment_extraction",
  imaging_report: "treatment_extraction",
  wage_loss_document: "specials_extraction",
  police_report: "general_review",
  correspondence: "general_review",
  legal_filing: "general_review",
  insurance_document: "general_review",
  employment_record: "general_review",
  expert_report: "general_review",
  photograph: "general_review",
  unknown: "pending_classification",
  other: "general_review",
};

// COMPLIANCE NOTE: This function sends document text (L3–L4 PII/PHI) to the
// Lovable AI Gateway for classification and metadata extraction. Subprocessor
// data flow — see docs/compliance/subprocessor-boundaries.md.
// Do NOT log extracted text, AI prompts, or full AI response payloads.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[classify-document] Invoked");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !lovableApiKey) {
    console.error("[classify-document] Missing env vars:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!serviceRoleKey,
      hasAI: !!lovableApiKey,
    });
    return new Response(
      JSON.stringify({ error: "Server configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { document_id } = await req.json();
    console.log("[classify-document] document_id:", document_id);

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch the document
    const { data: doc, error: docErr } = await supabase
      .from("case_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      console.error("[classify-document] Document lookup failed:", docErr?.message);
      return new Response(
        JSON.stringify({ error: `Document not found: ${docErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // COMPLIANCE: Do not log file_name (may contain claimant PII) or tenant_id in production
    console.log("[classify-document] Found document, tenant:", doc.tenant_id?.slice(0, 8));

    // 2. Fetch extracted pages
    const { data: pages, error: pagesErr } = await supabase
      .from("document_pages")
      .select("page_number, extracted_text")
      .eq("document_id", document_id)
      .order("page_number", { ascending: true });

    console.log("[classify-document] Pages found:", pages?.length ?? 0, "error:", pagesErr?.message ?? "none");

    const pageTexts = (pages || [])
      .filter((p: any) => p.extracted_text?.trim())
      .map((p: any) => `--- Page ${p.page_number} ---\n${p.extracted_text}`);

    // Also check document-level extracted_text
    const docText = doc.extracted_text?.trim() || "";

    if (pageTexts.length === 0 && !docText) {
      console.error("[classify-document] No text available for classification");
      return new Response(
        JSON.stringify({ error: "No extracted text available for classification" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textForAnalysis = pageTexts.length > 0 ? pageTexts.join("\n\n") : docText;
    const truncatedText = textForAnalysis.substring(0, 8000);
    console.log("[classify-document] Text length for analysis:", truncatedText.length);

    // 3. Call AI for classification + metadata extraction
    const systemPrompt = `You are a legal document analyst for personal injury claims. Analyze document text to:
1. Classify the document type
2. Extract structured metadata candidates

Be precise. Extract only what is clearly present. For each metadata field, include the exact source text snippet. If a field has multiple candidates, return ALL as separate entries.

Confidence scores:
- 0.9-1.0: Clearly stated, unambiguous
- 0.7-0.89: Likely correct based on context
- 0.5-0.69: Possible but uncertain
- Below 0.5: Very uncertain, but worth flagging`;

    console.log("[classify-document] Calling AI gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            // COMPLIANCE: file_name may contain PII; extracted text contains PHI.
            // This is an approved AI boundary path — see docs/compliance/ai-data-boundary.md.
            content: `Analyze this document. File name: "${doc.file_name}", File type: ${doc.file_type}\n\nExtracted text:\n${truncatedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_and_extract",
              description: "Classify the document type and extract metadata candidates.",
              parameters: {
                type: "object",
                properties: {
                  document_type_suggestions: {
                    type: "array",
                    description: "Ranked list of likely document types.",
                    items: {
                      type: "object",
                      properties: {
                        suggested_type: {
                          type: "string",
                          enum: [...DOCUMENT_TYPES],
                        },
                        confidence: { type: "number" },
                        reasoning: { type: "string" },
                        source_snippet: { type: "string" },
                      },
                      required: ["suggested_type", "confidence", "reasoning"],
                    },
                  },
                  metadata_extractions: {
                    type: "array",
                    description: "Extracted metadata candidates.",
                    items: {
                      type: "object",
                      properties: {
                        field_type: {
                          type: "string",
                          enum: [...METADATA_FIELDS],
                        },
                        extracted_value: { type: "string" },
                        confidence: { type: "number" },
                        source_snippet: { type: "string" },
                        source_page: { type: "integer" },
                      },
                      required: ["field_type", "extracted_value", "confidence", "source_snippet"],
                    },
                  },
                },
                required: ["document_type_suggestions", "metadata_extractions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_and_extract" } },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[classify-document] AI response error:", response.status, errBody.substring(0, 500));
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, retry later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI classification failed [${response.status}]: ${errBody.substring(0, 300)}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    console.log("[classify-document] AI response received, has tool_call:", !!toolCall);

    if (!toolCall?.function?.arguments) {
      // Fallback: check if content has the data directly (some models respond differently)
      const content = aiData.choices?.[0]?.message?.content;
      console.error("[classify-document] No tool call in response. Content:", content?.substring(0, 200));
      throw new Error("AI did not return structured tool call output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const typeSuggestions = parsed.document_type_suggestions || [];
    const metadataExtractions = parsed.metadata_extractions || [];

    console.log("[classify-document] Parsed:", typeSuggestions.length, "type suggestions,", metadataExtractions.length, "metadata extractions");

    // 4. Delete existing suggestions (idempotent re-runs)
    const [delTypes, delMeta] = await Promise.all([
      supabase.from("document_type_suggestions").delete().eq("document_id", document_id),
      supabase.from("document_metadata_extractions").delete().eq("document_id", document_id),
    ]);
    console.log("[classify-document] Cleared old data. Types err:", delTypes.error?.message ?? "none", "Meta err:", delMeta.error?.message ?? "none");

    // 5. Insert type suggestions
    let topType: string | null = null;
    let topConfidence: number | null = null;

    if (typeSuggestions.length > 0) {
      const typeRecords = typeSuggestions.map((s: any) => ({
        tenant_id: doc.tenant_id,
        case_id: doc.case_id,
        document_id: doc.id,
        suggested_type: s.suggested_type,
        confidence: s.confidence ?? null,
        reasoning: s.reasoning || "",
        source_snippet: s.source_snippet || "",
      }));

      const { error: typeErr } = await supabase
        .from("document_type_suggestions")
        .insert(typeRecords);

      if (typeErr) {
        console.error("[classify-document] Failed to insert type suggestions:", typeErr.message);
      } else {
        console.log("[classify-document] Inserted", typeRecords.length, "type suggestions");
      }

      const sorted = [...typeSuggestions].sort(
        (a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)
      );
      topType = sorted[0]?.suggested_type;
      topConfidence = sorted[0]?.confidence;

      // Always store the AI prediction in predicted_type
      if (topType) {
        await supabase
          .from("case_documents")
          .update({ predicted_type: topType })
          .eq("id", document_id);
        console.log("[classify-document] Set predicted_type to", topType);
      }

      // Auto-accept highest confidence if >= 0.8 → set document_type (final_type)
      if (topType && (topConfidence ?? 0) >= 0.8) {
        const { error: updateErr } = await supabase
          .from("case_documents")
          .update({ document_type: topType })
          .eq("id", document_id);
        console.log("[classify-document] Auto-set document_type to", topType, "err:", updateErr?.message ?? "none");

        // Enqueue the routed workflow job based on document type
        const workflow = WORKFLOW_ROUTING[topType] || "general_review";
        if (workflow !== "pending_classification") {
          await supabase.from("intake_jobs").insert({
            tenant_id: doc.tenant_id,
            case_id: doc.case_id,
            document_id: doc.id,
            job_type: workflow,
            status: "queued",
          });
          console.log("[classify-document] Enqueued workflow job:", workflow);
        }

        // Auto-trigger orchestrate-intake to fire extraction functions
        try {
          await fetch(`${supabaseUrl}/functions/v1/orchestrate-intake`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              document_id: doc.id,
              case_id: doc.case_id,
              tenant_id: doc.tenant_id,
            }),
          });
          console.log("[classify-document] Triggered orchestrate-intake");
        } catch (orchErr) {
          console.warn("[classify-document] orchestrate-intake trigger failed (non-fatal):", orchErr);
        }
      }
    }

    // 6. Insert metadata extractions
    if (metadataExtractions.length > 0) {
      const metaRecords = metadataExtractions.map((m: any) => ({
        tenant_id: doc.tenant_id,
        case_id: doc.case_id,
        document_id: doc.id,
        field_type: m.field_type,
        extracted_value: m.extracted_value,
        confidence: m.confidence ?? null,
        source_snippet: m.source_snippet || "",
        source_page: m.source_page ?? null,
      }));

      const { error: metaErr } = await supabase
        .from("document_metadata_extractions")
        .insert(metaRecords);

      if (metaErr) {
        console.error("[classify-document] Failed to insert metadata:", metaErr.message);
      } else {
        console.log("[classify-document] Inserted", metaRecords.length, "metadata extractions");
      }
    }

    // 7. Update pipeline stage — advance to document_classified
    // Do NOT regress intake_status; only advance pipeline_stage
    const { error: stageErr } = await supabase
      .from("case_documents")
      .update({ pipeline_stage: "document_classified" })
      .eq("id", document_id);

    console.log("[classify-document] Updated pipeline_stage. err:", stageErr?.message ?? "none");

    const routed_workflow = topType ? (WORKFLOW_ROUTING[topType] || "general_review") : null;
    const result = {
      success: true,
      type_suggestions: typeSuggestions.length,
      metadata_extractions: metadataExtractions.length,
      top_type: topType,
      top_confidence: topConfidence,
      routed_workflow,
    };

    console.log("[classify-document] Complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[classify-document] Error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
