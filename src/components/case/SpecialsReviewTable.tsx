import { useState } from "react";
import {
  DollarSign, CheckCircle2, AlertTriangle, Edit3, Save, X,
  Trash2, FileText, Calendar, User, Zap, Hash,
} from "lucide-react";
import {
  useCaseSpecials,
  useUpdateSpecialsRecord,
  useVerifySpecialsRecord,
  useFlagSpecialsRecord,
  useDeleteSpecialsRecord,
  useTriggerSpecialsExtraction,
  computeSpecialsAggregates,
  type SpecialsRecordRow,
} from "@/hooks/useSpecials";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
  billDocumentIds?: string[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  verified: { bg: "bg-[hsl(var(--status-approved))]/10", text: "text-[hsl(var(--status-approved))]", label: "Verified" },
  flagged: { bg: "bg-[hsl(var(--status-attention))]/10", text: "text-[hsl(var(--status-attention))]", label: "Flagged" },
  unverified: { bg: "bg-muted", text: "text-muted-foreground", label: "Unverified" },
};

const SpecialsReviewTable = ({ caseId, tenantId, billDocumentIds = [] }: Props) => {
  const { user } = useAuth();
  const { data: records = [], isLoading } = useCaseSpecials(caseId);
  const triggerExtraction = useTriggerSpecialsExtraction();
  const [editingId, setEditingId] = useState<string | null>(null);

  const agg = computeSpecialsAggregates(records);

  if (isLoading) {
    return (
      <div className="card-elevated p-6 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Medical Specials</h3>
          <span className="text-[9px] font-medium text-muted-foreground">
            {records.length} record{records.length !== 1 ? "s" : ""}
          </span>
        </div>
        {billDocumentIds.length > 0 && (
          <button
            onClick={() => {
              billDocumentIds.forEach((docId) =>
                triggerExtraction.mutate({ documentId: docId, caseId, tenantId })
              );
            }}
            disabled={triggerExtraction.isPending}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Zap className="h-3 w-3" />
            {triggerExtraction.isPending ? "Extracting…" : "Extract Bills"}
          </button>
        )}
      </div>

      {/* Aggregate Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 py-3 border-b border-border bg-accent/30">
          <AggStat label="Total Billed" value={`$${agg.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <AggStat label="Bills" value={agg.numberOfBills.toString()} />
          <AggStat label="Providers" value={agg.numberOfProviders.toString()} />
          <AggStat label="Verified" value={`${agg.verified}/${records.length}`} />
          {agg.flagged > 0 && <AggStat label="Flagged" value={agg.flagged.toString()} warn />}
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && (
        <div className="px-5 py-8 text-center">
          <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No specials records extracted yet.</p>
          {billDocumentIds.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Click "Extract Bills" to process {billDocumentIds.length} document{billDocumentIds.length !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-accent/20">
                <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Provider</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Date</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Code</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Description</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Billed</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Status</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Conf.</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((rec) => (
                <SpecialsRow
                  key={rec.id}
                  record={rec}
                  isEditing={editingId === rec.id}
                  onStartEdit={() => setEditingId(rec.id)}
                  onCancelEdit={() => setEditingId(null)}
                  userId={user?.id ?? ""}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Row Component ─────────────────────────────────────

function SpecialsRow({
  record,
  isEditing,
  onStartEdit,
  onCancelEdit,
  userId,
}: {
  record: SpecialsRecordRow;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  userId: string;
}) {
  const updateRecord = useUpdateSpecialsRecord();
  const verifyRecord = useVerifySpecialsRecord();
  const flagRecord = useFlagSpecialsRecord();
  const deleteRecord = useDeleteSpecialsRecord();
  const [draft, setDraft] = useState<Partial<SpecialsRecordRow>>({});

  const startEdit = () => {
    setDraft({
      provider_name: record.provider_name,
      date_of_service: record.date_of_service,
      cpt_or_hcpcs_code: record.cpt_or_hcpcs_code,
      description: record.description,
      billed_amount: record.billed_amount,
      adjustments: record.adjustments,
      balance_due: record.balance_due,
    });
    onStartEdit();
  };

  const save = () => {
    updateRecord.mutate({ recordId: record.id, patch: draft }, {
      onSuccess: onCancelEdit,
    });
  };

  const status = STATUS_STYLES[record.verification_status] ?? STATUS_STYLES.unverified;
  const confPct = record.extraction_confidence != null ? Math.round(record.extraction_confidence * 100) : null;

  if (isEditing) {
    return (
      <tr className="bg-primary/5">
        <td className="px-4 py-2">
          <input value={draft.provider_name ?? ""} onChange={(e) => setDraft({ ...draft, provider_name: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="px-3 py-2">
          <input type="date" value={draft.date_of_service ?? ""} onChange={(e) => setDraft({ ...draft, date_of_service: e.target.value })}
            className="rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="px-3 py-2">
          <input value={draft.cpt_or_hcpcs_code ?? ""} onChange={(e) => setDraft({ ...draft, cpt_or_hcpcs_code: e.target.value })}
            className="w-20 rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="px-3 py-2">
          <input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td className="px-3 py-2 text-right">
          <input type="number" value={draft.billed_amount ?? 0} onChange={(e) => setDraft({ ...draft, billed_amount: parseFloat(e.target.value) || 0 })}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-[11px] text-right outline-none focus:ring-1 focus:ring-ring" />
        </td>
        <td />
        <td />
        <td className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={updateRecord.isPending} className="p-1 rounded hover:bg-accent text-primary"><Save className="h-3 w-3" /></button>
            <button onClick={onCancelEdit} className="p-1 rounded hover:bg-accent text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-accent/30 transition-colors group">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-foreground font-medium truncate max-w-[160px]">{record.provider_name || "—"}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-foreground">{record.date_of_service || "—"}</span>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {record.cpt_or_hcpcs_code ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-accent px-1.5 py-0.5 rounded">
            <Hash className="h-2.5 w-2.5" />{record.cpt_or_hcpcs_code}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 max-w-[200px]">
        <span className="text-foreground truncate block" title={record.description}>{record.description || "—"}</span>
        {record.source_snippet && (
          <span className="text-[8px] text-muted-foreground/60 italic truncate block" title={record.source_snippet}>
            p.{record.source_page ?? "?"}: "{record.source_snippet.slice(0, 50)}…"
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-foreground tabular-nums">
        ${record.billed_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {confPct != null && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            confPct >= 80 ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]"
              : confPct >= 50 ? "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]"
                : "bg-destructive/10 text-destructive"
          }`}>
            {confPct}%
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={startEdit} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Edit">
            <Edit3 className="h-3 w-3" />
          </button>
          {record.verification_status !== "verified" && (
            <button onClick={() => verifyRecord.mutate({ recordId: record.id, userId })} className="p-1 rounded hover:bg-accent text-[hsl(var(--status-approved))]" title="Verify">
              <CheckCircle2 className="h-3 w-3" />
            </button>
          )}
          {record.verification_status !== "flagged" && (
            <button onClick={() => flagRecord.mutate({ recordId: record.id })} className="p-1 rounded hover:bg-accent text-[hsl(var(--status-attention))]" title="Flag">
              <AlertTriangle className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => deleteRecord.mutate({ recordId: record.id })} className="p-1 rounded hover:bg-accent text-destructive" title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Aggregate stat ────────────────────────────────────

function AggStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-[14px] font-bold tabular-nums ${warn ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>{value}</p>
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

export default SpecialsReviewTable;
