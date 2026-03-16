import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ─── CORS ──────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── OCR Provider Interface ─────────────────────────────
interface OcrResult {
  text: string;
  confidence: number;
}

interface OcrProvider {
  name: string;
  extractPageText(
    base64Data: string,
    mimeType: string,
    pageHint?: number
  ): Promise<OcrResult>;
}

// ─── Lovable AI OCR Provider (Gemini vision) ────────────
class LovableAiOcrProvider implements OcrProvider {
  name = "lovable-ai-gemini";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractPageText(
    base64Data: string,
    mimeType: string,
    pageHint?: number
  ): Promise<OcrResult> {
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a precise OCR engine. Extract ALL text visible in this document page exactly as written. Preserve paragraph breaks with double newlines. Do not summarize, interpret, or add commentary. Output only the raw text content.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract all text from this document page${pageHint ? ` (page ${pageHint})` : ""}. Return ONLY the raw text, preserving layout as closely as possible.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(
        `AI OCR failed [${response.status}]: ${errBody.substring(0, 300)}`
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return { text, confidence: text.length > 0 ? 0.85 : 0 };
  }
}

// ─── Placeholder External OCR Provider ──────────────────
// Swap in Google Document AI, AWS Textract, Azure Form Recognizer, etc.
class ExternalOcrProvider implements OcrProvider {
  name = "external-placeholder";

  async extractPageText(): Promise<OcrResult> {
    // To enable: set OCR_PROVIDER env var + OCR_PROVIDER_API_KEY
    throw new Error(
      "External OCR provider not configured. Set OCR_PROVIDER and OCR_PROVIDER_API_KEY environment variables."
    );
  }
}

// ─── Provider Factory ───────────────────────────────────
function getOcrProvider(lovableApiKey: string): OcrProvider {
  const provider = Deno.env.get("OCR_PROVIDER");
  if (provider === "external") {
    return new ExternalOcrProvider();
  }
  // Default: use Lovable AI
  return new LovableAiOcrProvider(lovableApiKey);
}

// ─── Efficient Base64 Encoding ──────────────────────────
// Converts Uint8Array to base64 using chunked processing to avoid stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 32768; // 32KB chunks
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(""));
}

// ─── Born-Digital Text Extraction ───────────────────────
// Attempts to extract text directly from PDF binary without OCR.
// Uses a simple heuristic: search for text stream markers in PDF.
function detectBornDigitalText(pdfBytes: Uint8Array): boolean {
  // Heuristic: look for /Type /Page and text operators (Tj, TJ, BT/ET)
  // in the raw PDF bytes. Born-digital PDFs contain these operators.
  const sample = new TextDecoder("latin1").decode(
    pdfBytes.subarray(0, Math.min(pdfBytes.length, 50000))
  );
  const hasTextOps = /\b(Tj|TJ)\b/.test(sample) && /\bBT\b/.test(sample);
  return hasTextOps;
}

// Simple born-digital text extraction by splitting on page markers
// This is a best-effort approach; complex PDFs may need pdf-lib or pdfjs
function extractBornDigitalPages(pdfBytes: Uint8Array): string[] {
  const fullText = new TextDecoder("latin1").decode(pdfBytes);

  // Find text between BT...ET blocks (text objects)
  const textBlocks: string[] = [];
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  let currentText = "";
  let pageBreaks = 0;

  // Count pages via /Type /Page markers
  const pageRegex = /\/Type\s*\/Page[^s]/g;
  const pageCount = (fullText.match(pageRegex) || []).length;

  // Extract readable text strings from PDF content streams
  // Look for text in parentheses (Tj operator) or hex strings
  const readableRegex = /\(([^)]{2,})\)\s*Tj/g;
  while ((match = readableRegex.exec(fullText)) !== null) {
    currentText += match[1] + " ";
  }

  // If we found readable text, split roughly by page count
  if (currentText.trim().length > 20 && pageCount > 0) {
    const words = currentText.trim().split(/\s+/);
    const wordsPerPage = Math.ceil(words.length / pageCount);
    for (let i = 0; i < pageCount; i++) {
      const pageWords = words.slice(
        i * wordsPerPage,
        (i + 1) * wordsPerPage
      );
      textBlocks.push(pageWords.join(" "));
    }
    return textBlocks;
  }

  return []; // Couldn't extract → fall through to AI cleanup
}

