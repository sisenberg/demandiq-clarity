import { useState, createContext, useContext, type ReactNode } from "react";
import { X, BookOpen, ExternalLink, FileText, ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import type { CitationSource } from "./EvidenceCitation";
import { resolveAnchor } from "@/lib/citationService";
import type { EvidenceAnchorRow, ResolvedCitation } from "@/types/evidence-anchor";
import { supabase } from "@/integrations/supabase/client";

// ─── Mock source page data ──────────────────────────────
export interface SourcePage {
  id: string;
  documentId: string;
  docName: string;
  pageNumber: number;
  pageLabel: string;
  documentType: string;
  extractedText: string;
  /** Simulated highlighted excerpts on this page */
  highlights: { text: string; relevance: "direct" | "corroborating" | "contradicting" | "contextual" }[];
}

export const MOCK_SOURCE_PAGES: SourcePage[] = [
  {
    id: "sp-01", documentId: "doc-police", docName: "Police Report #PR-2024-8812",
    pageNumber: 3, pageLabel: "pg. 3", documentType: "police_report",
    extractedText: `TRAFFIC COLLISION REPORT — SUPPLEMENTAL

On November 15, 2024, at approximately 14:32 hours, Unit 1 (2022 Freightliner, CA plate 8ABC123, operated by James Howell, DOB 03/15/1978) was traveling southbound on I-95 approaching the intersection of SR-42.

Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection at approximately 35 mph. Vehicle 2 (2021 Honda Accord, CA plate 7XYZ789, operated by Elena Martinez, DOB 06/22/1990) was traveling westbound through a green signal.

Impact was primarily to the rear driver's side quarter panel of Vehicle 2. Both vehicles were towed from the scene. Driver of Vehicle 2 was transported to Mercy General Hospital by ambulance.

Witness K. Donovan (pedestrian at adjacent crosswalk) stated: \"I saw the white truck go through the red light and hit the gray sedan.\"

Field sobriety: Vehicle 1 driver showed no signs of impairment. No citations issued at scene pending further investigation.

Conclusion: Vehicle 1 driver at fault for failure to obey traffic control device (CVC 21453(a)).`,
    highlights: [
      { text: "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection at approximately 35 mph.", relevance: "direct" },
      { text: "I saw the white truck go through the red light and hit the gray sedan.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-02", documentId: "doc-er", docName: "ER Records — Mercy General",
    pageNumber: 1, pageLabel: "pg. 1", documentType: "medical_record",
    extractedText: `EMERGENCY DEPARTMENT RECORD
Mercy General Hospital
Date of Service: November 15, 2024
Patient: Elena Martinez  DOB: 06/22/1990  MRN: MGH-2024-44891

CHIEF COMPLAINT: Motor vehicle accident — rear-end collision

HISTORY OF PRESENT ILLNESS:
Patient is a 34-year-old female presenting to the ED via ambulance following a motor vehicle collision. Patient was the restrained driver of a vehicle struck from the rear at an intersection. Patient reports immediate onset of neck pain, right shoulder pain, and numbness/tingling in the right hand.

PHYSICAL EXAMINATION:
- Cervical spine: Tenderness to palpation over C4-C6 spinous processes. Limited ROM due to pain.
- Right shoulder: Contusion visible over lateral aspect. Tenderness over rotator cuff. ROM limited by pain.
- Neurological: Grip strength 4/5 right hand. Sensation intact but diminished over C6 dermatome.

ASSESSMENT:
1. Acute cervical strain (S13.4XXA)
2. Right shoulder contusion (S40.011A)
3. Radiating pain to right upper extremity — rule out cervical radiculopathy

Patient presents with acute cervical strain, right shoulder contusion.`,
    highlights: [
      { text: "Patient presents with acute cervical strain, right shoulder contusion.", relevance: "direct" },
      { text: "Tenderness to palpation over C4-C6 spinous processes. Limited ROM due to pain.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-03", documentId: "doc-er", docName: "ER Records — Mercy General",
    pageNumber: 4, pageLabel: "pg. 4", documentType: "medical_record",
    extractedText: `RADIOLOGY REPORT — EMERGENCY
Mercy General Hospital

Study: CT Head without contrast
Date: November 15, 2024
Patient: Elena Martinez  MRN: MGH-2024-44891
Ordering Physician: Dr. J. Williams, ED

CLINICAL INDICATION: Motor vehicle accident, head trauma evaluation

FINDINGS:
- No acute intracranial hemorrhage
- No midline shift
- Ventricles are normal in size and configuration
- No acute fracture identified
- Paranasal sinuses are clear

IMPRESSION:
CT head without contrast: no acute intracranial abnormality.

Recommendation: Clinical correlation. If symptoms persist, consider MRI for further evaluation.`,
    highlights: [
      { text: "CT head without contrast: no acute intracranial abnormality.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-04", documentId: "doc-chen", docName: "Medical Record — Dr. Chen",
    pageNumber: 2, pageLabel: "pg. 2", documentType: "medical_record",
    extractedText: `ORTHOPEDIC CONSULTATION NOTE
Dr. Sarah Chen, MD — Orthopedic Surgery
Date: November 18, 2024
Patient: Elena Martinez

REASON FOR VISIT: Follow-up evaluation s/p MVA 11/15/2024

SUBJECTIVE:
Patient reports persistent neck pain (7/10), right shoulder pain (5/10), and intermittent numbness in right hand since the accident. Pain is worse with cervical rotation and overhead activities. Sleep disrupted by pain.

OBJECTIVE:
- Cervical ROM: Flexion 30° (normal 50°), Extension 25° (normal 60°), Rotation 40° bilaterally (normal 80°)
- Spurling's test: Positive on right
- Right shoulder: Neer's test positive, Hawkins positive

ASSESSMENT:
1. Cervical disc injury, suspected — recommend MRI cervical spine
2. Right rotator cuff strain
3. Rule out cervical radiculopathy C5-C6

PLAN:
1. Order MRI cervical spine without contrast
2. Refer to physical therapy — 3x/week for 8 weeks
3. Prescribe Meloxicam 15mg daily, Cyclobenzaprine 10mg at bedtime
4. Follow-up in 3 weeks with MRI results`,
    highlights: [
      { text: "Cervical disc injury, suspected — recommend MRI cervical spine", relevance: "direct" },
    ],
  },
  {
    id: "sp-05", documentId: "doc-chen", docName: "Dr. Chen Ortho Eval",
    pageNumber: 3, pageLabel: "pg. 3", documentType: "medical_record",
    extractedText: `ORTHOPEDIC FOLLOW-UP NOTE
Dr. Sarah Chen, MD
Date: December 18, 2024
Patient: Elena Martinez

MRI REVIEW:
Cervical MRI (12/02/2024) reviewed in clinic. Findings confirm central disc herniation at C5-C6 with moderate foraminal narrowing. Additionally noted: possible pre-existing degenerative changes at L4-L5, mild facet arthropathy.

DISCUSSION:
The C5-C6 herniation is consistent with the mechanism of injury (rear-end collision with hyperextension-hyperflexion). The L4-L5 findings may represent age-related changes versus trauma-related injury.

Recommendation: Continue PT. If cervical symptoms do not improve with 6-8 weeks of conservative treatment, consider pain management referral for epidural steroid injection. Possible pre-existing degenerative changes at L4-L5 should be monitored.

Note: No prior imaging available for comparison to determine chronicity of L4-L5 changes.`,
    highlights: [
      { text: "possible pre-existing degenerative changes at L4-L5", relevance: "contradicting" },
      { text: "No prior imaging available for comparison to determine chronicity of L4-L5 changes.", relevance: "contextual" },
    ],
  },
  {
    id: "sp-06", documentId: "doc-mri", docName: "MRI Report — Regional Radiology",
    pageNumber: 7, pageLabel: "pg. 7", documentType: "imaging_report",
    extractedText: `MAGNETIC RESONANCE IMAGING — CERVICAL SPINE
Regional Radiology Associates
Date: December 2, 2024
Patient: Elena Martinez  DOB: 06/22/1990
Ordering Physician: Dr. Sarah Chen

TECHNIQUE: Multiplanar multisequence MRI of the cervical spine without contrast.

FINDINGS:
C3-C4: No significant disc abnormality. Neural foramina patent.
C4-C5: Mild disc bulge without significant neural compression.
C5-C6: Central disc herniation with moderate foraminal narrowing, right greater than left. Mild mass effect on the ventral thecal sac. Right C6 nerve root compression suggested.
C6-C7: Small disc protrusion without significant stenosis.
C7-T1: Normal.

Spinal cord: Normal signal intensity. No syrinx.
Vertebral bodies: Normal marrow signal. No compression fractures.

IMPRESSION:
1. Central disc herniation at C5-C6 with moderate foraminal narrowing. Right C6 radiculopathy is clinically correlated.
2. Mild disc bulge at C4-C5, no significant compression.

Recommendation: Neurosurgical consultation recommended.`,
    highlights: [
      { text: "Central disc herniation at C5-C6 with moderate foraminal narrowing.", relevance: "direct" },
      { text: "Right C6 nerve root compression suggested.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-07", documentId: "doc-mri", docName: "MRI Report — Regional Radiology",
    pageNumber: 12, pageLabel: "pg. 12", documentType: "imaging_report",
    extractedText: `MAGNETIC RESONANCE IMAGING — RIGHT KNEE
Regional Radiology Associates
Date: December 2, 2024
Patient: Elena Martinez  DOB: 06/22/1990
Ordering Physician: Dr. Sarah Chen

TECHNIQUE: Multiplanar multisequence MRI of the right knee without contrast.

FINDINGS:
Menisci: Horizontal tear of the posterior horn of the medial meniscus extending to the inferior articular surface. Lateral meniscus intact.
Ligaments: ACL and PCL intact. MCL shows mild thickening, possibly representing grade 1 sprain. LCL intact.
Articular cartilage: Mild chondromalacia of the medial femoral condyle.
Bone: No fracture or bone contusion identified.
Joint effusion: Small.

IMPRESSION:
1. Medial meniscus tear — posterior horn, horizontal type
2. Mild MCL sprain
3. Small joint effusion

Clinical correlation recommended.`,
    highlights: [
      { text: "Medial meniscus tear — posterior horn, horizontal type", relevance: "direct" },
    ],
  },
  {
    id: "sp-08", documentId: "doc-pt", docName: "PT Records — Advanced Rehab",
    pageNumber: 2, pageLabel: "pg. 2", documentType: "medical_record",
    extractedText: `PHYSICAL THERAPY INITIAL EVALUATION
Advanced Rehabilitation Center
Date: December 10, 2024
Patient: Elena Martinez
Referring Physician: Dr. Sarah Chen
Diagnosis: Cervical disc herniation C5-C6, Right rotator cuff strain, Right knee meniscus tear

SUBJECTIVE:
Patient reports neck pain 7/10, right shoulder pain 4/10, right knee pain 3/10. Pain is constant with sharp exacerbations on cervical rotation and overhead reaching. Difficulty sleeping due to neck pain. Unable to perform work duties as warehouse logistics coordinator.

OBJECTIVE:
Cervical ROM: Significantly limited in all planes (see measurements above).
Right shoulder: Active flexion 120° (normal 180°), abduction 100° (normal 180°).
Right knee: Flexion 110° (normal 140°), positive McMurray's test.
Strength: Right grip 4/5, right shoulder flexion 4-/5.

ASSESSMENT:
Initial evaluation: cervical ROM significantly limited. Pain rated 7/10. Significant functional limitations affecting ADLs and work capacity.

PLAN:
Treatment 3x/week for 8 weeks (24 sessions). Manual therapy, therapeutic exercise, modalities, progressive functional restoration.`,
    highlights: [
      { text: "Initial evaluation: cervical ROM significantly limited. Pain rated 7/10.", relevance: "direct" },
      { text: "Unable to perform work duties as warehouse logistics coordinator.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-09", documentId: "doc-pt", docName: "PT Records — Advanced Rehab",
    pageNumber: 22, pageLabel: "pg. 22", documentType: "medical_record",
    extractedText: `PHYSICAL THERAPY DISCHARGE SUMMARY
Advanced Rehabilitation Center
Date: March 28, 2025
Patient: Elena Martinez

TREATMENT SUMMARY:
Total sessions prescribed: 36
Total sessions completed: 24
Sessions missed/cancelled: 12 (patient cited work schedule conflicts and transportation issues)

PROGRESS:
Cervical ROM improved from initial evaluation:
- Flexion: 30° → 42° (normal 50°)
- Extension: 25° → 38° (normal 60°)
- Rotation: 40° → 58° (normal 80°)

Pain level improved from 7/10 to 5/10 at rest.
Right shoulder ROM normalized.
Right knee pain resolved with conservative management.

FUNCTIONAL STATUS:
Patient has not returned to work. Modified duty not available at employer. Continued limitations with overhead activities and prolonged sitting >30 minutes.

RECOMMENDATION:
Continued home exercise program. Follow-up with orthopedic surgeon regarding cervical symptoms. Patient would benefit from additional PT sessions if able to comply with schedule.`,
    highlights: [
      { text: "Total sessions prescribed: 36\nTotal sessions completed: 24", relevance: "contradicting" },
      { text: "Patient has not returned to work.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-10", documentId: "doc-patel", docName: "Pain Management Records — Dr. Patel",
    pageNumber: 1, pageLabel: "pg. 1", documentType: "medical_record",
    extractedText: `PAIN MANAGEMENT CONSULTATION
Dr. Raj Patel, MD — Interventional Pain Management
Date: January 10, 2025
Patient: Elena Martinez
Referred by: Dr. Sarah Chen

Reason for referral: Persistent cervical radiculopathy despite 4 weeks of PT.

PLAN:
C5-C6 transforaminal epidural steroid injection under fluoroscopic guidance.
Scheduled: January 15, 2025.

PROCEDURE NOTE (01/15/2025):
C5-C6 right transforaminal epidural steroid injection performed under fluoroscopy. No complications. Patient tolerated procedure well.

FOLLOW-UP (01/29/2025):
Partial relief reported — pain decreased from 7/10 to 4/10. Duration of relief approximately 10 days before partial return of symptoms. Will consider repeat injection in 6-8 weeks if symptoms persist.`,
    highlights: [
      { text: "C5-C6 right transforaminal epidural steroid injection performed under fluoroscopy.", relevance: "direct" },
      { text: "Partial relief reported — pain decreased from 7/10 to 4/10.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-11", documentId: "doc-ime", docName: "IME Report — Dr. Roberts",
    pageNumber: 5, pageLabel: "pg. 5", documentType: "expert_report",
    extractedText: `INDEPENDENT MEDICAL EXAMINATION REPORT
Dr. William Roberts, MD — Orthopedic Surgery
Date of Examination: February 15, 2025
Examinee: Elena Martinez
Retaining Party: Defense counsel — Pacific Freight Lines

CAUSATION OPINION:

Based on my review of the medical records and physical examination, it is my opinion, to a reasonable degree of medical probability, that:

1. The C5-C6 herniation is more likely than not causally related to the MVA of 11/15/2024. The mechanism of injury (rear-end collision with hyperextension-hyperflexion) is consistent with disc herniation at this level.

2. The right shoulder contusion is directly related to the accident and has resolved.

3. The right knee meniscus tear is possibly related to the accident, though the mechanism is less clear for a rear-end collision.

4. The L4-L5 findings are indeterminate — degenerative changes noted on imaging may or may not be pre-existing.`,
    highlights: [
      { text: "The C5-C6 herniation is more likely than not causally related to the MVA.", relevance: "corroborating" },
    ],
  },
  {
    id: "sp-12", documentId: "doc-ime", docName: "IME Report — Dr. Roberts",
    pageNumber: 8, pageLabel: "pg. 8", documentType: "expert_report",
    extractedText: `TREATMENT OPINIONS (continued):

Surgical Intervention:
At this time, I do not believe that surgical intervention is warranted for the C5-C6 herniation. Conservative treatment has not been exhausted; surgery is premature. The patient has completed only 24 of 36 prescribed physical therapy sessions and has received only two epidural injections. Standard of care typically requires completion of conservative measures before considering surgical options.

Recommendations:
1. Complete the full course of prescribed physical therapy
2. Consider a third epidural injection if symptoms persist
3. Re-evaluate for surgical candidacy after 6 months of completed conservative care
4. Functional capacity evaluation should be performed to objectively assess work restrictions

Maximum Medical Improvement: Not yet reached. Estimated 6-12 months from current date with compliance to treatment recommendations.`,
    highlights: [
      { text: "Conservative treatment has not been exhausted; surgery is premature.", relevance: "contradicting" },
      { text: "completed only 24 of 36 prescribed physical therapy sessions", relevance: "contradicting" },
    ],
  },
  {
    id: "sp-13", documentId: "doc-demand", docName: "Demand Letter v1",
    pageNumber: 1, pageLabel: "pg. 1", documentType: "legal_filing",
    extractedText: `DEMAND FOR SETTLEMENT

Date: March 1, 2025

To: Pacific Freight Lines Insurance
Re: Elena Martinez v. Pacific Freight Lines, Inc.
Claim No: PFL-2024-INJ-0187
Date of Loss: November 15, 2024

Dear Claims Adjuster:

On behalf of our client Elena Martinez, we hereby demand the sum of $285,000.00 in full and final settlement of all claims arising from the motor vehicle accident of November 15, 2024.

This demand is supported by the enclosed documentation including:
1. Medical chronology and narrative summary
2. Complete medical records and billing statements
3. Police report and witness statement
4. Lost wage documentation
5. Pain and suffering analysis

SPECIAL DAMAGES:
- Medical expenses (billed): $87,450.00
- Lost wages (to date): $24,500.00
- Future medical (estimated): $35,000.00

GENERAL DAMAGES:
- Pain and suffering, loss of enjoyment of life: $138,050.00

TOTAL DEMAND: $285,000.00

We request your response within thirty (30) days.`,
    highlights: [
      { text: "we hereby demand the sum of $285,000.00 in full and final settlement", relevance: "direct" },
    ],
  },
  {
    id: "sp-14", documentId: "doc-witness", docName: "Witness Statement — K. Donovan",
    pageNumber: 1, pageLabel: "pg. 1", documentType: "correspondence",
    extractedText: `WITNESS STATEMENT

Name: Kevin Donovan
Date: November 15, 2024
Location: Intersection of I-95 and SR-42

I was standing at the crosswalk on the northeast corner of the intersection waiting for the pedestrian signal. I had a clear view of the traffic lights and both vehicles.

I saw the white truck go through the red light and hit the gray sedan. The sedan had a green light and was going through the intersection at normal speed. The truck did not appear to brake before impact.

After the collision, the sedan spun about 90 degrees. I called 911 immediately. The driver of the sedan (a woman) appeared to be in pain and was holding her neck.

I am willing to provide further testimony if needed.

Signed: Kevin Donovan
Contact: (555) 234-5678`,
    highlights: [
      { text: "I saw the white truck go through the red light and hit the gray sedan.", relevance: "corroborating" },
      { text: "The truck did not appear to brake before impact.", relevance: "corroborating" },
    ],
  },
];

// ─── Lookup helper ──────────────────────────────────────
export function findSourcePage(docName: string, page: string): SourcePage | undefined {
  return MOCK_SOURCE_PAGES.find(
    (sp) =>
      sp.docName.toLowerCase().includes(docName.toLowerCase().split("—")[0].trim().substring(0, 15)) &&
      sp.pageLabel === page
  );
}

// ─── Source Drawer Context ──────────────────────────────
interface SourceDrawerState {
  open: boolean;
  source: CitationSource | null;
  page: SourcePage | null;
  resolvedCitation: ResolvedCitation | null;
  loading: boolean;
}

interface SourceDrawerContextValue {
  state: SourceDrawerState;
  openSource: (citation: CitationSource) => void;
  openSourceFromAnchor: (anchor: EvidenceAnchorRow) => void;
  close: () => void;
}

const SourceDrawerContext = createContext<SourceDrawerContextValue>({
  state: { open: false, source: null, page: null, resolvedCitation: null, loading: false },
  openSource: () => {},
  openSourceFromAnchor: () => {},
  close: () => {},
});

export const useSourceDrawer = () => useContext(SourceDrawerContext);

export const SourceDrawerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SourceDrawerState>({
    open: false,
    source: null,
    page: null,
    resolvedCitation: null,
    loading: false,
  });

  const openSource = async (citation: CitationSource) => {
    // If citation has an anchorId, resolve from DB
    if (citation.anchorId) {
      setState({ open: true, source: citation, page: null, resolvedCitation: null, loading: true });
      try {
        const { data } = await (supabase.from("evidence_references") as any)
          .select("*")
          .eq("id", citation.anchorId)
          .single();
        if (data) {
          const resolved = await resolveAnchor(data as EvidenceAnchorRow);
          const page = resolvedToSourcePage(resolved);
          setState({ open: true, source: citation, page, resolvedCitation: resolved, loading: false });
          return;
        }
      } catch {
        // Fall through to mock
      }
    }

    // If citation has documentId but no anchorId, try DB page lookup
    if (citation.documentId) {
      setState({ open: true, source: citation, page: null, resolvedCitation: null, loading: true });
      try {
        const pageNum = parseInt(citation.page.replace(/\D/g, ""), 10);
        if (!isNaN(pageNum)) {
          // Try parsed_document_pages first
          const { data: parsed } = await (supabase.from("parsed_document_pages") as any)
            .select("page_text, provider, parse_version")
            .eq("document_id", citation.documentId)
            .eq("page_number", pageNum)
            .eq("is_current", true)
            .single();

          const { data: doc } = await supabase
            .from("case_documents")
            .select("file_name, document_type")
            .eq("id", citation.documentId)
            .single();

          if (parsed || doc) {
            let pageText = parsed?.page_text;
            if (!pageText) {
              const { data: rawPage } = await supabase
                .from("document_pages")
                .select("extracted_text")
                .eq("document_id", citation.documentId)
                .eq("page_number", pageNum)
                .single();
              pageText = rawPage?.extracted_text;
            }

            const page: SourcePage = {
              id: `db-${citation.documentId}-${pageNum}`,
              documentId: citation.documentId,
              docName: doc?.file_name ?? citation.docName,
              pageNumber: pageNum,
              pageLabel: citation.page,
              documentType: doc?.document_type ?? "unknown",
              extractedText: pageText ?? "",
              highlights: citation.excerpt
                ? [{ text: citation.excerpt, relevance: (citation.relevance ?? "direct") as any }]
                : [],
            };
            setState({ open: true, source: citation, page, resolvedCitation: null, loading: false });
            return;
          }
        }
      } catch {
        // Fall through to mock
      }
    }

    // Mock fallback
    const page = findSourcePage(citation.docName, citation.page);
    setState({ open: true, source: citation, page: page ?? null, resolvedCitation: null, loading: false });
  };

  const openSourceFromAnchor = async (anchor: EvidenceAnchorRow) => {
    setState({ open: true, source: null, page: null, resolvedCitation: null, loading: true });
    try {
      const resolved = await resolveAnchor(anchor);
      const page = resolvedToSourcePage(resolved);
      const citation: CitationSource = {
        docName: resolved.fileName,
        page: `pg. ${anchor.page_number}`,
        excerpt: anchor.quoted_text || undefined,
        relevance: anchor.evidence_type as any,
        documentId: anchor.document_id,
        anchorId: anchor.id,
        parseVersion: resolved.parseVersion ?? undefined,
        chunkId: anchor.chunk_id ?? undefined,
      };
      setState({ open: true, source: citation, page, resolvedCitation: resolved, loading: false });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  };

  const close = () => setState({ open: false, source: null, page: null, resolvedCitation: null, loading: false });

  return (
    <SourceDrawerContext.Provider value={{ state, openSource, openSourceFromAnchor, close }}>
      {children}
    </SourceDrawerContext.Provider>
  );
};

/** Convert a ResolvedCitation to a SourcePage for display */
function resolvedToSourcePage(resolved: ResolvedCitation): SourcePage | null {
  if (!resolved.pageText) return null;
  return {
    id: `resolved-${resolved.anchor.id}`,
    documentId: resolved.anchor.document_id,
    docName: resolved.fileName,
    pageNumber: resolved.anchor.page_number,
    pageLabel: `pg. ${resolved.anchor.page_number}`,
    documentType: resolved.documentType,
    extractedText: resolved.pageText,
    highlights: resolved.anchor.quoted_text
      ? [{ text: resolved.anchor.quoted_text, relevance: (resolved.anchor.evidence_type ?? "direct") as any }]
      : [],
  };
}

// ─── Relevance badge styles ─────────────────────────────
const RELEVANCE_STYLE: Record<string, string> = {
  direct: "bg-primary/10 text-primary border-primary/20",
  corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
  contradicting: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.2)]",
  contextual: "bg-accent text-muted-foreground border-border",
};

// ─── Source Drawer Component ────────────────────────────
export const SourceDrawer = () => {
  const { state, close } = useSourceDrawer();

  if (!state.open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/15 backdrop-blur-[1px] z-40 transition-opacity"
        onClick={close}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-card border-l border-border z-50 flex flex-col animate-in slide-in-from-right duration-200"
        style={{ boxShadow: '-8px 0 30px -10px rgb(0 0 0 / 0.08)' }}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-foreground truncate">
              {state.source?.docName ?? "Source Document"}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold bg-primary/8 text-primary px-1.5 py-0.5 rounded-md">
                {state.source?.page}
              </span>
              {state.source?.relevance && (
                <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${RELEVANCE_STYLE[state.source.relevance]}`}>
                  {state.source.relevance}
                </span>
              )}
              {state.resolvedCitation?.parseVersion != null && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-muted-foreground bg-accent px-1.5 py-0.5 rounded border border-border">
                  <GitBranch className="h-2 w-2" />
                  v{state.resolvedCitation.parseVersion}
                </span>
              )}
              {state.source?.parseVersion != null && !state.resolvedCitation && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold text-muted-foreground bg-accent px-1.5 py-0.5 rounded border border-border">
                  <GitBranch className="h-2 w-2" />
                  v{state.source.parseVersion}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {state.loading ? (
            <div className="p-5 text-center pt-16">
              <div className="h-12 w-12 rounded-xl bg-accent/60 mx-auto flex items-center justify-center mb-3.5 animate-pulse">
                <BookOpen className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-[13px] font-semibold text-foreground mb-1">Loading source…</p>
              <p className="text-[11px] text-muted-foreground">Resolving citation from database</p>
            </div>
          ) : state.page ? (
            <div className="p-5">
              {/* Document meta */}
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground capitalize">{state.page.documentType.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] font-medium text-foreground">Page {state.page.pageNumber}</span>
              </div>

              {/* Highlighted excerpt callout */}
              {state.source?.excerpt && (
                <div className="mb-5 rounded-lg border border-primary/15 bg-primary/3 p-3.5">
                  <p className="text-[9px] font-semibold text-primary uppercase tracking-wider mb-2">Referenced Excerpt</p>
                  <blockquote className="text-[12px] text-foreground leading-relaxed evidence-text">
                    "{state.source.excerpt}"
                  </blockquote>
                </div>
              )}

              {/* Full page text with highlights */}
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Extracted Text — Page {state.page.pageNumber}
                </p>
                <div className="text-[11px] text-foreground leading-relaxed evidence-text whitespace-pre-wrap">
                  <HighlightedText
                    text={state.page.extractedText}
                    highlights={state.page.highlights}
                  />
                </div>
              </div>

              {/* Other highlights on this page */}
              {state.page.highlights.length > 0 && (
                <div className="mt-4">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Evidence Highlights
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {state.page.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 p-2.5">
                        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${RELEVANCE_STYLE[h.relevance]}`}>
                          {h.relevance}
                        </span>
                        <p className="text-[11px] text-foreground leading-relaxed evidence-text">"{h.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-center pt-16">
              <div className="h-12 w-12 rounded-xl bg-accent/60 mx-auto flex items-center justify-center mb-3.5">
                <FileText className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="text-[13px] font-semibold text-foreground mb-1">Source page not available</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                The extracted source page for this citation has not been processed yet.
              </p>
              {state.source?.excerpt && (
                <blockquote className="mt-5 text-[12px] text-foreground leading-relaxed pl-3 border-l-2 border-primary/20 evidence-text text-left mx-auto max-w-md">
                  "{state.source.excerpt}"
                </blockquote>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Text highlighter ───────────────────────────────────
function HighlightedText({
  text,
  highlights,
}: {
  text: string;
  highlights: { text: string; relevance: string }[];
}) {
  if (highlights.length === 0) return <>{text}</>;

  // Find highlight positions
  type Segment = { start: number; end: number; relevance: string };
  const segments: Segment[] = [];

  for (const h of highlights) {
    const idx = text.indexOf(h.text);
    if (idx >= 0) {
      segments.push({ start: idx, end: idx + h.text.length, relevance: h.relevance });
    }
  }

  segments.sort((a, b) => a.start - b.start);

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const seg of segments) {
    if (seg.start > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, seg.start)}</span>);
    }
    const bgColor =
      seg.relevance === "direct" ? "bg-primary/15" :
      seg.relevance === "contradicting" ? "bg-destructive/10" :
      seg.relevance === "corroborating" ? "bg-[hsl(var(--status-approved)/0.1)]" :
      "bg-accent";
    parts.push(
      <mark key={`h-${seg.start}`} className={`${bgColor} rounded px-0.5 not-italic`}>
        {text.slice(seg.start, seg.end)}
      </mark>
    );
    cursor = seg.end;
  }
  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

