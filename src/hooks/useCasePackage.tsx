import React, { createContext, useContext, type ReactNode } from "react";
import type { CasePackage, DemandIQOutput } from "@/types";
import { MARTINEZ_CASE_PACKAGE, getDemandIQOutput } from "@/data/mock/casePackage";
import { ReviewStatus } from "@/types";

/** Known demo case IDs that should render mock data */
const DEMO_CASE_IDS = new Set(["case-001"]);

interface CasePackageContextValue {
  pkg: CasePackage;
  demandIQ: DemandIQOutput;
  /** True when the package contains real or demo data; false for empty real cases */
  hasData: boolean;
}

const EMPTY_DEMAND_SUMMARY = {
  demand_amount: 0,
  medical_specials: 0,
  lost_wages: 0,
  future_medical: 0,
  general_damages: 0,
  policy_limits: null,
  demand_date: null,
  response_deadline: null,
  status: "preparing" as const,
  carrier_response_amount: null,
  notes: "",
};

const EMPTY_PACKAGE: CasePackage = {
  contract_version: "1.0",
  case_record: {} as any,
  parties: [],
  documents: [],
  source_pages: [],
  evidence_refs: [],
  timeline_events: [],
  injuries: [],
  providers: [],
  treatments: [],
  billing_lines: [],
  insurance_policies: [],
  liability_facts: [],
  issue_flags: [],
  demand_summary: EMPTY_DEMAND_SUMMARY,
  modules: {},
  module_runs: [],
  module_outputs: [],
};

const EMPTY_DEMAND_IQ: DemandIQOutput = {
  claim_assessment: [],
  chronological_summary: [],
  medical_codes: [],
  billing_summary: [],
  provider_summary: [],
  demand_package: [],
  demand_summary: EMPTY_DEMAND_SUMMARY,
  review_status: ReviewStatus.Pending,
  last_edited_by: "",
  last_edited_at: "",
};

const CasePackageContext = createContext<CasePackageContextValue>({
  pkg: EMPTY_PACKAGE,
  demandIQ: EMPTY_DEMAND_IQ,
  hasData: false,
});

export const useCasePackage = () => useContext(CasePackageContext);

/**
 * Provides the case package data to all child components.
 * Demo cases get mock data; real cases get an empty package.
 */
export const CasePackageProvider = ({
  caseId,
  children,
}: {
  caseId: string;
  children: ReactNode;
}) => {
  const isDemo = DEMO_CASE_IDS.has(caseId);
  const pkg = isDemo ? MARTINEZ_CASE_PACKAGE : EMPTY_PACKAGE;
  const demandIQ = isDemo ? getDemandIQOutput() : EMPTY_DEMAND_IQ;

  return (
    <CasePackageContext.Provider value={{ pkg, demandIQ, hasData: isDemo }}>
      {children}
    </CasePackageContext.Provider>
  );
};
