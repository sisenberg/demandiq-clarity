import { BookOpen, Clock } from "lucide-react";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";

interface Milestone {
  date: string;
  label: string;
  category: string;
  description: string;
  citations: CitationSource[];
}

const MOCK_MILESTONES: Milestone[] = [
  {
    date: "2024-11-15",
    label: "Motor Vehicle Accident",
    category: "Accident",
    description: "Rear-end collision on I-95 northbound at mile marker 42. Defendant ran red light at approximately 35 mph.",
    citations: [
      { docName: "Police Report #PR-2024-8812", page: "pg. 3", excerpt: "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection.", relevance: "direct" },
    ],
  },
  {
    date: "2024-11-15",
    label: "Emergency Room Visit",
    category: "First Treatment",
    description: "Presented to Mercy General ER with cervical strain, right shoulder contusion, and radiating pain to right upper extremity. CT of head negative.",
    citations: [
      { docName: "ER Records — Mercy General", page: "pg. 1", excerpt: "Patient presents with acute cervical strain, right shoulder contusion.", relevance: "direct" },
      { docName: "ER Records — Mercy General", page: "pg. 4", excerpt: "CT head without contrast: no acute intracranial abnormality.", relevance: "corroborating" },
    ],
  },
  {
    date: "2024-11-18",
    label: "Orthopedic Consultation",
    category: "Treatment",
    description: "Dr. Sarah Chen orthopedic evaluation. Recommended MRI of cervical spine and physical therapy referral.",
    citations: [
      { docName: "Medical Record — Dr. Chen", page: "pg. 2", relevance: "direct" },
    ],
  },
  {
    date: "2024-12-02",
    label: "Cervical MRI — Herniation Confirmed",
    category: "Imaging",
    description: "MRI revealed central disc herniation at C5-C6 with moderate foraminal narrowing. Neurosurgical consultation recommended.",
    citations: [
      { docName: "MRI Report — Regional Radiology", page: "pg. 7", excerpt: "Central disc herniation at C5-C6 with moderate foraminal narrowing.", relevance: "direct" },
    ],
  },
  {
    date: "2024-12-10",
    label: "Physical Therapy Initiated",
    category: "Treatment",
    description: "Began physical therapy at Advanced Rehab, 3x/week for 8 weeks. Initial cervical ROM significantly limited, pain rated 7/10.",
    citations: [
      { docName: "PT Records — Advanced Rehab", page: "pg. 2", excerpt: "Initial evaluation: cervical ROM significantly limited. Pain rated 7/10.", relevance: "direct" },
    ],
  },
  {
    date: "2025-01-15",
    label: "Epidural Steroid Injection #1",
    category: "Injection",
    description: "C5-C6 transforaminal epidural steroid injection performed by Dr. Patel. Partial pain relief reported at 2-week follow-up.",
    citations: [
      { docName: "Pain Management Records — Dr. Patel", page: "pg. 1", relevance: "direct" },
    ],
  },
  {
    date: "2025-02-15",
    label: "Independent Medical Examination",
    category: "IME",
    description: "Defense IME conducted by Dr. Roberts. Report concluded herniation is causally related but questioned necessity of surgical intervention.",
    citations: [
      { docName: "IME Report — Dr. Roberts", page: "pg. 5", excerpt: "The C5-C6 herniation is more likely than not causally related to the MVA.", relevance: "corroborating" },
      { docName: "IME Report — Dr. Roberts", page: "pg. 8", excerpt: "Conservative treatment has not been exhausted; surgery is premature.", relevance: "contradicting" },
    ],
  },
  {
    date: "2025-03-01",
    label: "Demand Package Sent",
    category: "Demand",
    description: "Initial demand letter transmitted to carrier. Demand amount: $285,000. Supporting documentation included medical records, billing summary, and chronology.",
    citations: [
      { docName: "Demand Letter v1", page: "pg. 1", relevance: "direct" },
    ],
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-[hsl(var(--status-processing))]",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
};

const ChronologyPanel = () => {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Case Chronology</h2>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
          {MOCK_MILESTONES.length} milestones
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {MOCK_MILESTONES.map((ms, idx) => {
              const dotColor = CATEGORY_COLORS[ms.category] ?? "bg-primary";
              return (
                <div key={idx} className="flex gap-4 py-3 relative group">
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-1.5 shrink-0">
                    <div className={`h-[11px] w-[11px] rounded-full ${dotColor} ring-2 ring-card`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Date + Category */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-foreground tabular-nums">{ms.date}</span>
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground"
                      >
                        {ms.category}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium text-foreground mb-1">{ms.label}</p>

                    {/* Description with inline citations */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ms.description}
                      {ms.citations.map((c, ci) => (
                        <CitationBadge key={ci} source={c} />
                      ))}
                    </p>

                    {/* Expanded citations on hover */}
                    {ms.citations.some((c) => c.excerpt) && (
                      <div className="mt-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity max-h-0 group-hover:max-h-96 overflow-hidden">
                        {ms.citations
                          .filter((c) => c.excerpt)
                          .map((c, ci) => (
                            <div key={ci} className="flex items-start gap-2 pl-3 border-l-2 border-primary/20">
                              <span className="text-[10px] font-semibold text-primary shrink-0 mt-0.5">{c.page}</span>
                              <span className="text-[11px] text-foreground font-mono leading-relaxed">"{c.excerpt}"</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export { MOCK_MILESTONES };
export default ChronologyPanel;
