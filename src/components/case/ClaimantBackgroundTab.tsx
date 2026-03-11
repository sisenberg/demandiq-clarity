import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import {
  ChevronDown,
  ChevronRight,
  Briefcase,
  AlertTriangle,
  Activity,
  Brain,
  HeartPulse,
  Bone,
  ShieldAlert,
  User,
  FileWarning,
  Wine,
  Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
type RiskLevel = "none" | "low" | "moderate" | "high";

interface BackgroundItem {
  id: string;
  label: string;
  detail: string;
  date?: string;
  riskLevel: RiskLevel;
  impactAreas: string[];
  citations?: CitationSource[];
}

interface BackgroundSection {
  id: string;
  title: string;
  icon: React.ElementType;
  riskLevel: RiskLevel;
  summary: string;
  items: BackgroundItem[];
}

// ─── Risk styling ────────────────────────────────────
const RISK_CONFIG: Record<RiskLevel, { label: string; class: string; dotClass: string }> = {
  none: { label: "None Identified", class: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", dotClass: "bg-[hsl(var(--status-approved))]" },
  low: { label: "Low", class: "bg-accent text-muted-foreground", dotClass: "bg-muted-foreground" },
  moderate: { label: "Moderate", class: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]", dotClass: "bg-[hsl(var(--status-attention))]" },
  high: { label: "High", class: "bg-destructive/10 text-destructive", dotClass: "bg-destructive" },
};

const IMPACT_CHIP: Record<string, string> = {
  causation: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.2)]",
  credibility: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))] border-[hsl(var(--status-attention)/0.2)]",
  damages: "bg-primary/10 text-primary border-primary/20",
  baseline: "bg-accent text-muted-foreground border-border",
};

