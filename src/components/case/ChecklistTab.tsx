import { useState } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import type { EvidenceReference } from "@/types";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  MessageSquare,
} from "lucide-react";

function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any,
  }));
}

// ─── Status Types ────────────────────────────────────
type ItemStatus = "pass" | "warn" | "fail" | "unchecked";

const STATUS_CONFIG: Record<ItemStatus, { icon: React.ElementType; dotClass: string; label: string }> = {
  pass: { icon: CheckCircle2, dotClass: "text-[hsl(var(--status-approved))]", label: "Clear" },
  warn: { icon: AlertTriangle, dotClass: "text-[hsl(var(--status-review))]", label: "Review" },
  fail: { icon: XCircle, dotClass: "text-destructive", label: "Issue" },
  unchecked: { icon: Circle, dotClass: "text-muted-foreground/40", label: "Unchecked" },
};

// ─── Checklist Data ──────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  defaultStatus: ItemStatus;
  citations?: CitationSource[];
}

interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: "doc-inventory",
    title: "Documentation Inventory",
    items: [
      { id: "d1", label: "Police report obtained", detail: "PR-2024-8812 on file, liability section clear", defaultStatus: "pass", citations: [{ docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" }] },
      { id: "d2", label: "ER records complete", detail: "Mercy General ER records, 4 pages, includes CT results", defaultStatus: "pass", citations: [{ docName: "ER Records — Mercy General", page: "pg. 1", relevance: "direct" }] },
      { id: "d3", label: "All treating physician records", detail: "Dr. Chen (6 visits), Dr. Patel (3 visits) — records on file", defaultStatus: "pass" },
      { id: "d4", label: "Imaging reports collected", detail: "Cervical MRI + Right Knee MRI from Regional Radiology", defaultStatus: "pass", citations: [{ docName: "MRI Report — Regional Radiology", page: "pg. 7", relevance: "direct" }] },
      { id: "d5", label: "PT records complete", detail: "Advanced Rehab — 24 session notes on file, discharge summary pending", defaultStatus: "warn" },
      { id: "d6", label: "Billing records reconciled", detail: "All provider bills received. Pharmacy bills included.", defaultStatus: "pass" },
      { id: "d7", label: "Prior medical records requested", detail: "No prior PCP records obtained — needed to address L4-L5 pre-existing", defaultStatus: "fail" },
    ],
  },
  {
    id: "accident-info",
    title: "Accident Information",
    items: [
      { id: "a1", label: "Mechanism of injury documented", detail: "Rear-end collision at ~35 mph, defendant ran red light", defaultStatus: "pass", citations: [{ docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" }] },
      { id: "a2", label: "Witness statement obtained", detail: "Kevin Donovan — pedestrian bystander, corroborates red-light violation", defaultStatus: "pass", citations: [{ docName: "Witness Statement — K. Donovan", page: "pg. 1", relevance: "corroborating" }] },
      { id: "a3", label: "Liability assessment strong", detail: "Defendant ran red signal. Witness corroboration. No comparative fault.", defaultStatus: "pass" },
      { id: "a4", label: "Accident photos / scene evidence", detail: "Vehicle damage photos not yet obtained", defaultStatus: "warn" },
    ],
  },
  {
    id: "record-integrity",
    title: "Record Integrity",
    items: [
      { id: "r1", label: "Treatment dates internally consistent", detail: "All visit dates align with billing records", defaultStatus: "pass" },
      { id: "r2", label: "Diagnosis codes consistent across providers", detail: "M50.12 consistent. L4-L5 codes vary between providers (M54.5 vs M54.41)", defaultStatus: "warn" },
      { id: "r3", label: "No unauthorized alterations detected", detail: "Records appear authentic. No signs of amendment or alteration.", defaultStatus: "pass" },
      { id: "r4", label: "Signature and authentication present", detail: "All records signed by treating providers", defaultStatus: "pass" },
    ],
  },
  {
    id: "chronic-conditions",
    title: "Chronic Conditions & Prior Injuries",
    items: [
      { id: "c1", label: "Pre-existing conditions identified", detail: "Dr. Chen notes 'possible pre-existing degenerative changes at L4-L5'", defaultStatus: "fail", citations: [{ docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" }] },
      { id: "c2", label: "Prior treatment history reviewed", detail: "No prior PCP records available — unable to confirm/deny prior lumbar complaints", defaultStatus: "fail" },
      { id: "c3", label: "Prior claims check completed", detail: "ISO search pending", defaultStatus: "unchecked" },
    ],
  },
  {
    id: "patient-statements",
    title: "Patient Statements",
    items: [
      { id: "p1", label: "Initial complaint consistent with injuries", detail: "ER presentation matches documented injuries — cervical strain, shoulder contusion", defaultStatus: "pass" },
      { id: "p2", label: "Symptom progression documented", detail: "Pain diary maintained through PT course. Consistent trajectory.", defaultStatus: "pass" },
      { id: "p3", label: "Functional limitations self-reported", detail: "Work restrictions, sleep disruption, ADL limitations documented", defaultStatus: "pass" },
    ],
  },
  {
    id: "treatment-gaps",
    title: "Treatment Gaps & Compliance",
    items: [
      { id: "t1", label: "No unexplained treatment gaps", detail: "14-day gap between ER (11/15) and first ortho follow-up (11/18) — within acceptable range", defaultStatus: "pass" },
      { id: "t2", label: "PT compliance adequate", detail: "Only 24/36 sessions completed (67%). Defense will likely argue non-compliance.", defaultStatus: "fail", citations: [{ docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" }] },
      { id: "t3", label: "ESI interval within guidelines", detail: "8-week gap between ESI #1 (01/15) and ESI #2 (03/10). Within guidelines but on outer edge.", defaultStatus: "warn" },
      { id: "t4", label: "Follow-up visits timely", detail: "All scheduled follow-ups attended per records", defaultStatus: "pass" },
    ],
  },
  {
    id: "clinical-consistency",
    title: "Clinical Consistency",
    items: [
      { id: "cl1", label: "Injury causation supported", detail: "Mechanism (rear-end MVA at 35 mph) supports cervical disc herniation per treating and IME physicians", defaultStatus: "pass" },
      { id: "cl2", label: "Treatment reasonable and necessary", detail: "All treatment modalities appropriate per diagnosis. PT frequency within guidelines.", defaultStatus: "pass" },
      { id: "cl3", label: "Billing within UCR", detail: "MRI billed at $3,200 vs Medicare ~$380 — expect significant reduction. ESIs on high end.", defaultStatus: "warn" },
    ],
  },
  {
    id: "surgical-support",
    title: "Surgical Support",
    items: [
      { id: "s1", label: "Surgical recommendation documented", detail: "Dr. Chen has discussed surgical consultation if conservative measures fail", defaultStatus: "warn" },
      { id: "s2", label: "Conservative treatment exhausted", detail: "Defense IME (Dr. Roberts) argues conservative treatment not yet exhausted", defaultStatus: "fail", citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 8", relevance: "contradicting" }] },
      { id: "s3", label: "IME rebuttal prepared", detail: "Dr. Roberts concurs on herniation causation but disputes surgical necessity", defaultStatus: "warn", citations: [{ docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" }] },
    ],
  },
  {
    id: "major-concerns",
    title: "Major Concerns",
    items: [
      { id: "m1", label: "Pre-existing L4-L5 degenerative changes", detail: "No prior records to rebut. Request PCP records immediately.", defaultStatus: "fail" },
      { id: "m2", label: "PT non-completion may weaken damages", detail: "Defense will argue 67% compliance shows injuries less severe than claimed", defaultStatus: "fail" },
      { id: "m3", label: "IME disputes surgical necessity", detail: "Key vulnerability in demand. Consider rebuttal expert opinion.", defaultStatus: "warn" },
      { id: "m4", label: "Billing reductions expected (~29%)", detail: "Gap between billed ($87,450) and expected adjusted ($62,200) is significant", defaultStatus: "warn" },
    ],
  },
];

// ─── Main Component ──────────────────────────────────
const ChecklistTab = () => {
  const { pkg } = useCasePackage();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(CHECKLIST_SECTIONS.map((s) => s.id))
  );
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>(() => {
    const map: Record<string, ItemStatus> = {};
    CHECKLIST_SECTIONS.forEach((s) => s.items.forEach((i) => { map[i.id] = i.defaultStatus; }));
    return map;
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const cycleStatus = (itemId: string) => {
    const order: ItemStatus[] = ["unchecked", "pass", "warn", "fail"];
    setItemStatuses((prev) => {
      const current = prev[itemId] ?? "unchecked";
      const idx = order.indexOf(current);
      return { ...prev, [itemId]: order[(idx + 1) % order.length] };
    });
  };

  // Summary counts
  const allItems = CHECKLIST_SECTIONS.flatMap((s) => s.items);
  const counts = {
    pass: allItems.filter((i) => (itemStatuses[i.id] ?? i.defaultStatus) === "pass").length,
    warn: allItems.filter((i) => (itemStatuses[i.id] ?? i.defaultStatus) === "warn").length,
    fail: allItems.filter((i) => (itemStatuses[i.id] ?? i.defaultStatus) === "fail").length,
    unchecked: allItems.filter((i) => (itemStatuses[i.id] ?? i.defaultStatus) === "unchecked").length,
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Claim Review Checklist</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Evidence-backed review points — status indicators are guidance tools, not blockers.
        </p>

        {/* Summary bar */}
        <div className="flex items-center gap-4 mt-3 p-3 rounded-lg bg-accent/40 border border-border">
          <SummaryChip icon={CheckCircle2} count={counts.pass} label="Clear" className="text-[hsl(var(--status-approved))]" />
          <SummaryChip icon={AlertTriangle} count={counts.warn} label="Review" className="text-[hsl(var(--status-review))]" />
          <SummaryChip icon={XCircle} count={counts.fail} label="Issue" className="text-destructive" />
          <SummaryChip icon={Circle} count={counts.unchecked} label="Unchecked" className="text-muted-foreground" />
          <div className="flex-1" />
          <div className="h-2 flex-1 max-w-[200px] bg-border rounded-full overflow-hidden flex">
            <div className="h-full bg-[hsl(var(--status-approved))] transition-all" style={{ width: `${(counts.pass / allItems.length) * 100}%` }} />
            <div className="h-full bg-[hsl(var(--status-review))] transition-all" style={{ width: `${(counts.warn / allItems.length) * 100}%` }} />
            <div className="h-full bg-destructive transition-all" style={{ width: `${(counts.fail / allItems.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {CHECKLIST_SECTIONS.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const sectionCounts = {
            pass: section.items.filter((i) => (itemStatuses[i.id]) === "pass").length,
            warn: section.items.filter((i) => (itemStatuses[i.id]) === "warn").length,
            fail: section.items.filter((i) => (itemStatuses[i.id]) === "fail").length,
          };

          return (
            <div key={section.id} className="card-elevated overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-accent/30 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <h3 className="text-[12px] font-semibold text-foreground flex-1">{section.title}</h3>

                {/* Mini status pills */}
                <div className="flex items-center gap-1.5">
                  {sectionCounts.fail > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{sectionCounts.fail}</span>
                  )}
                  {sectionCounts.warn > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]">{sectionCounts.warn}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {sectionCounts.pass}/{section.items.length}
                  </span>
                </div>
              </button>

              {/* Items */}
              {isExpanded && (
                <div className="divide-y divide-border/50">
                  {section.items.map((item) => {
                    const status = itemStatuses[item.id] ?? item.defaultStatus;
                    const config = STATUS_CONFIG[status];
                    const StatusIcon = config.icon;
                    const noteText = notes[item.id] ?? "";
                    const isEditingThis = editingNote === item.id;

                    return (
                      <div key={item.id} className="px-4 py-3 hover:bg-accent/10 transition-colors">
                        <div className="flex items-start gap-2.5">
                          {/* Status toggle */}
                          <button
                            onClick={() => cycleStatus(item.id)}
                            className={`mt-0.5 shrink-0 transition-colors ${config.dotClass}`}
                            title={`Status: ${config.label}. Click to cycle.`}
                          >
                            <StatusIcon className="h-4 w-4" />
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.detail}</p>

                            {/* Citations */}
                            {item.citations && item.citations.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {item.citations.map((c, i) => (
                                  <CitationBadge key={i} source={c} />
                                ))}
                              </div>
                            )}

                            {/* Analyst note */}
                            {(noteText || isEditingThis) && (
                              <div className="mt-2 pt-2 border-t border-border/40">
                                {isEditingThis ? (
                                  <div className="flex items-start gap-1.5">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                    <textarea
                                      className="flex-1 text-[11px] bg-accent/50 border border-primary/20 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 resize-none min-h-[40px] text-foreground"
                                      value={noteText}
                                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                      placeholder="Add analyst note…"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => setEditingNote(null)}
                                      className="text-[10px] font-medium text-primary hover:underline mt-0.5"
                                    >
                                      Done
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-1.5">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                    <p
                                      className="text-[10px] text-muted-foreground italic cursor-pointer hover:text-foreground transition-colors"
                                      onClick={() => setEditingNote(item.id)}
                                    >
                                      {noteText}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Add note button */}
                          {!noteText && !isEditingThis && (
                            <button
                              onClick={() => { setNotes((prev) => ({ ...prev, [item.id]: "" })); setEditingNote(item.id); }}
                              className="shrink-0 p-1 rounded text-muted-foreground/0 hover:text-muted-foreground hover:bg-accent transition-all group-hover:text-muted-foreground/30"
                              title="Add note"
                            >
                              <MessageSquare className="h-3 w-3" />
                            </button>
                          )}
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

      {/* Footer */}
      <div className="mt-6 p-3 rounded-lg bg-accent/30 border border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Note:</strong> Checklist items are review aids — not approval gates. Issues flagged here do not block workflow progression. Items marked as "Issue" should be addressed before completing the demand but are not mandatory.
        </p>
      </div>
    </div>
  );
};

function SummaryChip({ icon: Icon, count, label, className }: {
  icon: React.ElementType; count: number; label: string; className: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${className}`} />
      <span className="text-[12px] font-semibold text-foreground">{count}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default ChecklistTab;
