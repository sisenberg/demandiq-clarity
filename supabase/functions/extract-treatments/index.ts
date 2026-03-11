import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ──────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_MODEL = "google/gemini-3-flash-preview";
const EXTRACTION_VERSION = "1.0.0";

// ─── System prompt for treatment extraction ────────────
const SYSTEM_PROMPT = `You are a medical record analysis engine for casualty insurance claims.
Extract structured treatment records from the provided document text.

For EACH distinct medical visit or encounter, extract a treatment record.

IMPORTANT RULES:
- Preserve ambiguous values verbatim in the raw text fields; set is_date_ambiguous=true if dates are unclear.
- If a field cannot be determined, leave it as empty string or null — do NOT fabricate data.
- Each record must reference the source page(s) and include a snippet of supporting text.
- Group related information (e.g., a single ER visit with multiple findings) into ONE record.
- Separate distinct visits on different dates into separate records.
- For provider names, preserve the exact name as written in the document.
- For ICD/CPT codes, include both the code and description when available.`;

// ─── Tool definition for structured extraction ─────────
const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_treatment_records",
    description: "Extract structured treatment records from medical document text.",
    parameters: {
      type: "object",
      properties: {
        records: {
          type: "array",
          items: {
            type: "object",
            properties: {
              visit_type: {
                type: "string",
                enum: [
                  "emergency", "ems", "inpatient", "outpatient", "surgery",
                  "physical_therapy", "chiropractic", "pain_management",
                  "radiology", "primary_care", "specialist", "mental_health",
                  "operative", "follow_up", "ime", "other",
                ],
              },
              visit_date: { type: "string", description: "ISO date YYYY-MM-DD if determinable, empty string if ambiguous" },
              visit_date_text: { type: "string", description: "Date as written in the document verbatim" },
              service_date_start: { type: "string", description: "ISO date, service start if range" },
              service_date_end: { type: "string", description: "ISO date, service end if range" },
              is_date_ambiguous: { type: "boolean" },
              provider_name_raw: { type: "string", description: "Provider name exactly as written" },
              facility_name: { type: "string" },
              provider_specialty: { type: "string" },
              subjective_summary: { type: "string", description: "Patient complaints, history, chief complaint" },
              objective_findings: { type: "string", description: "Physical exam findings, vital signs, ROM, imaging results" },
              assessment_summary: { type: "string", description: "Diagnosis, impression, assessment" },
              plan_summary: { type: "string", description: "Treatment plan, orders, referrals" },
              diagnoses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string", description: "ICD-10 code if found" },
                    description: { type: "string" },
                    is_primary: { type: "boolean" },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
              procedures: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string", description: "CPT code if found" },
                    description: { type: "string" },
                  },
                  required: ["description"],
                  additionalProperties: false,
                },
              },
              medications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    dosage: { type: "string" },
                    frequency: { type: "string" },
                    route: { type: "string" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
              body_parts: {
                type: "array",
                items: { type: "string" },
                description: "Body parts / regions referenced",
              },
              restrictions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", description: "work, activity, weight, driving, etc." },
                    detail: { type: "string" },
                  },
                  required: ["type", "detail"],
                  additionalProperties: false,
                },
              },
              follow_up_recommendations: { type: "string" },
              source_page_start: { type: "integer" },
              source_page_end: { type: "integer" },
              source_snippet: { type: "string", description: "Key excerpt from source text (max 500 chars)" },
              confidence: {
                type: "object",
                properties: {
                  overall: { type: "number", description: "0-1 confidence score" },
                  date_confidence: { type: "number" },
                  provider_confidence: { type: "number" },
                  diagnosis_confidence: { type: "number" },
                },
                required: ["overall"],
                additionalProperties: false,
              },
            },
            required: [
              "visit_type", "visit_date_text", "provider_name_raw",
              "source_page_start", "source_snippet", "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["records"],
      additionalProperties: false,
    },
  },
};

// ─── Provider normalization helpers ─────────────────────

