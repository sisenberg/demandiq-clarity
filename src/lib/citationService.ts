/**
 * Citation Service — CRUD and resolution for evidence anchors.
 *
 * All downstream modules use this service to create, query, and resolve
 * evidence citations back to source material.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  EvidenceAnchorRow,
  ResolvedCitation,
  CreateEvidenceAnchorParams,
  AnchorEntityType,
  BoundingBox,
} from "@/types/evidence-anchor";
import type { CitationSource } from "@/components/case/EvidenceCitation";

// ── Create ─────────────────────────────────────────────────

export async function createEvidenceAnchor(
  tenantId: string,
  userId: string,
  params: CreateEvidenceAnchorParams
): Promise<EvidenceAnchorRow> {
  const { data, error } = await (supabase.from("evidence_references") as any)
    .insert({
      tenant_id: tenantId,
      case_id: params.caseId,
      document_id: params.documentId,
      page_number: params.pageNumber,
      quoted_text: params.quotedText,
      evidence_type: params.evidenceType,
      character_start: params.characterStart ?? null,
      character_end: params.characterEnd ?? null,
      chunk_id: params.chunkId ?? null,
      parse_version: params.parseVersion ?? null,
      processing_run_id: params.processingRunId ?? null,
      bounding_box: params.boundingBox ?? null,
      anchor_entity_type: params.anchorEntityType ?? null,
      anchor_entity_id: params.anchorEntityId ?? null,
      anchor_module: params.anchorModule ?? null,
      confidence: params.confidence ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EvidenceAnchorRow;
}

// ── Query ──────────────────────────────────────────────────

export async function fetchAnchorsForEntity(
  entityType: AnchorEntityType,
  entityId: string
): Promise<EvidenceAnchorRow[]> {
  const { data, error } = await (supabase.from("evidence_references") as any)
    .select("*")
    .eq("anchor_entity_type", entityType)
    .eq("anchor_entity_id", entityId)
    .order("page_number");

  if (error) throw error;
  return (data ?? []) as EvidenceAnchorRow[];
}

export async function fetchAnchorsForCase(
  caseId: string
): Promise<EvidenceAnchorRow[]> {
  const { data, error } = await (supabase.from("evidence_references") as any)
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as EvidenceAnchorRow[];
}

// ── Resolution ─────────────────────────────────────────────

/**
 * Resolve an anchor to a full citation with page text, document metadata,
 * and chunk context for UI display.
 */
export async function resolveAnchor(
  anchor: EvidenceAnchorRow
): Promise<ResolvedCitation> {
  // Fetch document metadata
  const { data: doc } = await supabase
    .from("case_documents")
    .select("file_name, document_type")
    .eq("id", anchor.document_id)
    .single();

  // Fetch parsed page text (prefer parsed_document_pages)
  let pageText: string | null = null;
  let provider: string | null = null;
  let resolvedParseVersion: number | null = anchor.parse_version;

  const parsedQuery = (supabase.from("parsed_document_pages") as any)
    .select("page_text, provider, parse_version")
    .eq("document_id", anchor.document_id)
    .eq("page_number", anchor.page_number);

  if (anchor.parse_version != null) {
    const { data: parsed } = await parsedQuery
      .eq("parse_version", anchor.parse_version)
      .single();
    if (parsed) {
      pageText = parsed.page_text;
      provider = parsed.provider;
      resolvedParseVersion = parsed.parse_version;
    }
  } else {
    // Fall back to current version
    const { data: parsed } = await parsedQuery
      .eq("is_current", true)
      .single();
    if (parsed) {
      pageText = parsed.page_text;
      provider = parsed.provider;
      resolvedParseVersion = parsed.parse_version;
    }
  }

  // If no parsed page, fall back to document_pages
  if (!pageText) {
    const { data: rawPage } = await supabase
      .from("document_pages")
      .select("extracted_text")
      .eq("document_id", anchor.document_id)
      .eq("page_number", anchor.page_number)
      .single();
    if (rawPage) {
      pageText = rawPage.extracted_text;
    }
  }

  // Fetch chunk text if linked
  let chunkText: string | null = null;
  if (anchor.chunk_id) {
    const { data: chunk } = await (supabase.from("document_chunks") as any)
      .select("chunk_text")
      .eq("id", anchor.chunk_id)
      .single();
    if (chunk) chunkText = chunk.chunk_text;
  }

  return {
    anchor,
    fileName: doc?.file_name ?? `Doc:${anchor.document_id.slice(0, 8)}`,
    documentType: doc?.document_type ?? "unknown",
    pageText,
    parseVersion: resolvedParseVersion,
    chunkText,
    provider,
  };
}

// ── Batch resolution ───────────────────────────────────────

export async function resolveAnchorsForEntity(
  entityType: AnchorEntityType,
  entityId: string
): Promise<ResolvedCitation[]> {
  const anchors = await fetchAnchorsForEntity(entityType, entityId);
  return Promise.all(anchors.map(resolveAnchor));
}

// ── Conversion helpers ─────────────────────────────────────

/** Convert a DB anchor row to the UI CitationSource format */
export function anchorToCitationSource(
  anchor: EvidenceAnchorRow,
  fileName: string
): CitationSource {
  return {
    docName: fileName,
    page: `pg. ${anchor.page_number}`,
    excerpt: anchor.quoted_text || undefined,
    relevance: (anchor.evidence_type as CitationSource["relevance"]) ?? "direct",
    documentId: anchor.document_id,
    anchorId: anchor.id,
    parseVersion: anchor.parse_version ?? undefined,
    chunkId: anchor.chunk_id ?? undefined,
  };
}

/** Convert a ResolvedCitation to the UI CitationSource format */
export function resolvedToCitationSource(
  resolved: ResolvedCitation
): CitationSource {
  return anchorToCitationSource(resolved.anchor, resolved.fileName);
}