// ─── Mock Data ───────────────────────────────────────
const SECTIONS: BackgroundSection[] = [
  {
    id: "occupation",
    title: "Occupation, Wage & Contact",
    icon: Briefcase,
    riskLevel: "low",
    summary: "Full-time warehouse logistics coordinator. Physical demands documented.",
    items: [
      { id: "occ-1", label: "Occupation", detail: "Warehouse Logistics Coordinator at Pacific Distribution Center. Full-time, 40 hrs/week. Role involves inventory tracking, coordinating shipments, light lifting (up to 30 lbs), prolonged standing and walking.", riskLevel: "low", impactAreas: ["baseline", "damages"], citations: [{ docName: "Employment Records — Pacific Distribution", page: "pg. 2", relevance: "direct" }] },
      { id: "occ-2", label: "Wage Information", detail: "Annual salary: $58,500 ($28.13/hr). Currently on light-duty restrictions per Dr. Chen, resulting in reduced hours (32 hrs/week). Lost wages from 11/15/2024 through 12/23/2024 (return to light duty).", riskLevel: "low", impactAreas: ["damages"], citations: [{ docName: "Employment Records — Pacific Distribution", page: "pg. 4", relevance: "direct" }] },
      { id: "occ-3", label: "Contact Information", detail: "Elena Martinez, DOB 06/22/1990 (Age 34). 1847 Willow Creek Drive, Sacramento, CA 95822. Phone: (916) 555-0147. Email: e.martinez@email.com.", riskLevel: "none", impactAreas: [] },
    ],
  },
  {
    id: "prior-injuries",
    title: "Prior Injuries",
    icon: Activity,
    riskLevel: "moderate",
    summary: "L4-L5 degenerative changes noted — no prior imaging for comparison.",
    items: [
      { id: "pi-1", label: "L4-L5 Degenerative Changes", detail: "Dr. Chen noted 'possible pre-existing degenerative changes at L4-L5' during orthopedic evaluation. No prior lumbar imaging available for comparison. No prior PCP records obtained to confirm or deny prior lumbar complaints. This is a key vulnerability in the demand.", date: "Noted 11/18/2024", riskLevel: "high", impactAreas: ["causation", "damages"], citations: [{ docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" }] },
      { id: "pi-2", label: "No Other Documented Prior Injuries", detail: "Claimant denies prior neck, shoulder, or knee injuries on intake questionnaire. No prior orthopedic records identified. ISO ClaimSearch pending.", riskLevel: "low", impactAreas: ["causation"] },
    ],
  },
  {
    id: "prior-accidents",
    title: "Prior Accidents",
    icon: ShieldAlert,
    riskLevel: "low",
    summary: "No prior accident claims identified. ISO search pending.",
    items: [
      { id: "pa-1", label: "ISO ClaimSearch Pending", detail: "Prior claims search has been requested but results not yet received. No prior accident claims disclosed by claimant on intake forms.", riskLevel: "low", impactAreas: ["causation", "credibility"] },
      { id: "pa-2", label: "Claimant Self-Report", detail: "Claimant denies any prior motor vehicle accidents or workers' compensation claims on intake questionnaire dated 11/18/2024.", riskLevel: "none", impactAreas: ["credibility"] },
    ],
  },
  {
    id: "chronic-conditions",
    title: "Chronic Conditions",
    icon: HeartPulse,
    riskLevel: "low",
    summary: "Mild hypertension noted — no impact on claimed injuries.",
    items: [
      { id: "cc-1", label: "Hypertension (Controlled)", detail: "ER intake notes 'history of mild hypertension, managed with Lisinopril 10mg daily.' No cardiovascular impact on musculoskeletal treatment. Not expected to affect causation or damages analysis.", date: "Documented 11/15/2024", riskLevel: "none", impactAreas: ["baseline"], citations: [{ docName: "ER Records — Mercy General", page: "pg. 2", relevance: "contextual" }] },
      { id: "cc-2", label: "No Other Chronic Conditions", detail: "No diabetes, autoimmune conditions, fibromyalgia, or other chronic pain conditions documented in any records reviewed.", riskLevel: "none", impactAreas: [] },
    ],
  },
  {
    id: "degenerative",
    title: "Degenerative Conditions",
    icon: Bone,
    riskLevel: "high",
    summary: "L4-L5 degenerative changes — defense will argue pre-existing.",
    items: [
      { id: "dg-1", label: "L4-L5 Degenerative Disc Changes", detail: "MRI lumbar spine and Dr. Chen evaluation suggest age-related degenerative changes at L4-L5. Defense IME (Dr. Roberts) agrees herniation at C5-C6 is causally related to MVA, but notes L4-L5 changes 'may predate the accident.' Without prior imaging, this cannot be definitively resolved.", riskLevel: "high", impactAreas: ["causation", "damages"], citations: [{ docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" }, { docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" }] },
      { id: "dg-2", label: "C5-C6 — No Pre-Existing Evidence", detail: "No degenerative changes noted at C5-C6 per either treating or IME physicians. Both agree herniation is more likely than not related to the MVA.", riskLevel: "none", impactAreas: ["causation"], citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" }] },
    ],
  },
  {
    id: "prior-surgeries",
    title: "Prior Surgeries",
    icon: FileWarning,
    riskLevel: "none",
    summary: "No prior surgeries documented.",
    items: [
      { id: "ps-1", label: "No Prior Surgeries", detail: "Claimant denies any prior surgical history on intake forms. No surgical records identified in document review. ER history notes 'surgical history: none.'", riskLevel: "none", impactAreas: [], citations: [{ docName: "ER Records — Mercy General", page: "pg. 1", relevance: "contextual" }] },
    ],
  },
  {
    id: "behavioral",
    title: "Behavioral Risk Factors",
    icon: AlertTriangle,
    riskLevel: "moderate",
    summary: "PT non-compliance (67%) — may affect credibility of damages claim.",
    items: [
      { id: "br-1", label: "Physical Therapy Non-Completion", detail: "Only 24 of 36 prescribed PT sessions completed (67% compliance). Defense will likely argue that incomplete PT course undermines the severity of claimed injuries and that conservative treatment was not exhausted before considering surgical intervention.", riskLevel: "high", impactAreas: ["credibility", "damages"], citations: [{ docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" }] },
      { id: "br-2", label: "Medication Compliance", detail: "No documented issues with medication compliance. Claimant reports taking prescribed Meloxicam, Cyclobenzaprine, and Gabapentin as directed.", riskLevel: "none", impactAreas: ["credibility"] },
    ],
  },
  {
    id: "psychological",
    title: "Psychological / Mental Health",
    icon: Brain,
    riskLevel: "low",
    summary: "Sleep disturbance and anxiety reported — no formal psych diagnosis.",
    items: [
      { id: "mh-1", label: "Sleep Disturbance", detail: "Claimant reports waking 2-3x nightly due to cervical pain. Documented by Dr. Chen at 3 separate visits. No prior sleep complaints documented. Pain-related sleep disruption is consistent with C5-C6 radiculopathy.", riskLevel: "low", impactAreas: ["damages", "baseline"] },
      { id: "mh-2", label: "Driving Anxiety", detail: "Claimant reports anxiety when driving, particularly on highways and at intersections. No formal anxiety diagnosis or mental health referral. Mentioned in PT intake and ortho follow-up notes.", riskLevel: "low", impactAreas: ["damages"] },
      { id: "mh-3", label: "No Prior Mental Health History", detail: "No documented prior psychiatric diagnoses, medications, or treatment. No history of depression, anxiety disorder, or PTSD.", riskLevel: "none", impactAreas: ["baseline"] },
    ],
  },
  {
    id: "substance",
    title: "Substance Use History",
    icon: Wine,
    riskLevel: "none",
    summary: "No documented substance use concerns.",
    items: [
      { id: "su-1", label: "No Documented Substance Concerns", detail: "ER toxicology screen negative. No documented history of alcohol or substance use disorders. Social history notes 'occasional social alcohol use, no tobacco, no recreational drugs.'", riskLevel: "none", impactAreas: [], citations: [{ docName: "ER Records — Mercy General", page: "pg. 2", relevance: "contextual" }] },
    ],
  },
  {
    id: "social-context",
    title: "Social & Work Context",
    icon: Users,
    riskLevel: "low",
    summary: "Single parent — functional impact may amplify general damages.",
    items: [
      { id: "sc-1", label: "Family Situation", detail: "Single parent of two children (ages 8 and 11). Primary caregiver. Reports difficulty with childcare activities requiring lifting and prolonged standing. Receives some assistance from extended family.", riskLevel: "low", impactAreas: ["damages"] },
      { id: "sc-2", label: "Work Environment Impact", detail: "Light-duty restrictions limit job duties — cannot perform warehouse floor supervision, cargo inspection, or equipment operation. Reduced to desk-based scheduling and paperwork only. Reports frustration and concern about job security.", riskLevel: "low", impactAreas: ["damages", "baseline"] },
      { id: "sc-3", label: "Recreational Impact", detail: "Previously active — reported regular jogging, recreational soccer, and hiking. All activities discontinued since MVA. Documented by PT intake assessment.", riskLevel: "low", impactAreas: ["damages"], citations: [{ docName: "PT Records — Advanced Rehab", page: "pg. 2", relevance: "direct" }] },
    ],
  },
];

// ─── Main Component ──────────────────────────────────
const ClaimantBackgroundTab = () => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary risk counts
  const riskCounts = {
    high: SECTIONS.filter((s) => s.riskLevel === "high").length,
    moderate: SECTIONS.filter((s) => s.riskLevel === "moderate").length,
    low: SECTIONS.filter((s) => s.riskLevel === "low").length,
    none: SECTIONS.filter((s) => s.riskLevel === "none").length,
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Claimant Background</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pre-existing conditions, prior history, and contextual factors that may affect causation, credibility, or damages.
        </p>
      </div>

      {/* Risk Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <RiskSummaryCard label="High Risk" count={riskCounts.high} level="high" items={SECTIONS.filter((s) => s.riskLevel === "high").map((s) => s.title)} />
        <RiskSummaryCard label="Moderate" count={riskCounts.moderate} level="moderate" items={SECTIONS.filter((s) => s.riskLevel === "moderate").map((s) => s.title)} />
        <RiskSummaryCard label="Low" count={riskCounts.low} level="low" items={SECTIONS.filter((s) => s.riskLevel === "low").map((s) => s.title)} />
        <RiskSummaryCard label="Clear" count={riskCounts.none} level="none" items={SECTIONS.filter((s) => s.riskLevel === "none").map((s) => s.title)} />
      </div>

      {/* Key Background Risks */}
      <div className="p-3 rounded-lg border border-border bg-card mb-5">
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Key Background Risks</span>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SECTIONS.filter((s) => s.riskLevel === "high" || s.riskLevel === "moderate").map((s) => {
            const risk = RISK_CONFIG[s.riskLevel];
            return (
              <button
                key={s.id}
                onClick={() => {
                  setExpandedSections((prev) => new Set(prev).add(s.id));
                  document.getElementById(`bg-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors hover:opacity-80 ${risk.class} border-current/10`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${risk.dotClass}`} />
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const risk = RISK_CONFIG[section.riskLevel];
          const Icon = section.icon;

          return (
            <div key={section.id} id={`bg-${section.id}`} className="card-elevated overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-accent/30 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <h3 className="text-[12px] font-semibold text-foreground flex-1">{section.title}</h3>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${risk.class}`}>
                  {risk.label}
                </span>
              </button>

              {/* Section summary */}
              {!isExpanded && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-[11px] text-muted-foreground pl-[52px]">{section.summary}</p>
                </div>
              )}

              {/* Items */}
              {isExpanded && (
                <div className="divide-y divide-border/50">
                  {section.items.map((item) => (
                    <BackgroundItemRow key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 p-3 rounded-lg bg-accent/30 border border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Note:</strong> Background information is extracted from available medical, employment, and intake records. All risk assessments are evidence-based guidance — final determinations should incorporate ISO results, prior PCP records (when obtained), and adjuster judgment.
        </p>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────

function RiskSummaryCard({ label, count, level, items }: {
  label: string; count: number; level: RiskLevel; items: string[];
}) {
  const risk = RISK_CONFIG[level];
  return (
    <div className={`rounded-lg border border-border p-3 ${count > 0 && level !== "none" ? "bg-card" : "bg-accent/20"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`h-2 w-2 rounded-full ${risk.dotClass}`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-[18px] font-bold text-foreground tabular-nums">{count}</p>
      {items.length > 0 && (
        <div className="mt-1.5">
          {items.slice(0, 2).map((t) => (
            <p key={t} className="text-[9px] text-muted-foreground truncate">{t}</p>
          ))}
          {items.length > 2 && (
            <p className="text-[9px] text-muted-foreground">+{items.length - 2} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function BackgroundItemRow({ item }: { item: BackgroundItem }) {
  const risk = RISK_CONFIG[item.riskLevel];

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${risk.dotClass}`} />
        <div className="flex-1 min-w-0">
          {/* Label + date */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-medium text-foreground">{item.label}</span>
            {item.date && (
              <span className="text-[9px] text-muted-foreground tabular-nums">{item.date}</span>
            )}
          </div>

          {/* Detail text */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>

          {/* Impact chips + citations */}
          {(item.impactAreas.length > 0 || (item.citations && item.citations.length > 0)) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {item.impactAreas.map((area) => (
                <span
                  key={area}
                  className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${IMPACT_CHIP[area] ?? IMPACT_CHIP.baseline}`}
                >
                  {area}
                </span>
              ))}
              {item.citations && item.citations.map((c, i) => (
                <CitationBadge key={i} source={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClaimantBackgroundTab;
