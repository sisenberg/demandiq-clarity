import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  HelpCircle,
  Activity,
  Briefcase,
  Heart,
  Stethoscope,
  Syringe,
  Scan,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
type SupportLevel = "supported" | "partial" | "weak" | "unsupported" | "needs_review";

const SUPPORT_CONFIG: Record<SupportLevel, { label: string; class: string; dotClass: string; icon: React.ElementType }> = {
  supported: { label: "Appears Supported", class: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]", dotClass: "bg-[hsl(var(--status-approved))]", icon: CheckCircle2 },
  partial: { label: "Partially Supported", class: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]", dotClass: "bg-[hsl(var(--status-review))]", icon: MinusCircle },
  weak: { label: "Appears Weakly Supported", class: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]", dotClass: "bg-[hsl(var(--status-attention))]", icon: AlertTriangle },
  unsupported: { label: "Not Supported", class: "bg-destructive/10 text-destructive", dotClass: "bg-destructive", icon: XCircle },
  needs_review: { label: "Needs Review", class: "bg-accent text-muted-foreground", dotClass: "bg-muted-foreground", icon: HelpCircle },
};

interface AssessmentItem {
  id: string;
  text: string;
  support: SupportLevel;
  detail?: string;
  citations?: CitationSource[];
}

interface AssessmentSection {
  id: string;
  title: string;
  icon: React.ElementType;
  variant: "neutral" | "strength" | "weakness" | "question";
  items: AssessmentItem[];
}

// ─── Escalation Ladder ───────────────────────────────
interface LadderStep {
  id: string;
  label: string;
  icon: React.ElementType;
  dateRange: string;
  support: SupportLevel;
  summary: string;
  details: string[];
  missingSupport?: string[];
  citations?: CitationSource[];
}

