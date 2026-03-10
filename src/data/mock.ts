import {
  type Tenant,
  type User,
  type Case,
  type CaseDocument,
  type TimelineEvent,
  type Issue,
  CaseStatus,
  DocumentStatus,
  EventStatus,
  IssueSeverity,
  IssueStatus,
  UserRole,
} from "@/types";

// --- Tenant ---

export const mockTenant: Tenant = {
  id: "tenant-001",
  name: "Burke & Associates",
  slug: "burke-associates",
  createdAt: "2024-01-15T00:00:00Z",
};

// --- Users ---

export const mockUsers: User[] = [
  {
    id: "user-001",
    tenantId: "tenant-001",
    email: "sarah.burke@burkelaw.com",
    displayName: "Sarah Burke",
    role: UserRole.Admin,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "user-002",
    tenantId: "tenant-001",
    email: "james.chen@burkelaw.com",
    displayName: "James Chen",
    role: UserRole.Reviewer,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "user-003",
    tenantId: "tenant-001",
    email: "maria.santos@burkelaw.com",
    displayName: "Maria Santos",
    role: UserRole.Analyst,
    createdAt: "2024-03-01T00:00:00Z",
  },
];

// --- Cases ---

export const mockCases: Case[] = [
  {
    id: "case-001",
    tenantId: "tenant-001",
    title: "Martinez v. Pacific Freight Lines",
    caseNumber: "CF-2024-00187",
    claimant: "Elena Martinez",
    defendant: "Pacific Freight Lines, Inc.",
    status: CaseStatus.Review,
    createdById: "user-001",
    assignedToId: "user-002",
    dateOfLoss: "2023-11-14",
    createdAt: "2024-06-01T10:00:00Z",
    updatedAt: "2024-09-15T14:30:00Z",
  },
  {
    id: "case-002",
    tenantId: "tenant-001",
    title: "Thompson v. Meridian Properties",
    caseNumber: "CF-2024-00203",
    claimant: "Robert Thompson",
    defendant: "Meridian Properties LLC",
    status: CaseStatus.Extraction,
    createdById: "user-001",
    assignedToId: "user-003",
    dateOfLoss: "2024-01-22",
    createdAt: "2024-07-10T09:00:00Z",
    updatedAt: "2024-09-12T11:00:00Z",
  },
  {
    id: "case-003",
    tenantId: "tenant-001",
    title: "Nguyen v. Coastal Health Systems",
    caseNumber: "CF-2024-00215",
    claimant: "David Nguyen",
    defendant: "Coastal Health Systems",
    status: CaseStatus.Intake,
    createdById: "user-003",
    assignedToId: null,
    dateOfLoss: "2024-03-08",
    createdAt: "2024-08-20T15:00:00Z",
    updatedAt: "2024-08-20T15:00:00Z",
  },
];

// --- Documents ---

export const mockDocuments: CaseDocument[] = [
  {
    id: "doc-001",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "Police_Report_2023-11-14.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 2_450_000,
    status: DocumentStatus.Extracted,
    uploadedById: "user-001",
    pageCount: 8,
    extractedAt: "2024-06-02T12:00:00Z",
    createdAt: "2024-06-01T10:05:00Z",
  },
  {
    id: "doc-002",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "ER_Records_Martinez.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 5_100_000,
    status: DocumentStatus.Extracted,
    uploadedById: "user-001",
    pageCount: 24,
    extractedAt: "2024-06-02T12:30:00Z",
    createdAt: "2024-06-01T10:06:00Z",
  },
  {
    id: "doc-003",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "Ortho_Consult_Dr_Patel.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 1_800_000,
    status: DocumentStatus.Extracted,
    uploadedById: "user-003",
    pageCount: 6,
    extractedAt: "2024-06-03T09:00:00Z",
    createdAt: "2024-06-02T16:00:00Z",
  },
  {
    id: "doc-004",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "MRI_Lumbar_Spine_Report.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 980_000,
    status: DocumentStatus.Extracted,
    uploadedById: "user-003",
    pageCount: 3,
    extractedAt: "2024-06-03T09:15:00Z",
    createdAt: "2024-06-02T16:05:00Z",
  },
  {
    id: "doc-005",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "PT_Progress_Notes.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 3_200_000,
    status: DocumentStatus.Extracted,
    uploadedById: "user-003",
    pageCount: 18,
    extractedAt: "2024-06-04T10:00:00Z",
    createdAt: "2024-06-03T14:00:00Z",
  },
  {
    id: "doc-006",
    caseId: "case-001",
    tenantId: "tenant-001",
    fileName: "Wage_Loss_Statement.pdf",
    fileType: "application/pdf",
    fileSizeBytes: 420_000,
    status: DocumentStatus.Pending,
    uploadedById: "user-001",
    pageCount: 2,
    extractedAt: null,
    createdAt: "2024-09-10T08:00:00Z",
  },
];

// --- Timeline Events ---

