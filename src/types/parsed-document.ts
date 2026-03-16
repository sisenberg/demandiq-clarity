/**
 * Canonical parsed-document representation types.
 *
 * Every successfully processed document produces page-level normalized output
 * stored in `parsed_document_pages`. Downstream modules (chunking, extraction,
 * citations, retrieval) consume this format instead of raw provider text.
 */

// ── Content Block Types ────────────────────────────────────

export type ContentBlockType =
  | "heading"
  | "paragraph"
  | "table"
  | "list"
  | "image_ref";

export interface ContentBlockBase {
  block_index: number;
  block_type: ContentBlockType;
  text: string;
  char_start: number;
  char_end: number;
}

export interface HeadingBlock extends ContentBlockBase {
  block_type: "heading";
  level: number; // 1–6
}

export interface ParagraphBlock extends ContentBlockBase {
  block_type: "paragraph";
}

export interface TableBlock extends ContentBlockBase {
  block_type: "table";
  rows: number;
  cols: number;
}

export interface ListBlock extends ContentBlockBase {
  block_type: "list";
  ordered: boolean;
  items: number;
}

export interface ImageRefBlock extends ContentBlockBase {
  block_type: "image_ref";
  storage_path?: string;
}

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | ListBlock
  | ImageRefBlock;

// ── Heading / Table / List summary objects ──────────────────

export interface HeadingSummary {
  text: string;
  level: number;
  block_index: number;
  char_start: number;
  char_end: number;
}

export interface TableRegionSummary {
  block_index: number;
  rows: number;
  cols: number;
  char_start: number;
  char_end: number;
  preview: string; // first ~120 chars
}

export interface ListRegionSummary {
  block_index: number;
  ordered: boolean;
  items: number;
  char_start: number;
  char_end: number;
}

export interface ImageArtifact {
  block_index: number;
  storage_path?: string;
  description?: string;
}

// ── Row type matching parsed_document_pages table ──────────

export interface ParsedDocumentPageRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  parse_version: number;
  page_number: number;
  page_text: string;
  content_blocks: ContentBlock[];
  headings: HeadingSummary[];
  table_regions: TableRegionSummary[];
  list_regions: ListRegionSummary[];
  image_artifacts: ImageArtifact[];
  provider: string;
  provider_model: string | null;
  provider_run_metadata: Record<string, unknown>;
  confidence_score: number | null;
  is_current: boolean;
  processing_run_id: string | null;
  created_at: string;
}

// ── Parse version summary (for version picker UI) ──────────

export interface ParseVersionSummary {
  parse_version: number;
  provider: string;
  provider_model: string | null;
  page_count: number;
  created_at: string;
  is_current: boolean;
}
