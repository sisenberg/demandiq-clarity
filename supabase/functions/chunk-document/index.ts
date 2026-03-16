import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Chunk Strategy Types ───────────────────────────────

type ChunkStrategy = "semantic_large" | "table_aware" | "page_section" | "paragraph" | "generic";

interface ChunkResult {
  page_start: number;
  page_end: number;
  chunk_type: string;
  chunk_text: string;
  chunk_index: number;
  content_hash: string;
}

// ─── Document Type → Strategy Mapping ───────────────────

function getChunkStrategy(documentType: string): ChunkStrategy {
  switch (documentType) {
    case "demand_letter":
      return "semantic_large";
    case "medical_bill":
    case "itemized_statement":
    case "billing_record":
      return "table_aware";
    case "medical_record":
    case "imaging_report":
      return "page_section";
    case "narrative_report":
    case "expert_report":
      return "paragraph";
    default:
      return "generic";
  }
}

// ─── Document Type → Extraction Pass Routing ────────────

function getExtractionPasses(documentType: string): string[] {
  switch (documentType) {
    case "demand_letter":
      return ["demand_extraction", "injury_extraction"];
    case "medical_bill":
    case "itemized_statement":
    case "billing_record":
      return ["specials_extraction"];
    case "medical_record":
      return ["treatment_extraction", "injury_extraction"];
    case "imaging_report":
      return ["injury_extraction", "treatment_extraction"];
    case "narrative_report":
    case "expert_report":
      return ["injury_extraction", "treatment_extraction"];
    default:
      return ["demand_extraction"];
  }
}

// ─── Simple SHA-256 hash ────────────────────────────────

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Chunking Strategies ────────────────────────────────

function chunkSemanticLarge(
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  // Demand letters: combine into large semantic blocks (3-5 pages per chunk)
  const PAGES_PER_CHUNK = 4;
  const chunks: Omit<ChunkResult, "content_hash">[] = [];

  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    const batch = pages.slice(i, i + PAGES_PER_CHUNK);
    chunks.push({
      page_start: batch[0].page_number,
      page_end: batch[batch.length - 1].page_number,
      chunk_type: "semantic_large",
      chunk_text: batch.map((p) => p.text).join("\n\n"),
      chunk_index: chunks.length,
    });
  }

  return chunks;
}

function chunkTableAware(
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  // Medical bills: each page likely contains table data — keep pages separate
  // but merge very short pages (< 200 chars) with the previous chunk
  const chunks: Omit<ChunkResult, "content_hash">[] = [];
  let buffer = "";
  let startPage = pages[0]?.page_number ?? 1;
  let endPage = startPage;

  for (const page of pages) {
    if (buffer && page.text.length > 200) {
      // Flush buffer as its own chunk
      chunks.push({
        page_start: startPage,
        page_end: endPage,
        chunk_type: "table_aware",
        chunk_text: buffer,
        chunk_index: chunks.length,
      });
      buffer = page.text;
      startPage = page.page_number;
      endPage = page.page_number;
    } else {
      buffer += (buffer ? "\n\n" : "") + page.text;
      endPage = page.page_number;
      if (!buffer) startPage = page.page_number;
    }
  }

  if (buffer) {
    chunks.push({
      page_start: startPage,
      page_end: endPage,
      chunk_type: "table_aware",
      chunk_text: buffer,
      chunk_index: chunks.length,
    });
  }

  return chunks;
}

function chunkPageSection(
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  // Medical records: one chunk per page to preserve visit boundaries
  return pages.map((p, i) => ({
    page_start: p.page_number,
    page_end: p.page_number,
    chunk_type: "page_section",
    chunk_text: p.text,
    chunk_index: i,
  }));
}

function chunkParagraph(
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  // Narrative reports: split by paragraphs, group into ~2000 char chunks
  const TARGET_SIZE = 2000;
  const chunks: Omit<ChunkResult, "content_hash">[] = [];

  for (const page of pages) {
    const paragraphs = page.text.split(/\n{2,}/);
    let buffer = "";

    for (const para of paragraphs) {
      if (buffer.length + para.length > TARGET_SIZE && buffer) {
        chunks.push({
          page_start: page.page_number,
          page_end: page.page_number,
          chunk_type: "paragraph",
          chunk_text: buffer.trim(),
          chunk_index: chunks.length,
        });
        buffer = para;
      } else {
        buffer += (buffer ? "\n\n" : "") + para;
      }
    }

    if (buffer.trim()) {
      chunks.push({
        page_start: page.page_number,
        page_end: page.page_number,
        chunk_type: "paragraph",
        chunk_text: buffer.trim(),
        chunk_index: chunks.length,
      });
    }
  }

  return chunks;
}

