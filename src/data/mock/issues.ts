import type { Issue } from "@/types";
import { IssueSeverity, IssueStatus } from "@/types";

export const mockIssues: Issue[] = [
  // --- case-001 (Review) issues ---
  {
    id: "iss-001",
    caseId: "case-001",
    tenantId: "tenant-001",
    title: "Pre-existing degenerative changes at C5-C6",
    description:
      "CT report notes 'mild degenerative changes at C5-C6' which may indicate pre-existing condition. Defense may argue cervical symptoms are not causally related to the collision.",
    severity: IssueSeverity.High,
    status: IssueStatus.Open,
    source: "ai_flagged",
    evidenceRefs: [
      {
        documentId: "doc-002",
        pageNumber: 3,
        excerpt:
          "CT cervical spine: No acute fracture or subluxation. Mild degenerative changes at C5-C6.",
      },
    ],
    flaggedById: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: "2024-06-02T13:00:00Z",
    updatedAt: "2024-06-02T13:00:00Z",
  },
  {
    id: "iss-002",
    caseId: "case-001",
    tenantId: "tenant-001",
    title: "Gap in treatment — 2 week delay before ortho consult",
    description:
      "14-day gap between ER visit (11/14) and orthopedic consultation (11/28). Insurance may argue delayed treatment weakens causation.",
    severity: IssueSeverity.Medium,
    status: IssueStatus.Open,
    source: "ai_flagged",
    evidenceRefs: [
      {
        documentId: "doc-002",
        pageNumber: 1,
        excerpt: "Patient: Elena Martinez, DOB 03/15/1985. Date of service: 11/14/2023.",
      },
      {
        documentId: "doc-003",
        pageNumber: 1,
        excerpt: "Date of consultation: 11/28/2023. Referral from: St. Mary's ED.",
      },
    ],
    flaggedById: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: "2024-06-03T09:30:00Z",
    updatedAt: "2024-06-03T09:30:00Z",
  },
  {
    id: "iss-003",
    caseId: "case-001",
    tenantId: "tenant-001",
    title: "Incomplete PT course — 28 of 36 sessions",
    description:
      "Patient completed only 28 of 36 prescribed PT sessions. Non-compliance may be raised by defense to minimize claimed damages.",
    severity: IssueSeverity.Low,
    status: IssueStatus.Acknowledged,
    source: "ai_flagged",
    evidenceRefs: [
      {
        documentId: "doc-005",
        pageNumber: 16,
        excerpt:
          "Discharge summary: Patient completed 28 of 36 planned sessions.",
      },
    ],
    flaggedById: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: "2024-06-04T10:30:00Z",
    updatedAt: "2024-06-04T10:30:00Z",
  },
  {
    id: "iss-004",
    caseId: "case-001",
    tenantId: "tenant-001",
    title: "Wage loss documentation pending",
    description:
      "Wage loss statement uploaded but not yet processed. Required to substantiate economic damages claim.",
    severity: IssueSeverity.Medium,
    status: IssueStatus.Open,
    source: "manual",
    evidenceRefs: [
      {
        documentId: "doc-006",
        pageNumber: 1,
        excerpt: "",
      },
    ],
    flaggedById: "user-002",
    resolvedById: null,
    resolvedAt: null,
    createdAt: "2024-09-10T09:00:00Z",
    updatedAt: "2024-09-10T09:00:00Z",
  },
];