/** Normalize a provider name for matching: lowercase, strip titles, trim */
function normalizeProviderName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(dr\.?|m\.?d\.?|d\.?o\.?|ph\.?d\.?|rn|np|pa-c|pt|dpt|dc)\b/gi, "")
    .replace(/[,.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple string similarity (Dice coefficient) for fuzzy matching */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bi = s.substring(i, i + 2);
      set.set(bi, (set.get(bi) || 0) + 1);
    }
    return set;
  };
  const aBi = bigrams(a);
  const bBi = bigrams(b);
  let intersection = 0;
  for (const [bi, count] of aBi) {
    intersection += Math.min(count, bBi.get(bi) || 0);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/** Parse ambiguous date strings into ISO format */
function parseDateText(text: string): { date: string | null; ambiguous: boolean } {
  if (!text || text.trim() === "") return { date: null, ambiguous: true };

  // Try ISO format directly
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return { date: text, ambiguous: false };

  // MM/DD/YYYY or M/D/YYYY
  const usMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    return { date: `${y}-${month}-${day}`, ambiguous: false };
  }

  // Month DD, YYYY
  const longMatch = text.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{1,2}),?\s+(\d{4})$/i
  );
  if (longMatch) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const [, mon, d, y] = longMatch;
    const month = months[mon.substring(0, 3).toLowerCase()];
    if (month) return { date: `${y}-${month}-${d.padStart(2, "0")}`, ambiguous: false };
  }

  return { date: null, ambiguous: true };
}

/** Compute confidence tier from numeric score */
function confidenceTier(score: number | null | undefined): string {
  if (score == null) return "unknown";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

// ─── Duplicate detection ────────────────────────────────

interface DuplicateCheck {
  isDuplicate: boolean;
  matchedRecordId: string | null;
  similarity: number;
  reason: string;
}

function checkDuplicate(
  newRecord: {
    visit_date: string | null;
    provider_name_raw: string;
    visit_type: string;
    source_document_id: string;
  },
  existingRecords: Array<{
    id: string;
    visit_date: string | null;
    provider_name_raw: string;
    visit_type: string;
    source_document_id: string;
  }>
): DuplicateCheck {
  for (const existing of existingRecords) {
    // Same document = skip (expected to have multiple records)
    if (existing.source_document_id === newRecord.source_document_id) continue;

    // Check date match
    const dateMatch = newRecord.visit_date && existing.visit_date &&
      newRecord.visit_date === existing.visit_date;

    // Check provider similarity
    const provSim = diceCoefficient(
      normalizeProviderName(newRecord.provider_name_raw),
      normalizeProviderName(existing.provider_name_raw)
    );

    // Check visit type match
    const typeMatch = newRecord.visit_type === existing.visit_type;

    // Scoring
    let similarity = 0;
    const reasons: string[] = [];
    if (dateMatch) { similarity += 0.4; reasons.push("same date"); }
    if (provSim > 0.7) { similarity += 0.3 * provSim; reasons.push(`provider match (${(provSim * 100).toFixed(0)}%)`); }
    if (typeMatch) { similarity += 0.2; reasons.push("same visit type"); }

    if (similarity >= 0.6) {
      return {
        isDuplicate: true,
        matchedRecordId: existing.id,
        similarity,
        reason: `Potential duplicate: ${reasons.join(", ")}`,
      };
    }
  }

  return { isDuplicate: false, matchedRecordId: null, similarity: 0, reason: "" };
}

// ─── Try to match provider to existing upstream providers ──
async function matchProvider(
  supabase: ReturnType<typeof createClient>,
  caseId: string,
  rawName: string
): Promise<string | null> {
  const normalized = normalizeProviderName(rawName);
  if (!normalized) return null;

  // Check case_parties with provider role
  const { data: parties } = await supabase
    .from("case_parties")
    .select("id, full_name")
    .eq("case_id", caseId)
    .eq("party_role", "provider");

  if (!parties) return null;

  let bestMatch: { id: string; score: number } | null = null;
  for (const party of parties) {
    const score = diceCoefficient(normalized, normalizeProviderName(party.full_name));
    if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: party.id, score };
    }
  }

  return bestMatch?.id ?? null;
}

