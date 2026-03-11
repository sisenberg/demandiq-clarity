import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  "accident", "first_treatment", "treatment", "imaging", "injection",
  "surgery", "ime", "demand", "legal", "administrative",
  "billing", "correspondence", "investigation", "representation", "other",
] as const;

// COMPLIANCE NOTE: This function sends extracted text (L4 PHI — medical events)
// to the Lovable AI Gateway. See docs/compliance/subprocessor-boundaries.md.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[generate-chronology] Invoked");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !lovableApiKey) {
    console.error("[generate-chronology] Missing env vars");
    return new Response(
      JSON.stringify({ error: "Server configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { case_id } = await req.json();
    console.log("[generate-chronology] case_id:", case_id);

    if (!case_id) {
      return new Response(
        JSON.stringify({ error: "case_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch the case
    const { data: caseData, error: caseErr } = await supabase
      .from("cases")
      .select("id, tenant_id, claimant, date_of_loss, claim_number")
      .eq("id", case_id)
      .single();

    if (caseErr || !caseData) {
      console.error("[generate-chronology] Case not found:", caseErr?.message);
      return new Response(
        JSON.stringify({ error: "Case not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-chronology] Case:", caseData.claimant, "tenant:", caseData.tenant_id);

    // 2. Gather all parsed document data for this case
    const [docsResult, pagesResult, metaResult, factsResult, typesResult] = await Promise.all([
      supabase.from("case_documents").select("id, file_name, document_type, document_status, pipeline_stage").eq("case_id", case_id),
      supabase.from("document_pages").select("document_id, page_number, extracted_text").eq("case_id", case_id).order("page_number"),
      supabase.from("document_metadata_extractions").select("*").eq("case_id", case_id),
      supabase.from("extracted_facts").select("*").eq("case_id", case_id),
      supabase.from("document_type_suggestions").select("*").eq("case_id", case_id),
    ]);

    const docs = docsResult.data || [];
    const pages = pagesResult.data || [];
    const metadata = metaResult.data || [];
    const facts = factsResult.data || [];
    const typeSuggestions = typesResult.data || [];

    console.log("[generate-chronology] Data gathered:", {
      docs: docs.length,
      pages: pages.length,
      metadata: metadata.length,
      facts: facts.length,
      typeSuggestions: typeSuggestions.length,
    });

    // Build per-document text summaries (truncated)
    const docSummaries = docs.map((doc: any) => {
      const docPages = pages
        .filter((p: any) => p.document_id === doc.id && p.extracted_text?.trim())
        .map((p: any) => `[Page ${p.page_number}]: ${p.extracted_text!.substring(0, 1500)}`);
      const docMeta = metadata
        .filter((m: any) => m.document_id === doc.id)
        .map((m: any) => `${m.field_type}: ${m.extracted_value} (confidence: ${m.confidence ?? "?"})`);
      const docFacts = facts
        .filter((f: any) => f.document_id === doc.id)
        .map((f: any) => `[${f.fact_type}] ${f.fact_text} (page ${f.page_number ?? "?"})`);
      const docType = typeSuggestions.find((t: any) => t.document_id === doc.id);

      return {
        document_id: doc.id,
        file_name: doc.file_name,
        document_type: docType?.suggested_type ?? doc.document_type,
        text_preview: docPages.join("\n").substring(0, 4000),
        metadata: docMeta,
        facts: docFacts,
      };
    });

    // 3. Build AI prompt
    const contextBlock = docSummaries.map((ds: any) =>
      `=== Document: ${ds.file_name} (${ds.document_type}) [ID: ${ds.document_id}] ===\n` +
      (ds.metadata.length > 0 ? `Metadata:\n${ds.metadata.join("\n")}\n` : "") +
      (ds.facts.length > 0 ? `Facts:\n${ds.facts.join("\n")}\n` : "") +
      (ds.text_preview ? `Text:\n${ds.text_preview}\n` : "")
    ).join("\n\n");

    const truncatedContext = contextBlock.substring(0, 20000);

    const systemPrompt = `You are a legal chronology analyst for personal injury claims. Generate a timeline of significant events from case documents.

For each event extract:
- event_date: ISO date string (YYYY-MM-DD) or partial date. Use best available info.
- category: one of ${CATEGORIES.join(", ")}
- label: short descriptive title (under 80 chars)
- description: 1-2 sentence summary
- confidence: 0.0-1.0
- source_document_id: UUID of the source document
- source_page: page number if known
- quoted_text: exact text snippet supporting this event

Event types to look for:
- Incident/loss date
- Initial treatment / ER visit
- Follow-up treatments
- Imaging studies (MRI, CT, X-ray)
- Injections (ESI, trigger point)
- Surgeries
- IME examinations
- Demand letters sent
- Attorney representation dates
- Billing/charge events
- Police reports / investigation events
- Significant correspondence

Rules:
- Include ALL candidate events, even if dates conflict
- Preserve conflicting dates as separate candidates
- Flag low-confidence events (confidence < 0.6)
- Each event MUST reference a source document`;

    console.log("[generate-chronology] Calling AI gateway, context length:", truncatedContext.length);

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
            content: `Case: ${caseData.claimant}, Claim #${caseData.claim_number}, DOL: ${caseData.date_of_loss ?? "unknown"}\n\nDocuments:\n${truncatedContext}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_chronology_events",
              description: "Generate chronology event candidates from case documents.",
              parameters: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        event_date: { type: "string", description: "ISO date YYYY-MM-DD or partial" },
                        event_date_end: { type: "string", description: "End date if range" },
                        category: { type: "string", enum: [...CATEGORIES] },
                        label: { type: "string" },
                        description: { type: "string" },
                        confidence: { type: "number" },
                        source_document_id: { type: "string", description: "UUID of source document" },
                        source_page: { type: "integer" },
                        quoted_text: { type: "string", description: "Exact supporting text snippet" },
                      },
                      required: ["event_date", "category", "label", "description", "confidence", "source_document_id"],
                    },
                  },
                },
                required: ["events"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_chronology_events" } },
        temperature: 0.15,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[generate-chronology] AI error:", response.status, errBody.substring(0, 500));
      throw new Error(`AI chronology generation failed [${response.status}]`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[generate-chronology] No tool call in AI response");
      throw new Error("AI did not return structured chronology output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const events = parsed.events || [];

    console.log("[generate-chronology] AI returned", events.length, "events");

    // Validate document IDs
    const validDocIds = new Set(docs.map((d: any) => d.id));

    // 4. Clear existing draft candidates for this case (idempotent re-runs)
    await supabase.from("chronology_evidence_links").delete().eq("case_id", case_id);
    await supabase.from("chronology_event_candidates").delete().eq("case_id", case_id).eq("source_type", "ai_extracted");
    console.log("[generate-chronology] Cleared previous AI-generated candidates");

    // 5. Insert candidates + evidence links
    let insertedCount = 0;
    let evidenceCount = 0;

    for (const evt of events) {
      const docId = evt.source_document_id;
      const hasValidDoc = validDocIds.has(docId);

      const candidateRecord = {
        tenant_id: caseData.tenant_id,
        case_id: case_id,
        event_date: evt.event_date || "",
        event_date_end: evt.event_date_end || null,
        category: CATEGORIES.includes(evt.category) ? evt.category : "other",
        label: evt.label || "",
        description: evt.description || "",
        confidence: evt.confidence ?? null,
        status: "draft",
        source_type: "ai_extracted",
        machine_label: evt.label || null,
        machine_description: evt.description || null,
        machine_date: evt.event_date || null,
        machine_category: evt.category || null,
        source_document_id: hasValidDoc ? docId : null,
        source_page: evt.source_page ?? null,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("chronology_event_candidates")
        .insert(candidateRecord)
        .select("id")
        .single();

      if (insertErr) {
        console.error("[generate-chronology] Insert error:", insertErr.message, "for event:", evt.label);
        continue;
      }

      insertedCount++;

      // Insert evidence link
      if (hasValidDoc && inserted) {
        const evidenceRecord = {
          tenant_id: caseData.tenant_id,
          case_id: case_id,
          candidate_id: inserted.id,
          document_id: docId,
          page_number: evt.source_page ?? null,
          quoted_text: evt.quoted_text || "",
          relevance_type: "direct",
          confidence: evt.confidence ?? null,
        };

        const { error: evErr } = await supabase
          .from("chronology_evidence_links")
          .insert(evidenceRecord);

        if (evErr) {
          console.error("[generate-chronology] Evidence link error:", evErr.message);
        } else {
          evidenceCount++;
        }
      }
    }

    const result = {
      success: true,
      events_generated: insertedCount,
      evidence_links: evidenceCount,
      ai_returned: events.length,
    };

    console.log("[generate-chronology] Complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-chronology] Error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
