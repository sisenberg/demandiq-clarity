// ===================================================
// CasualtyIQ — Centralized Mock Case Package
// Martinez v. Pacific Freight Lines — Demo Case
// ===================================================

import type {
  CasePackage,
  Party,
  Injury,
  Provider,
  TreatmentRecord,
  BillingLine,
  InsurancePolicy,
  LiabilityFact,
  TimelineEvent,
  EvidenceReference,
  DemandSummary,
  DemandIQOutput,
  ClaimAssessmentSection,
  ModuleRun,
  ModuleOutput,
} from "@/types";
import {
  PartyRole,
  InjurySeverity,
  TreatmentType,
  BillStatus,
  TimelineCategory,
  RelevanceType,
  ReviewState,
  SourceType,
  ReviewStatus,
  ModuleId,
} from "@/types";
import { mockCases } from "./cases";
import { mockDocuments } from "./documents";
import { MOCK_SOURCE_PAGES } from "@/components/case/SourceDrawer";

const T = "tenant-001";
const C = "case-001";

// ─── Parties ────────────────────────────────────────
const parties: Party[] = [
  {
    id: "party-claimant",
    tenant_id: T, case_id: C,
    full_name: "Elena Martinez",
    party_role: PartyRole.Claimant,
    organization: "",
    contact_phone: "(555) 867-5309",
    contact_email: "elena.martinez@email.com",
    address: "1247 Oak Park Drive, Sacramento, CA 95814",
    notes: "DOB: 06/22/1990. Occupation: warehouse logistics coordinator.",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "party-defendant",
    tenant_id: T, case_id: C,
    full_name: "James Howell",
    party_role: PartyRole.Insured,
    organization: "Pacific Freight Lines, Inc.",
    contact_phone: "",
    contact_email: "",
    address: "",
    notes: "Driver of defendant vehicle. DOB: 03/15/1978.",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "party-witness",
    tenant_id: T, case_id: C,
    full_name: "Kevin Donovan",
    party_role: PartyRole.Witness,
    organization: "",
    contact_phone: "(555) 234-5678",
    contact_email: "",
    address: "",
    notes: "Pedestrian bystander at adjacent crosswalk.",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "party-chen",
    tenant_id: T, case_id: C,
    full_name: "Dr. Sarah Chen",
    party_role: PartyRole.Provider,
    organization: "Chen Orthopedic Associates",
    contact_phone: "(555) 444-1122",
    contact_email: "office@chenortho.com",
    address: "200 Medical Center Dr, Suite 300, Sacramento, CA",
    notes: "Primary treating orthopedic surgeon.",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "party-patel",
    tenant_id: T, case_id: C,
    full_name: "Dr. Raj Patel",
    party_role: PartyRole.Provider,
    organization: "Sacramento Pain Management",
    contact_phone: "(555) 444-3344",
    contact_email: "",
    address: "",
    notes: "Interventional pain management specialist. Performed ESIs.",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "party-roberts",
    tenant_id: T, case_id: C,
    full_name: "Dr. William Roberts",
    party_role: PartyRole.Expert,
    organization: "Roberts Orthopedic Consulting",
    contact_phone: "",
    contact_email: "",
    address: "",
    notes: "Defense-retained IME examiner.",
    created_at: "2024-08-14T09:00:00Z",
    updated_at: "2024-08-14T09:00:00Z",
  },
];

// ─── Evidence References ────────────────────────────
function ref(id: string, docId: string, page: number, docName: string, pageLabel: string, quotedText: string, relevance: RelevanceType, linkedType: string, linkedId: string): EvidenceReference {
  return {
    id, tenant_id: T, case_id: C,
    source_document_id: docId, source_page: page, source_chunk_id: null,
    quoted_text: quotedText, locator_text: `${docName}, Page ${page}`,
    doc_name: docName, page_label: pageLabel, relevance,
    confidence: relevance === RelevanceType.Direct ? 0.95 : relevance === RelevanceType.Corroborating ? 0.85 : 0.7,
    review_state: ReviewState.Approved,
    linked_entity_type: linkedType, linked_entity_id: linkedId,
    created_at: "2024-06-02T12:00:00Z",
  };
}

