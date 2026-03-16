/**
 * Provider-to-canonical transformation layer.
 *
 * Converts raw `document_pages` rows into the canonical
 * `ParsedDocumentPage` format with detected content blocks.
 */

import type {
  ContentBlock,
  HeadingSummary,
  TableRegionSummary,
  ListRegionSummary,
  HeadingBlock,
  ParagraphBlock,
  TableBlock,
  ListBlock,
} from "@/types/parsed-document";

// ── Public API ─────────────────────────────────────────────

export interface RawPageInput {
  page_number: number;
  extracted_text: string | null;
  confidence_score: number | null;
}

export interface NormalizedPageOutput {
  page_number: number;
  page_text: string;
  content_blocks: ContentBlock[];
  headings: HeadingSummary[];
  table_regions: TableRegionSummary[];
  list_regions: ListRegionSummary[];
  confidence_score: number | null;
}

/**
 * Transform an array of raw document_pages rows into canonical
 * normalized output, preserving page order and identity.
 */
export function normalizeProviderOutput(
  rawPages: RawPageInput[]
): NormalizedPageOutput[] {
  return rawPages
    .filter((p) => p.extracted_text && p.extracted_text.trim().length > 0)
    .sort((a, b) => a.page_number - b.page_number)
    .map((page) => {
      const text = page.extracted_text!.trim();
      const blocks = detectContentBlocks(text);
      return {
        page_number: page.page_number,
        page_text: text,
        content_blocks: blocks,
        headings: extractHeadings(blocks),
        table_regions: extractTableRegions(blocks),
        list_regions: extractListRegions(blocks),
        confidence_score: page.confidence_score,
      };
    });
}

// ── Block Detection ────────────────────────────────────────

const HEADING_PATTERNS = [
  /^#{1,6}\s+.+/,                           // Markdown-style
  /^[A-Z][A-Z\s,.\-:]{4,80}$/,              // ALL-CAPS line
  /^\d{1,3}\.\s+[A-Z]/,                     // Numbered section
  /^[IVXLC]+\.\s+/,                         // Roman numeral
  /^(?:Section|Article|Part|Chapter)\s+/i,   // Document heading keywords
];

const TABLE_LINE_PATTERN = /^[|┃┆│].*[|┃┆│]$/;
const TAB_DELIMITED_PATTERN = /\t.*\t/;
const LIST_BULLET_PATTERN = /^[\s]*[-•●○◦▪▸►]\s+/;
const LIST_ORDERED_PATTERN = /^[\s]*(?:\d+[.)]\s+|[a-z][.)]\s+)/i;

/**
 * Detect content blocks in page text by scanning line-by-line.
 * Assigns char_start / char_end offsets relative to page text.
 */
export function detectContentBlocks(pageText: string): ContentBlock[] {
  const lines = pageText.split("\n");
  const blocks: ContentBlock[] = [];
  let charOffset = 0;
  let blockIndex = 0;

  let bufferLines: string[] = [];
  let bufferStart = 0;
  let currentType: "paragraph" | "table" | "list" | null = null;

  const flushBuffer = () => {
    if (bufferLines.length === 0) return;
    const text = bufferLines.join("\n");
    const charEnd = bufferStart + text.length;

    if (currentType === "table") {
      const rows = bufferLines.length;
      const cols = estimateTableCols(bufferLines);
      blocks.push({
        block_index: blockIndex++,
        block_type: "table",
        text,
        char_start: bufferStart,
        char_end: charEnd,
        rows,
        cols,
      } as TableBlock);
    } else if (currentType === "list") {
      const ordered = LIST_ORDERED_PATTERN.test(bufferLines[0]);
      blocks.push({
        block_index: blockIndex++,
        block_type: "list",
        text,
        char_start: bufferStart,
        char_end: charEnd,
        ordered,
        items: bufferLines.length,
      } as ListBlock);
    } else {
      blocks.push({
        block_index: blockIndex++,
        block_type: "paragraph",
        text,
        char_start: bufferStart,
        char_end: charEnd,
      } as ParagraphBlock);
    }
    bufferLines = [];
    currentType = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = charOffset;
    charOffset += line.length + (i < lines.length - 1 ? 1 : 0); // +1 for \n

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushBuffer();
      continue;
    }

    // Check heading
    if (isHeading(trimmed)) {
      flushBuffer();
      const level = detectHeadingLevel(trimmed);
      blocks.push({
        block_index: blockIndex++,
        block_type: "heading",
        text: trimmed,
        char_start: lineStart,
        char_end: lineStart + line.length,
        level,
      } as HeadingBlock);
      continue;
    }

    // Check table line
    if (isTableLine(line)) {
      if (currentType !== "table") {
        flushBuffer();
        currentType = "table";
        bufferStart = lineStart;
      }
      bufferLines.push(line);
      continue;
    }

    // Check list item
    if (isListItem(line)) {
      if (currentType !== "list") {
        flushBuffer();
        currentType = "list";
        bufferStart = lineStart;
      }
      bufferLines.push(trimmed);
      continue;
    }

    // Default: paragraph
    if (currentType !== "paragraph" && currentType !== null) {
      flushBuffer();
    }
    if (bufferLines.length === 0) {
      bufferStart = lineStart;
      currentType = "paragraph";
    }
    bufferLines.push(line);
  }

  flushBuffer();
  return blocks;
}

// ── Helpers ────────────────────────────────────────────────

function isHeading(trimmed: string): boolean {
  if (trimmed.length > 120) return false;
  return HEADING_PATTERNS.some((p) => p.test(trimmed));
}

function detectHeadingLevel(text: string): number {
  const mdMatch = text.match(/^(#{1,6})\s/);
  if (mdMatch) return mdMatch[1].length;
  if (/^[A-Z][A-Z\s,.\-:]+$/.test(text)) return 1;
  if (/^\d+\.\s/.test(text)) return 2;
  if (/^[IVXLC]+\.\s/.test(text)) return 2;
  return 3;
}

function isTableLine(line: string): boolean {
  return TABLE_LINE_PATTERN.test(line.trim()) || TAB_DELIMITED_PATTERN.test(line);
}

function isListItem(line: string): boolean {
  return LIST_BULLET_PATTERN.test(line) || LIST_ORDERED_PATTERN.test(line);
}

function estimateTableCols(lines: string[]): number {
  if (lines.length === 0) return 0;
  const first = lines[0];
  if (first.includes("|")) return first.split("|").filter(Boolean).length;
  if (first.includes("\t")) return first.split("\t").length;
  return 1;
}

function extractHeadings(blocks: ContentBlock[]): HeadingSummary[] {
  return blocks
    .filter((b): b is HeadingBlock => b.block_type === "heading")
    .map((b) => ({
      text: b.text,
      level: b.level,
      block_index: b.block_index,
      char_start: b.char_start,
      char_end: b.char_end,
    }));
}

function extractTableRegions(blocks: ContentBlock[]): TableRegionSummary[] {
  return blocks
    .filter((b): b is TableBlock => b.block_type === "table")
    .map((b) => ({
      block_index: b.block_index,
      rows: b.rows,
      cols: b.cols,
      char_start: b.char_start,
      char_end: b.char_end,
      preview: b.text.substring(0, 120),
    }));
}

function extractListRegions(blocks: ContentBlock[]): ListRegionSummary[] {
  return blocks
    .filter((b): b is ListBlock => b.block_type === "list")
    .map((b) => ({
      block_index: b.block_index,
      ordered: b.ordered,
      items: b.items,
      char_start: b.char_start,
      char_end: b.char_end,
    }));
}
