import type { Case } from "@/types";
import { CaseStatus } from "@/types";

export const mockCases: Case[] = [
  // Case in Review — primary workflow case with full data
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
  // Case in Extraction — documents uploaded, jobs running
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
  // Case in Intake — freshly created, no documents yet
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
  // Case Approved — all events reviewed, ready for export
  {
    id: "case-004",
    tenantId: "tenant-001",
    title: "Park v. Summit Logistics",
    caseNumber: "CF-2024-00228",
    claimant: "Jennifer Park",
    defendant: "Summit Logistics Corp.",
    status: CaseStatus.Approved,
    createdById: "user-001",
    assignedToId: "user-002",
    dateOfLoss: "2024-02-10",
    createdAt: "2024-05-15T08:00:00Z",
    updatedAt: "2024-10-01T16:00:00Z",
  },
];
