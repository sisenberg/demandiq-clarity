import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { useSourceDrawer } from "./SourceDrawer";
import { CitationBadge, EvidenceStatement, type CitationSource } from "./EvidenceCitation";
import { getBillingSummary, getTreatmentStats } from "@/data/mock/casePackage";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { isDocumentReady } from "@/lib/statuses";
import type { EvidenceReference, TimelineEvent } from "@/types";
import { maskClaimNumber } from "@/lib/phi-utils";
import IntakeReadinessPanel from "./IntakeReadinessPanel";
import DemandSummaryPanel from "./DemandSummaryPanel";
import {
  User,
  Car,
  Activity,
  Stethoscope,
  AlertTriangle,
  TrendingDown,
  FileText,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Shield,
  Zap,
  Heart,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────
function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

const SEVERITY_DOT: Record<string, string> = {
  minor: "bg-[hsl(var(--status-review))]",
  moderate: "bg-[hsl(var(--status-attention))]",
  severe: "bg-destructive",
  catastrophic: "bg-destructive",
  fatal: "bg-destructive",
};

const SEVERITY_LABEL: Record<string, string> = {
  minor: "status-badge-review",
  moderate: "status-badge-attention",
  severe: "status-badge-failed",
  catastrophic: "status-badge-failed",
  fatal: "status-badge-failed",
};

const CATEGORY_DOT: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-primary",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
  Legal: "bg-primary",
  Administrative: "bg-muted-foreground",
};

const FLAG_ICON_MAP: Record<string, string> = {
  pre_existing_condition: "⚠",
  treatment_gap: "⏱",
  incomplete_compliance: "📉",
  documentation_missing: "📄",
  causation_risk: "🔗",
  inconsistency: "⚡",
};

// ─── Main Component ──────────────────────────────────
interface CaseOverviewProps {
  caseData: CaseRow;
  documents: DocumentRow[];
  onNavigate?: (section: string) => void;
}