const evidenceRefs: EvidenceReference[] = [
  ref("er-001", "doc-001", 3, "Police Report #PR-2024-8812", "pg. 3", "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection at approximately 35 mph.", RelevanceType.Direct, "timeline_event", "te-001"),
  ref("er-002", "doc-008", 1, "Witness Statement — K. Donovan", "pg. 1", "I saw the white truck go through the red light and hit the gray sedan.", RelevanceType.Corroborating, "timeline_event", "te-001"),
  ref("er-003", "doc-002", 1, "ER Records — Mercy General", "pg. 1", "Patient presents with acute cervical strain, right shoulder contusion.", RelevanceType.Direct, "timeline_event", "te-002"),
  ref("er-004", "doc-002", 4, "ER Records — Mercy General", "pg. 4", "CT head without contrast: no acute intracranial abnormality.", RelevanceType.Corroborating, "timeline_event", "te-002"),
  ref("er-005", "doc-003", 2, "Medical Record — Dr. Chen", "pg. 2", "Cervical disc injury, suspected — recommend MRI cervical spine", RelevanceType.Direct, "timeline_event", "te-003"),
  ref("er-006", "doc-004", 7, "MRI Report — Regional Radiology", "pg. 7", "Central disc herniation at C5-C6 with moderate foraminal narrowing.", RelevanceType.Direct, "injury", "inj-001"),
  ref("er-007", "doc-004", 7, "MRI Report — Regional Radiology", "pg. 7", "Right C6 nerve root compression suggested.", RelevanceType.Corroborating, "injury", "inj-001"),
  ref("er-008", "doc-004", 12, "MRI Report — Regional Radiology", "pg. 12", "Medial meniscus tear — posterior horn, horizontal type", RelevanceType.Direct, "injury", "inj-004"),
  ref("er-009", "doc-005", 2, "PT Records — Advanced Rehab", "pg. 2", "Initial evaluation: cervical ROM significantly limited. Pain rated 7/10.", RelevanceType.Direct, "timeline_event", "te-005"),
  ref("er-010", "doc-005", 22, "PT Records — Advanced Rehab", "pg. 22", "Total sessions prescribed: 36. Total sessions completed: 24.", RelevanceType.Contradicting, "issue_flag", "flag-compliance"),
  ref("er-011", "doc-006", 1, "Pain Management Records — Dr. Patel", "pg. 1", "C5-C6 right transforaminal epidural steroid injection performed under fluoroscopy.", RelevanceType.Direct, "timeline_event", "te-006"),
  ref("er-012", "doc-007", 5, "IME Report — Dr. Roberts", "pg. 5", "The C5-C6 herniation is more likely than not causally related to the MVA.", RelevanceType.Corroborating, "injury", "inj-001"),
  ref("er-013", "doc-007", 8, "IME Report — Dr. Roberts", "pg. 8", "Conservative treatment has not been exhausted; surgery is premature.", RelevanceType.Contradicting, "issue_flag", "flag-ime"),
  ref("er-014", "doc-003", 3, "Dr. Chen Ortho Eval", "pg. 3", "possible pre-existing degenerative changes at L4-L5", RelevanceType.Contradicting, "injury", "inj-003"),
  ref("er-015", "doc-009", 1, "Demand Letter v1", "pg. 1", "we hereby demand the sum of $285,000.00 in full and final settlement", RelevanceType.Direct, "timeline_event", "te-008"),
  ref("er-016", "doc-002", 1, "ER Records — Mercy General", "pg. 1", "Patient presents with acute cervical strain, right shoulder contusion.", RelevanceType.Direct, "injury", "inj-002"),
];

