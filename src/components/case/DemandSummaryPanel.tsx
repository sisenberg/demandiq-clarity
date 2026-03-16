import { useState } from "react";
import {
  FileText, CheckCircle2, Edit3, Save, X, Zap, Clock,
  DollarSign, User, Briefcase, Building2, Calendar, Shield, Hash,
} from "lucide-react";
import {
  useCaseDemands,
  useDemandFieldExtractions,
  useUpdateDemand,
  useActivateDemand,
  useTriggerDemandExtraction,
  DEMAND_FIELD_LABELS,
  type DemandRow,
} from "@/hooks/useDemands";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
  demandDocumentId?: string;
}

const FIELD_ICONS: Record<string, React.ElementType> = {
  demand_date: Calendar, claimant_name: User, attorney_name: Briefcase,
  law_firm_name: Building2, represented_status: Shield, demand_amount: DollarSign,
  demand_deadline: Clock, loss_date: Calendar, insured_name: User,
  claim_number: Hash, demand_summary_text: FileText,
};

const DemandSummaryPanel = ({ caseId, tenantId, demandDocumentId }: Props) => {
  const { data: demands = [], isLoading } = useCaseDemands(caseId);
  const triggerExtraction = useTriggerDemandExtraction();
  const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);

  const activeDemand = demands.find((d) => d.is_active);
  const currentDemand = selectedDemandId
    ? demands.find((d) => d.id === selectedDemandId)
    : activeDemand ?? demands[0];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (demands.length === 0) {
    return (
      <div className="card-elevated p-6 text-center space-y-3">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No demand record extracted yet.</p>
        {demandDocumentId && (
          <button
            onClick={() => triggerExtraction.mutate({ documentId: demandDocumentId, caseId, tenantId })}
            disabled={triggerExtraction.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5" />
            {triggerExtraction.isPending ? "Extracting…" : "Extract Demand"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Demand selector for history */}
      {demands.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {demands.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDemandId(d.id)}
              className={`text-[10px] font-medium px-3 py-1.5 rounded-full border transition-colors shrink-0 ${
                currentDemand?.id === d.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {d.is_active && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
              {d.demand_date || new Date(d.created_at).toLocaleDateString()}
              {d.demand_amount != null && ` · $${d.demand_amount.toLocaleString()}`}
            </button>
          ))}
        </div>
      )}

      {currentDemand && <DemandCard demand={currentDemand} caseId={caseId} />}
    </div>
  );
};

// ─── Demand Detail Card ────────────────────────────────

function DemandCard({ demand, caseId }: { demand: DemandRow; caseId: string }) {
  const { data: extractions = [] } = useDemandFieldExtractions(demand.id);
  const updateDemand = useUpdateDemand();
  const activateDemand = useActivateDemand();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<DemandRow>>({});

  const startEdit = () => {
    setDraft({
      demand_date: demand.demand_date,
      claimant_name: demand.claimant_name,
      attorney_name: demand.attorney_name,
      law_firm_name: demand.law_firm_name,
      represented_status: demand.represented_status,
      demand_amount: demand.demand_amount,
      demand_deadline: demand.demand_deadline,
      loss_date: demand.loss_date,
      insured_name: demand.insured_name,
      claim_number: demand.claim_number,
      demand_summary_text: demand.demand_summary_text,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateDemand.mutate({ demandId: demand.id, patch: draft }, {
      onSuccess: () => setEditing(false),
    });
  };

  const confidenceMap = Object.fromEntries(
    extractions.map((e) => [e.field_name, e])
  );

  const editableFields = Object.keys(DEMAND_FIELD_LABELS).filter((k) => k !== "demand_summary_text");

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Demand Record</h3>
          {demand.is_active ? (
            <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
              Active
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={saveEdit}
                disabled={updateDemand.isPending}
                className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3 w-3" /> Save
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {!demand.is_active && (
                <button
                  onClick={() => activateDemand.mutate({ demandId: demand.id, caseId })}
                  disabled={activateDemand.isPending}
                  className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-[hsl(var(--status-approved))] text-white hover:opacity-90 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3 w-3" /> Activate
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fields grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {editableFields.map((fieldName) => {
          const Icon = FIELD_ICONS[fieldName] ?? FileText;
          const extraction = confidenceMap[fieldName];
          const value = editing
            ? (draft as any)[fieldName] ?? ""
            : (demand as any)[fieldName] ?? "";

          return (
            <div key={fieldName} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {DEMAND_FIELD_LABELS[fieldName]}
                </label>
                {extraction && (
                  <ConfidencePill confidence={extraction.confidence} />
                )}
              </div>
              {editing ? (
                fieldName === "represented_status" ? (
                  <select
                    value={value}
                    onChange={(e) => setDraft({ ...draft, [fieldName]: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="represented">Represented</option>
                    <option value="unrepresented">Unrepresented</option>
                  </select>
                ) : fieldName === "demand_amount" ? (
                  <input
                    type="number"
                    value={value ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [fieldName]: e.target.value ? parseFloat(e.target.value) : null })
                    }
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="0.00"
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setDraft({ ...draft, [fieldName]: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                )
              ) : (
                <p className="text-[12px] text-foreground">
                  {fieldName === "demand_amount" && value != null
                    ? `$${Number(value).toLocaleString()}`
                    : value || "—"}
                </p>
              )}
              {extraction?.source_snippet && !editing && (
                <p
                  className="text-[9px] text-muted-foreground/70 italic truncate cursor-help"
                  title={extraction.source_snippet}
                >
                  p.{extraction.source_page ?? "?"}: "{extraction.source_snippet.slice(0, 80)}…"
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="px-5 pb-5">
        <div className="space-y-1">
          <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Demand Summary
          </label>
          {editing ? (
            <textarea
              value={(draft.demand_summary_text as string) ?? ""}
              onChange={(e) => setDraft({ ...draft, demand_summary_text: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          ) : (
            <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
              {demand.demand_summary_text || "—"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Confidence pill ───────────────────────────────────

function ConfidencePill({ confidence }: { confidence: number | null }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80
      ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]"
      : pct >= 50
        ? "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      {pct}%
    </span>
  );
}

export default DemandSummaryPanel;