const CaseOverview = ({ caseData, documents, onNavigate }: CaseOverviewProps) => {
  const { pkg } = useCasePackage();
  const billing = getBillingSummary(pkg);
  const stats = getTreatmentStats(pkg);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<string | null>(null);

  const completeDocs = documents.filter(
    (d) => isDocumentReady(d.document_status)
  ).length;

  const claimant = pkg.parties.find((p) => p.party_role === "claimant");

  return (
    <div className="flex gap-5">
      {/* ═══ LEFT COLUMN — Main content ═══ */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* ── Row 0: Intake Readiness ── */}
        <IntakeReadinessPanel documents={documents} caseId={caseData.id} onNavigate={onNavigate} />

        {/* ── Row 1: Case Snapshot + Key Metrics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Case / Claimant Summary */}
          <div className="lg:col-span-2 card-elevated p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{claimant?.full_name ?? caseData.claimant}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {claimant?.notes ?? ""} · {caseData.jurisdiction_state}
                </p>
              </div>
              <span className="status-badge-processing text-[9px]">{caseData.case_status.replace(/_/g, " ")}</span>
            </div>

            {/* Narrative summary */}
            <div className="text-[12px] text-foreground leading-relaxed space-y-1.5">
              <p>
                <EvidenceStatement
                  text={`On ${formatDate(caseData.date_of_loss)}, claimant was involved in a rear-end MVA at ~35 mph when defendant ran a red light on I-95.`}
                  citations={refsToCS(pkg.evidence_refs.filter((r) => r.linked_entity_type === "timeline_event").slice(0, 2))}
                />
              </p>
              <p>
                <EvidenceStatement
                  text={`${pkg.injuries.length} injuries documented including ${pkg.injuries[0]?.body_part?.toLowerCase()} herniation (${pkg.injuries[0]?.diagnosis_code}). Emergency treatment at ${pkg.providers.find((p) => p.specialty === "Emergency Medicine")?.facility_name ?? "hospital"} on DOI.`}
                  citations={refsToCS(pkg.injuries[0]?.evidence_refs.slice(0, 1) ?? [])}
                />
              </p>
            </div>

            {/* Quick facts row */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 pt-3 border-t border-border">
              <MiniStat label="DOI" value={formatDate(caseData.date_of_loss)} />
              <MiniStat label="Claim #" value={maskClaimNumber(caseData.claim_number)} mono />
              <MiniStat label="Jurisdiction" value={caseData.jurisdiction_state} />
              <MiniStat label="Defendant" value={caseData.defendant} />
            </div>
          </div>

          {/* Key metrics card */}
          <div className="card-elevated p-4 flex flex-col gap-3">
            <h3 className="section-label">Case Metrics</h3>
            <div className="flex flex-col gap-2.5 flex-1">
              <MetricRow icon={FileText} label="Documents" value={`${completeDocs}/${documents.length}`} sub="processed" />
              <MetricRow icon={Stethoscope} label="Providers" value={`${stats.providers}`} sub={`${stats.totalVisits} visits`} />
              <MetricRow icon={DollarSign} label="Billed" value={`$${billing.totalBilled.toLocaleString()}`} sub={`adj. $${billing.totalAdjusted.toLocaleString()}`} />
              <MetricRow icon={Activity} label="Injuries" value={`${pkg.injuries.length}`} sub={`${pkg.injuries.filter(i => i.severity === "severe" || i.severity === "catastrophic").length} severe`} />
              <MetricRow icon={Shield} label="Demand" value={`$${pkg.demand_summary.demand_amount.toLocaleString()}`} sub="transmitted" />
            </div>
          </div>
        </div>

        {/* ── Row 2: Accident Facts ── */}
        <AccidentFactsSection pkg={pkg} caseData={caseData} />

        {/* ── Row 3: Injuries by Body Region + Treatment Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InjuryRegionMap pkg={pkg} />
          <TreatmentSummaryCard pkg={pkg} stats={stats} billing={billing} />
        </div>

        {/* ── Row 4: Red Flags + Functional Impact ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RedFlagsCard pkg={pkg} />
          <FunctionalImpactCard />
        </div>

        {/* ── Row 5: Top Evidence-Linked Facts ── */}
        <TopEvidenceFactsCard pkg={pkg} />
      </div>

      {/* ═══ RIGHT COLUMN — Chronology Rail ═══ */}
      <div className="hidden xl:flex w-72 shrink-0">
        <ChronologyRail
          events={pkg.timeline_events}
          selectedId={selectedTimelineEvent}
          onSelect={setSelectedTimelineEvent}
        />
      </div>
    </div>
  );
};

// ─── Accident Facts ──────────────────────────────────
function AccidentFactsSection({ pkg, caseData }: { pkg: any; caseData: CaseRow }) {
  const accidentRefs = pkg.evidence_refs.filter((r: EvidenceReference) => r.linked_entity_id === "te-001");

  const facts = [
    { label: "Date of Loss", value: formatDate(caseData.date_of_loss) },
    { label: "Mechanism", value: "Rear-end MVA, ~35 mph" },
    { label: "Location", value: "I-95 intersection, Sacramento, CA" },
    { label: "At-Fault", value: `${caseData.defendant} — ran red signal` },
    { label: "Witness", value: "Kevin Donovan — pedestrian bystander" },
    { label: "Police Report", value: "#PR-2024-8812" },
  ];

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Car className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Accident Facts</h3>
        {accidentRefs.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {refsToCS(accidentRefs).slice(0, 2).map((c, i) => (
              <CitationBadge key={i} source={c} />
            ))}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
          {facts.map((f) => (
            <div key={f.label}>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{f.label}</span>
              <p className="text-[12px] text-foreground font-medium mt-0.5">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Injury Region Map (Modern) ──────────────────────
function InjuryRegionMap({ pkg }: { pkg: any }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { openSource } = useSourceDrawer();
  const selectedInjury = pkg.injuries.find((i: any) => i.id === selectedId);

  // Body region definitions with relative positions for a modern schematic
  const BODY_REGIONS = [
    { id: "head", label: "Head / Skull", x: 50, y: 8, w: 16, h: 12 },
    { id: "neck", label: "Cervical Spine", x: 50, y: 18, w: 10, h: 6 },
    { id: "shoulder-l", label: "L. Shoulder", x: 30, y: 23, w: 12, h: 8 },
    { id: "shoulder-r", label: "R. Shoulder", x: 70, y: 23, w: 12, h: 8 },
    { id: "upper-back", label: "Thoracic Spine", x: 50, y: 28, w: 18, h: 10 },
    { id: "lower-back", label: "Lumbar Spine", x: 50, y: 40, w: 18, h: 10 },
    { id: "hip-l", label: "L. Hip", x: 38, y: 52, w: 10, h: 8 },
    { id: "hip-r", label: "R. Hip", x: 62, y: 52, w: 10, h: 8 },
    { id: "knee-l", label: "L. Knee", x: 40, y: 68, w: 8, h: 8 },
    { id: "knee-r", label: "R. Knee", x: 60, y: 68, w: 8, h: 8 },
    { id: "ankle-l", label: "L. Ankle", x: 40, y: 84, w: 8, h: 6 },
    { id: "ankle-r", label: "R. Ankle", x: 60, y: 84, w: 8, h: 6 },
  ];

  // Map injuries to body regions
  const injuryByRegion: Record<string, typeof pkg.injuries> = {};
  pkg.injuries.forEach((inj: any) => {
    const regionKey = mapInjuryToRegion(inj.body_part, inj.body_region);
    if (!injuryByRegion[regionKey]) injuryByRegion[regionKey] = [];
    injuryByRegion[regionKey].push(inj);
  });

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Findings by Body Region</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {pkg.injuries.length}
        </span>
      </div>

      <div className="flex">
        {/* Schematic body map */}
        <div className="flex-1 p-4 flex items-center justify-center min-h-[320px]">
          <svg viewBox="0 0 100 100" className="w-full max-w-[180px]">
            {/* Body outline — clean modern lines */}
            <ellipse cx="50" cy="8" rx="5.5" ry="6.5" fill="none" stroke="hsl(var(--border))" strokeWidth="0.6" />
            <line x1="50" y1="14.5" x2="50" y2="17" stroke="hsl(var(--border))" strokeWidth="0.6" />
            {/* Torso */}
            <rect x="40" y="17" width="20" height="34" rx="3" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
            {/* Arms */}
            <path d="M40 19 L30 24 L27 40 L30 42" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" />
            <path d="M60 19 L70 24 L73 40 L70 42" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" />
            {/* Legs */}
            <path d="M43 51 L41 70 L39 88 L43 90" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" />
            <path d="M57 51 L59 70 L61 88 L57 90" fill="none" stroke="hsl(var(--border))" strokeWidth="0.4" />

            {/* Active injury regions */}
            {BODY_REGIONS.map((region) => {
              const injuries = injuryByRegion[region.id] || [];
              if (injuries.length === 0) return null;
              const maxSeverity = getMaxSeverity(injuries);
              const isSelected = injuries.some((i: any) => i.id === selectedId);

              return (
                <g key={region.id}>
                  {/* Pulsing highlight */}
                  <rect
                    x={region.x - region.w / 2}
                    y={region.y - region.h / 2}
                    width={region.w}
                    height={region.h}
                    rx="2"
                    fill={getSeverityFill(maxSeverity)}
                    stroke={getSeverityStroke(maxSeverity)}
                    strokeWidth={isSelected ? "1" : "0.5"}
                    className="cursor-pointer transition-all"
                    opacity={isSelected ? 0.5 : 0.25}
                    onClick={() => setSelectedId(isSelected ? null : injuries[0].id)}
                  >
                    {!isSelected && (
                      <animate attributeName="opacity" values="0.15;0.3;0.15" dur="3s" repeatCount="indefinite" />
                    )}
                  </rect>
                  {/* Injury count badge */}
                  <circle
                    cx={region.x + region.w / 2 - 1}
                    cy={region.y - region.h / 2 + 1}
                    r="2.5"
                    fill={getSeverityStroke(maxSeverity)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(isSelected ? null : injuries[0].id)}
                  />
                  <text
                    x={region.x + region.w / 2 - 1}
                    y={region.y - region.h / 2 + 1.8}
                    textAnchor="middle"
                    fill="white"
                    fontSize="2.5"
                    fontWeight="600"
                    className="pointer-events-none"
                  >
                    {injuries.length}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Injury list */}
        <div className="w-52 border-l border-border overflow-y-auto max-h-[320px]">
          {selectedInjury ? (
            <div className="p-3">
              <button onClick={() => setSelectedId(null)} className="text-[10px] text-primary font-medium mb-2 hover:underline">
                ← All injuries
              </button>
              <span className={SEVERITY_LABEL[selectedInjury.severity]}>{selectedInjury.severity}</span>
              <h4 className="text-[12px] font-semibold text-foreground mt-2">{selectedInjury.body_part}</h4>
              <p className="text-[11px] text-foreground leading-relaxed mt-1">{selectedInjury.diagnosis_description}</p>
              <div className="flex flex-col gap-1.5 mt-3">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">ICD-10</span>
                <code className="text-[10px] font-mono text-foreground bg-accent px-1.5 py-0.5 rounded w-fit">{selectedInjury.diagnosis_code}</code>
              </div>
              {selectedInjury.is_pre_existing && (
                <span className="status-badge-attention text-[9px] mt-2 inline-block">Possible Pre-Existing</span>
              )}
              {selectedInjury.evidence_refs?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-1">
                  {refsToCS(selectedInjury.evidence_refs).map((c: CitationSource, i: number) => (
                    <CitationBadge key={i} source={c} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2">
              {pkg.injuries.map((inj: any) => (
                <button
                  key={inj.id}
                  onClick={() => setSelectedId(inj.id)}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-accent/60 transition-colors flex items-start gap-2"
                >
                  <span className={`h-2 w-2 rounded-full mt-1 shrink-0 ${SEVERITY_DOT[inj.severity]}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{inj.body_part}</p>
                    <p className="text-[10px] text-muted-foreground">{inj.diagnosis_code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Summary Card ──────────────────────────
function TreatmentSummaryCard({ pkg, stats, billing }: { pkg: any; stats: any; billing: any }) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Stethoscope className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Treatment Summary</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatBlock label="Total Visits" value={stats.totalVisits.toString()} />
          <StatBlock label="PT Sessions" value={`${stats.ptSessions} / 36`} warn={stats.ptSessions < 36} />
          <StatBlock label="Injections" value={stats.injections.toString()} />
          <StatBlock label="Providers" value={stats.providers.toString()} />
          <StatBlock label="Total Billed" value={`$${billing.totalBilled.toLocaleString()}`} />
          <StatBlock label="Adjusted" value={`$${billing.totalAdjusted.toLocaleString()}`} />
        </div>

        {/* Treatment types */}
        <div className="mt-3 pt-3 border-t border-border">
          <span className="section-label">Treatment Types</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pkg.treatments
              .map((t: any) => t.treatment_type.replace(/_/g, " "))
              .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
              .map((type: string) => (
                <span
                  key={type}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-accent text-muted-foreground capitalize"
                >
                  {type}
                </span>
              ))}
          </div>
        </div>

        {/* Provider list */}
        <div className="mt-3 pt-3 border-t border-border">
          <span className="section-label">Key Providers</span>
          <div className="flex flex-col gap-1.5 mt-2">
            {pkg.providers.slice(0, 3).map((p: any) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[11px] text-foreground font-medium truncate">{p.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{p.specialty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Red Flags Card ──────────────────────────────────
function RedFlagsCard({ pkg }: { pkg: any }) {
  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        <h3 className="text-xs font-semibold text-foreground">Red Flags & Review Points</h3>
        <span className="text-[10px] font-semibold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full ml-auto">
          {pkg.issue_flags.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {pkg.issue_flags.map((flag: any) => {
          const flagRefs = pkg.evidence_refs.filter((r: EvidenceReference) => r.linked_entity_id === flag.id);
          return (
            <div key={flag.id} className="px-4 py-3 hover:bg-accent/20 transition-colors">
              <div className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">{FLAG_ICON_MAP[flag.flag_type] ?? "⚠"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">
                    {flag.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                    <EvidenceStatement text={flag.description} citations={refsToCS(flagRefs)} />
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Functional Impact Card ──────────────────────────
function FunctionalImpactCard() {
  const impacts = [
    { area: "Work Capacity", status: "Impaired", detail: "Unable to perform warehouse logistics duties. Light duty only per Dr. Chen.", level: 75 },
    { area: "Daily Activities", status: "Limited", detail: "Difficulty with overhead reaching, prolonged sitting, driving > 30 min.", level: 60 },
    { area: "Sleep Quality", status: "Disrupted", detail: "Reports waking 2-3x nightly due to cervical pain. On muscle relaxants.", level: 50 },
    { area: "Recreation", status: "Suspended", detail: "Cannot participate in gym activities, hiking, or recreational sports.", level: 85 },
  ];

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Heart className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Functional Impact</h3>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {impacts.map((imp) => (
          <div key={imp.area}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-foreground">{imp.area}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">{imp.status}</span>
            </div>
            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all bg-gradient-to-r from-primary to-destructive"
                style={{ width: `${imp.level}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{imp.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Evidence-Linked Facts ───────────────────────
function TopEvidenceFactsCard({ pkg }: { pkg: any }) {
  const { openSource } = useSourceDrawer();

  // Get the most impactful evidence refs
  const topRefs = pkg.evidence_refs
    .filter((r: EvidenceReference) => r.quoted_text && r.confidence >= 0.85)
    .slice(0, 6);

  const RELEVANCE_CHIP: Record<string, string> = {
    direct: "bg-primary/10 text-primary border-primary/20",
    corroborating: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]",
    contradicting: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.2)]",
    contextual: "bg-accent text-muted-foreground border-border",
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Top Evidence-Linked Facts</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {topRefs.length} key
        </span>
      </div>
      <div className="divide-y divide-border">
        {topRefs.map((ref: EvidenceReference) => (
          <div
            key={ref.id}
            onClick={() => openSource({ docName: ref.doc_name, page: ref.page_label, excerpt: ref.quoted_text, relevance: ref.relevance as any })}
            className="px-4 py-3 hover:bg-accent/20 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${RELEVANCE_CHIP[ref.relevance] ?? RELEVANCE_CHIP.direct}`}>
                {ref.relevance}
              </span>
              <span className="text-[10px] font-semibold text-primary bg-primary/5 px-1.5 py-0.5 rounded">{ref.page_label}</span>
              <span className="text-[11px] font-medium text-foreground truncate flex-1">{ref.doc_name}</span>
              <Zap className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <blockquote className="text-[11px] text-foreground leading-relaxed pl-3 border-l-2 border-primary/20 evidence-text">
              "{ref.quoted_text}"
            </blockquote>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chronology Rail (Right Side) ────────────────────
function ChronologyRail({
  events,
  selectedId,
  onSelect,
}: {
  events: TimelineEvent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { openSource } = useSourceDrawer();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="card-elevated flex flex-col h-fit sticky top-5 max-h-[calc(100vh-140px)]">
      <div className="px-3.5 py-3 border-b border-border flex items-center gap-2 shrink-0">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Chronology</h3>
        <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full ml-auto">
          {events.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

          {events.map((evt) => {
            const isExpanded = expandedIds.has(evt.id);
            const isSelected = selectedId === evt.id;
            const dot = CATEGORY_DOT[evt.category] ?? "bg-muted-foreground";

            return (
              <div key={evt.id} className="relative pl-5 pb-3">
                {/* Dot */}
                <div
                  className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-card ${dot} ${
                    isSelected ? "ring-2 ring-primary/30 scale-125" : ""
                  } transition-all cursor-pointer`}
                  onClick={() => onSelect(isSelected ? null : evt.id)}
                />

                <button
                  onClick={() => toggleExpand(evt.id)}
                  className={`w-full text-left rounded-md px-2 py-1.5 transition-all ${
                    isSelected ? "bg-primary/5" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-foreground tabular-nums">{formatShortDate(evt.event_date)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-2.5 w-2.5 text-muted-foreground ml-auto" />
                    ) : (
                      <ChevronRight className="h-2.5 w-2.5 text-muted-foreground ml-auto" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">{evt.label}</p>
                </button>

                {isExpanded && (
                  <div className="px-2 pt-1.5 pb-1">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{evt.description}</p>
                    {evt.evidence_refs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {evt.evidence_refs.map((r: EvidenceReference, i: number) => (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              openSource({ docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any });
                            }}
                            className="text-[9px] font-medium text-primary bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                          >
                            {r.page_label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Utility Components ──────────────────────────────
function MiniStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <p className={`text-[11px] font-medium text-foreground mt-0.5 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</p>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-[12px] font-semibold text-foreground">{value}</p>
      </div>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function StatBlock({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-background border border-border px-3 py-2">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <p className={`text-[12px] font-semibold mt-0.5 ${warn ? "text-[hsl(var(--status-attention-foreground))]" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────
function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function mapInjuryToRegion(bodyPart: string, bodyRegion: string): string {
  const bp = (bodyPart + " " + bodyRegion).toLowerCase();
  if (bp.includes("cervic") || bp.includes("neck")) return "neck";
  if (bp.includes("shoulder") && bp.includes("right")) return "shoulder-r";
  if (bp.includes("shoulder") && bp.includes("left")) return "shoulder-l";
  if (bp.includes("shoulder")) return "shoulder-r";
  if (bp.includes("lumbar") || bp.includes("lower back")) return "lower-back";
  if (bp.includes("thorac") || bp.includes("upper back")) return "upper-back";
  if (bp.includes("knee") && bp.includes("right")) return "knee-r";
  if (bp.includes("knee") && bp.includes("left")) return "knee-l";
  if (bp.includes("knee")) return "knee-r";
  if (bp.includes("hip")) return "hip-r";
  if (bp.includes("ankle")) return "ankle-r";
  if (bp.includes("head") || bp.includes("skull")) return "head";
  return "upper-back";
}

function getSeverityFill(severity: string): string {
  if (severity === "severe" || severity === "catastrophic" || severity === "fatal") return "hsl(0, 84%, 60%)";
  if (severity === "moderate") return "hsl(25, 95%, 53%)";
  return "hsl(38, 92%, 50%)";
}

function getSeverityStroke(severity: string): string {
  return getSeverityFill(severity);
}

function getMaxSeverity(injuries: any[]): string {
  const order = ["fatal", "catastrophic", "severe", "moderate", "minor"];
  for (const s of order) {
    if (injuries.some((i) => i.severity === s)) return s;
  }
  return "minor";
}

export default CaseOverview;
