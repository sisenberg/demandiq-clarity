import { FileText } from "lucide-react";
import { useSourceDrawer } from "../SourceDrawer";
import { EvidenceStatement, type CitationSource } from "../EvidenceCitation";
import type { CaseRow } from "@/hooks/useCases";
import type { EvidenceReference } from "@/types";

function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ClaimSummarySectionProps {
  caseData: CaseRow;
  claimantName: string;
  injuries: any[];
  totalBilled: number;
  providerCount: number;
  treatmentCount: number;
  representedStatus: string;
  hasData: boolean;
  pkg: any;
}

function generateBullets(
  caseData: CaseRow,
  claimantName: string,
  injuries: any[],
  totalBilled: number,
  providerCount: number,
  treatmentCount: number,
  representedStatus: string,
): string[] {
  const bullets: string[] = [];

  bullets.push(
    `${claimantName} involved in motor vehicle collision on ${formatDate(caseData.date_of_loss)}.`
  );

  if (injuries.length > 0) {
    // Deduplicate injury names for summary
    const uniqueParts = [...new Set(injuries.map((i) => i.body_part?.toLowerCase()).filter(Boolean))];
    const top = uniqueParts.slice(0, 4);
    bullets.push(`${uniqueParts.length} distinct injury regions including ${top.join(", ") || "multiple regions"}.`);
  }

  if (treatmentCount > 0) {
    bullets.push(`${treatmentCount} treatment events across ${providerCount} provider${providerCount !== 1 ? "s" : ""}.`);
  }

  const diagCodes = [...new Set(injuries.filter((i) => i.diagnosis_code).map((i) => i.diagnosis_code))].slice(0, 4);
  if (diagCodes.length > 0) {
    bullets.push(`Key diagnoses: ${diagCodes.join(", ")}.`);
  }

  if (totalBilled > 0) {
    bullets.push(`Total medical specials: $${totalBilled.toLocaleString()}.`);
  }

  if (representedStatus) {
    bullets.push(
      representedStatus === "represented"
        ? "Claimant is represented by counsel."
        : `Claimant status: ${representedStatus}.`
    );
  }

  const preExisting = injuries.filter((i) => i.is_pre_existing);
  if (preExisting.length > 0) {
    bullets.push(`${preExisting.length} possible pre-existing condition${preExisting.length > 1 ? "s" : ""} flagged for review.`);
  }

  return bullets.slice(0, 8);
}

const ClaimSummarySection = ({
  caseData,
  claimantName,
  injuries,
  totalBilled,
  providerCount,
  treatmentCount,
  representedStatus,
  hasData,
  pkg,
}: ClaimSummarySectionProps) => {
  const bullets = generateBullets(caseData, claimantName, injuries, totalBilled, providerCount, treatmentCount, representedStatus);
  const summaryRefs = hasData
    ? pkg.evidence_refs?.filter((r: EvidenceReference) => r.linked_entity_type === "timeline_event").slice(0, 2)
    : [];

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2.5">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Patient Summary</h2>
      </div>
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30 mt-[6px] shrink-0" />
            <span className="text-[12px] text-foreground/75 leading-[1.6]">
              {hasData && summaryRefs.length > 0 && i === 0 ? (
                <EvidenceStatement text={b} citations={refsToCS(summaryRefs)} />
              ) : (
                b
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ClaimSummarySection;
