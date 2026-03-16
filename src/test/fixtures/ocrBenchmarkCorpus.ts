/**
 * CasualtyIQ — OCR Golden Test Benchmark Corpus
 *
 * Seven synthetic benchmark items simulating real-world document scenarios.
 * Page texts are synthetic but contain domain keywords to exercise the
 * labeling engine, parse normalizer, and extraction routing.
 */

import type { BenchmarkCorpusItem } from "@/types/benchmark-harness";

// ── Helpers ────────────────────────────────────────────────

function repeat(text: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `[Page ${i + 1}]\n${text}`);
}

// ── Corpus ─────────────────────────────────────────────────

export const BENCHMARK_CORPUS: BenchmarkCorpusItem[] = [
  // BN-01: Text-native PDF demand
  {
    id: "bn-01",
    name: "Text-native PDF demand",
    description: "Clean text-layer demand letter with structured paragraphs and clear liability language",
    documentType: "demand_letter",
    fileType: "application/pdf",
    fileSizeBytes: 245_000,
    pageCount: 12,
    pageTexts: [
      "DEMAND FOR SETTLEMENT\n\nDear Claims Adjuster,\n\nThis office represents Jane Doe in connection with bodily injury damages arising from the motor vehicle collision that occurred on March 15, 2024.",
      "LIABILITY ANALYSIS\n\nOur client was proceeding through the intersection when your insured failed to yield, constituting clear negligence. The proximate cause of all injuries is the at-fault driver's breach of duty of care.",
      "MEDICAL TREATMENT SUMMARY\n\nFollowing the accident, Ms. Doe was transported to Memorial Hospital where she underwent emergency evaluation. Diagnosis: cervical strain, lumbar disc herniation L4-L5.",
      "TREATMENT CHRONOLOGY\n\nMarch 16, 2024 — Follow-up visit with Dr. Smith, orthopedic.\nMarch 22, 2024 — MRI of lumbar spine confirming disc herniation.\nApril 1–June 30, 2024 — Physical therapy, 3x/week.",
      "SPECIALS SUMMARY\n\n| Provider | CPT | Billed |\n| Memorial Hospital | 99284 | $4,200.00 |\n| Dr. Smith Orthopedic | 99213 | $350.00 |\n| Advanced Imaging | 72148 | $1,800.00 |\n| PT Associates | 97110 | $6,400.00 |\n\nTotal Medical Specials: $12,750.00",
      "WAGE LOSS\n\nMs. Doe is employed as a software engineer earning $95,000 per year. She missed 6 weeks of work due to her injuries, resulting in lost wages of $10,961.54.",
      "FUTURE CARE AND PROGNOSIS\n\nDr. Smith has opined that Ms. Doe will require ongoing treatment including periodic injections and possible future surgery. The life care plan projects future medical costs of $45,000–$65,000.",
      "POLICY AND COVERAGE\n\nYour insured maintains bodily injury liability limits of $100,000 per person / $300,000 per occurrence under policy number ABC-123456.",
      "PRIOR MEDICAL HISTORY\n\nMs. Doe had no pre-existing conditions or prior injuries to the cervical or lumbar spine. Medical records from her primary care physician confirm a healthy baseline.",
      "PHOTOGRAPHS AND EVIDENCE\n\nEnclosed please find photographs of the vehicle damage, the intersection, and radiographic images from Advanced Imaging showing the L4-L5 herniation.",
      "SETTLEMENT DEMAND AND POSTURE\n\nBased on the foregoing, we demand the sum of $175,000 in full settlement of this claim. This demand will remain open for 30 days, after which we reserve the right to pursue litigation.",
      "CONCLUSION\n\nWe look forward to your prompt response and a good-faith negotiation of this matter.\n\nSincerely,\nJohnson & Associates, PLLC",
    ],
    isOcrRequired: false,
    expectedLabels: ["liability", "treatment_chronology", "specials_billing", "wage_loss", "future_damages", "policy_coverage", "attorney_demand", "settlement_posture", "visual_evidence", "prior_injuries"],
    expectedChunkCountMin: 3,
    expectedChunkCountMax: 6,
    expectedExtractionPasses: ["demand_extraction"],
    expectedFailurePoints: [],
  },

  // BN-02: Scanned/image-only PDF demand
  {
    id: "bn-02",
    name: "Scanned/image-only PDF demand",
    description: "OCR-dependent demand letter with potential quality artifacts",
    documentType: "demand_letter",
    fileType: "application/pdf",
    fileSizeBytes: 1_800_000,
    pageCount: 8,
    pageTexts: [
      "DEMAND LETTER\n\nRe: Claim #2024-CV-08821\nClaimant: Robert Chen\nDate of Loss: January 8, 2024",
      "Our investigation reveals clear liability on the part of your insured who ran a red light causing the collision. Negligence and proximate cause are established.",
      "Mr. Chen sustained injuries including cervical strain and right shoulder rotator cuff tear requiring arthroscopic surgery on April 12, 2024.",
      "Treatment records from Valley Orthopedic show 14 physical therapy visits post-surgery with ongoing rehabilitation and chiropractic care.",
      "Medical bills total $38,450.00 including:\n| Provider | Amount |\n| Valley Orthopedic | $22,000 |\n| PT Solutions | $8,450 |\n| Radiology Group | $4,200 |\n| Valley Chiropractic | $3,800 |",
      "Mr. Chen experienced lost income of $12,300 due to 8 weeks of missed employment as a construction foreman.",
      "The prognosis indicates permanent impairment to the right shoulder. Future medical care is projected at $25,000–$40,000.",
      "We hereby demand $225,000 in settlement of all claims. This offer expires in 21 days.",
    ],
    isOcrRequired: true,
    expectedLabels: ["liability", "treatment_chronology", "specials_billing", "wage_loss", "future_damages", "attorney_demand"],
    expectedChunkCountMin: 2,
    expectedChunkCountMax: 4,
    expectedExtractionPasses: ["demand_extraction"],
    expectedFailurePoints: [],
  },

  // BN-03: Multi-document packet (bills + records)
  {
    id: "bn-03",
    name: "Multi-doc packet (bills + records)",
    description: "Combined packet containing medical bills and treatment records from multiple providers",
    documentType: "medical_bill",
    fileType: "application/pdf",
    fileSizeBytes: 3_200_000,
    pageCount: 24,
    pageTexts: [
      ...repeat("ITEMIZED STATEMENT\nPatient: Maria Lopez\nAccount: #ML-2024-0391\n\n| Date | CPT | Description | Charges |\n| 02/10/2024 | 99284 | ED Visit Level 4 | $3,800.00 |\n| 02/10/2024 | 72148 | MRI Lumbar | $1,600.00 |", 4),
      ...repeat("BILLING RECORD — Valley Physical Therapy\nPatient: Maria Lopez\n\n| Visit | CPT | Billed |\n| 03/01/2024 | 97110 | $175.00 |\n| 03/04/2024 | 97140 | $150.00 |\n| 03/08/2024 | 97110 | $175.00 |", 4),
      ...repeat("MEDICAL RECORD — PROGRESS NOTE\nPatient: Maria Lopez  DOB: 05/12/1985\nDate of Service: 03/15/2024\n\nSubjective: Patient reports continued lower back pain radiating to left leg.\nObjective: Lumbar ROM decreased. SLR positive on left.\nAssessment: Lumbar radiculopathy, improving.\nPlan: Continue PT 3x/week. Follow-up in 4 weeks.", 6),
      ...repeat("IMAGING REPORT\nModality: MRI Lumbar Spine\nDate: 02/10/2024\nFindings: L4-L5 disc protrusion with mild foraminal stenosis. No prior imaging for comparison.\nImpression: Disc herniation consistent with acute traumatic injury.", 4),
      ...repeat("NARRATIVE MEDICAL REPORT\nDr. Patricia Wells, MD — Orthopedic Surgery\n\nMs. Lopez sustained injuries in a motor vehicle accident on February 8, 2024. Treatment has included conservative management with physical therapy. If symptoms persist, surgical intervention may be warranted.", 4),
      ...repeat("DISCHARGE SUMMARY\nPatient: Maria Lopez\nAdmission: 02/08/2024  Discharge: 02/10/2024\nDiagnosis: Acute lumbar strain, L4-L5 disc herniation\nDisposition: Follow-up with orthopedics in 1 week.", 2),
    ],
    isOcrRequired: false,
    expectedLabels: ["specials_billing", "treatment_chronology"],
    expectedChunkCountMin: 6,
    expectedChunkCountMax: 24,
    expectedExtractionPasses: ["specials_extraction"],
    expectedFailurePoints: [],
  },

  // BN-04: Poor-quality faxed records
  {
    id: "bn-04",
    name: "Poor-quality faxed records",
    description: "Low-confidence OCR from faxed medical records with noise and artifacts",
    documentType: "medical_record",
    fileType: "application/pdf",
    fileSizeBytes: 950_000,
    pageCount: 6,
    pageTexts: [
      "MEDICAL RECORD\nPat1ent: Th0mas Wi1son\nD0B: 11/22/1978\nDate: 04/15/2024\n\nChief C0mplaint: Neck pain and headaches f0llowing MVA on 04/01/2024\nHistory of pr3sent illness: Patient reports prior neck injury in 2019 — pre-existing degenerative disc disease at C5-C6.",
      "PHYSICAL EXAM\nCervical sp1ne: Tenderness at C4-C6. ROM decreased\nShoulder: Full ROM bil4terally\nNeurological: DTRs 2+ and symm3tric\n\nAssessment: Cervical stra1n superimposed on chronic degenerative changes",
      "TREATMENT PLAN\nPhys1cal therapy 2x/week x 6 weeks\nNaproxen 500mg BID\nFollow-up visit in 3 weeks\nMRI cerv1cal spine ordered",
      "IMAGING — MRI CERVICAL SPINE\nDate: 04/22/2024\nFind1ngs: C5-C6 disc bulge w1th moderate foraminal narrowing\nCompar1son: No prior imaging available\nImpress1on: Degenerative changes at C5-C6, likely pre-existing with possible acute exacerbation",
      "PROGRESS NOTE — 05/10/2024\nPat1ent reports moderate improvement with PT\nContinue current treatment plan\nHistory of chronic pain manag3ment noted in prior records from 2019-2022",
      "FOLLOW-UP — 06/14/2024\nPatient achiev1ng baseline function\nDischarge from PT recommended\nFuture care: periodic flare management, possible epidural injections if symptoms recur",
    ],
    isOcrRequired: true,
    expectedLabels: ["treatment_chronology", "prior_injuries"],
    expectedChunkCountMin: 3,
    expectedChunkCountMax: 6,
    expectedExtractionPasses: ["treatment_timeline_extraction", "injury_extraction"],
    expectedFailurePoints: [],
  },

  // BN-05: Photos + PDF packet
  {
    id: "bn-05",
    name: "Photos + PDF packet",
    description: "Mixed media packet with vehicle damage photos and medical records",
    documentType: "medical_record",
    fileType: "application/pdf",
    fileSizeBytes: 8_500_000,
    pageCount: 7,
    pageTexts: [
      "[PHOTO: Vehicle rear-end damage — driver side]\n[IMAGE CONTENT — No extractable text]",
      "[PHOTO: Vehicle interior damage — deployed airbag]\n[IMAGE CONTENT — No extractable text]",
      "[PHOTO: Intersection overview — traffic signals visible]\n[IMAGE CONTENT — No extractable text]",
      "[PHOTO: Patient bruising — left shoulder and chest]\n[IMAGE CONTENT — No extractable text]",
      "MEDICAL RECORD — EMERGENCY DEPARTMENT\nDate: 05/20/2024\nPatient: Sarah Kim\nChief Complaint: MVA — chest pain, left shoulder pain\nDiagnosis: Left clavicle fracture, chest wall contusion\nTreatment: Sling immobilization, pain management, follow-up orthopedics",
      "RADIOLOGY REPORT\nDate: 05/20/2024\nExam: CT Chest, XR Left Shoulder\nFindings: Non-displaced left clavicle fracture. No pneumothorax.\nImpression: Acute fracture consistent with blunt trauma",
      "ORTHOPEDIC FOLLOW-UP — 06/03/2024\nFracture healing appropriately. Continue sling 4 more weeks.\nPhysical therapy to begin at 6 weeks post-injury.\nPrognosis: Full recovery expected within 4-6 months.",
    ],
    isOcrRequired: true,
    expectedLabels: ["visual_evidence", "treatment_chronology"],
    expectedChunkCountMin: 3,
    expectedChunkCountMax: 7,
    expectedExtractionPasses: ["treatment_timeline_extraction", "injury_extraction"],
    expectedFailurePoints: [],
  },

  // BN-06: Oversized packet
  {
    id: "bn-06",
    name: "Oversized packet (85 pages)",
    description: "Large demand packet with extensive medical records spanning multiple providers and years",
    documentType: "demand_letter",
    fileType: "application/pdf",
    fileSizeBytes: 18_000_000,
    pageCount: 85,
    pageTexts: [
      "DEMAND FOR SETTLEMENT — CONSOLIDATED\n\nRe: James Martinez v. ABC Transport LLC\nClaim: #2023-BI-44291\nDate of Loss: September 3, 2023\n\nDear Ms. Anderson,\n\nThis firm represents Mr. Martinez in connection with the catastrophic injuries sustained in the commercial vehicle collision.",
      "LIABILITY\n\nYour insured's driver was operating a commercial truck in violation of FMCSA hours-of-service regulations, constituting negligence per se. Proximate cause is undisputed based on the police report and witness statements.",
      "INJURY SUMMARY\n\nMr. Martinez sustained: TBI with loss of consciousness, multiple rib fractures, pulmonary contusion, L2 compression fracture, bilateral knee contusions. Emergency surgery was performed for internal bleeding.",
      "TREATMENT CHRONOLOGY — ACUTE PHASE\n\nSeptember 3, 2023 — Life-flight to Level 1 Trauma Center\nSeptember 3–17, 2023 — ICU admission, exploratory laparotomy\nSeptember 17–October 8, 2023 — Step-down unit, physical therapy initiated",
      ...repeat("PROVIDER RECORDS — Continued treatment documentation showing visits, therapy notes, imaging results, and specialist consultations. Treatment included orthopedic follow-up, neuropsychological testing, vestibular therapy, and pain management.", 20),
      ...repeat("BILLING RECORDS\n\n| Date | Provider | CPT | Billed Amount |\n| 09/03/2023 | Trauma Center | 99291 | $8,500.00 |\n| 09/04/2023 | Surgical Team | 44120 | $45,000.00 |\n| 09/05/2023 | ICU Daily | 99232 | $3,200.00 |", 15),
      ...repeat("MEDICAL RECORDS — Progress notes documenting ongoing treatment, physical therapy sessions, occupational therapy, cognitive rehabilitation, and pain management protocols over 18 months of care.", 20),
      "WAGE LOSS AND ECONOMIC DAMAGES\n\nMr. Martinez was employed as a regional sales manager earning $120,000 annually plus benefits. He has been unable to return to work and his earning capacity is permanently diminished.",
      "FUTURE CARE — LIFE CARE PLAN\n\nThe attached life care plan prepared by Dr. Elizabeth Foster projects future medical costs of $850,000–$1,200,000 over Mr. Martinez's expected lifespan, including ongoing neurological care, pain management, and possible revision surgery.",
      "POLICY LIMITS AND COVERAGE\n\nABC Transport LLC maintains a commercial liability policy with limits of $1,000,000 per occurrence. We understand umbrella coverage of $5,000,000 is also available.",
      "DEMAND\n\nBased on the severity of injuries, the extensive treatment, the permanent impairment, and the economic losses, we demand the policy limits of $1,000,000 in settlement. This demand expires in 30 days.\n\nSincerely,\nCarter & Reeves LLP",
      ...repeat("APPENDIX — Additional supporting documentation, medical records continuation, specialist reports, and billing summaries.", 20),
    ],
    isOcrRequired: false,
    expectedLabels: ["liability", "treatment_chronology", "specials_billing", "wage_loss", "future_damages", "policy_coverage", "attorney_demand", "settlement_posture"],
    expectedChunkCountMin: 15,
    expectedChunkCountMax: 30,
    expectedExtractionPasses: ["demand_extraction"],
    expectedFailurePoints: [],
  },

  // BN-07: Revised demand v2
  {
    id: "bn-07",
    name: "Revised demand v2",
    description: "Second version of a demand letter with updated specials and revised settlement posture",
    documentType: "demand_letter",
    fileType: "application/pdf",
    fileSizeBytes: 310_000,
    pageCount: 14,
    pageTexts: [
      "SUPPLEMENTAL DEMAND — VERSION 2\n\nRe: Patricia Williams v. Metro Delivery Services\nClaim: #2024-PD-09182\nDate of Loss: November 12, 2023\n\nDear Mr. Thompson,\n\nThis supplemental demand supersedes our initial demand letter dated March 1, 2024 and incorporates updated treatment, additional specials, and a revised settlement posture.",
      "UPDATED LIABILITY ASSESSMENT\n\nAs previously established, your insured's driver was at fault. We now attach the supplemental police report confirming negligence findings.",
      "TREATMENT UPDATE\n\nSince our initial demand, Ms. Williams has undergone the following additional treatment:\n- Epidural steroid injection at L4-L5 (May 15, 2024)\n- Additional 12 weeks of physical therapy\n- Orthopedic consultation recommending potential discectomy\n- Follow-up MRI showing persistent disc herniation",
      "UPDATED SPECIALS — REVISED\n\n| Provider | Prior Billed | New Charges | Total |\n| Metro Spine Center | $12,000 | $8,500 | $20,500 |\n| PT Associates | $6,400 | $4,800 | $11,200 |\n| Advanced Imaging | $1,800 | $2,400 | $4,200 |\n| Pain Management | $0 | $3,600 | $3,600 |\n\nTotal Updated Specials: $39,500 (previously $20,200)",
      "Ms. Williams continues to experience difficulty with prolonged sitting, lifting, and driving. Her employer has confirmed continued work restrictions.",
      "REVISED FUTURE CARE\n\nThe updated prognosis from Dr. Anderson indicates a 60% probability that surgical intervention will be required. Projected future medical costs have been revised to $55,000–$85,000.",
      "UPDATED WAGE LOSS\n\nAdditional lost wages since initial demand: $8,750. Total lost wages to date: $22,500. Diminished earning capacity analysis attached.",
      "COUNTEROFFER RESPONSE\n\nYour counteroffer of $45,000 dated April 15, 2024 is inadequate given the updated specials alone exceed $39,500. The settlement range for comparable cases in this jurisdiction supports a valuation of $125,000–$175,000.",
      "We note that mediation may be appropriate if good-faith negotiation continues. Our authority for mediation has been obtained.",
      "REVISED SETTLEMENT DEMAND\n\nIn light of the additional treatment, updated specials, and revised prognosis, we hereby increase our demand to $165,000 (revised from the initial demand of $125,000).",
      "This revised demand will remain open for 21 days from the date of this letter.",
      "EXHIBITS INDEX\n- Exhibit A: Supplemental police report\n- Exhibit B: Updated medical records (May–August 2024)\n- Exhibit C: Revised billing statements\n- Exhibit D: Employer verification letter\n- Exhibit E: Life care plan update",
      "ATTORNEY CERTIFICATION\n\nI certify that the information contained herein is accurate and supported by the enclosed documentation.\n\nVery truly yours,\nDavis & Chen, Attorneys at Law",
      "APPENDIX — Comparative settlement data for similar claims in this venue showing median outcomes of $140,000–$180,000 for comparable injury patterns with similar treatment courses.",
    ],
    isOcrRequired: false,
    expectedLabels: ["attorney_demand", "settlement_posture", "specials_billing", "treatment_chronology", "future_damages", "wage_loss"],
    expectedChunkCountMin: 3,
    expectedChunkCountMax: 7,
    expectedExtractionPasses: ["demand_extraction"],
    expectedFailurePoints: [],
  },
];