// ─── Main Handler ───────────────────────────────────────
// COMPLIANCE NOTE: This function sends extracted document text (L4 PHI) to
// the Lovable AI Gateway for treatment extraction. Documented in AI boundary config.
// Do NOT log clinical content, SOAP notes, or AI response payloads.
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
    const body = await req.json();
    const { document_id, case_id, job_id } = body;

    if (!document_id || !case_id) {
      return new Response(
        JSON.stringify({ error: "document_id and case_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create or update extraction job
    let extractionJobId = job_id;
    if (!extractionJobId) {
      const { data: newJob, error: jobErr } = await supabase
        .from("reviewer_extraction_jobs")
        .insert({
          tenant_id: body.tenant_id,
          case_id,
          document_id,
          status: "running",
          extraction_model: EXTRACTION_MODEL,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (jobErr) throw new Error(`Failed to create extraction job: ${jobErr.message}`);
      extractionJobId = newJob.id;
    } else {
      await supabase
        .from("reviewer_extraction_jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", extractionJobId);
    }

    // 2. Fetch document pages (extracted text)
    const { data: pages, error: pagesErr } = await supabase
      .from("document_pages")
      .select("page_number, extracted_text")
      .eq("document_id", document_id)
      .order("page_number", { ascending: true });

    if (pagesErr) throw new Error(`Failed to fetch pages: ${pagesErr.message}`);
    if (!pages || pages.length === 0) {
      throw new Error("No extracted text found for this document. Run OCR first.");
    }

    // 3. Fetch document metadata for context
    const { data: doc } = await supabase
      .from("case_documents")
      .select("file_name, document_type, page_count")
      .eq("id", document_id)
      .single();

    // 4. Build prompt with page text (truncate to avoid token limits)
    const pageTexts = pages
      .filter((p: any) => p.extracted_text && p.extracted_text.trim())
      .map((p: any) => `--- PAGE ${p.page_number} ---\n${p.extracted_text}`)
      .join("\n\n");

    const truncatedText = pageTexts.substring(0, 60000); // ~15k tokens

    const userPrompt = `Analyze this medical document and extract ALL treatment records/visits found.

Document: ${doc?.file_name || "Unknown"} (${doc?.document_type || "unknown type"}, ${pages.length} pages)

DOCUMENT TEXT:
${truncatedText}

Extract every distinct medical encounter, visit, procedure, or treatment session. Group related findings from a single visit together. Flag any dates or values that are ambiguous.`;

    // 5. Call AI for extraction
    console.log(`[extract-treatments] Starting extraction for document ${document_id}, ${pages.length} pages`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "extract_treatment_records" } },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        await supabase.from("reviewer_extraction_jobs").update({
          status: "failed",
          error_message: "Rate limited — try again later",
          completed_at: new Date().toISOString(),
        }).eq("id", extractionJobId);
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        await supabase.from("reviewer_extraction_jobs").update({
          status: "failed",
          error_message: "Payment required",
          completed_at: new Date().toISOString(),
        }).eq("id", extractionJobId);
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI extraction failed [${aiResponse.status}]: ${errText.substring(0, 300)}`);
    }

    const aiData = await aiResponse.json();
    // COMPLIANCE: Do NOT log aiData — it contains PHI
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "extract_treatment_records") {
      throw new Error("AI did not return expected tool call");
    }

    let extracted: { records: any[] };
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Failed to parse AI extraction output");
    }

    console.log(`[extract-treatments] AI returned ${extracted.records.length} records for document ${document_id}`);

    // 6. Fetch existing records for duplicate detection
    const { data: existingRecords } = await supabase
      .from("reviewer_treatment_records")
      .select("id, visit_date, provider_name_raw, visit_type, source_document_id")
      .eq("case_id", case_id);

    // 7. Process and insert records
    let recordsInserted = 0;
    let duplicatesFlagged = 0;

    for (const raw of extracted.records) {
      // Parse and normalize date
      const dateResult = parseDateText(raw.visit_date_text || "");
      const visitDate = raw.visit_date || dateResult.date;
      const isAmbiguous = raw.is_date_ambiguous || dateResult.ambiguous;

      // Normalize provider
      const normalizedName = raw.provider_name_raw
        ? normalizeProviderName(raw.provider_name_raw)
        : null;

      // Match to upstream provider
      const upstreamProviderId = await matchProvider(
        supabase, case_id, raw.provider_name_raw || ""
      );

      // Confidence
      const overallConf = raw.confidence?.overall ?? null;
      const tier = confidenceTier(overallConf);

      // Determine review state based on confidence
      const reviewState = overallConf != null && overallConf >= 0.8 ? "draft" : "needs_review";

      // Check duplicates
      const dupCheck = checkDuplicate(
        {
          visit_date: visitDate,
          provider_name_raw: raw.provider_name_raw || "",
          visit_type: raw.visit_type || "other",
          source_document_id: document_id,
        },
        existingRecords || []
      );

      if (dupCheck.isDuplicate) duplicatesFlagged++;

      const record = {
        tenant_id: body.tenant_id,
        case_id,
        source_document_id: document_id,
        source_page_start: raw.source_page_start ?? null,
        source_page_end: raw.source_page_end ?? raw.source_page_start ?? null,
        source_snippet: (raw.source_snippet || "").substring(0, 500),
        extraction_model: EXTRACTION_MODEL,
        extraction_version: EXTRACTION_VERSION,
        visit_type: raw.visit_type || "other",
        visit_date: visitDate,
        visit_date_text: raw.visit_date_text || "",
        service_date_start: raw.service_date_start || visitDate,
        service_date_end: raw.service_date_end || null,
        is_date_ambiguous: isAmbiguous,
        provider_name_raw: raw.provider_name_raw || "",
        provider_name_normalized: normalizedName
          ? normalizedName.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
          : null,
        upstream_provider_id: upstreamProviderId,
        facility_name: raw.facility_name || "",
        provider_specialty: raw.provider_specialty || "",
        subjective_summary: raw.subjective_summary || "",
        objective_findings: raw.objective_findings || "",
        assessment_summary: raw.assessment_summary || "",
        plan_summary: raw.plan_summary || "",
        diagnoses: raw.diagnoses || [],
        procedures: raw.procedures || [],
        medications: raw.medications || [],
        body_parts: raw.body_parts || [],
        restrictions: raw.restrictions || [],
        follow_up_recommendations: raw.follow_up_recommendations || "",
        overall_confidence: overallConf,
        confidence_tier: tier,
        confidence_details: raw.confidence || {},
        review_state: reviewState,
        is_duplicate_suspect: dupCheck.isDuplicate,
        duplicate_of_record_id: dupCheck.matchedRecordId,
        duplicate_similarity: dupCheck.isDuplicate ? dupCheck.similarity : null,
        duplicate_reason: dupCheck.reason,
      };

      const { error: insertErr } = await supabase
        .from("reviewer_treatment_records")
        .insert(record);

      if (insertErr) {
        console.error(`[extract-treatments] Insert error for record: ${insertErr.message}`);
      } else {
        recordsInserted++;
      }
    }

    // 8. Update extraction job
    await supabase
      .from("reviewer_extraction_jobs")
      .update({
        status: "completed",
        records_extracted: recordsInserted,
        duplicates_flagged: duplicatesFlagged,
        completed_at: new Date().toISOString(),
        metadata: {
          pages_processed: pages.length,
          total_records: extracted.records.length,
          model: EXTRACTION_MODEL,
        },
      })
      .eq("id", extractionJobId);

    // 9. Update reviewer case state counters
    const { data: caseState } = await supabase
      .from("reviewer_case_state")
      .select("id, total_treatments")
      .eq("case_id", case_id)
      .maybeSingle();

    if (caseState) {
      await supabase.from("reviewer_case_state").update({
        total_treatments: (caseState.total_treatments || 0) + recordsInserted,
      }).eq("id", caseState.id);
    }

    console.log(`[extract-treatments] Completed: ${recordsInserted} records, ${duplicatesFlagged} duplicates flagged`);

    return new Response(
      JSON.stringify({
        success: true,
        records_extracted: recordsInserted,
        duplicates_flagged: duplicatesFlagged,
        job_id: extractionJobId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract-treatments] Error:", errMsg);

    // Try to mark job as failed
    try {
      const b = await req.clone().json().catch(() => ({}));
      if (b.job_id || b.document_id) {
        await supabase.from("reviewer_extraction_jobs").update({
          status: "failed",
          error_message: errMsg.substring(0, 1000),
          completed_at: new Date().toISOString(),
        }).eq(b.job_id ? "id" : "document_id", b.job_id || b.document_id);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
