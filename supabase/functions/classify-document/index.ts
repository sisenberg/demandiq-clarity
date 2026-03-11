import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * classify-document: AI-powered document typing + intake metadata extraction.
 *
 * Invoked after text extraction is complete. Reads extracted text from
 * document_pages, calls Lovable AI to classify the document type and
 * extract structured metadata candidates, then persists results to
 * document_type_suggestions and document_metadata_extractions.
 *
 * Input: { document_id: string }
 */

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
  "medical_record",
  "police_report",
  "legal_filing",
  "correspondence",
  "billing_record",
  "imaging_report",
  "insurance_document",
  "employment_record",
  "expert_report",
  "photograph",
  "other",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !lovableApiKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { document_id } = await req.json();

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
      return new Response(
        JSON.stringify({ error: `Document not found: ${docErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch extracted pages
    const { data: pages } = await supabase
      .from("document_pages")
      .select("page_number, extracted_text")
      .eq("document_id", document_id)
      .order("page_number", { ascending: true });

    const pageTexts = (pages || [])
      .filter((p: any) => p.extracted_text?.trim())
      .map((p: any) => `--- Page ${p.page_number} ---\n${p.extracted_text}`);

    if (pageTexts.length === 0 && !doc.extracted_text) {
      return new Response(
        JSON.stringify({ error: "No extracted text available for classification" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use page-level text if available, else document-level
    const textForAnalysis = pageTexts.length > 0
      ? pageTexts.join("\n\n")
      : doc.extracted_text;

    // Truncate to ~8000 chars to stay within token limits
    const truncatedText = textForAnalysis.substring(0, 8000);

    // 3. Call AI for classification + metadata extraction via tool calling
    const systemPrompt = `You are a legal document analyst for personal injury claims. You analyze document text to:
1. Classify the document type
2. Extract structured metadata candidates

Be precise. Extract only what is clearly present in the text. For each metadata field, include the exact source text snippet that supports the extraction. If a field has multiple candidates (e.g., multiple provider names), return ALL of them as separate entries.

For confidence scores, use:
- 0.9-1.0: Clearly stated, unambiguous
- 0.7-0.89: Likely correct based on context
- 0.5-0.69: Possible but uncertain
- Below 0.5: Very uncertain, but worth flagging`;

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
            content: `Analyze this document. File name: "${doc.file_name}", File type: ${doc.file_type}\n\nExtracted text:\n${truncatedText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_and_extract",
              description: "Classify the document type and extract metadata candidates from the document text.",
              parameters: {
                type: "object",
                properties: {
                  document_type_suggestions: {
                    type: "array",
                    description: "Ranked list of likely document types, most likely first.",
                    items: {
                      type: "object",
                      properties: {
                        suggested_type: {
                          type: "string",
                          enum: [...DOCUMENT_TYPES],
                          description: "The document type classification",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence score 0-1",
                        },
                        reasoning: {
                          type: "string",
                          description: "Brief explanation of why this type was suggested",
                        },
                        source_snippet: {
                          type: "string",
                          description: "Key text excerpt supporting this classification",
                        },
                      },
                      required: ["suggested_type", "confidence", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                  metadata_extractions: {
                    type: "array",
                    description: "Extracted metadata candidates found in the document.",
                    items: {
                      type: "object",
                      properties: {
                        field_type: {
                          type: "string",
                          enum: [...METADATA_FIELDS],
                          description: "The type of metadata field",
                        },
                        extracted_value: {
                          type: "string",
                          description: "The extracted value",
                        },
                        confidence: {
                          type: "number",
                          description: "Confidence score 0-1",
                        },
                        source_snippet: {
                          type: "string",
                          description: "Exact text from the document supporting this extraction",
                        },
                        source_page: {
                          type: "integer",
                          description: "Page number where this was found, if known",
                        },
                      },
                      required: ["field_type", "extracted_value", "confidence", "source_snippet"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["document_type_suggestions", "metadata_extractions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_and_extract" } },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please retry later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errBody = await response.text();
      throw new Error(`AI classification failed [${response.status}]: ${errBody.substring(0, 300)}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const typeSuggestions = parsed.document_type_suggestions || [];
    const metadataExtractions = parsed.metadata_extractions || [];

    // 4. Delete existing suggestions for this document (idempotent re-runs)
    await Promise.all([
      supabase.from("document_type_suggestions").delete().eq("document_id", document_id),
      supabase.from("document_metadata_extractions").delete().eq("document_id", document_id),
    ]);

    // 5. Insert type suggestions
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
        console.error("Failed to insert type suggestions:", typeErr.message);
      }

      // Auto-accept highest confidence suggestion if > 0.8
      const topSuggestion = typeSuggestions.sort(
        (a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)
      )[0];

      if (topSuggestion && (topSuggestion.confidence ?? 0) >= 0.8) {
        // Update document type to the top suggestion
        await supabase
          .from("case_documents")
          .update({ document_type: topSuggestion.suggested_type })
          .eq("id", document_id);
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
        console.error("Failed to insert metadata extractions:", metaErr.message);
      }
    }

    // 7. Update pipeline stage
    await supabase
      .from("case_documents")
      .update({
        pipeline_stage: "document_classified",
        intake_status: "queued_for_parsing",
      })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        type_suggestions: typeSuggestions.length,
        metadata_extractions: metadataExtractions.length,
        top_type: typeSuggestions[0]?.suggested_type ?? null,
        top_confidence: typeSuggestions[0]?.confidence ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Classify document error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
