import { useState, useMemo } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import { useSourceDrawer } from "./SourceDrawer";
import type { Provider, TreatmentRecord, BillingLine, EvidenceReference } from "@/types";
import { TreatmentType } from "@/types";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Stethoscope,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Activity,
  Syringe,
  Scan,
  Briefcase,
  Heart,
  FileText,
  ArrowLeft,
  User,
  Clock,
} from "lucide-react";

function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({ docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any }));
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(n: number): string {
  return "$" + n.toLocaleString();
}

// ─── View Mode ───────────────────────────────────────
type ViewMode = "provider" | "facility" | "specialty";

// ─── Treatment type badges ───────────────────────────
const TX_BADGE: Record<string, { label: string; icon: React.ElementType; class: string }> = {
  emergency: { label: "ER", icon: Heart, class: "bg-destructive/10 text-destructive border-destructive/20" },
  diagnostic_imaging: { label: "Imaging", icon: Scan, class: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.2)]" },
  physical_therapy: { label: "PT", icon: Activity, class: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))] border-[hsl(var(--status-processing)/0.2)]" },
  injection: { label: "Injection", icon: Syringe, class: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]" },
  surgery: { label: "Surgery", icon: Heart, class: "bg-primary/10 text-primary border-primary/20" },
  outpatient: { label: "Outpatient", icon: Stethoscope, class: "bg-accent text-muted-foreground border-border" },
  prescription: { label: "Rx", icon: FileText, class: "bg-accent text-muted-foreground border-border" },
};

// ─── Provider enrichment ─────────────────────────────
interface EnrichedProvider {
  provider: Provider;
  treatments: TreatmentRecord[];
  bills: BillingLine[];
  diagnoses: string[];
  procedures: string[];
  treatmentTypes: TreatmentType[];
  totalBilled: number;
  totalPaid: number;
  redFlags: string[];
  citations: CitationSource[];
}

function enrichProviders(
  providers: Provider[],
  treatments: TreatmentRecord[],
  bills: BillingLine[]
): EnrichedProvider[] {
  return providers.map((prov) => {
    const provTx = treatments.filter((t) => t.provider_id === prov.id);
    const provBills = bills.filter((b) => b.provider_id === prov.id);

    const diagSet = new Set<string>();
    const procSet = new Set<string>();
    const txTypes = new Set<TreatmentType>();
    const allCitations: CitationSource[] = [];

    provTx.forEach((tx) => {
      txTypes.add(tx.treatment_type);
      tx.procedure_codes.forEach((c) => procSet.add(c));
      tx.evidence_refs.forEach((r) => allCitations.push(...refsToCS([r])));
    });
    provBills.forEach((b) => {
      b.diagnosis_codes.forEach((d) => diagSet.add(d));
      b.cpt_codes.forEach((c) => procSet.add(c));
    });

    // Red flags
    const redFlags: string[] = [];
    if (prov.total_billed > 0 && prov.total_paid > 0) {
      const ratio = (prov.total_billed - prov.total_paid) / prov.total_billed;
      if (ratio > 0.3) redFlags.push(`Billed-to-paid gap: ${Math.round(ratio * 100)}%`);
    }
    const ptTx = provTx.filter((t) => t.treatment_type === TreatmentType.PhysicalTherapy);
    if (ptTx.length > 0) {
      const desc = ptTx[0].description.toLowerCase();
      if (desc.includes("24 of 36") || desc.includes("non-completion")) {
        redFlags.push("PT course incomplete (67% compliance)");
      }
    }
    if (prov.role_description.toLowerCase().includes("ime")) {
      redFlags.push("Defense-retained examiner");
    }

    return {
      provider: prov,
      treatments: provTx,
      bills: provBills,
      diagnoses: Array.from(diagSet),
      procedures: Array.from(procSet),
      treatmentTypes: Array.from(txTypes),
      totalBilled: prov.total_billed,
      totalPaid: prov.total_paid,
      redFlags,
      citations: allCitations,
    };
  });
}