const ESCALATION_LADDER: LadderStep[] = [
  {
    id: "initial",
    label: "Initial Care",
    icon: Zap,
    dateRange: "11/15/2024",
    support: "supported",
    summary: "ER presentation same day as MVA with documented complaints consistent with mechanism of injury.",
    details: [
      "Same-day ER visit at Mercy General Hospital",
      "Acute cervical strain and right shoulder contusion diagnosed",
      "CT head negative for intracranial injury",
      "Complaints of neck pain, shoulder pain, and radiating symptoms documented on arrival",
    ],
    citations: [
      { docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" },
      { docName: "ER Records — Mercy General", page: "pg. 4", relevance: "corroborating" },
    ],
  },
  {
    id: "conservative",
    label: "Conservative Care",
    icon: Activity,
    dateRange: "11/18/2024 – 03/28/2025",
    support: "partial",
    summary: "Orthopedic evaluation and PT initiated within appropriate timeframe. PT course incomplete (67%).",
    details: [
      "Orthopedic consult 3 days post-accident — clinically appropriate interval",
      "PT prescribed 3x/week for 12 weeks (36 sessions)",
      "Only 24/36 sessions completed — defense will argue non-compliance",
      "Cervical ROM improved but lumbar radicular symptoms persisted through PT course",
    ],
    missingSupport: [
      "PT discharge summary not yet on file",
      "Reason for PT discontinuation not documented",
    ],
    citations: [
      { docName: "PT Records — Advanced Rehab", page: "pg. 2", relevance: "direct" },
      { docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" },
    ],
  },
  {
    id: "imaging",
    label: "Diagnostic Imaging",
    icon: Scan,
    dateRange: "12/02/2024",
    support: "supported",
    summary: "MRI ordered after clinical exam suggested disc injury — findings confirmed herniation.",
    details: [
      "MRI cervical spine: C5-C6 central disc herniation with moderate foraminal narrowing",
      "MRI right knee: medial meniscus tear, posterior horn",
      "Imaging ordered after 2+ weeks conservative care — clinically appropriate timing",
      "Findings correlate with documented mechanism of injury",
    ],
    citations: [
      { docName: "MRI Report — Regional Radiology", page: "pg. 7", relevance: "direct" },
      { docName: "MRI Report — Regional Radiology", page: "pg. 12", relevance: "direct" },
    ],
  },
  {
    id: "injections",
    label: "Injections",
    icon: Syringe,
    dateRange: "01/15/2025 – 03/10/2025",
    support: "supported",
    summary: "ESIs initiated after conservative care showed insufficient relief — timing appears clinically coherent.",
    details: [
      "First ESI at ~2 months post-PT start — reasonable escalation timeline",
      "C5-C6 transforaminal epidural steroid injection under fluoroscopy",
      "Partial relief reported at 2-week follow-up",
      "Second ESI 8 weeks after first — within clinical guidelines",
    ],
    missingSupport: [
      "Follow-up documentation after second ESI not yet available",
    ],
    citations: [
      { docName: "Pain Management Records — Dr. Patel", page: "pg. 1", relevance: "direct" },
    ],
  },
  {
    id: "specialist",
    label: "Specialist / Surgical Consult",
    icon: Stethoscope,
    dateRange: "Pending",
    support: "weak",
    summary: "Surgical consultation discussed but not yet formally pursued. Defense IME disputes necessity.",
    details: [
      "Dr. Chen has discussed surgical consultation if conservative measures fail",
      "Defense IME (Dr. Roberts) concurs on herniation causation",
      "Dr. Roberts argues conservative treatment not yet exhausted — disputes surgical necessity",
      "No formal neurosurgical referral documented",
    ],
    missingSupport: [
      "Formal surgical consultation not yet scheduled",
      "No treating physician letter of medical necessity on file",
      "Rebuttal to IME opinion not prepared",
    ],
    citations: [
      { docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" },
      { docName: "IME Report — Dr. Roberts", page: "pg. 8", relevance: "contradicting" },
    ],
  },
  {
    id: "procedures",
    label: "Procedures / Surgery",
    icon: Heart,
    dateRange: "Not Yet Performed",
    support: "needs_review",
    summary: "No surgical procedures performed. Future surgical need included in demand but not yet substantiated.",
    details: [
      "Demand includes future surgical costs in damages calculation",
      "No surgical consultation, recommendation letter, or cost estimate on file",
      "Defense will challenge inclusion of future surgical costs without formal recommendation",
    ],
    missingSupport: [
      "Surgical consultation report",
      "Letter of medical necessity from treating surgeon",
      "Surgical cost estimate",
      "Second opinion supporting surgical recommendation",
    ],
  },
];

// ─── Assessment Sections ─────────────────────────────
const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    id: "injury-assessment",
    title: "Accident-Related Injury Assessment",
    icon: Shield,
    variant: "neutral",
    items: [
      { id: "ia-1", text: "C5-C6 disc herniation appears causally related to the MVA based on mechanism, timing, and imaging findings.", support: "supported", detail: "Both treating and IME physicians agree on causal relationship. No prior cervical imaging or complaints documented.", citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" }, { docName: "MRI Report — Regional Radiology", page: "pg. 7", relevance: "direct" }] },
      { id: "ia-2", text: "Right shoulder rotator cuff strain documented on initial ER visit, consistent with seatbelt restraint injury.", support: "supported", detail: "Resolved after 6 weeks of PT. No ongoing treatment needed.", citations: [{ docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" }] },
      { id: "ia-3", text: "L4-L5 lumbar strain claimed but pre-existing degenerative changes noted — causation disputed.", support: "weak", detail: "Dr. Chen notes 'possible pre-existing degenerative changes.' No prior imaging for comparison. Defense will argue aggravation vs. new injury.", citations: [{ docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" }] },
      { id: "ia-4", text: "Right knee medial meniscus tear confirmed on MRI, mechanism-consistent with dashboard impact.", support: "supported", citations: [{ docName: "MRI Report — Regional Radiology", page: "pg. 12", relevance: "direct" }] },
    ],
  },
  {
    id: "causation-support",
    title: "Causation Support",
    icon: ShieldCheck,
    variant: "strength",
    items: [
      { id: "cs-1", text: "Clear mechanism of injury — rear-end MVA at ~35 mph with red-light violation by defendant.", support: "supported", citations: [{ docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" }] },
      { id: "cs-2", text: "Same-day ER presentation with complaints consistent with mechanism.", support: "supported" },
      { id: "cs-3", text: "No prior cervical complaints or treatment documented — supports new injury causation for C5-C6.", support: "supported" },
      { id: "cs-4", text: "Defense IME physician concurs C5-C6 herniation is 'more likely than not causally related to the MVA.'", support: "supported", citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" }] },
    ],
  },
  {
    id: "causation-challenges",
    title: "Causation Challenges",
    icon: ShieldAlert,
    variant: "weakness",
    items: [
      { id: "cc-1", text: "L4-L5 pre-existing degenerative changes — no prior imaging to establish baseline.", support: "weak", detail: "Request prior PCP records immediately. Without baseline, defense will argue entire lumbar component is pre-existing." },
      { id: "cc-2", text: "ISO ClaimSearch results pending — prior claims unknown.", support: "needs_review", detail: "If prior lumbar claims are found, causation argument for L4-L5 weakens significantly." },
    ],
  },
  {
    id: "treatment-consistency",
    title: "Treatment Consistency",
    icon: Activity,
    variant: "neutral",
    items: [
      { id: "tc-1", text: "Treatment modalities appear appropriate for diagnosed conditions per available records.", support: "supported" },
      { id: "tc-2", text: "Treatment frequency and duration within published clinical guidelines for cervical disc herniation.", support: "supported" },
      { id: "tc-3", text: "Escalation from conservative care → imaging → injections follows a clinically coherent progression.", support: "supported" },
      { id: "tc-4", text: "Billing for MRI ($3,200 per scan) exceeds typical Medicare allowable (~$380) — expect significant reduction.", support: "weak", detail: "Defense will challenge reasonableness of charges. Total billed-to-adjusted gap is ~29%." },
    ],
  },
  {
    id: "treatment-gaps",
    title: "Treatment Gaps",
    icon: Clock,
    variant: "weakness",
    items: [
      { id: "tg-1", text: "PT course: 24/36 sessions completed (67% compliance).", support: "weak", detail: "Defense will argue claimant did not exhaust conservative treatment. No documented reason for discontinuation.", citations: [{ docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" }] },
      { id: "tg-2", text: "No treatment gap between ER and first ortho follow-up (3 days).", support: "supported" },
      { id: "tg-3", text: "Post-second ESI follow-up documentation not yet available.", support: "needs_review" },
    ],
  },
  {
    id: "functional-impact",
    title: "Functional Impact",
    icon: Activity,
    variant: "neutral",
    items: [
      { id: "fi-1", text: "Inability to perform full work duties — light-duty restrictions documented by Dr. Chen.", support: "supported" },
      { id: "fi-2", text: "Sleep disruption (2-3x nightly waking) documented across 3 separate provider visits.", support: "supported" },
      { id: "fi-3", text: "Inability to participate in recreational activities — documented in PT intake.", support: "supported", citations: [{ docName: "PT Records — Advanced Rehab", page: "pg. 2", relevance: "direct" }] },
      { id: "fi-4", text: "Childcare difficulties reported — single parent with two children.", support: "partial", detail: "Self-reported, limited corroboration in medical records." },
    ],
  },
  {
    id: "work-impact",
    title: "Work Impact",
    icon: Briefcase,
    variant: "neutral",
    items: [
      { id: "wi-1", text: "6 weeks total lost time documented (11/15/2024 – 12/23/2024).", support: "supported" },
      { id: "wi-2", text: "Currently on light-duty restrictions — reduced hours (32 hrs/week).", support: "supported" },
      { id: "wi-3", text: "Long-term earning capacity impact not yet formally assessed.", support: "needs_review", detail: "Vocational evaluation would strengthen damages claim if surgical path proceeds." },
    ],
  },
  {
    id: "future-care",
    title: "Future Care Indicators",
    icon: TrendingUp,
    variant: "neutral",
    items: [
      { id: "fc-1", text: "Surgical consultation under consideration for C5-C6 if conservative measures fail.", support: "partial", detail: "No formal referral yet. IME disputes necessity. Key vulnerability in demand." },
      { id: "fc-2", text: "Ongoing pain management likely needed — 2 ESIs performed with partial relief only.", support: "supported" },
      { id: "fc-3", text: "Future PT may be needed if surgical path is pursued.", support: "needs_review" },
    ],
  },
  {
    id: "permanency",
    title: "Permanency Indicators",
    icon: Heart,
    variant: "neutral",
    items: [
      { id: "pm-1", text: "C5-C6 disc herniation is a structural injury unlikely to fully resolve per available evidence.", support: "supported" },
      { id: "pm-2", text: "No permanent impairment rating obtained.", support: "needs_review", detail: "Would strengthen general damages claim, particularly if surgery is not pursued." },
      { id: "pm-3", text: "Ongoing radicular symptoms despite 2 ESIs suggest chronic condition developing.", support: "partial" },
    ],
  },
  {
    id: "strengths",
    title: "Key Strengths of the Demand",
    icon: TrendingUp,
    variant: "strength",
    items: [
      { id: "st-1", text: "Clear liability — defendant ran red light, corroborated by eyewitness and police report.", support: "supported" },
      { id: "st-2", text: "Defense IME concurs on C5-C6 herniation causation.", support: "supported" },
      { id: "st-3", text: "Objective MRI findings (herniation + meniscus tear) support injury claims.", support: "supported" },
      { id: "st-4", text: "Documented functional limitations across work, sleep, and daily activities.", support: "supported" },
      { id: "st-5", text: "No prior cervical history — clean baseline for C5-C6 claim.", support: "supported" },
    ],
  },
  {
    id: "weaknesses",
    title: "Key Weaknesses of the Demand",
    icon: TrendingDown,
    variant: "weakness",
    items: [
      { id: "wk-1", text: "L4-L5 pre-existing degenerative changes without prior imaging baseline.", support: "weak" },
      { id: "wk-2", text: "PT non-completion (67%) undermines 'exhausted conservative care' argument.", support: "weak" },
      { id: "wk-3", text: "IME disputes surgical necessity — weakens future care component of demand.", support: "weak" },
      { id: "wk-4", text: "Billing-to-adjusted gap (~29%) suggests inflated medical specials.", support: "weak" },
      { id: "wk-5", text: "Future surgical costs included in demand without formal recommendation on file.", support: "unsupported" },
    ],
  },
  {
    id: "missing-evidence",
    title: "Missing Evidence / Unresolved Questions",
    icon: HelpCircle,
    variant: "question",
    items: [
      { id: "me-1", text: "Prior PCP records — needed to address L4-L5 pre-existing argument.", support: "needs_review" },
      { id: "me-2", text: "ISO ClaimSearch results — prior claims status unknown.", support: "needs_review" },
      { id: "me-3", text: "PT discharge summary — reason for discontinuation undocumented.", support: "needs_review" },
      { id: "me-4", text: "Post-second ESI follow-up — treatment response undocumented.", support: "needs_review" },
      { id: "me-5", text: "Vehicle damage photos — would corroborate mechanism/force of impact.", support: "needs_review" },
      { id: "me-6", text: "Formal surgical consultation report.", support: "needs_review" },
    ],
  },
  {
    id: "review-questions",
    title: "Recommended Adjuster Review Questions",
    icon: ShieldQuestion,
    variant: "question",
    items: [
      { id: "rq-1", text: "Has claimant disclosed any prior lumbar complaints to any provider, including primary care?", support: "needs_review" },
      { id: "rq-2", text: "What was the specific reason for PT discontinuation — schedule, cost, symptom improvement, or non-compliance?", support: "needs_review" },
      { id: "rq-3", text: "Is the treating physician willing to provide a formal letter of medical necessity for surgical consultation?", support: "needs_review" },
      { id: "rq-4", text: "Should a rebuttal IME be obtained to address Dr. Roberts' opinion on surgical necessity?", support: "needs_review" },
      { id: "rq-5", text: "Are there any surveillance opportunities given the reported functional limitations?", support: "needs_review" },
    ],
  },
];

// ─── Variant Styling ─────────────────────────────────
const VARIANT_ACCENT: Record<string, string> = {
  neutral: "border-l-primary/30",
  strength: "border-l-[hsl(var(--status-approved))]",
  weakness: "border-l-destructive",
  question: "border-l-[hsl(var(--status-review))]",
};

// ─── Main Component ──────────────────────────────────
const ClaimAssessmentTab = () => {
  const { hasData } = useCasePackage();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["injury-assessment", "causation-support", "causation-challenges", "strengths", "weaknesses"])
  );
  const [ladderExpanded, setLadderExpanded] = useState(true);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-11 w-11 rounded-xl bg-accent/60 flex items-center justify-center mb-3.5">
          <Shield className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h3 className="text-[13px] font-semibold text-foreground mb-1">No claim assessment available</h3>
        <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">Upload and process documents to generate a claim assessment.</p>
      </div>
    );
  }

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary counts
  const allItems = ASSESSMENT_SECTIONS.flatMap((s) => s.items);
  const supportCounts = {
    supported: allItems.filter((i) => i.support === "supported").length,
    partial: allItems.filter((i) => i.support === "partial").length,
    weak: allItems.filter((i) => i.support === "weak").length,
    needs_review: allItems.filter((i) => i.support === "needs_review" || i.support === "unsupported").length,
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Claim Assessment</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Structured analysis of injury causation, treatment coherence, and demand viability based on available records.
        </p>
      </div>

      {/* Assessment Overview */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <OverviewCard label="Supported" count={supportCounts.supported} level="supported" />
        <OverviewCard label="Partial" count={supportCounts.partial} level="partial" />
        <OverviewCard label="Weak / Unsupported" count={supportCounts.weak} level="weak" />
        <OverviewCard label="Needs Review" count={supportCounts.needs_review} level="needs_review" />
      </div>

      {/* ─── Medical Escalation Ladder ─── */}
      <div className="card-elevated overflow-hidden mb-5">
        <button
          onClick={() => setLadderExpanded(!ladderExpanded)}
          className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-accent/30 transition-colors text-left border-b border-border"
        >
          {ladderExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[12px] font-semibold text-foreground flex-1">Medical Escalation Ladder</h3>
          <span className="text-[9px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
            {ESCALATION_LADDER.length} steps
          </span>
        </button>

        {ladderExpanded && (
          <div className="p-4">
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-4 px-1">
              Evaluates whether treatment progression appears clinically coherent based on available records. This is not a medical-necessity determination.
            </p>

            <div className="relative">
              {ESCALATION_LADDER.map((step, idx) => {
                const support = SUPPORT_CONFIG[step.support];
                const StepIcon = step.icon;
                const SupportIcon = support.icon;
                const isLast = idx === ESCALATION_LADDER.length - 1;

                return (
                  <div key={step.id} className="flex gap-0 mb-0">
                    {/* Ladder rail */}
                    <div className="flex flex-col items-center w-10 shrink-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center border-2 ${
                        step.support === "supported" ? "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved-bg))]"
                        : step.support === "partial" ? "border-[hsl(var(--status-review))] bg-[hsl(var(--status-review-bg))]"
                        : step.support === "weak" ? "border-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention-bg))]"
                        : step.support === "needs_review" ? "border-border bg-accent"
                        : "border-destructive bg-destructive/10"
                      }`}>
                        <StepIcon className={`h-4 w-4 ${
                          step.support === "supported" ? "text-[hsl(var(--status-approved-foreground))]"
                          : step.support === "partial" ? "text-[hsl(var(--status-review-foreground))]"
                          : step.support === "weak" ? "text-[hsl(var(--status-attention-foreground))]"
                          : step.support === "needs_review" ? "text-muted-foreground"
                          : "text-destructive"
                        }`} />
                      </div>
                      {!isLast && (
                        <div className="flex flex-col items-center flex-1 py-1">
                          <ArrowRight className="h-3 w-3 text-muted-foreground/30 rotate-90" />
                          <div className="w-px flex-1 bg-border" />
                        </div>
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0 pb-4 pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] font-semibold text-foreground">{step.label}</span>
                        <span className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${support.class}`}>
                          <SupportIcon className="h-2.5 w-2.5" />
                          {support.label}
                        </span>
                      </div>

                      <span className="text-[10px] text-muted-foreground tabular-nums">{step.dateRange}</span>

                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{step.summary}</p>

                      {/* Detail bullets */}
                      <ul className="mt-2 space-y-1">
                        {step.details.map((d, di) => (
                          <li key={di} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                            <span className="h-1 w-1 rounded-full bg-foreground/30 mt-1.5 shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>

                      {/* Missing support */}
                      {step.missingSupport && step.missingSupport.length > 0 && (
                        <div className="mt-2 p-2 rounded-md bg-[hsl(var(--status-attention-bg))] border border-[hsl(var(--status-attention)/0.15)]">
                          <span className="text-[9px] font-semibold text-[hsl(var(--status-attention-foreground))] uppercase tracking-widest">Missing Support</span>
                          <ul className="mt-1 space-y-0.5">
                            {step.missingSupport.map((m, mi) => (
                              <li key={mi} className="text-[10px] text-[hsl(var(--status-attention-foreground))]">• {m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Citations */}
                      {step.citations && step.citations.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {step.citations.map((c, ci) => (
                            <CitationBadge key={ci} source={c} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Assessment Sections ─── */}
      <div className="flex flex-col gap-3">
        {ASSESSMENT_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const SectionIcon = section.icon;
          const accentBorder = VARIANT_ACCENT[section.variant];

          // Section-level counts
          const sectionItems = section.items;
          const weakCount = sectionItems.filter((i) => i.support === "weak" || i.support === "unsupported").length;
          const reviewCount = sectionItems.filter((i) => i.support === "needs_review").length;

          return (
            <div key={section.id} className={`card-elevated overflow-hidden border-l-[3px] ${accentBorder}`}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-accent/30 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <SectionIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <h3 className="text-[12px] font-semibold text-foreground flex-1">{section.title}</h3>
                <div className="flex items-center gap-1.5">
                  {weakCount > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{weakCount}</span>
                  )}
                  {reviewCount > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{reviewCount}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{sectionItems.length}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border/50">
                  {sectionItems.map((item) => {
                    const sup = SUPPORT_CONFIG[item.support];
                    const SupIcon = sup.icon;
                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <SupIcon className={`h-4 w-4 mt-0.5 shrink-0 ${sup.dotClass === "bg-destructive" ? "text-destructive" : sup.dotClass === "bg-muted-foreground" ? "text-muted-foreground" : `text-[hsl(var(--status-${
                            item.support === "supported" ? "approved" : item.support === "partial" ? "review" : "attention"
                          }))]`}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground leading-relaxed">{item.text}</p>
                            {item.detail && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{item.detail}</p>
                            )}
                            {item.citations && item.citations.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {item.citations.map((c, ci) => (
                                  <CitationBadge key={ci} source={c} />
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${sup.class}`}>
                            {sup.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-3 rounded-lg bg-accent/30 border border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Disclaimer:</strong> This assessment synthesizes available medical, legal, and claims records to support adjuster decision-making. Support-level indicators reflect the strength of available documentation — they are not medical opinions, liability determinations, or coverage conclusions. All assessments should be validated against complete records and adjuster judgment.
        </p>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────
function OverviewCard({ label, count, level }: { label: string; count: number; level: SupportLevel }) {
  const config = SUPPORT_CONFIG[level];
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-[18px] font-bold text-foreground tabular-nums">{count}</p>
    </div>
  );
}

export default ClaimAssessmentTab;
