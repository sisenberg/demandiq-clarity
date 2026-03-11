import { useState } from "react";
import {
  Pencil,
  Download,
  MoreHorizontal,
  Plus,
  ChevronRight,
} from "lucide-react";
import { EvidenceStatement, CitationBadge, type CitationSource } from "./EvidenceCitation";

// ─── Sub-tab definitions ────────────────────────────────
interface SubTab {
  key: string;
  label: string;
}

const TABS: SubTab[] = [
  { key: "claim", label: "Claim Assessment" },
  { key: "chrono", label: "Chronological Summary" },
  { key: "codes", label: "Medical Codes" },
  { key: "billing", label: "Billing" },
  { key: "providers", label: "Providers" },
  { key: "demand", label: "Demand Package" },
];

// ─── Claim Assessment content ───────────────────────────

interface Section {
  title: string;
  content: { text: string; citations: CitationSource[] }[];
}

const CLAIM_SECTIONS: Section[] = [
  {
    title: "Accident Details",
    content: [
      {
        text: "On November 15, 2024, claimant Elena Martinez was traveling northbound on I-95 when defendant's vehicle, operated by Pacific Freight Lines driver James Howell, failed to stop at a red signal and struck claimant's vehicle at approximately 35 mph.",
        citations: [
          { docName: "Police Report #PR-2024-8812", page: "pg. 3", excerpt: "Vehicle 1 failed to stop at red signal, striking Vehicle 2 in the intersection.", relevance: "direct" },
        ],
      },
      {
        text: "Impact was primarily to the rear driver's side. Airbags deployed. Claimant was wearing a seatbelt at the time of collision. Vehicle was towed from the scene.",
        citations: [
          { docName: "Police Report #PR-2024-8812", page: "pg. 4", relevance: "corroborating" },
        ],
      },
    ],
  },
  {
    title: "Liability & Mechanism of Injury",
    content: [
      {
        text: "Liability is clear — defendant ran a red light as confirmed by the investigating officer's report and a witness statement from a bystander at the adjacent crosswalk. No contributory negligence by claimant.",
        citations: [
          { docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" },
          { docName: "Witness Statement — K. Donovan", page: "pg. 1", excerpt: "I saw the white truck go through the red light and hit the gray sedan.", relevance: "corroborating" },
        ],
      },
      {
        text: "Mechanism of injury is consistent with rear-end impact causing cervical hyperextension-hyperflexion and compressive forces on the lumbar spine. Shoulder contusion from seatbelt restraint and lateral impact forces.",
        citations: [
          { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
        ],
      },
    ],
  },
  {
    title: "Injuries",
    content: [
      {
        text: "C5-C6 central disc herniation with moderate foraminal narrowing (M50.12). MRI confirmed on 12/02/2024. Neurosurgical consultation recommended.",
        citations: [
          { docName: "MRI Report — Regional Radiology", page: "pg. 7", excerpt: "Central disc herniation at C5-C6 with moderate foraminal narrowing.", relevance: "direct" },
        ],
      },
      {
        text: "Right shoulder rotator cuff strain with contusion (S46.011A). Diagnosed on initial ER visit. Resolved after 6 weeks of physical therapy.",
        citations: [
          { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
        ],
      },
      {
        text: "Lumbar strain L4-L5 with possible pre-existing degenerative changes (M54.5). Defense may argue contribution; however, claimant had no prior treatment for lumbar symptoms.",
        citations: [
          { docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "direct" },
          { docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "contradicting" },
        ],
      },
      {
        text: "Right medial meniscus tear (S83.211A). MRI confirmed. Conservative treatment prescribed.",
        citations: [
          { docName: "MRI Report — Regional Radiology", page: "pg. 12", relevance: "direct" },
        ],
      },
    ],
  },
  {
    title: "Treatment Overview",
    content: [
      {
        text: "Emergency department care at Mercy General on date of loss. Follow-up orthopedic evaluation by Dr. Sarah Chen on 11/18/2024. Cervical and knee MRIs obtained 12/02/2024.",
        citations: [
          { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
          { docName: "Medical Record — Dr. Chen", page: "pg. 2", relevance: "direct" },
        ],
      },
      {
        text: "24 of 36 prescribed physical therapy sessions completed at Advanced Rehab (3x/week, 8 weeks). Two C5-C6 transforaminal epidural steroid injections performed by Dr. Patel on 01/15/2025 and 03/10/2025. Partial relief reported.",
        citations: [
          { docName: "PT Records — Advanced Rehab", page: "pg. 2", excerpt: "Initial evaluation: cervical ROM significantly limited. Pain rated 7/10.", relevance: "direct" },
          { docName: "Pain Management Records — Dr. Patel", page: "pg. 1", relevance: "direct" },
        ],
      },
    ],
  },
  {
    title: "Pain & Functional Analysis",
    content: [
      {
        text: "Claimant reports persistent cervical pain rated 5–7/10 at most recent visit. Pain is described as constant, dull ache with sharp exacerbation on cervical rotation. Sleep disruption 4–5 nights per week.",
        citations: [
          { docName: "Dr. Chen Follow-up — 02/28/2025", page: "pg. 1", relevance: "direct" },
        ],
      },
      {
        text: "Functional limitations include inability to lift >10 lbs overhead, difficulty with prolonged sitting (>30 min), and reduced cervical ROM (40% of baseline). Claimant unable to return to prior occupation as warehouse logistics coordinator.",
        citations: [
          { docName: "PT Records — Advanced Rehab", page: "pg. 18", excerpt: "Functional capacity assessment indicates significant limitation in overhead activities and prolonged static postures.", relevance: "direct" },
        ],
      },
    ],
  },
  {
    title: "Gaps, Issues & Inconsistencies",
    content: [
      {
        text: "14-day gap between ER visit (11/15) and first orthopedic follow-up (11/18 — originally documented as 11/28 in some records). Dates should be reconciled across medical records.",
        citations: [],
      },
      {
        text: "Patient completed only 24 of 36 prescribed PT sessions (67% compliance). Defense may argue non-compliance diminishes claimed damages.",
        citations: [
          { docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" },
        ],
      },
      {
        text: "Dr. Chen notes 'possible pre-existing degenerative changes at L4-L5.' No prior imaging available for comparison. Consider requesting prior medical records from PCP to address causation.",
        citations: [
          { docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" },
        ],
      },
      {
        text: "Defense IME by Dr. Roberts concurs on herniation causation but disputes surgical necessity, stating 'conservative treatment has not been exhausted.' This is a key defense argument to rebut.",
        citations: [
          { docName: "IME Report — Dr. Roberts", page: "pg. 8", excerpt: "Conservative treatment has not been exhausted; surgery is premature.", relevance: "contradicting" },
        ],
      },
    ],
  },
];

// ─── Placeholder tab content ────────────────────────────
const PLACEHOLDER_CONTENT: Record<string, { title: string; items: string[] }> = {
  chrono: {
    title: "Chronological Summary",
    items: [
      "11/15/2024 — MVA on I-95; ER visit at Mercy General",
      "11/18/2024 — Orthopedic evaluation with Dr. Chen",
      "12/02/2024 — Cervical MRI confirms C5-C6 herniation",
      "12/10/2024 — Physical therapy initiated at Advanced Rehab",
      "01/15/2025 — First epidural steroid injection (Dr. Patel)",
      "02/15/2025 — Defense IME by Dr. Roberts",
      "03/01/2025 — Demand package sent to carrier ($285,000)",
      "03/10/2025 — Second epidural steroid injection",
    ],
  },
  codes: {
    title: "Medical Codes",
    items: [
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
  },
  billing: {
    title: "Billing Summary",
    items: [
      "Mercy General ER — $4,280 (paid: $3,200)",
      "Dr. Chen Orthopedics — $2,850 (paid: $2,100)",
      "Regional Radiology (MRI x2) — $6,400 (paid: $4,800)",
      "Advanced Rehab (PT 24 sessions) — $9,600 (paid: $7,200)",
      "Dr. Patel Pain Management (2 injections) — $12,400 (paid: $9,300)",
      "Pharmacy — $1,920 (paid: $1,600)",
      "Total Billed: $87,450 | Total Paid: $62,200 | Adjusted: $25,250",
    ],
  },
  providers: {
    title: "Provider Summary",
    items: [
      "Dr. Sarah Chen — Orthopedics — Primary treating physician, 6 visits",
      "Dr. Raj Patel — Pain Management — ESI provider, 3 visits",
      "Advanced Rehab — Physical Therapy — 24 sessions completed",
      "Mercy General Hospital — ER — Initial emergency treatment",
      "Regional Radiology — Imaging — MRI cervical + knee",
      "Dr. William Roberts — IME — Defense-retained examiner",
    ],
  },
  demand: {
    title: "Demand Package",
    items: [
      "Demand Amount: $285,000",
      "Special Damages: $87,450 (medical specials)",
      "General Damages: $197,550 (pain & suffering, loss of enjoyment)",
      "Package includes: medical chronology, billing summary, liability memo, and supporting exhibits",
      "Status: Transmitted to carrier 03/01/2025, awaiting response",
    ],
  },
};

// ─── Component ──────────────────────────────────────────
const CaseNotesPanel = () => {
  const [activeTab, setActiveTab] = useState("claim");

  return (
    <div className="card-elevated overflow-hidden">
      {/* ── Header ────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 bg-card">
        <h2 className="text-sm font-semibold text-foreground">Case Notes</h2>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <ActionButton icon={Pencil} label="Edit" />
          <ActionButton icon={Download} label="Export" />
          <ActionButton icon={MoreHorizontal} />
        </div>
      </div>

      {/* ── Sub-tabs ──────────────────────── */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center px-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
          {/* Add tab button */}
          <button className="ml-1 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────── */}
      <div className="bg-card">
        {activeTab === "claim" ? (
          <ClaimAssessmentContent />
        ) : (
          <PlaceholderTabContent data={PLACEHOLDER_CONTENT[activeTab]} />
        )}
      </div>
    </div>
  );
};

// ─── Claim Assessment ───────────────────────────────────
const ClaimAssessmentContent = () => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    Object.fromEntries(CLAIM_SECTIONS.map((_, i) => [i, true]))
  );

  const toggle = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="divide-y divide-border">
      {CLAIM_SECTIONS.map((section, idx) => (
        <div key={idx}>
          {/* Section header */}
          <button
            onClick={() => toggle(idx)}
            className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-accent/30 transition-colors"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                expanded[idx] ? "rotate-90" : ""
              }`}
            />
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          </button>

          {/* Section body */}
          {expanded[idx] && (
            <div className="px-5 pb-4 pl-10 flex flex-col gap-2.5">
              {section.content.map((block, bi) => (
                <p key={bi} className="text-sm text-foreground leading-relaxed">
                  <EvidenceStatement text={block.text} citations={block.citations} />
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Placeholder tab ────────────────────────────────────
const PlaceholderTabContent = ({
  data,
}: {
  data?: { title: string; items: string[] };
}) => {
  if (!data) return <div className="px-5 py-8 text-center text-xs text-muted-foreground">Tab content coming soon.</div>;

  return (
    <div className="px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{data.title}</h3>
      <div className="flex flex-col gap-2">
        {data.items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 py-1.5"
          >
            <span className="text-[10px] font-mono text-muted-foreground mt-0.5 shrink-0 w-4 text-right">
              {i + 1}.
            </span>
            <p className="text-sm text-foreground leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Small action button ────────────────────────────────
function ActionButton({ icon: Icon, label }: { icon: React.ElementType; label?: string }) {
  return (
    <button
      className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

export default CaseNotesPanel;