export const mockEvents: TimelineEvent[] = [
  {
    id: "evt-001",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2023-11-14",
    title: "Motor vehicle collision on I-405 SB",
    description:
      "Claimant's vehicle rear-ended by defendant's commercial truck at approximately 45 mph. Claimant transported via ambulance to St. Mary's Medical Center.",
    status: EventStatus.Approved,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-001",
        pageNumber: 1,
        excerpt:
          "Unit 1 (commercial vehicle, Pacific Freight Lines) struck Unit 2 (2019 Honda Accord) from behind at estimated 45 mph on I-405 SB near mile marker 22.",
      },
    ],
    createdById: null,
    reviewedById: "user-002",
    reviewedAt: "2024-06-05T10:00:00Z",
    reviewNote: null,
    version: 2,
    createdAt: "2024-06-02T12:05:00Z",
    updatedAt: "2024-06-05T10:00:00Z",
  },
  {
    id: "evt-002",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2023-11-14",
    title: "Emergency department presentation",
    description:
      "Claimant presented to St. Mary's ED with complaints of severe neck pain, lower back pain, and left shoulder pain. GCS 15. CT cervical spine negative for fracture.",
    status: EventStatus.Approved,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-002",
        pageNumber: 1,
        excerpt:
          "Patient: Elena Martinez, DOB 03/15/1985. Chief complaint: neck pain, low back pain, left shoulder pain following MVC. GCS 15, alert and oriented x4.",
      },
      {
        documentId: "doc-002",
        pageNumber: 3,
        excerpt:
          "CT cervical spine: No acute fracture or subluxation. Mild degenerative changes at C5-C6.",
      },
    ],
    createdById: null,
    reviewedById: "user-002",
    reviewedAt: "2024-06-05T10:05:00Z",
    reviewNote: null,
    version: 2,
    createdAt: "2024-06-02T12:35:00Z",
    updatedAt: "2024-06-05T10:05:00Z",
  },
  {
    id: "evt-003",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2023-11-28",
    title: "Orthopedic consultation — Dr. Patel",
    description:
      "Initial orthopedic evaluation. Diagnosis: cervical strain, lumbar disc herniation suspected, left rotator cuff strain. MRI lumbar spine ordered.",
    status: EventStatus.PendingReview,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-003",
        pageNumber: 1,
        excerpt:
          "Assessment: 1) Cervical strain 2) Suspected lumbar disc herniation — MRI recommended 3) Left rotator cuff strain. Plan: MRI lumbar spine, PT referral, follow-up in 4 weeks.",
      },
    ],
    createdById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    version: 1,
    createdAt: "2024-06-03T09:05:00Z",
    updatedAt: "2024-06-03T09:05:00Z",
  },
  {
    id: "evt-004",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2023-12-05",
    title: "MRI lumbar spine — disc herniation confirmed",
    description:
      "MRI reveals L4-L5 disc herniation with moderate canal stenosis and left-sided foraminal narrowing. Correlates with reported radicular symptoms.",
    status: EventStatus.PendingReview,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-004",
        pageNumber: 2,
        excerpt:
          "L4-L5: Broad-based disc herniation with moderate central canal stenosis. Left-sided foraminal narrowing with probable impingement of the traversing L5 nerve root.",
      },
    ],
    createdById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    version: 1,
    createdAt: "2024-06-03T09:20:00Z",
    updatedAt: "2024-06-03T09:20:00Z",
  },
  {
    id: "evt-005",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2023-12-12",
    title: "Physical therapy initiated",
    description:
      "Began PT program at Peak Performance Rehab, 3x/week. Initial functional assessment: limited cervical ROM, antalgic gait, pain 7/10.",
    status: EventStatus.PendingReview,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-005",
        pageNumber: 1,
        excerpt:
          "Initial evaluation: Cervical ROM limited 40% in all planes. Lumbar flexion limited 50%. Antalgic gait pattern. VAS pain score 7/10. Treatment plan: 3x/week for 12 weeks.",
      },
    ],
    createdById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    version: 1,
    createdAt: "2024-06-04T10:05:00Z",
    updatedAt: "2024-06-04T10:05:00Z",
  },
  {
    id: "evt-006",
    caseId: "case-001",
    tenantId: "tenant-001",
    eventDate: "2024-02-15",
    title: "PT discharge — partial improvement",
    description:
      "Discharged from PT after 10 weeks. Cervical ROM improved to 70% of normal. Lumbar symptoms persist with ongoing radiculopathy. Pain 5/10 at rest.",
    status: EventStatus.Draft,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-005",
        pageNumber: 16,
        excerpt:
          "Discharge summary: Patient completed 28 of 36 planned sessions. Cervical ROM improved to approx. 70% normal. Lumbar radicular symptoms persist. VAS 5/10 at rest, 7/10 with activity.",
      },
    ],
    createdById: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    version: 1,
    createdAt: "2024-06-04T10:20:00Z",
    updatedAt: "2024-06-04T10:20:00Z",
  },
];

// --- Issues ---

export const mockIssues: Issue[] = [
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
