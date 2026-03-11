/**
 * ReviewerIQ — Bill Line Review Table
 * Displays structured bill lines with reference pricing and disposition controls.
 */

import { useState, useMemo } from "react";
import {
  DollarSign, AlertTriangle, CheckCircle2, Search, X, Filter,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { ReviewerBillLine, BillLineDisposition } from "@/types/reviewer-bills";

const DISPOSITION_LABEL: Record<BillLineDisposition, string> = {
  pending: "Pending",
  accepted: "Accepted",
  reduced: "Reduced",
  denied: "Denied",
  disputed: "Disputed",
  uncertain: "Uncertain",
};

const DISPOSITION_STYLE: Record<BillLineDisposition, string> = {
  pending: "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-foreground))]",
  accepted: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  reduced: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  denied: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))]",
  disputed: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]",
  uncertain: "bg-accent text-muted-foreground",
};

interface BillLineReviewTableProps {
  billLines: ReviewerBillLine[];
  onDisposition: (lineId: string, disposition: string, amount: number | null) => void;
}

export default function BillLineReviewTable({ billLines, onDisposition }: BillLineReviewTableProps) {
  const [search, setSearch] = useState("");
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const filtered = useMemo(() => {
    return billLines.filter(l => {
      if (showFlaggedOnly && l.flags.length === 0 && (!l.variance_pct || l.variance_pct <= 200)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${l.cpt_code || ""} ${l.description} ${l.provider_name}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [billLines, search, showFlaggedOnly]);

  // Group by provider
  const grouped = useMemo(() => {
    const map = new Map<string, ReviewerBillLine[]>();
    for (const l of filtered) {
      const key = l.provider_name || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return [...map.entries()];
  }, [filtered]);

  const totalBilled = filtered.reduce((s, l) => s + l.billed_amount, 0);
  const totalRef = filtered.reduce((s, l) => s + (l.reference_amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Search by code, description…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
        </div>

        <button
          onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
          className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            showFlaggedOnly ? "border-[hsl(var(--status-review))]/30 bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]" : "border-border bg-card text-muted-foreground"
          }`}
        >
          <AlertTriangle className="h-3 w-3 inline mr-1" />Flagged / High Variance
        </button>

        <div className="ml-auto text-[10px] text-muted-foreground">
          {filtered.length} lines · ${totalBilled.toLocaleString()} billed · ${totalRef.toLocaleString()} reference
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="data-table">
          <thead className="sticky-header">
            <tr>
              <th>DOS</th>
              <th>CPT</th>
              <th>Description</th>
              <th className="text-right">Units</th>
              <th className="text-right">Billed</th>
              <th className="text-right">Reference</th>
              <th className="text-right">Variance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([provider, lines]) => (
              <>
                <tr key={`hdr-${provider}`} className="bg-accent/20">
                  <td colSpan={9} className="text-[10px] font-semibold text-foreground py-1.5">
                    {provider} · {lines.length} line{lines.length !== 1 ? "s" : ""} · ${lines.reduce((s, l) => s + l.billed_amount, 0).toLocaleString()}
                  </td>
                </tr>
                {lines.map(line => (
                  <BillLineRow
                    key={line.id}
                    line={line}
                    expanded={expandedLine === line.id}
                    onToggle={() => setExpandedLine(expandedLine === line.id ? null : line.id)}
                    onDisposition={onDisposition}
                  />
                ))}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="text-right font-mono">${totalBilled.toLocaleString()}</td>
              <td className="text-right font-mono">${totalRef.toLocaleString()}</td>
              <td className="text-right font-mono">
                {totalRef > 0 ? `${Math.round((totalBilled / totalRef) * 100)}%` : "—"}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function BillLineRow({
  line, expanded, onToggle, onDisposition,
}: {
  line: ReviewerBillLine;
  expanded: boolean;
  onToggle: () => void;
  onDisposition: (id: string, d: string, amount: number | null) => void;
}) {
  const highVariance = line.variance_pct && line.variance_pct > 200;
  const hasFlags = line.flags.length > 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer ${highVariance ? "bg-[hsl(var(--status-review-bg))]/30" : ""}`}
      >
        <td className="text-[11px] font-mono">{line.service_date || "—"}</td>
        <td className="text-[11px] font-mono font-medium">{line.cpt_code || "—"}</td>
        <td className="text-[10px] max-w-[200px] truncate">
          {line.description}
          {hasFlags && <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-review))] inline ml-1" />}
        </td>
        <td className="text-right text-[11px]">{line.units}</td>
        <td className="text-right text-[11px] font-mono">${line.billed_amount.toLocaleString()}</td>
        <td className="text-right text-[11px] font-mono">{line.reference_amount ? `$${line.reference_amount.toLocaleString()}` : "—"}</td>
        <td className={`text-right text-[11px] font-mono ${highVariance ? "text-[hsl(var(--status-failed))] font-semibold" : line.variance_pct && line.variance_pct > 150 ? "text-[hsl(var(--status-review))]" : ""}`}>
          {line.variance_pct ? `${line.variance_pct}%` : "—"}
        </td>
        <td>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${DISPOSITION_STYLE[line.disposition]}`}>
            {DISPOSITION_LABEL[line.disposition]}
          </span>
        </td>
        <td>
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-accent/20 px-4 py-3">
            <div className="space-y-2">
              {/* Reference basis */}
              <div className="text-[9px] text-muted-foreground">
                <span className="font-medium">Reference basis: </span>{line.reference_basis}
              </div>

              {/* Flags */}
              {line.flags.length > 0 && (
                <div className="space-y-1">
                  {line.flags.map((f, i) => (
                    <div key={i} className="text-[9px] flex items-center gap-1">
                      <AlertTriangle className={`h-2.5 w-2.5 ${f.severity === "error" ? "text-[hsl(var(--status-failed))]" : "text-[hsl(var(--status-review))]"}`} />
                      <span>{f.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Disposition actions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {(["accepted", "reduced", "denied", "disputed", "uncertain"] as BillLineDisposition[]).map(d => (
                  <button
                    key={d}
                    onClick={(e) => { e.stopPropagation(); onDisposition(line.id, d, d === "accepted" ? line.billed_amount : d === "reduced" && line.reference_amount ? line.reference_amount : null); }}
                    className={`text-[9px] font-medium px-2 py-1 rounded-md border transition-colors ${
                      line.disposition === d
                        ? `${DISPOSITION_STYLE[d]} border-current/20`
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {DISPOSITION_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
