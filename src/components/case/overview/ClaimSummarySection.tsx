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
    const top = injuries.slice(0, 3).map((i) => i.body_part?.toLowerCase()).filter(Boolean);
    bullets.push(`${injuries.length} documented injuries including ${top.join(", ") || "multiple regions"}.`);
  }

  if (treatmentCount > 0) {
    bullets.push(`${treatmentCount} treatment events across ${providerCount} provider${providerCount !== 1 ? "s" : ""}.`);
  }

  const diagCodes = injuries.filter((i) => i.diagnosis_code).slice(0, 3).map((i) => i.diagnosis_code);
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
    bullets.push(`${preExisting.length} possible pre-existing condition${preExisting.length > 1 ? "s" : ""} flagged.`);
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
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Patient Summary</h2>
      </div>
      <ul className="space-y-2 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 mt-[7px] shrink-0" />
            <span className="text-[13px] text-foreground/80 leading-relaxed">
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
