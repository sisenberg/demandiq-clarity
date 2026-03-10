import type { TimelineEvent } from "@/types";
import { EventStatus } from "@/types";

export const mockEvents: TimelineEvent[] = [
  // --- case-001 (Review) — mix of approved, pending, draft ---
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

  // --- case-004 (Approved) — all events approved ---
  {
    id: "evt-007",
    caseId: "case-004",
    tenantId: "tenant-001",
    eventDate: "2024-02-10",
    title: "Warehouse loading dock accident",
    description:
      "Claimant struck by forklift while unloading cargo at Summit Logistics facility. Emergency services called.",
    status: EventStatus.Approved,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-009",
        pageNumber: 1,
        excerpt:
          "Employee Jennifer Park struck by forklift (unit FL-12) during cargo unloading operations at dock 3. Paramedics dispatched at 14:22.",
      },
    ],
    createdById: null,
    reviewedById: "user-002",
    reviewedAt: "2024-09-28T09:00:00Z",
    reviewNote: null,
    version: 2,
    createdAt: "2024-05-16T11:05:00Z",
    updatedAt: "2024-09-28T09:00:00Z",
  },
  {
    id: "evt-008",
    caseId: "case-004",
    tenantId: "tenant-001",
    eventDate: "2024-02-10",
    title: "Emergency treatment — fractured tibia",
    description:
      "Claimant treated at Regional Medical Center. X-ray confirmed right tibial shaft fracture. Surgical consult ordered.",
    status: EventStatus.Approved,
    source: "ai_extracted",
    evidenceRefs: [
      {
        documentId: "doc-010",
        pageNumber: 2,
        excerpt:
          "X-ray right lower extremity: Transverse fracture of the tibial shaft, mid-diaphysis. No fibular involvement. Orthopedic surgery consult placed.",
      },
    ],
    createdById: null,
    reviewedById: "user-002",
    reviewedAt: "2024-09-28T09:10:00Z",
    reviewNote: null,
    version: 2,
    createdAt: "2024-05-16T11:35:00Z",
    updatedAt: "2024-09-28T09:10:00Z",
  },
];