// ─── Main Component ──────────────────────────────────
const ProvidersTab = () => {
  const { pkg, hasData } = useCasePackage();
  const { openSource } = useSourceDrawer();

  const enriched = useMemo(
    () => enrichProviders(pkg.providers, pkg.treatments, pkg.billing_lines),
    [pkg.providers, pkg.treatments, pkg.billing_lines]
  );

  const [viewMode, setViewMode] = useState<ViewMode>("provider");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter
  const filtered = useMemo(() => {
    let items = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.provider.full_name.toLowerCase().includes(q) ||
          e.provider.facility_name.toLowerCase().includes(q) ||
          e.provider.specialty.toLowerCase().includes(q)
      );
    }
    return items;
  }, [enriched, search]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-11 w-11 rounded-xl bg-accent/60 flex items-center justify-center mb-3.5">
          <Stethoscope className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h3 className="text-[13px] font-semibold text-foreground mb-1">No providers found</h3>
        <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">Providers will appear here after documents are processed and treatment data is extracted.</p>
      </div>
    );
  }

  // Grouping
  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedProvider[]>();
    filtered.forEach((ep) => {
      const key =
        viewMode === "provider" ? ep.provider.full_name
        : viewMode === "facility" ? ep.provider.facility_name
        : ep.provider.specialty;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ep);
    });
    return map;
  }, [filtered, viewMode]);

  const selected = selectedId ? enriched.find((e) => e.provider.id === selectedId) : null;

  // Summary stats
  const totalBilled = enriched.reduce((s, e) => s + e.totalBilled, 0);
  const totalPaid = enriched.reduce((s, e) => s + e.totalPaid, 0);
  const totalVisits = enriched.reduce((s, e) => s + e.provider.total_visits, 0);

  // ─── Detail Panel ───
  if (selected) {
    return <ProviderDetailPanel ep={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Providers & Facilities</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {enriched.length} providers · {totalVisits} total visits · {formatCurrency(totalBilled)} billed · {formatCurrency(totalPaid)} paid
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard label="Providers" value={enriched.length.toString()} icon={Stethoscope} />
        <StatCard label="Total Visits" value={totalVisits.toString()} icon={Calendar} />
        <StatCard label="Total Billed" value={formatCurrency(totalBilled)} icon={DollarSign} />
        <StatCard label="Adjustment" value={`${Math.round(((totalBilled - totalPaid) / totalBilled) * 100)}%`} icon={AlertTriangle} warn />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        {/* View mode */}
        <div className="flex gap-px bg-accent rounded-lg p-0.5">
          {([
            { key: "provider" as ViewMode, label: "By Provider", icon: User },
            { key: "facility" as ViewMode, label: "By Facility", icon: Building2 },
            { key: "specialty" as ViewMode, label: "By Specialty", icon: Stethoscope },
          ] as const).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                viewMode === v.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <v.icon className="h-3 w-3" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-52">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search providers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Provider List */}
      <div className="flex flex-col gap-3">
        {Array.from(grouped.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            {/* Group header (only if grouped by facility/specialty) */}
            {viewMode !== "provider" && (
              <div className="flex items-center gap-2 mb-2 px-1">
                {viewMode === "facility" ? <Building2 className="h-3 w-3 text-muted-foreground" /> : <Stethoscope className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[11px] font-semibold text-foreground">{groupName}</span>
                <span className="text-[9px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{items.length}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {items.map((ep) => (
                <ProviderCard key={ep.provider.id} ep={ep} onClick={() => setSelectedId(ep.provider.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Provider Card ───────────────────────────────────
function ProviderCard({ ep, onClick }: { ep: EnrichedProvider; onClick: () => void }) {
  const p = ep.provider;
  return (
    <button
      onClick={onClick}
      className="card-elevated w-full text-left px-4 py-3 hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Stethoscope className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + role */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">{p.full_name}</span>
            <span className="text-[9px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{p.role_description}</span>
          </div>

          {/* Specialty + Facility */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
            <span>{p.specialty}</span>
            {p.facility_name !== p.full_name && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{p.facility_name}</span>
              </>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2">
            <MiniStat icon={Calendar} label={`${p.total_visits} visits`} />
            <MiniStat icon={Clock} label={`${formatDate(p.first_visit_date)} – ${formatDate(p.last_visit_date)}`} />
            {p.total_billed > 0 && <MiniStat icon={DollarSign} label={formatCurrency(p.total_billed)} />}
          </div>

          {/* Treatment type badges */}
          {ep.treatmentTypes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ep.treatmentTypes.map((tt) => {
                const badge = TX_BADGE[tt] ?? TX_BADGE.outpatient;
                const BIcon = badge.icon;
                return (
                  <span key={tt} className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.class}`}>
                    <BIcon className="h-2 w-2" />
                    {badge.label}
                  </span>
                );
              })}
            </div>
          )}

          {/* Red flags */}
          {ep.redFlags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ep.redFlags.map((rf, i) => (
                <span key={i} className="flex items-center gap-1 text-[9px] font-medium text-destructive bg-destructive/8 px-1.5 py-0.5 rounded border border-destructive/15">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {rf}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Billing column */}
        {p.total_billed > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[12px] font-semibold text-foreground tabular-nums">{formatCurrency(p.total_billed)}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">Paid {formatCurrency(p.total_paid)}</p>
            {p.total_billed > p.total_paid && (
              <p className="text-[9px] text-destructive tabular-nums mt-0.5">
                −{formatCurrency(p.total_billed - p.total_paid)} adj
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Provider Detail Panel ───────────────────────────
function ProviderDetailPanel({ ep, onBack }: { ep: EnrichedProvider; onBack: () => void }) {
  const { openSource } = useSourceDrawer();
  const p = ep.provider;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["visits", "diagnoses", "billing"]));

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Visit chronology sorted by date
  const sortedTx = [...ep.treatments].sort((a, b) => (a.treatment_date ?? "").localeCompare(b.treatment_date ?? ""));

  // Aggregate diagnoses from bills
  const diagCodes = [...new Set(ep.bills.flatMap((b) => b.diagnosis_codes))];
  const cptCodes = [...new Set(ep.bills.flatMap((b) => b.cpt_codes))];

  // Functional / work notes extraction
  const workNotes = ep.treatments
    .filter((t) => t.description.toLowerCase().includes("light duty") || t.description.toLowerCase().includes("work") || t.description.toLowerCase().includes("restriction"))
    .map((t) => ({ date: t.treatment_date, text: t.description }));

  const functionalNotes = ep.treatments
    .filter((t) => t.description.toLowerCase().includes("rom") || t.description.toLowerCase().includes("pain") || t.description.toLowerCase().includes("limited"))
    .map((t) => ({ date: t.treatment_date, text: t.description }));

  const imagingTx = ep.treatments.filter((t) => t.treatment_type === TreatmentType.DiagnosticImaging);
  const injectionTx = ep.treatments.filter((t) => t.treatment_type === TreatmentType.Injection);

  type DetailSection = { id: string; title: string; icon: React.ElementType; count?: number };
  const sections: DetailSection[] = [
    { id: "visits", title: "Visit Chronology", icon: Calendar, count: sortedTx.length },
    { id: "diagnoses", title: "Diagnoses & Procedures", icon: FileText, count: diagCodes.length + cptCodes.length },
    { id: "billing", title: "Billing Summary", icon: DollarSign, count: ep.bills.length },
    ...(imagingTx.length > 0 ? [{ id: "imaging", title: "Imaging Ordered", icon: Scan, count: imagingTx.length }] : []),
    ...(injectionTx.length > 0 ? [{ id: "injections", title: "Injections / Procedures", icon: Syringe, count: injectionTx.length }] : []),
    ...(workNotes.length > 0 ? [{ id: "work", title: "Work Status Notes", icon: Briefcase, count: workNotes.length }] : []),
    ...(functionalNotes.length > 0 ? [{ id: "functional", title: "Functional Complaints", icon: Activity, count: functionalNotes.length }] : []),
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 mb-4 transition-colors">
        <ArrowLeft className="h-3 w-3" />
        Back to Providers
      </button>

      {/* Provider header card */}
      <div className="card-elevated p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-bold text-foreground">{p.full_name}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{p.specialty} · {p.facility_name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{p.role_description}</p>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Visits</span>
                <p className="text-[14px] font-bold text-foreground tabular-nums">{p.total_visits}</p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Date Range</span>
                <p className="text-[11px] font-medium text-foreground">{formatDate(p.first_visit_date)} – {formatDate(p.last_visit_date)}</p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Billed</span>
                <p className="text-[14px] font-bold text-foreground tabular-nums">{formatCurrency(p.total_billed)}</p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Paid</span>
                <p className="text-[14px] font-bold text-foreground tabular-nums">{formatCurrency(p.total_paid)}</p>
              </div>
            </div>

            {/* Red flags */}
            {ep.redFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
                {ep.redFlags.map((rf, i) => (
                  <span key={i} className="flex items-center gap-1 text-[9px] font-medium text-destructive bg-destructive/8 px-1.5 py-0.5 rounded border border-destructive/15">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {rf}
                  </span>
                ))}
              </div>
            )}

            {/* Provider notes */}
            {p.notes && (
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-3 pt-3 border-t border-border/50">{p.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Detail sections */}
      <div className="flex flex-col gap-3">
        {sections.map((sec) => {
          const isExpanded = expandedSections.has(sec.id);
          const SecIcon = sec.icon;

          return (
            <div key={sec.id} className="card-elevated overflow-hidden">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-accent/30 transition-colors text-left"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <SecIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-semibold text-foreground flex-1">{sec.title}</span>
                {sec.count !== undefined && (
                  <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{sec.count}</span>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border/50">
                  {/* Visit Chronology */}
                  {sec.id === "visits" && (
                    <div className="divide-y divide-border/30">
                      {sortedTx.map((tx) => {
                        const badge = TX_BADGE[tx.treatment_type] ?? TX_BADGE.outpatient;
                        const BIcon = badge.icon;
                        const citations = refsToCS(tx.evidence_refs);
                        return (
                          <div key={tx.id} className="px-4 py-3 flex items-start gap-3">
                            <span className="text-[11px] font-semibold text-foreground tabular-nums w-[80px] shrink-0 pt-0.5">
                              {formatDate(tx.treatment_date)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.class}`}>
                                  <BIcon className="h-2 w-2" />
                                  {badge.label}
                                </span>
                                {tx.procedure_codes.length > 0 && tx.procedure_codes.map((c) => (
                                  <code key={c} className="text-[9px] font-mono bg-accent text-foreground/70 px-1 py-0.5 rounded">{c}</code>
                                ))}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{tx.description}</p>
                              {citations.length > 0 && (
                                <div className="flex gap-1 mt-1.5">
                                  {citations.map((c, ci) => <CitationBadge key={ci} source={c} />)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {sortedTx.length === 0 && <EmptyRow label="No treatment records linked to this provider." />}
                    </div>
                  )}

                  {/* Diagnoses & Procedures */}
                  {sec.id === "diagnoses" && (
                    <div className="px-4 py-3 space-y-3">
                      {diagCodes.length > 0 && (
                        <div>
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Diagnosis Codes</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {diagCodes.map((d) => (
                              <code key={d} className="text-[10px] font-mono bg-accent text-foreground px-2 py-1 rounded border border-border">{d}</code>
                            ))}
                          </div>
                        </div>
                      )}
                      {cptCodes.length > 0 && (
                        <div>
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Procedure Codes (CPT)</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {cptCodes.map((c) => (
                              <code key={c} className="text-[10px] font-mono bg-primary/5 text-primary px-2 py-1 rounded border border-primary/15">{c}</code>
                            ))}
                          </div>
                        </div>
                      )}
                      {diagCodes.length === 0 && cptCodes.length === 0 && <EmptyRow label="No diagnosis or procedure codes on file." />}
                    </div>
                  )}

                  {/* Billing */}
                  {sec.id === "billing" && (
                    <div>
                      {ep.bills.length > 0 ? (
                        <div className="divide-y divide-border/30">
                          {ep.bills.map((b) => (
                            <div key={b.id} className="px-4 py-3 flex items-start gap-3">
                              <span className="text-[11px] font-semibold text-foreground tabular-nums w-[80px] shrink-0 pt-0.5">
                                {formatDate(b.service_date)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-foreground font-medium">{b.description}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  {b.cpt_codes.map((c) => (
                                    <code key={c} className="text-[9px] font-mono bg-accent text-foreground/70 px-1 py-0.5 rounded">{c}</code>
                                  ))}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-semibold text-foreground tabular-nums">{formatCurrency(b.billed_amount)}</p>
                                <p className="text-[9px] text-muted-foreground tabular-nums">Paid {formatCurrency(b.paid_amount)}</p>
                                {b.adjusted_amount > 0 && (
                                  <p className="text-[9px] text-destructive tabular-nums">−{formatCurrency(b.adjusted_amount)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {/* Totals */}
                          <div className="px-4 py-3 bg-accent/30 flex items-center">
                            <span className="text-[11px] font-semibold text-foreground flex-1">Total</span>
                            <div className="text-right">
                              <span className="text-[12px] font-bold text-foreground tabular-nums">{formatCurrency(ep.totalBilled)}</span>
                              <span className="text-[10px] text-muted-foreground ml-3">Paid {formatCurrency(ep.totalPaid)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyRow label="No billing records for this provider." />
                      )}
                    </div>
                  )}

                  {/* Imaging */}
                  {sec.id === "imaging" && (
                    <div className="divide-y divide-border/30">
                      {imagingTx.map((tx) => {
                        const citations = refsToCS(tx.evidence_refs);
                        return (
                          <div key={tx.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatDate(tx.treatment_date)}</span>
                              <Scan className="h-3 w-3 text-[hsl(var(--status-review))]" />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{tx.description}</p>
                            {citations.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {citations.map((c, ci) => <CitationBadge key={ci} source={c} />)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Injections */}
                  {sec.id === "injections" && (
                    <div className="divide-y divide-border/30">
                      {injectionTx.map((tx) => {
                        const citations = refsToCS(tx.evidence_refs);
                        return (
                          <div key={tx.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatDate(tx.treatment_date)}</span>
                              <Syringe className="h-3 w-3 text-[hsl(var(--status-approved))]" />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{tx.description}</p>
                            {citations.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {citations.map((c, ci) => <CitationBadge key={ci} source={c} />)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Work status */}
                  {sec.id === "work" && (
                    <div className="divide-y divide-border/30">
                      {workNotes.map((n, i) => (
                        <div key={i} className="px-4 py-3">
                          <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatDate(n.date)}</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{n.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Functional */}
                  {sec.id === "functional" && (
                    <div className="divide-y divide-border/30">
                      {functionalNotes.map((n, i) => (
                        <div key={i} className="px-4 py-3">
                          <span className="text-[11px] font-semibold text-foreground tabular-nums">{formatDate(n.date)}</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{n.text}</p>
                        </div>
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
  );
}

// ─── Shared Sub-components ───────────────────────────
function StatCard({ label, value, icon: Icon, warn }: { label: string; value: string; icon: React.ElementType; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${warn ? "text-destructive" : "text-primary"}`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-[14px] font-bold tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default ProvidersTab;
