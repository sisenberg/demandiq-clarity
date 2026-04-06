import { useCasePackage } from "@/hooks/useCasePackage";
import { useIntakeEvaluationPackage } from "@/hooks/useIntakeEvaluationPackage";
import { useIntakeValidation } from "@/hooks/useIntakeValidation";
import { useIntakeWorkflow } from "@/hooks/useIntakeWorkflow";
import { getBillingSummary, getTreatmentStats } from "@/data/mock/casePackage";
import CaseEmptyUploadCTA from "./CaseEmptyUploadCTA";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { isDocumentReady } from "@/lib/statuses";
import type { TimelineEvent } from "@/types";

import ClaimHeader from "./overview/ClaimHeader";
import ClaimSummarySection from "./overview/ClaimSummarySection";
import FindingsByBodySystemSection from "./overview/FindingsByBodySystemSection";
import ChronologyRail from "./overview/ChronologyRail";
import { BillingSummaryCard, DocumentsCard, ReviewFlagsCard } from "./overview/LowerSummaryCards";
import ProcessingAccordion from "./overview/ProcessingAccordion";

interface CaseOverviewProps {
  caseData: CaseRow;
  documents: DocumentRow[];
  onNavigate?: (section: string) => void;
}

const CaseOverview = ({ caseData, documents, onNavigate }: CaseOverviewProps) => {
  const { pkg, hasData } = useCasePackage();
  const { data: intakePkg } = useIntakeEvaluationPackage(caseData.id);
  const { validation } = useIntakeValidation(caseData.id);
  const workflow = useIntakeWorkflow(caseData.id, documents);

  const billing = hasData ? getBillingSummary(pkg) : { totalBilled: 0, totalAdjusted: 0, totalPaid: 0 };
  const stats = hasData ? getTreatmentStats(pkg) : { providers: 0, totalVisits: 0, ptSessions: 0, injections: 0 };
  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;

  const specials = intakePkg?.specials_summary as any;
  const totalBilled = hasData ? billing.totalBilled : (specials?.total_billed ?? 0);
  const billCount = specials?.bill_count ?? 0;
  const providerCount = hasData ? stats.providers : (specials?.provider_count ?? intakePkg?.provider_list?.length ?? 0);
  const treatmentSummary = intakePkg?.treatment_summary as any;
  const treatmentCount = hasData ? stats.totalVisits : (treatmentSummary?.treatment_count ?? 0);
  const representedStatus = intakePkg?.represented_status ?? "";
  const claimantName = intakePkg?.claimant_name ?? caseData.claimant;

  const injuries: any[] = hasData
    ? pkg.injuries
    : (intakePkg?.injury_summary ?? []).map((inj: any, i: number) => ({
        id: inj.id ?? `inj-${i}`,
        body_part: inj.body_part ?? inj.label ?? "Unknown",
        body_region: inj.body_region ?? "",
        diagnosis_code: inj.diagnosis_code ?? inj.icd10 ?? "",
        diagnosis_description: inj.diagnosis_description ?? inj.description ?? "",
        severity: inj.severity ?? "moderate",
        is_pre_existing: inj.is_pre_existing ?? false,
        evidence_refs: inj.evidence_refs ?? [],
        first_date: inj.first_date ?? null,
        last_date: inj.last_date ?? null,
        provider: inj.provider ?? null,
      }));

  const timelineEvents: TimelineEvent[] = hasData ? pkg.timeline_events : [];
  const issueFlags = hasData ? pkg.issue_flags : [];

  if (documents.length === 0) {
    return <CaseEmptyUploadCTA caseId={caseData.id} />;
  }

  return (
    <div className="flex gap-8">
      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 min-w-0 flex flex-col gap-8">
        {/* Page header */}
        <ClaimHeader
          claimantName={claimantName}
          claimNumber={caseData.claim_number}
          doi={caseData.date_of_loss}
          onNavigate={onNavigate}
        />

        {/* Divider */}
        <hr className="border-border/40" />

        {/* Patient Summary */}
        <ClaimSummarySection
          caseData={caseData}
          claimantName={claimantName}
          injuries={injuries}
          totalBilled={totalBilled}
          providerCount={providerCount}
          treatmentCount={treatmentCount}
          representedStatus={representedStatus}
          hasData={hasData}
          pkg={pkg}
        />

        {/* Divider */}
        <hr className="border-border/40" />

        {/* Findings by Body System */}
        <FindingsByBodySystemSection injuries={injuries} />

        {/* Divider */}
        <hr className="border-border/40" />

        {/* Lower summary row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BillingSummaryCard
            totalBilled={totalBilled}
            totalAdjusted={hasData ? billing.totalAdjusted : 0}
            totalPaid={hasData ? billing.totalPaid : 0}
            billCount={billCount}
            providerCount={providerCount}
          />
          <DocumentsCard documents={documents} />
          <ReviewFlagsCard
            validation={validation}
            issueFlags={issueFlags}
            hasData={hasData}
          />
        </div>

        {/* Processing Details (collapsed) */}
        <ProcessingAccordion
          workflow={workflow}
          documents={documents}
          intakePkg={intakePkg}
        />
      </div>

      {/* ═══ RIGHT CHRONOLOGY RAIL ═══ */}
      <div className="hidden xl:block w-56 shrink-0">
        <ChronologyRail events={timelineEvents} hasData={hasData} />
      </div>
    </div>
  );
};

export default CaseOverview;
