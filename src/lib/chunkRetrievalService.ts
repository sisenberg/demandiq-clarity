/**
 * Unified chunk retrieval service supporting lexical, metadata, and semantic modes.
 * Logs all retrieval operations to retrieval_events for auditability.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ChunkLabel,
  RetrievalMode,
  RetrievalQuery,
  RetrievalResult,
} from "@/types/chunk-retrieval";

// ── Lexical Search ─────────────────────────────────────────

async function searchLexical(
  caseId: string,
  query: string,
  filters: Omit<RetrievalQuery, "query" | "mode">,
  tenantId: string
): Promise<RetrievalResult[]> {
  // Build base query on document_chunks
  let q = (supabase.from("document_chunks") as any)
    .select("id, document_id, chunk_text, chunk_type, chunk_index, page_start, page_end")
    .eq("case_id", caseId)
    .ilike("chunk_text", `%${query}%`)
    .order("chunk_index", { ascending: true })
    .limit(filters.limit ?? 50);

  if (filters.documentIds?.length) {
    q = q.in("document_id", filters.documentIds);
  }
  if (filters.pageRange) {
    q = q.gte("page_start", filters.pageRange.start).lte("page_end", filters.pageRange.end);
  }
  if (filters.chunkTypes?.length) {
    q = q.in("chunk_type", filters.chunkTypes);
  }

  const { data, error } = await q;
  if (error) throw error;

  let results: RetrievalResult[] = (data ?? []).map((c: any, i: number) => ({
    chunk_id: c.id,
    document_id: c.document_id,
    chunk_text: c.chunk_text,
    chunk_type: c.chunk_type,
    chunk_index: c.chunk_index,
    page_start: c.page_start,
    page_end: c.page_end,
    score: 1 - i * 0.01, // simple positional scoring
    labels: [] as ChunkLabel[],
  }));

  // Filter by labels if specified
  if (filters.labels?.length && results.length > 0) {
    const chunkIds = results.map((r) => r.chunk_id);
    const { data: labelData } = await (supabase.from("chunk_labels") as any)
      .select("chunk_id, label")
      .in("chunk_id", chunkIds)
      .in("label", filters.labels);

    const labelMap = new Map<string, Set<string>>();
    for (const row of labelData ?? []) {
      if (!labelMap.has(row.chunk_id)) labelMap.set(row.chunk_id, new Set());
      labelMap.get(row.chunk_id)!.add(row.label);
    }

    // Only keep chunks that have at least one requested label
    results = results.filter((r) => labelMap.has(r.chunk_id));
    results.forEach((r) => {
      r.labels = Array.from(labelMap.get(r.chunk_id) ?? []) as ChunkLabel[];
    });
  } else if (results.length > 0) {
    // Attach labels for display even when not filtering
    await attachLabels(results);
  }

  return results;
}

// ── Metadata Search ────────────────────────────────────────

async function searchMetadata(
  caseId: string,
  filters: Omit<RetrievalQuery, "query" | "mode">,
  tenantId: string
): Promise<RetrievalResult[]> {
  // Start from chunk_labels if labels specified, otherwise from chunks
  if (filters.labels?.length) {
    let q = (supabase.from("chunk_labels") as any)
      .select("chunk_id, label")
      .eq("case_id", caseId)
      .in("label", filters.labels);

    if (filters.documentIds?.length) {
      q = q.in("document_id", filters.documentIds);
    }

    const { data: labelData, error: labelErr } = await q;
    if (labelErr) throw labelErr;
    if (!labelData?.length) return [];

    const chunkIds = [...new Set((labelData as any[]).map((l: any) => l.chunk_id))];
    const labelMap = new Map<string, ChunkLabel[]>();
    for (const row of labelData as any[]) {
      if (!labelMap.has(row.chunk_id)) labelMap.set(row.chunk_id, []);
      labelMap.get(row.chunk_id)!.push(row.label);
    }

    let cq = (supabase.from("document_chunks") as any)
      .select("id, document_id, chunk_text, chunk_type, chunk_index, page_start, page_end")
      .in("id", chunkIds.slice(0, 100))
      .order("chunk_index", { ascending: true })
      .limit(filters.limit ?? 50);

    if (filters.pageRange) {
      cq = cq.gte("page_start", filters.pageRange.start).lte("page_end", filters.pageRange.end);
    }

    const { data: chunks, error: chunkErr } = await cq;
    if (chunkErr) throw chunkErr;

    return (chunks ?? []).map((c: any) => ({
      chunk_id: c.id,
      document_id: c.document_id,
      chunk_text: c.chunk_text,
      chunk_type: c.chunk_type,
      chunk_index: c.chunk_index,
      page_start: c.page_start,
      page_end: c.page_end,
      score: 1,
      labels: labelMap.get(c.id) ?? [],
    }));
  }

  // No labels filter — just query chunks with metadata filters
  let q = (supabase.from("document_chunks") as any)
    .select("id, document_id, chunk_text, chunk_type, chunk_index, page_start, page_end")
    .eq("case_id", caseId)
    .order("chunk_index", { ascending: true })
    .limit(filters.limit ?? 50);

  if (filters.documentIds?.length) q = q.in("document_id", filters.documentIds);
  if (filters.pageRange) {
    q = q.gte("page_start", filters.pageRange.start).lte("page_end", filters.pageRange.end);
  }
  if (filters.chunkTypes?.length) q = q.in("chunk_type", filters.chunkTypes);

  const { data, error } = await q;
  if (error) throw error;

  const results: RetrievalResult[] = (data ?? []).map((c: any) => ({
    chunk_id: c.id,
    document_id: c.document_id,
    chunk_text: c.chunk_text,
    chunk_type: c.chunk_type,
    chunk_index: c.chunk_index,
    page_start: c.page_start,
    page_end: c.page_end,
    score: 1,
    labels: [] as ChunkLabel[],
  }));

  if (results.length > 0) await attachLabels(results);
  return results;
}

// ── Semantic Search ────────────────────────────────────────

async function searchSemantic(
  caseId: string,
  query: string,
  filters: Omit<RetrievalQuery, "query" | "mode">,
  tenantId: string
): Promise<RetrievalResult[]> {
  // First get lexical candidates
  const candidates = await searchLexical(caseId, query, { ...filters, limit: 30 }, tenantId);
  if (candidates.length === 0) return [];

  // Re-rank via AI edge function
  try {
    const { data, error } = await supabase.functions.invoke("search-chunks", {
      body: {
        case_id: caseId,
        query,
        candidate_chunk_ids: candidates.map((c) => c.chunk_id),
        top_k: filters.limit ?? 10,
      },
    });

    if (error || !data?.ranked_chunks) {
      console.warn("[retrieval] Semantic re-ranking failed, falling back to lexical", error);
      return candidates.slice(0, filters.limit ?? 10);
    }

    // Map re-ranked results back with AI scores
    const ranked: RetrievalResult[] = [];
    for (const item of data.ranked_chunks) {
      const candidate = candidates.find((c) => c.chunk_id === item.chunk_id);
      if (candidate) {
        ranked.push({ ...candidate, score: item.relevance_score ?? 0.5 });
      }
    }
    return ranked;
  } catch (e) {
    console.warn("[retrieval] Semantic search error, falling back to lexical", e);
    return candidates.slice(0, filters.limit ?? 10);
  }
}

// ── Helpers ────────────────────────────────────────────────

async function attachLabels(results: RetrievalResult[]): Promise<void> {
  const chunkIds = results.map((r) => r.chunk_id);
  const { data: labelData } = await (supabase.from("chunk_labels") as any)
    .select("chunk_id, label")
    .in("chunk_id", chunkIds);

  const labelMap = new Map<string, ChunkLabel[]>();
  for (const row of (labelData ?? []) as any[]) {
    if (!labelMap.has(row.chunk_id)) labelMap.set(row.chunk_id, []);
    labelMap.get(row.chunk_id)!.push(row.label);
  }

  results.forEach((r) => {
    r.labels = labelMap.get(r.chunk_id) ?? [];
  });
}

// ── Event Logging ──────────────────────────────────────────

async function logRetrievalEvent(
  caseId: string,
  tenantId: string,
  query: RetrievalQuery,
  results: RetrievalResult[],
  latencyMs: number
): Promise<void> {
  try {
    await (supabase.from("retrieval_events") as any).insert({
      tenant_id: tenantId,
      case_id: caseId,
      query_text: query.query ?? "",
      retrieval_mode: query.mode,
      filters: {
        labels: query.labels ?? [],
        documentIds: query.documentIds ?? [],
        pageRange: query.pageRange ?? null,
        chunkTypes: query.chunkTypes ?? [],
      },
      result_chunk_ids: results.map((r) => r.chunk_id),
      result_count: results.length,
      triggered_by: query.triggeredBy ?? "system",
      module: query.module ?? null,
      latency_ms: latencyMs,
    });
  } catch (e) {
    console.warn("[retrieval] Failed to log retrieval event:", e);
  }
}

// ── Unified Entry Point ────────────────────────────────────

/**
 * Retrieve chunks for a case. Dispatches to the appropriate mode,
 * logs the retrieval event, and returns results with attached labels.
 */
export async function retrieveChunks(
  caseId: string,
  tenantId: string,
  query: RetrievalQuery
): Promise<RetrievalResult[]> {
  const start = performance.now();

  let results: RetrievalResult[];
  const { mode, query: queryText, ...filters } = query;

  switch (mode) {
    case "lexical":
      if (!queryText) throw new Error("Lexical search requires a query string");
      results = await searchLexical(caseId, queryText, filters, tenantId);
      break;
    case "metadata":
      results = await searchMetadata(caseId, filters, tenantId);
      break;
    case "semantic":
      if (!queryText) throw new Error("Semantic search requires a query string");
      results = await searchSemantic(caseId, queryText, filters, tenantId);
      break;
    default:
      throw new Error(`Unknown retrieval mode: ${mode}`);
  }

  const latencyMs = Math.round(performance.now() - start);
  await logRetrievalEvent(caseId, tenantId, query, results, latencyMs);

  return results;
}
