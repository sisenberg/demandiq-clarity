import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedDocumentPageRow, ParseVersionSummary } from "@/types/parsed-document";
import { toast } from "sonner";

/**
 * Fetch canonical parsed pages for a document.
 * Defaults to the current (latest) version; pass parseVersion to pin.
 */
export function useParsedDocumentPages(
  documentId: string | undefined,
  parseVersion?: number
) {
  return useQuery({
    queryKey: ["parsed-document-pages", documentId, parseVersion ?? "current"],
    enabled: !!documentId,
    queryFn: async () => {
      let query = (supabase.from("parsed_document_pages") as any)
        .select("*")
        .eq("document_id", documentId!);

      if (parseVersion != null) {
        query = query.eq("parse_version", parseVersion);
      } else {
        query = query.eq("is_current", true);
      }

      const { data, error } = await query.order("page_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ParsedDocumentPageRow[];
    },
  });
}

/**
 * List available parse versions for a document with summary metadata.
 */
export function useDocumentParseVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["parse-versions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("parsed_document_pages") as any)
        .select("parse_version, provider, provider_model, is_current, created_at")
        .eq("document_id", documentId!)
        .order("parse_version", { ascending: false });

      if (error) throw error;

      // Group by version
      const versionMap = new Map<number, ParseVersionSummary>();
      for (const row of data ?? []) {
        if (!versionMap.has(row.parse_version)) {
          versionMap.set(row.parse_version, {
            parse_version: row.parse_version,
            provider: row.provider,
            provider_model: row.provider_model,
            page_count: 0,
            created_at: row.created_at,
            is_current: row.is_current,
          });
        }
        versionMap.get(row.parse_version)!.page_count += 1;
      }

      return Array.from(versionMap.values());
    },
  });
}

/**
 * Persist normalized pages as a new parse version.
 * Marks previous versions as non-current.
 */
export function usePersistParsedPages() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      tenantId,
      caseId,
      pages,
      provider,
      providerModel,
      providerRunMetadata,
      processingRunId,
    }: {
      documentId: string;
      tenantId: string;
      caseId: string;
      pages: Array<{
        page_number: number;
        page_text: string;
        content_blocks: unknown[];
        headings: unknown[];
        table_regions: unknown[];
        list_regions: unknown[];
        confidence_score: number | null;
      }>;
      provider: string;
      providerModel?: string;
      providerRunMetadata?: Record<string, unknown>;
      processingRunId?: string;
    }) => {
      // 1. Determine next version
      const { data: existing } = await (supabase.from("parsed_document_pages") as any)
        .select("parse_version")
        .eq("document_id", documentId)
        .order("parse_version", { ascending: false })
        .limit(1);

      const nextVersion = ((existing?.[0]?.parse_version as number) ?? 0) + 1;

      // 2. Mark all previous versions as non-current
      await (supabase.from("parsed_document_pages") as any)
        .update({ is_current: false })
        .eq("document_id", documentId)
        .eq("is_current", true);

      // 3. Insert new version pages
      const rows = pages.map((p) => ({
        tenant_id: tenantId,
        case_id: caseId,
        document_id: documentId,
        parse_version: nextVersion,
        page_number: p.page_number,
        page_text: p.page_text,
        content_blocks: p.content_blocks,
        headings: p.headings,
        table_regions: p.table_regions,
        list_regions: p.list_regions,
        image_artifacts: [],
        provider,
        provider_model: providerModel ?? null,
        provider_run_metadata: providerRunMetadata ?? {},
        confidence_score: p.confidence_score,
        is_current: true,
        processing_run_id: processingRunId ?? null,
      }));

      const { error } = await (supabase.from("parsed_document_pages") as any).insert(rows);
      if (error) throw error;

      return { parse_version: nextVersion, page_count: rows.length };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["parsed-document-pages"] });
      qc.invalidateQueries({ queryKey: ["parse-versions"] });
      toast.success(
        `Created parse v${result.parse_version} (${result.page_count} pages)`
      );
    },
    onError: (e) => toast.error(`Failed to persist parsed pages: ${(e as Error).message}`),
  });
}