// ─── Injuries ───────────────────────────────────────
const injuries: Injury[] = [
  {
    id: "inj-001", tenant_id: T, case_id: C, party_id: "party-claimant",
    body_part: "Cervical Spine", body_region: "Neck",
    diagnosis_description: "C5-C6 central disc herniation with moderate foraminal narrowing",
    diagnosis_code: "M50.12",
    severity: InjurySeverity.Severe,
    is_pre_existing: false,
    date_of_onset: "2024-11-15",
    notes: "MRI confirmed. Neurosurgical consultation recommended. Right C6 radiculopathy clinically correlated.",
    evidence_refs: [evidenceRefs[5], evidenceRefs[6], evidenceRefs[11]],
    map_x: 50, map_y: 18,
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "inj-002", tenant_id: T, case_id: C, party_id: "party-claimant",
    body_part: "Right Shoulder", body_region: "Shoulder",
    diagnosis_description: "Rotator cuff strain with contusion",
    diagnosis_code: "S46.011A",
    severity: InjurySeverity.Moderate,
    is_pre_existing: false,
    date_of_onset: "2024-11-15",
    notes: "Diagnosed on initial ER visit. Resolved after 6 weeks of physical therapy.",
    evidence_refs: [evidenceRefs[15]],
    map_x: 34, map_y: 24,
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "inj-003", tenant_id: T, case_id: C, party_id: "party-claimant",
    body_part: "Lumbar Spine", body_region: "Lower Back",
    diagnosis_description: "Lumbar strain L4-L5 with possible pre-existing degenerative changes",
    diagnosis_code: "M54.5",
    severity: InjurySeverity.Moderate,
    is_pre_existing: true,
    date_of_onset: "2024-11-15",
    notes: "Defense may argue contribution. No prior imaging available for comparison.",
    evidence_refs: [evidenceRefs[13]],
    map_x: 50, map_y: 42,
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "inj-004", tenant_id: T, case_id: C, party_id: "party-claimant",
    body_part: "Right Knee", body_region: "Knee",
    diagnosis_description: "Medial meniscus tear, posterior horn, horizontal type",
    diagnosis_code: "S83.211A",
    severity: InjurySeverity.Moderate,
    is_pre_existing: false,
    date_of_onset: "2024-11-15",
    notes: "MRI confirmed. Conservative treatment prescribed. MCL sprain also noted.",
    evidence_refs: [evidenceRefs[7]],
    map_x: 44, map_y: 68,
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "inj-005", tenant_id: T, case_id: C, party_id: "party-claimant",
    body_part: "Left Wrist", body_region: "Wrist",
    diagnosis_description: "Scaphoid fracture, non-displaced",
    diagnosis_code: "S62.001A",
    severity: InjurySeverity.Minor,
    is_pre_existing: false,
    date_of_onset: "2024-11-15",
    notes: "Incidental finding. Cast immobilization for 6 weeks.",
    evidence_refs: [],
    map_x: 68, map_y: 48,
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
];

// ─── Providers ──────────────────────────────────────
const providers: Provider[] = [
  {
    id: "prov-chen", tenant_id: T, case_id: C, party_id: "party-chen",
    full_name: "Dr. Sarah Chen", specialty: "Orthopedic Surgery",
    facility_name: "Chen Orthopedic Associates",
    role_description: "Primary treating physician",
    total_visits: 6, first_visit_date: "2024-11-18", last_visit_date: "2025-02-28",
    total_billed: 2850, total_paid: 2100,
    notes: "", created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "prov-patel", tenant_id: T, case_id: C, party_id: "party-patel",
    full_name: "Dr. Raj Patel", specialty: "Interventional Pain Management",
    facility_name: "Sacramento Pain Management",
    role_description: "ESI provider",
    total_visits: 3, first_visit_date: "2025-01-10", last_visit_date: "2025-03-10",
    total_billed: 12400, total_paid: 9300,
    notes: "", created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "prov-rehab", tenant_id: T, case_id: C, party_id: null,
    full_name: "Advanced Rehabilitation Center", specialty: "Physical Therapy",
    facility_name: "Advanced Rehabilitation Center",
    role_description: "Physical therapy provider",
    total_visits: 24, first_visit_date: "2024-12-10", last_visit_date: "2025-03-28",
    total_billed: 9600, total_paid: 7200,
    notes: "24 of 36 prescribed sessions completed.", created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "prov-mercy", tenant_id: T, case_id: C, party_id: null,
    full_name: "Mercy General Hospital", specialty: "Emergency Medicine",
    facility_name: "Mercy General Hospital",
    role_description: "Initial emergency treatment",
    total_visits: 1, first_visit_date: "2024-11-15", last_visit_date: "2024-11-15",
    total_billed: 4280, total_paid: 3200,
    notes: "", created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "prov-radiology", tenant_id: T, case_id: C, party_id: null,
    full_name: "Regional Radiology Associates", specialty: "Diagnostic Imaging",
    facility_name: "Regional Radiology Associates",
    role_description: "MRI provider",
    total_visits: 2, first_visit_date: "2024-12-02", last_visit_date: "2024-12-02",
    total_billed: 6400, total_paid: 4800,
    notes: "Cervical MRI + Right Knee MRI", created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "prov-roberts", tenant_id: T, case_id: C, party_id: "party-roberts",
    full_name: "Dr. William Roberts", specialty: "Orthopedic Surgery",
    facility_name: "Roberts Orthopedic Consulting",
    role_description: "Defense-retained IME examiner",
    total_visits: 1, first_visit_date: "2025-02-15", last_visit_date: "2025-02-15",
    total_billed: 0, total_paid: 0,
    notes: "Defense IME. Concurred on herniation causation, disputed surgical necessity.", created_at: "2024-08-14T09:00:00Z", updated_at: "2024-08-14T09:00:00Z",
  },
];

// ─── Treatments ─────────────────────────────────────
const treatments: TreatmentRecord[] = [
  {
    id: "tx-001", tenant_id: T, case_id: C, injury_id: null, provider_id: "prov-mercy", document_id: "doc-002",
    treatment_type: TreatmentType.Emergency,
    treatment_date: "2024-11-15", treatment_end_date: "2024-11-15",
    description: "Emergency department evaluation and treatment. CT head negative. Cervical strain, right shoulder contusion diagnosed.",
    procedure_codes: ["99283"], facility_name: "Mercy General Hospital", provider_name: "Mercy General ER",
    source_page: 1, evidence_refs: [evidenceRefs[2]],
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "tx-002", tenant_id: T, case_id: C, injury_id: "inj-001", provider_id: "prov-chen", document_id: "doc-003",
    treatment_type: TreatmentType.Outpatient,
    treatment_date: "2024-11-18", treatment_end_date: "2024-11-18",
    description: "Orthopedic consultation. MRI cervical spine ordered. PT referral.",
    procedure_codes: ["99243"], facility_name: "Chen Orthopedic Associates", provider_name: "Dr. Sarah Chen",
    source_page: 2, evidence_refs: [evidenceRefs[4]],
    created_at: "2024-06-03T09:00:00Z", updated_at: "2024-06-03T09:00:00Z",
  },
  {
    id: "tx-003", tenant_id: T, case_id: C, injury_id: "inj-001", provider_id: "prov-radiology", document_id: "doc-004",
    treatment_type: TreatmentType.DiagnosticImaging,
    treatment_date: "2024-12-02", treatment_end_date: "2024-12-02",
    description: "MRI cervical spine without contrast. C5-C6 herniation confirmed.",
    procedure_codes: ["72141"], facility_name: "Regional Radiology Associates", provider_name: "Regional Radiology",
    source_page: 7, evidence_refs: [evidenceRefs[5]],
    created_at: "2024-06-03T09:15:00Z", updated_at: "2024-06-03T09:15:00Z",
  },
  {
    id: "tx-004", tenant_id: T, case_id: C, injury_id: "inj-004", provider_id: "prov-radiology", document_id: "doc-004",
    treatment_type: TreatmentType.DiagnosticImaging,
    treatment_date: "2024-12-02", treatment_end_date: "2024-12-02",
    description: "MRI right knee without contrast. Medial meniscus tear confirmed.",
    procedure_codes: ["73721"], facility_name: "Regional Radiology Associates", provider_name: "Regional Radiology",
    source_page: 12, evidence_refs: [evidenceRefs[7]],
    created_at: "2024-06-03T09:15:00Z", updated_at: "2024-06-03T09:15:00Z",
  },
  {
    id: "tx-005", tenant_id: T, case_id: C, injury_id: "inj-001", provider_id: "prov-rehab", document_id: "doc-005",
    treatment_type: TreatmentType.PhysicalTherapy,
    treatment_date: "2024-12-10", treatment_end_date: "2025-03-28",
    description: "Physical therapy — 24 of 36 sessions completed. Cervical ROM improved. Manual therapy, therapeutic exercise, modalities.",
    procedure_codes: ["97110", "97140", "97530"], facility_name: "Advanced Rehabilitation Center", provider_name: "Advanced Rehab",
    source_page: 2, evidence_refs: [evidenceRefs[8], evidenceRefs[9]],
    created_at: "2024-06-04T10:00:00Z", updated_at: "2024-06-04T10:00:00Z",
  },
  {
    id: "tx-006", tenant_id: T, case_id: C, injury_id: "inj-001", provider_id: "prov-patel", document_id: "doc-006",
    treatment_type: TreatmentType.Injection,
    treatment_date: "2025-01-15", treatment_end_date: "2025-01-15",
    description: "C5-C6 right transforaminal epidural steroid injection under fluoroscopy. Partial relief reported.",
    procedure_codes: ["64483"], facility_name: "Sacramento Pain Management", provider_name: "Dr. Raj Patel",
    source_page: 1, evidence_refs: [evidenceRefs[10]],
    created_at: "2025-01-15T14:00:00Z", updated_at: "2025-01-15T14:00:00Z",
  },
  {
    id: "tx-007", tenant_id: T, case_id: C, injury_id: "inj-001", provider_id: "prov-patel", document_id: "doc-006",
    treatment_type: TreatmentType.Injection,
    treatment_date: "2025-03-10", treatment_end_date: "2025-03-10",
    description: "Second C5-C6 epidural steroid injection. Follow-up pending.",
    procedure_codes: ["64483"], facility_name: "Sacramento Pain Management", provider_name: "Dr. Raj Patel",
    source_page: null, evidence_refs: [],
    created_at: "2025-03-10T14:00:00Z", updated_at: "2025-03-10T14:00:00Z",
  },
];

// ─── Billing Lines ──────────────────────────────────
const billingLines: BillingLine[] = [
  {
    id: "bill-001", tenant_id: T, case_id: C, treatment_id: "tx-001", provider_id: "prov-mercy", document_id: "doc-002",
    description: "Emergency department visit, moderate severity",
    service_date: "2024-11-15", cpt_codes: ["99283"], diagnosis_codes: ["S13.4XXA", "S40.011A"],
    billed_amount: 4280, allowed_amount: 3500, paid_amount: 3200, adjusted_amount: 1080,
    bill_status: BillStatus.Paid,
    provider_name: "Mercy General Hospital", facility_name: "Mercy General Hospital",
    notes: "", created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "bill-002", tenant_id: T, case_id: C, treatment_id: "tx-002", provider_id: "prov-chen", document_id: "doc-003",
    description: "Orthopedic consultation and follow-ups (6 visits)",
    service_date: "2024-11-18", cpt_codes: ["99243", "99214"], diagnosis_codes: ["M50.12", "M54.5"],
    billed_amount: 2850, allowed_amount: 2300, paid_amount: 2100, adjusted_amount: 750,
    bill_status: BillStatus.Paid,
    provider_name: "Dr. Sarah Chen", facility_name: "Chen Orthopedic Associates",
    notes: "", created_at: "2024-06-03T09:00:00Z", updated_at: "2024-06-03T09:00:00Z",
  },
  {
    id: "bill-003", tenant_id: T, case_id: C, treatment_id: "tx-003", provider_id: "prov-radiology", document_id: "doc-004",
    description: "MRI cervical spine + right knee without contrast",
    service_date: "2024-12-02", cpt_codes: ["72141", "73721"], diagnosis_codes: ["M50.12", "S83.211A"],
    billed_amount: 6400, allowed_amount: 5200, paid_amount: 4800, adjusted_amount: 1600,
    bill_status: BillStatus.Paid,
    provider_name: "Regional Radiology Associates", facility_name: "Regional Radiology Associates",
    notes: "", created_at: "2024-06-03T09:15:00Z", updated_at: "2024-06-03T09:15:00Z",
  },
  {
    id: "bill-004", tenant_id: T, case_id: C, treatment_id: "tx-005", provider_id: "prov-rehab", document_id: "doc-005",
    description: "Physical therapy — 24 sessions",
    service_date: "2024-12-10", cpt_codes: ["97110", "97140", "97530"], diagnosis_codes: ["M50.12"],
    billed_amount: 9600, allowed_amount: 7800, paid_amount: 7200, adjusted_amount: 2400,
    bill_status: BillStatus.Paid,
    provider_name: "Advanced Rehabilitation Center", facility_name: "Advanced Rehabilitation Center",
    notes: "24 of 36 prescribed sessions", created_at: "2024-06-04T10:00:00Z", updated_at: "2024-06-04T10:00:00Z",
  },
  {
    id: "bill-005", tenant_id: T, case_id: C, treatment_id: "tx-006", provider_id: "prov-patel", document_id: "doc-006",
    description: "Pain management — 2 epidural steroid injections + consults",
    service_date: "2025-01-10", cpt_codes: ["64483", "99243", "77003"], diagnosis_codes: ["M50.12"],
    billed_amount: 12400, allowed_amount: 10000, paid_amount: 9300, adjusted_amount: 3100,
    bill_status: BillStatus.Paid,
    provider_name: "Dr. Raj Patel", facility_name: "Sacramento Pain Management",
    notes: "", created_at: "2025-01-15T14:00:00Z", updated_at: "2025-01-15T14:00:00Z",
  },
  {
    id: "bill-006", tenant_id: T, case_id: C, treatment_id: null, provider_id: null, document_id: null,
    description: "Pharmacy — Meloxicam 15mg, Cyclobenzaprine 10mg, Gabapentin 300mg",
    service_date: "2024-11-15", cpt_codes: [], diagnosis_codes: ["M50.12", "M54.5"],
    billed_amount: 1920, allowed_amount: 1700, paid_amount: 1600, adjusted_amount: 320,
    bill_status: BillStatus.Paid,
    provider_name: "CVS Pharmacy", facility_name: "CVS Pharmacy",
    notes: "", created_at: "2024-11-15T18:00:00Z", updated_at: "2024-11-15T18:00:00Z",
  },
];

// ─── Insurance Policies ─────────────────────────────
const insurancePolicies: InsurancePolicy[] = [
  {
    id: "pol-001", tenant_id: T, case_id: C,
    carrier_name: "Pacific Freight Lines Insurance",
    policy_number: "PFL-CGL-2024-0890",
    policy_type: "Commercial General Liability",
    coverage_limit: 1_000_000,
    deductible: 5000,
    effective_date: "2024-01-01",
    expiration_date: "2025-01-01",
    notes: "Primary liability policy. $1M per occurrence.",
    created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "pol-002", tenant_id: T, case_id: C,
    carrier_name: "Pacific Freight Lines Insurance",
    policy_number: "PFL-UMB-2024-0891",
    policy_type: "Umbrella / Excess",
    coverage_limit: 5_000_000,
    deductible: null,
    effective_date: "2024-01-01",
    expiration_date: "2025-01-01",
    notes: "Excess policy above CGL.",
    created_at: "2024-06-01T10:00:00Z", updated_at: "2024-06-01T10:00:00Z",
  },
];

// ─── Liability Facts ────────────────────────────────
const liabilityFacts: LiabilityFact[] = [
  {
    id: "lf-001", tenant_id: T, case_id: C,
    fact_text: "Defendant ran red traffic signal as confirmed by police report and eyewitness.",
    supports_liability: true, confidence_score: 0.98,
    source_document_id: "doc-001", source_page: 3,
    evidence_refs: [evidenceRefs[0], evidenceRefs[1]],
    notes: "Clear liability. Violation of CVC 21453(a).",
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "lf-002", tenant_id: T, case_id: C,
    fact_text: "No contributory negligence by claimant — claimant had green light and was traveling at normal speed.",
    supports_liability: true, confidence_score: 0.95,
    source_document_id: "doc-008", source_page: 1,
    evidence_refs: [evidenceRefs[1]],
    notes: "",
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
  {
    id: "lf-003", tenant_id: T, case_id: C,
    fact_text: "Defendant's vehicle was a commercial truck operated during business activities — respondeat superior applies.",
    supports_liability: true, confidence_score: 0.90,
    source_document_id: "doc-001", source_page: 3,
    evidence_refs: [evidenceRefs[0]],
    notes: "Employer liability for driver's negligence.",
    created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-02T12:00:00Z",
  },
];

// ─── Timeline Events ────────────────────────────────
const timelineEvents: TimelineEvent[] = [
  {
    id: "te-001", tenant_id: T, case_id: C,
    event_date: "2024-11-15", category: TimelineCategory.Accident,
    label: "Motor Vehicle Accident",
    description: "Rear-end collision on I-95 at SR-42 intersection. Defendant ran red light at approximately 35 mph.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[0], evidenceRefs[1]],
    version: 2, created_at: "2024-06-02T12:00:00Z", updated_at: "2024-06-05T10:00:00Z",
  },
  {
    id: "te-002", tenant_id: T, case_id: C,
    event_date: "2024-11-15", category: TimelineCategory.FirstTreatment,
    label: "Emergency Room Visit",
    description: "Presented to Mercy General ER with cervical strain, right shoulder contusion, and radiating pain. CT head negative.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[2], evidenceRefs[3]],
    version: 2, created_at: "2024-06-02T12:30:00Z", updated_at: "2024-06-05T10:05:00Z",
  },
  {
    id: "te-003", tenant_id: T, case_id: C,
    event_date: "2024-11-18", category: TimelineCategory.Treatment,
    label: "Orthopedic Consultation",
    description: "Dr. Sarah Chen orthopedic evaluation. Recommended MRI of cervical spine and physical therapy referral.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[4]],
    version: 1, created_at: "2024-06-03T09:00:00Z", updated_at: "2024-06-03T09:00:00Z",
  },
  {
    id: "te-004", tenant_id: T, case_id: C,
    event_date: "2024-12-02", category: TimelineCategory.Imaging,
    label: "Cervical MRI — Herniation Confirmed",
    description: "MRI revealed central disc herniation at C5-C6 with moderate foraminal narrowing. Neurosurgical consultation recommended.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[5]],
    version: 1, created_at: "2024-06-03T09:15:00Z", updated_at: "2024-06-03T09:15:00Z",
  },
  {
    id: "te-005", tenant_id: T, case_id: C,
    event_date: "2024-12-10", category: TimelineCategory.Treatment,
    label: "Physical Therapy Initiated",
    description: "Began physical therapy at Advanced Rehab, 3x/week for 8 weeks. Initial cervical ROM significantly limited, pain rated 7/10.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[8]],
    version: 1, created_at: "2024-06-04T10:00:00Z", updated_at: "2024-06-04T10:00:00Z",
  },
  {
    id: "te-006", tenant_id: T, case_id: C,
    event_date: "2025-01-15", category: TimelineCategory.Injection,
    label: "Epidural Steroid Injection #1",
    description: "C5-C6 transforaminal epidural steroid injection performed by Dr. Patel. Partial pain relief reported at 2-week follow-up.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[10]],
    version: 1, created_at: "2025-01-15T14:00:00Z", updated_at: "2025-01-15T14:00:00Z",
  },
  {
    id: "te-007", tenant_id: T, case_id: C,
    event_date: "2025-02-15", category: TimelineCategory.IME,
    label: "Independent Medical Examination",
    description: "Defense IME conducted by Dr. Roberts. Concluded herniation is causally related but questioned necessity of surgical intervention.",
    source_type: SourceType.AiExtracted, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[11], evidenceRefs[12]],
    version: 1, created_at: "2024-08-15T14:00:00Z", updated_at: "2024-08-15T14:00:00Z",
  },
  {
    id: "te-008", tenant_id: T, case_id: C,
    event_date: "2025-03-01", category: TimelineCategory.Demand,
    label: "Demand Completed",
    description: "Demand letter finalized and transmitted to carrier. Demand amount: $285,000. Supporting documentation included medical records, billing summary, and chronology.",
    source_type: SourceType.Manual, review_state: ReviewState.Approved,
    evidence_refs: [evidenceRefs[14]],
    version: 1, created_at: "2025-03-01T16:00:00Z", updated_at: "2025-03-01T16:00:00Z",
  },
];

// ─── Demand Summary ─────────────────────────────────
const demandSummary: DemandSummary = {
  demand_amount: 285_000,
  medical_specials: 87_450,
  lost_wages: 24_500,
  future_medical: 35_000,
  general_damages: 138_050,
  policy_limits: 1_000_000,
  demand_date: "2025-03-01",
  response_deadline: "2025-03-31",
  status: "transmitted",
  carrier_response_amount: null,
  notes: "Demand includes medical chronology, billing summary, liability memo, and supporting exhibits.",
};

// ─── Module Runs ────────────────────────────────────
const moduleRuns: ModuleRun[] = [
  {
    id: "run-001", tenant_id: T, case_id: C,
    module_id: ModuleId.DemandIQ,
    run_status: "completed",
    started_at: "2025-03-01T14:00:00Z",
    completed_at: "2025-03-01T14:05:00Z",
    triggered_by: "user-002",
    version: 1,
    error_message: null,
    created_at: "2025-03-01T14:00:00Z",
  },
];

// ─── Module Outputs ─────────────────────────────────
const moduleOutputs: ModuleOutput[] = [
  {
    id: "out-001", tenant_id: T, case_id: C,
    module_id: ModuleId.DemandIQ,
    module_run_id: "run-001",
    output_type: "demand_package",
    content_json: {} as Record<string, unknown>, // DemandIQOutput is used via getDemandIQOutput()
    review_status: ReviewStatus.Draft,
    reviewed_by: null,
    reviewed_at: null,
    version: 1,
    created_at: "2025-03-01T14:05:00Z",
    updated_at: "2025-03-10T16:42:00Z",
  },
];

// ─── Issue Flags (re-derived for package) ───────────
import { mockIssueFlags } from "./issues";

// ─── Assemble Package ───────────────────────────────
const martinezCase = mockCases.find((c) => c.id === "case-001")!;
const martinezDocs = mockDocuments.filter((d) => d.case_id === "case-001");

export const MARTINEZ_CASE_PACKAGE: CasePackage = {
  contract_version: "1.0.0",
  case_record: martinezCase,
  parties,
  documents: martinezDocs,
  source_pages: MOCK_SOURCE_PAGES.map((sp) => ({
    id: sp.id,
    document_id: sp.documentId,
    doc_name: sp.docName,
    page_number: sp.pageNumber,
    page_label: sp.pageLabel,
    document_type: sp.documentType as any,
    extracted_text: sp.extractedText,
    highlights: sp.highlights.map((h) => ({ text: h.text, relevance: h.relevance as any })),
  })),
  evidence_refs: evidenceRefs,
  timeline_events: timelineEvents,
  injuries,
  providers,
  treatments,
  billing_lines: billingLines,
  insurance_policies: insurancePolicies,
  liability_facts: liabilityFacts,
  issue_flags: mockIssueFlags.filter((f) => f.case_id === "case-001"),
  demand_summary: demandSummary,
  modules: {
    // DemandIQ output populated below via getDemandIQOutput()
    // Other module sections omitted — not entitled / not yet run in mock data
  },
  module_runs: moduleRuns,
  module_outputs: moduleOutputs,
};

// ─── DemandIQ Output accessor ───────────────────────

export function getDemandIQOutput(): DemandIQOutput {
  // Convert evidence refs to citation-friendly format for claim assessment sections
  const refsByCitation = (ids: string[]) => evidenceRefs.filter((r) => ids.includes(r.id));

  const claimAssessment: ClaimAssessmentSection[] = [
    {
      title: "Accident Details",
      content: [
        { text: `On November 15, 2024, claimant Elena Martinez was traveling northbound on I-95 when defendant's vehicle, operated by Pacific Freight Lines driver James Howell, failed to stop at a red signal and struck claimant's vehicle at approximately 35 mph.`, evidence_refs: refsByCitation(["er-001"]) },
        { text: "Impact was primarily to the rear driver's side. Airbags deployed. Claimant was wearing a seatbelt at the time of collision. Vehicle was towed from the scene.", evidence_refs: refsByCitation(["er-001"]) },
      ],
    },
    {
      title: "Liability & Mechanism of Injury",
      content: [
        { text: "Liability is clear — defendant ran a red light as confirmed by the investigating officer's report and a witness statement from a bystander at the adjacent crosswalk. No contributory negligence by claimant.", evidence_refs: refsByCitation(["er-001", "er-002"]) },
        { text: "Mechanism of injury is consistent with rear-end impact causing cervical hyperextension-hyperflexion and compressive forces on the lumbar spine. Shoulder contusion from seatbelt restraint and lateral impact forces.", evidence_refs: refsByCitation(["er-003"]) },
      ],
    },
    {
      title: "Injuries",
      content: injuries.map((inj) => ({
        text: `${inj.diagnosis_description} (${inj.diagnosis_code}).${inj.is_pre_existing ? " Possible pre-existing condition." : ""} ${inj.notes}`.trim(),
        evidence_refs: inj.evidence_refs,
      })),
    },
    {
      title: "Treatment Overview",
      content: [
        { text: "Emergency department care at Mercy General on date of loss. Follow-up orthopedic evaluation by Dr. Sarah Chen on 11/18/2024. Cervical and knee MRIs obtained 12/02/2024.", evidence_refs: refsByCitation(["er-003", "er-005"]) },
        { text: "24 of 36 prescribed physical therapy sessions completed at Advanced Rehab (3x/week, 8 weeks). Two C5-C6 transforaminal epidural steroid injections performed by Dr. Patel on 01/15/2025 and 03/10/2025. Partial relief reported.", evidence_refs: refsByCitation(["er-009", "er-011"]) },
      ],
    },
    {
      title: "Pain & Functional Analysis",
      content: [
        { text: "Claimant reports persistent cervical pain rated 5–7/10 at most recent visit. Pain is described as constant, dull ache with sharp exacerbation on cervical rotation. Sleep disruption 4–5 nights per week.", evidence_refs: [] },
        { text: "Functional limitations include inability to lift >10 lbs overhead, difficulty with prolonged sitting (>30 min), and reduced cervical ROM (40% of baseline). Claimant unable to return to prior occupation as warehouse logistics coordinator.", evidence_refs: refsByCitation(["er-009"]) },
      ],
    },
    {
      title: "Gaps, Issues & Inconsistencies",
      content: [
        { text: "14-day gap between ER visit (11/15) and first orthopedic follow-up (11/18 — originally documented as 11/28 in some records). Dates should be reconciled across medical records.", evidence_refs: [] },
        { text: "Patient completed only 24 of 36 prescribed PT sessions (67% compliance). Defense may argue non-compliance diminishes claimed damages.", evidence_refs: refsByCitation(["er-010"]) },
        { text: "Dr. Chen notes 'possible pre-existing degenerative changes at L4-L5.' No prior imaging available for comparison. Consider requesting prior medical records from PCP to address causation.", evidence_refs: refsByCitation(["er-014"]) },
        { text: "Defense IME by Dr. Roberts concurs on herniation causation but disputes surgical necessity, stating 'conservative treatment has not been exhausted.' This is a key defense argument to rebut.", evidence_refs: refsByCitation(["er-013"]) },
      ],
    },
  ];

  return {
    claim_assessment: claimAssessment,
    chronological_summary: timelineEvents.map((e) => `${e.event_date} — ${e.label}: ${e.description}`),
    medical_codes: [
      "M50.12 — Cervical disc herniation, C5-C6",
      "S46.011A — Rotator cuff strain, right shoulder",
      "M54.5 — Lumbar strain, L4-L5",
      "S83.211A — Medial meniscus tear, right knee",
      "S62.001A — Scaphoid fracture, left wrist (non-displaced)",
      "99283 — ER visit, moderate severity",
      "72141 — MRI cervical spine without contrast",
      "97110 — Therapeutic exercises (PT)",
      "64483 — Transforaminal epidural injection",
    ],
    billing_summary: billingLines.map((b) =>
      `${b.provider_name} — $${b.billed_amount.toLocaleString()} (paid: $${(b.paid_amount ?? 0).toLocaleString()})`
    ).concat([
      `Total Billed: $${billingLines.reduce((s, b) => s + b.billed_amount, 0).toLocaleString()} | Total Paid: $${billingLines.reduce((s, b) => s + (b.paid_amount ?? 0), 0).toLocaleString()} | Adjusted: $${billingLines.reduce((s, b) => s + (b.adjusted_amount ?? 0), 0).toLocaleString()}`
    ]),
    provider_summary: providers.map((p) =>
      `${p.full_name} — ${p.specialty} — ${p.role_description}, ${p.total_visits} visit${p.total_visits !== 1 ? "s" : ""}`
    ),
    demand_package: [
      `Demand Amount: $${demandSummary.demand_amount.toLocaleString()}`,
      `Special Damages: $${demandSummary.medical_specials.toLocaleString()} (medical specials)`,
      `Lost Wages: $${demandSummary.lost_wages.toLocaleString()}`,
      `Future Medical: $${demandSummary.future_medical.toLocaleString()}`,
      `General Damages: $${demandSummary.general_damages.toLocaleString()} (pain & suffering, loss of enjoyment)`,
      `Policy Limits: $${(demandSummary.policy_limits ?? 0).toLocaleString()}`,
      "Package includes: medical chronology, billing summary, liability memo, and supporting exhibits",
      `Status: Transmitted to carrier ${demandSummary.demand_date}, response deadline ${demandSummary.response_deadline}`,
    ],
    demand_summary: demandSummary,
    review_status: ReviewStatus.Draft,
    last_edited_by: "Ana García",
    last_edited_at: "2025-03-10T16:42:00Z",
  };

  // Populate the modules.demandiq section on the package
  MARTINEZ_CASE_PACKAGE.modules.demandiq = output;

  return output;
}

// ─── Computed helpers for UI consumption ────────────

/** Total billing summary */
export function getBillingSummary(pkg: CasePackage) {
  const totalBilled = pkg.billing_lines.reduce((s, b) => s + b.billed_amount, 0);
  const totalPaid = pkg.billing_lines.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
  const totalAdjusted = pkg.billing_lines.reduce((s, b) => s + (b.adjusted_amount ?? 0), 0);
  return { totalBilled, totalPaid, totalAdjusted };
}

/** Treatment summary stats */
export function getTreatmentStats(pkg: CasePackage) {
  return {
    totalVisits: pkg.providers.reduce((s, p) => s + p.total_visits, 0),
    providers: pkg.providers.length,
    ptSessions: pkg.treatments.filter((t) => t.treatment_type === TreatmentType.PhysicalTherapy).reduce((s) => s + 24, 0),
    injections: pkg.treatments.filter((t) => t.treatment_type === TreatmentType.Injection).length,
    ...getBillingSummary(pkg),
  };
}