function chunkGeneric(
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  // Generic: 2 pages per chunk
  const PAGES_PER_CHUNK = 2;
  const chunks: Omit<ChunkResult, "content_hash">[] = [];

  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) {
    const batch = pages.slice(i, i + PAGES_PER_CHUNK);
    chunks.push({
      page_start: batch[0].page_number,
      page_end: batch[batch.length - 1].page_number,
      chunk_type: "generic",
      chunk_text: batch.map((p) => p.text).join("\n\n"),
      chunk_index: chunks.length,
    });
  }

  return chunks;
}

// ─── Dispatcher ─────────────────────────────────────────

function applyChunkStrategy(
  strategy: ChunkStrategy,
  pages: { page_number: number; text: string }[]
): Omit<ChunkResult, "content_hash">[] {
  switch (strategy) {
    case "semantic_large":
      return chunkSemanticLarge(pages);
    case "table_aware":
      return chunkTableAware(pages);
    case "page_section":
      return chunkPageSection(pages);
    case "paragraph":
      return chunkParagraph(pages);
    case "generic":
    default:
      return chunkGeneric(pages);
  }
}

// ─── Main Handler ───────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch document metadata
    const { data: doc, error: docErr } = await supabase
      .from("case_documents")
      .select("id, tenant_id, case_id, document_type, file_name")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: `Document not found: ${docErr?.message}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch extracted pages
    const { data: pages, error: pageErr } = await supabase
      .from("document_pages")
      .select("page_number, extracted_text")
      .eq("document_id", document_id)
      .order("page_number", { ascending: true });

    if (pageErr) throw pageErr;

    const validPages = (pages ?? [])
      .filter((p: any) => p.extracted_text && p.extracted_text.trim().length > 0)
      .map((p: any) => ({ page_number: p.page_number, text: p.extracted_text }));

    if (validPages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No extracted text available for chunking" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Determine strategy
    const strategy = getChunkStrategy(doc.document_type);
    const extractionPasses = getExtractionPasses(doc.document_type);

    // 4. Apply chunking strategy
    const rawChunks = applyChunkStrategy(strategy, validPages);

    // 5. Compute content hashes and filter empty chunks
    const chunks: ChunkResult[] = [];
    for (const rc of rawChunks) {
      if (!rc.chunk_text.trim()) continue;
      const hash = await hashText(rc.chunk_text);
      chunks.push({ ...rc, content_hash: hash });
    }

    // 6. Delete existing chunks for this document (idempotent re-run)
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", document_id);

    // 7. Insert chunks with dedup via content_hash unique index
    const chunkRecords = chunks.map((c) => ({
      tenant_id: doc.tenant_id,
      case_id: doc.case_id,
      document_id: document_id,
      page_start: c.page_start,
      page_end: c.page_end,
      chunk_type: c.chunk_type,
      chunk_text: c.chunk_text,
      chunk_index: c.chunk_index,
      content_hash: c.content_hash,
      extraction_pass: extractionPasses[0] ?? null,
      extraction_status: "pending",
    }));

    if (chunkRecords.length > 0) {
      const { error: insertErr } = await supabase
        .from("document_chunks")
        .insert(chunkRecords);
      if (insertErr) throw insertErr;
    }

    // 8. Create intake jobs for each extraction pass
    const jobsCreated: string[] = [];
    for (const pass of extractionPasses) {
      // Check if a job for this pass already exists and is not failed
      const { data: existingJob } = await supabase
        .from("intake_jobs")
        .select("id, status")
        .eq("document_id", document_id)
        .eq("job_type", pass)
        .in("status", ["queued", "running", "completed"])
        .maybeSingle();

      if (!existingJob) {
        const { error: jobErr } = await supabase.from("intake_jobs").insert({
          tenant_id: doc.tenant_id,
          case_id: doc.case_id,
          document_id: document_id,
          job_type: pass,
          status: "queued",
          metadata: {
            chunk_strategy: strategy,
            chunk_count: chunks.length,
            extraction_version: 1,
          },
        });
        if (!jobErr) jobsCreated.push(pass);
      }
    }

    // 9. Update document pipeline stage
    await supabase
      .from("case_documents")
      .update({ pipeline_stage: "chunked" })
      .eq("id", document_id);

    console.log(
      `[chunk-document] ${doc.document_type} → ${strategy}: ${chunks.length} chunks, passes: [${extractionPasses.join(", ")}]`
    );

    return new Response(
      JSON.stringify({
        success: true,
        document_type: doc.document_type,
        chunk_strategy: strategy,
        chunks_created: chunks.length,
        extraction_passes: extractionPasses,
        jobs_created: jobsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[chunk-document] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