// Broader text extraction: captures Tj, TJ array strings, and hex strings
function extractAllPdfText(pdfBytes: Uint8Array): string {
  const fullText = new TextDecoder("latin1").decode(pdfBytes);
  const parts: string[] = [];

  // Tj strings: (text) Tj
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRegex.exec(fullText)) !== null) {
    parts.push(m[1]);
  }

  // TJ arrays: [(text) num (text)] TJ
  const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((m = tjArrayRegex.exec(fullText)) !== null) {
    const inner = m[1];
    const strRegex = /\(([^)]+)\)/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRegex.exec(inner)) !== null) {
      parts.push(sm[1]);
    }
  }

  return parts.join(" ").replace(/\\n/g, "\n").replace(/\s+/g, " ").trim();
}

// ─── Main Handler ───────────────────────────────────────
// COMPLIANCE NOTE: This function sends document content (L4 restricted_phi) to
// the Lovable AI Gateway for OCR processing. This is a subprocessor data flow
// documented in docs/compliance/data-flow-inventory.md and
// docs/compliance/subprocessor-boundaries.md.
// Do NOT log extracted text content or AI response payloads.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch the intake job
    const { data: job, error: jobErr } = await supabase
      .from("intake_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: `Job not found: ${jobErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status !== "queued") {
      return new Response(
        JSON.stringify({ message: "Job already processed", status: job.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Mark job as running
    await supabase
      .from("intake_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // 3. Update document intake_status
    await supabase
      .from("case_documents")
      .update({ intake_status: "extracting_text" })
      .eq("id", job.document_id);

    // 4. Fetch document record
    const { data: doc, error: docErr } = await supabase
      .from("case_documents")
      .select("*")
      .eq("id", job.document_id)
      .single();

    if (docErr || !doc) {
      throw new Error(`Document not found: ${docErr?.message}`);
    }

    if (!doc.storage_path) {
      throw new Error("Document has no storage path");
    }

    // 5. Download file from storage
    // EVIDENCE ZONE: Raw file bytes (L4 restricted_phi) — held in memory only
    // for the duration of this function invocation. Never logged, never cached,
    // never written to any destination other than document_pages.extracted_text.
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("case-documents")
      .download(doc.storage_path);

    if (dlErr || !fileData) {
      throw new Error(`Failed to download file: ${dlErr?.message}`);
    }

    const fileBytes = new Uint8Array(await fileData.arrayBuffer());
    const isPdf = doc.file_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf");
    const isImage = /^image\/(jpeg|jpg|png|tiff|tif|webp)$/i.test(doc.file_type);

    let pages: { pageNumber: number; text: string; confidence: number }[] = [];
    let extractionMethod = "unknown";

    if (isPdf) {
      // 6a. Try born-digital extraction first
      const isBornDigital = detectBornDigitalText(fileBytes);

      if (isBornDigital) {
        extractionMethod = "born-digital";
        const extractedPages = extractBornDigitalPages(fileBytes);

        if (extractedPages.length > 0 && extractedPages.some((p) => p.trim().length > 10)) {
          pages = extractedPages.map((text, i) => ({
            pageNumber: i + 1,
            text: text.trim(),
            confidence: 0.95,
          }));
        } else {
          // Born-digital detection was wrong or text too sparse → fall to OCR
          extractionMethod = "ocr-fallback";
        }
      }

      // 6b. If no text extracted via born-digital, use AI text extraction
      // NOTE: Gemini vision API does not accept raw PDF binary via image_url.
      // Instead we extract whatever raw text we can from the PDF stream and
      // send it to the AI for cleanup and structuring.
      if (pages.length === 0) {
        extractionMethod = isBornDigital ? "ocr-fallback" : "ocr";

        if (!lovableApiKey) {
          throw new Error(
            "LOVABLE_API_KEY not configured. Required for text extraction."
          );
        }

        // Extract ALL readable text strings from the PDF (broader regex)
        const rawPdfText = extractAllPdfText(fileBytes);

        if (rawPdfText.trim().length < 20) {
          // Truly scanned PDF with no extractable text — mark for manual review
          extractionMethod = "scanned-pdf-no-text";
          await supabase
            .from("case_documents")
            .update({
              intake_status: "needs_review",
              document_status: "needs_attention",
              pipeline_stage: "upload_received",
            })
            .eq("id", doc.id);

          await supabase
            .from("intake_jobs")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: "Scanned PDF with no extractable text. Image-based OCR for PDFs is not yet supported.",
            })
            .eq("id", job_id);

          return new Response(
            JSON.stringify({
              success: false,
              extraction_method: extractionMethod,
              error: "Scanned PDF detected. Image-based OCR for PDFs is not yet supported. Please upload a born-digital (text-based) PDF.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Send raw text to AI for cleanup and page structuring
        const cleanupResponse = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "You are a document text extraction engine. You receive raw text extracted from a PDF document. Clean it up, fix encoding artifacts, restore paragraph structure, and return the readable text. Preserve all content faithfully — do not summarize or omit anything. If you can identify page boundaries, separate pages with the marker: --- Page N ---",
                },
                {
                  role: "user",
                  content: `Clean up and structure this raw PDF text extraction:\n\n${rawPdfText.substring(0, 30000)}`,
                },
              ],
              max_tokens: 8192,
              temperature: 0,
            }),
          }
        );

        if (!cleanupResponse.ok) {
          const errBody = await cleanupResponse.text();
          console.error("[process-document] AI cleanup failed:", cleanupResponse.status, errBody.substring(0, 300));
          // Fall back to raw text
          pages = [{
            pageNumber: 1,
            text: rawPdfText.substring(0, 50000),
            confidence: 0.5,
          }];
        } else {
          const cleanupData = await cleanupResponse.json();
          const cleanedText = cleanupData.choices?.[0]?.message?.content?.trim() || rawPdfText;

          // Split by page markers if present
          const pageTexts = cleanedText.split(/\n---\s*Page\s*\d+\s*---\n/i);
          if (pageTexts.length > 1) {
            pages = pageTexts.filter((t: string) => t.trim()).map((text: string, i: number) => ({
              pageNumber: i + 1,
              text: text.trim(),
              confidence: 0.8,
            }));
          } else {
            pages = [{
              pageNumber: 1,
              text: cleanedText,
              confidence: 0.8,
            }];
      }
    } else if (isImage) {
      // 7. Image files: always OCR
      extractionMethod = "ocr-image";

      if (!lovableApiKey) {
        throw new Error("LOVABLE_API_KEY not configured for image OCR.");
      }

      const ocrProvider = getOcrProvider(lovableApiKey);
      const cappedImgBytes = fileBytes.subarray(0, Math.min(fileBytes.length, 5_000_000));
      const base64 = uint8ArrayToBase64(cappedImgBytes);
      const result = await ocrProvider.extractPageText(base64, doc.file_type, 1);

      pages = [
        {
          pageNumber: 1,
          text: result.text.trim(),
          confidence: result.confidence,
        },
      ];
    } else if (/\.(docx|doc)$/i.test(doc.file_name) || doc.file_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // DOCX: flag as needing external conversion — not OCR-able directly
      extractionMethod = "unsupported-docx";
      // Mark document with a status that allows manual re-processing later
      await supabase
        .from("case_documents")
        .update({
          intake_status: "needs_review",
          document_status: "needs_attention",
          pipeline_stage: "upload_received",
        })
        .eq("id", doc.id);

      await supabase
        .from("intake_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: "DOCX text extraction is not yet supported. Convert to PDF and re-upload.",
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({
          success: false,
          extraction_method: extractionMethod,
          error: "DOCX text extraction not yet supported. Convert to PDF and re-upload.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Unsupported file type for text extraction
      throw new Error(
        `Unsupported file type for text extraction: ${doc.file_type}`
      );
    }

    // 8. Persist pages to document_pages
    if (pages.length > 0) {
      // Delete any existing pages for this document (idempotent)
      await supabase
        .from("document_pages")
        .delete()
        .eq("document_id", doc.id);

      const pageRecords = pages.map((p) => ({
        tenant_id: doc.tenant_id,
        case_id: doc.case_id,
        document_id: doc.id,
        page_number: p.pageNumber,
        extracted_text: p.text,
        confidence_score: p.confidence,
      }));

      const { error: insertErr } = await supabase
        .from("document_pages")
        .insert(pageRecords);

      if (insertErr) {
        throw new Error(`Failed to save pages: ${insertErr.message}`);
      }
    }

    // 9. Combine all page text for the document-level extracted_text
    const fullText = pages.map((p) => p.text).join("\n\n--- Page Break ---\n\n");

    // 10. Update document record
    // process-document owns: text_extracted + ocr_complete
    // classify-document will later advance pipeline_stage to document_classified
    await supabase
      .from("case_documents")
      .update({
        intake_status: "text_extracted",
        document_status: "extracted",
        pipeline_stage: "ocr_complete",
        extracted_text: fullText || null,
        extracted_at: new Date().toISOString(),
        page_count: pages.length || doc.page_count,
      })
      .eq("id", doc.id);

    // 11. Mark job completed
    await supabase
      .from("intake_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          extraction_method: extractionMethod,
          pages_extracted: pages.length,
          total_characters: fullText.length,
        },
      })
      .eq("id", job_id);

    // 12. Auto-enqueue chunking step (replaces raw document_parsing job)
    await supabase.from("intake_jobs").insert({
      tenant_id: doc.tenant_id,
      case_id: doc.case_id,
      document_id: doc.id,
      job_type: "document_chunking",
      status: "queued",
    });

    // 12b. Auto-trigger chunk-document to segment text by document type
    try {
      console.log("[process-document] Triggering chunk-document for", doc.id);
      const chunkUrl = `${supabaseUrl}/functions/v1/chunk-document`;
      const chunkResp = await fetch(chunkUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
      if (!chunkResp.ok) {
        const errText = await chunkResp.text();
        console.error("[process-document] Auto-chunking failed:", chunkResp.status, errText);
        await supabase.from("intake_jobs").insert({
          tenant_id: doc.tenant_id,
          case_id: doc.case_id,
          document_id: doc.id,
          job_type: "document_chunking",
          status: "failed",
          error_message: `Auto-chunking failed [${chunkResp.status}]: ${errText.substring(0, 500)}`,
        });
      } else {
        const chunkResult = await chunkResp.json();
        console.log("[process-document] Chunking completed:", chunkResult?.chunks_created ?? 0, "chunks");
        // Mark chunking job as completed
        await supabase
          .from("intake_jobs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("document_id", doc.id)
          .eq("job_type", "document_chunking")
          .eq("status", "queued");
      }
    } catch (chunkErr) {
      const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
      console.error("[process-document] Auto-chunking error:", errMsg);
      await supabase.from("intake_jobs").insert({
        tenant_id: doc.tenant_id,
        case_id: doc.case_id,
        document_id: doc.id,
        job_type: "document_chunking",
        status: "failed",
        error_message: `Auto-chunking exception: ${errMsg}`,
      });
    }

    // 13. Auto-trigger document classification
    // Fire-and-forget but log failures durably to intake_jobs
    try {
      console.log("[process-document] Triggering classify-document for", doc.id);
      const classifyUrl = `${supabaseUrl}/functions/v1/classify-document`;
      const classifyResp = await fetch(classifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
      if (!classifyResp.ok) {
        const errText = await classifyResp.text();
        console.error("[process-document] Auto-classification failed:", classifyResp.status, errText);
        // Record classification failure as a failed intake job for visibility
        await supabase.from("intake_jobs").insert({
          tenant_id: doc.tenant_id,
          case_id: doc.case_id,
          document_id: doc.id,
          job_type: "document_parsing",
          status: "failed",
          error_message: `Auto-classification failed [${classifyResp.status}]: ${errText.substring(0, 500)}`,
        });
      } else {
        const classifyResult = await classifyResp.json();
        // COMPLIANCE: Log only summary, not full payload which may contain PII/PHI snippets
        console.log("[process-document] Classification completed:", classifyResult?.success ? "success" : "unknown");
      }
    } catch (classifyErr) {
      const errMsg = classifyErr instanceof Error ? classifyErr.message : String(classifyErr);
      console.error("[process-document] Auto-classification error:", errMsg);
      // Record the failure durably
      await supabase.from("intake_jobs").insert({
        tenant_id: doc.tenant_id,
        case_id: doc.case_id,
        document_id: doc.id,
        job_type: "document_parsing",
        status: "failed",
        error_message: `Auto-classification exception: ${errMsg}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        extraction_method: extractionMethod,
        pages_extracted: pages.length,
        total_characters: fullText.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Process document error:", errMsg);

    // Try to mark job as failed
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.job_id) {
        const supabase2 = createClient(supabaseUrl!, serviceRoleKey!);

        // Get job to find document_id
        const { data: failedJob } = await supabase2
          .from("intake_jobs")
          .select("document_id, retry_count, max_retries")
          .eq("id", body.job_id)
          .single();

        await supabase2
          .from("intake_jobs")
          .update({
            status: "failed",
            error_message: errMsg,
            completed_at: new Date().toISOString(),
            retry_count: (failedJob?.retry_count ?? 0) + 1,
          })
          .eq("id", body.job_id);

        if (failedJob?.document_id) {
          await supabase2
            .from("case_documents")
            .update({ intake_status: "failed" })
            .eq("id", failedJob.document_id);
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
