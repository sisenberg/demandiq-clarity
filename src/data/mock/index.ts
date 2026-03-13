/**
 * COMPLIANCE GUARDRAIL: All data in src/data/mock/ MUST be synthetic/fictional.
 * Production PII (real names, SSNs, DOBs) and PHI (real medical records, diagnoses)
 * must NEVER appear in mock/seed data. See docs/compliance/data-classification.md §2.
 * Trust zone: non_production. See docs/compliance/subprocessor-boundaries.md §2 Zone 4.
 */
export { mockTenant } from "./tenant";
export { mockUsers } from "./users";
export { mockCases } from "./cases";
export { mockDocuments } from "./documents";
export { mockExtractions } from "./extractions";
export { mockEvidenceLinks } from "./evidenceLinks";
export { mockChronologyEvents } from "./events";
export { mockIssueFlags } from "./issues";
export { mockJobs } from "./jobs";
export { mockAuditEvents } from "./auditEvents";
export { mockActivityEvents } from "./activityEvents";
export { EVALUATE_DEMO_SEEDS } from "./evaluateSeeds";
export type { EvaluateDemoSeed } from "./evaluateSeeds";
