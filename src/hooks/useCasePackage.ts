import { createContext, useContext, type ReactNode } from "react";
import type { CasePackage, DemandIQOutput } from "@/types";
import { MARTINEZ_CASE_PACKAGE, getDemandIQOutput } from "@/data/mock/casePackage";

interface CasePackageContextValue {
  pkg: CasePackage;
  demandIQ: DemandIQOutput;
}

const CasePackageContext = createContext<CasePackageContextValue>({
  pkg: MARTINEZ_CASE_PACKAGE,
  demandIQ: getDemandIQOutput(),
});

export const useCasePackage = () => useContext(CasePackageContext);

/**
 * Provides the case package data to all child components.
 * For now uses mock data; will connect to real backend later.
 */
export const CasePackageProvider = ({
  caseId,
  children,
}: {
  caseId: string;
  children: ReactNode;
}) => {
  // For now, always return the Martinez demo case
  const pkg = MARTINEZ_CASE_PACKAGE;
  const demandIQ = getDemandIQOutput();

  return (
    <CasePackageContext.Provider value={{ pkg, demandIQ }}>
      {children}
    </CasePackageContext.Provider>
  );
};
