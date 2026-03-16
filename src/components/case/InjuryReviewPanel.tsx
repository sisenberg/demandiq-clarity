import { useState } from "react";
import {
  Bone, CheckCircle2, ChevronDown, ChevronRight, Edit3, FileText,
  Save, Trash2, X, Zap, AlertTriangle, Activity, Shield, Brain,
} from "lucide-react";
import {
  useCaseInjuryRecords,
  useUpdateInjuryRecord,
  useVerifyInjuryRecord,
  useDeleteInjuryRecord,
  useTriggerInjuryExtraction,
  computeInjurySummary,
  type InjuryRecordRow,
} from "@/hooks/useInjuryRecords";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
  medicalDocumentIds?: string[];
}

const InjuryReviewPanel = ({ caseId, tenantId, medicalDocumentIds = [] }: Props) => {
  const { user } = useAuth();
  const { data: records = [], isLoading } = useCaseInjuryRecords(caseId);
  const triggerExtraction = useTriggerInjuryExtraction();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = computeInjurySummary(records);

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
          <Bone className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Injury & Diagnosis Review</h3>
          <span className="text-[9px] font-medium text-muted-foreground">
            {records.length} record{records.length !== 1 ? "s" : ""}
          </span>
        </div>
        {medicalDocumentIds.length > 0 && (
          <button
            onClick={() => {
              medicalDocumentIds.forEach((docId) =>
                triggerExtraction.mutate({ documentId: docId, caseId, tenantId })
              );
            }}
            disabled={triggerExtraction.isPending}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Zap className="h-3 w-3" />
            {triggerExtraction.isPending ? "Extracting…" : "Extract Injuries"}
          </button>
        )}
      </div>

      {/* Clinical Flag Summary */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-5 py-3 border-b border-border bg-accent/30">
          <FlagStat label="Injuries" value={summary.totalInjuries} />
          <FlagStat label="Verified" value={`${summary.verified}/${summary.totalInjuries}`} />
          <FlagStat label="Objective" value={summary.objectiveSupport} highlight={summary.objectiveSupport > 0} />
          <FlagStat label="Invasive" value={summary.invasiveTreatment} highlight={summary.invasiveTreatment > 0} />
          <FlagStat label="Residual" value={summary.residualSymptoms} highlight={summary.residualSymptoms > 0} />
          <FlagStat label="Functional" value={summary.functionalImpact} highlight={summary.functionalImpact > 0} />
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && (
        <div className="px-5 py-8 text-center">
          <Bone className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No injury records extracted yet.</p>
          {medicalDocumentIds.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Click "Extract Injuries" to process {medicalDocumentIds.length} document{medicalDocumentIds.length !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Injury Cards */}
      {records.length > 0 && (
        <div className="divide-y divide-border">
          {records.map((rec) => (
            <InjuryCard
              key={rec.id}
              record={rec}
              isExpanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              userId={user?.id ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Injury Card ───────────────────────────────────────

function InjuryCard({
  record,
  isExpanded,
  onToggle,
  userId,
}: {
  record: InjuryRecordRow;
  isExpanded: boolean;
  onToggle: () => void;
  userId: string;
}) {
  const updateRecord = useUpdateInjuryRecord();
  const verifyRecord = useVerifyInjuryRecord();
  const deleteRecord = useDeleteInjuryRecord();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<InjuryRecordRow>>({});

  const confPct = record.extraction_confidence != null ? Math.round(record.extraction_confidence * 100) : null;
  const isVerified = record.verification_status === "verified";

  const activeFlags = [
    record.objective_support_flag && "Objective",
    record.invasive_treatment_flag && "Invasive",
    record.residual_symptom_flag && "Residual",
    record.functional_impact_flag && "Functional",
  ].filter(Boolean) as string[];

  const startEdit = () => {
    setDraft({
      injury_description: record.injury_description,
      body_part: record.body_part,
      diagnosis_description: record.diagnosis_description,
      imaging_references: record.imaging_references,
      surgery_mentions: record.surgery_mentions,
      injections_or_procedures: record.injections_or_procedures,
      therapy_mentions: record.therapy_mentions,
      residual_symptom_language: record.residual_symptom_language,
      work_restrictions: record.work_restrictions,
      functional_limitations: record.functional_limitations,
      objective_support_flag: record.objective_support_flag,
      invasive_treatment_flag: record.invasive_treatment_flag,
      residual_symptom_flag: record.residual_symptom_flag,
      functional_impact_flag: record.functional_impact_flag,
    });
    setEditing(true);
  };

  const save = () => {
    updateRecord.mutate({ recordId: record.id, patch: draft }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <div className="px-5 py-3">
      {/* Header row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        <div className="flex items-center gap-1.5 shrink-0">
          {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-foreground truncate block">
            {record.injury_description || record.body_part || "Injury record"}
          </span>
          {record.body_part && record.injury_description && (
            <span className="text-[9px] text-muted-foreground">{record.body_part}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {activeFlags.map((flag) => (
            <span key={flag} className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]">
              {flag}
            </span>
          ))}
          {confPct != null && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
              confPct >= 80 ? "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]"
                : confPct >= 50 ? "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]"
                  : "bg-destructive/10 text-destructive"
            }`}>
              {confPct}%
            </span>
          )}
          {isVerified && <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />}
        </div>
      </button>

      {/* Expanded */}
      {isExpanded && (
        <div className="mt-3 ml-5 space-y-3">
          {editing ? (
            <InjuryEditForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditing(false)} isPending={updateRecord.isPending} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <DetailField label="Injury" value={record.injury_description} />
                <DetailField label="Body Part" value={record.body_part} />
                <DetailField label="Diagnosis" value={record.diagnosis_description} />
                <DetailField label="ICD Codes" value={record.icd_codes.length > 0 ? record.icd_codes.join(", ") : null} />
                <DetailField label="Imaging" value={record.imaging_references} />
                <DetailField label="Surgery" value={record.surgery_mentions} />
                <DetailField label="Injections / Procedures" value={record.injections_or_procedures} />
                <DetailField label="Therapy" value={record.therapy_mentions} />
              </div>

              {record.residual_symptom_language && (
                <DetailBlock label="Residual Symptoms" value={record.residual_symptom_language} />
              )}
              {record.work_restrictions && (
                <DetailBlock label="Work Restrictions" value={record.work_restrictions} />
              )}
              {record.functional_limitations && (
                <DetailBlock label="Functional Limitations" value={record.functional_limitations} />
              )}

              {/* Clinical Flags */}
              <div className="flex flex-wrap gap-1.5">
                <FlagPill active={record.objective_support_flag} label="Objective Support" />
                <FlagPill active={record.invasive_treatment_flag} label="Invasive Treatment" />
                <FlagPill active={record.residual_symptom_flag} label="Residual Symptoms" />
                <FlagPill active={record.functional_impact_flag} label="Functional Impact" />
              </div>

              {/* Source evidence */}
              {record.source_snippet && (
                <div className="rounded-lg bg-accent/50 border border-border px-3 py-2">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Source Evidence</p>
                  <p className="text-[10px] text-foreground italic">"{record.source_snippet}"</p>
                  <p className="text-[8px] text-muted-foreground mt-1">
                    Page {record.source_page ?? "?"}
                    {record.source_document_id && ` · Doc ${record.source_document_id.slice(0, 8)}…`}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <button onClick={startEdit} className="flex items-center gap-1 text-[9px] font-medium px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground hover:bg-accent transition-colors">
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                {!isVerified && (
                  <button
                    onClick={() => verifyRecord.mutate({ recordId: record.id, userId })}
                    className="flex items-center gap-1 text-[9px] font-medium px-2.5 py-1.5 rounded-md bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] hover:bg-[hsl(var(--status-approved))]/20 transition-colors"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Verify
                  </button>
                )}
                <button
                  onClick={() => deleteRecord.mutate({ recordId: record.id })}
                  className="flex items-center gap-1 text-[9px] font-medium px-2.5 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit Form ─────────────────────────────────────────

function InjuryEditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  isPending,
}: {
  draft: Partial<InjuryRecordRow>;
  setDraft: (d: Partial<InjuryRecordRow>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <EditInput label="Injury Description" value={draft.injury_description ?? ""} onChange={(v) => setDraft({ ...draft, injury_description: v })} />
        <EditInput label="Body Part" value={draft.body_part ?? ""} onChange={(v) => setDraft({ ...draft, body_part: v })} />
        <EditInput label="Diagnosis" value={draft.diagnosis_description ?? ""} onChange={(v) => setDraft({ ...draft, diagnosis_description: v })} />
        <EditInput label="Imaging" value={draft.imaging_references ?? ""} onChange={(v) => setDraft({ ...draft, imaging_references: v })} />
        <EditInput label="Surgery" value={draft.surgery_mentions ?? ""} onChange={(v) => setDraft({ ...draft, surgery_mentions: v })} />
        <EditInput label="Injections / Procedures" value={draft.injections_or_procedures ?? ""} onChange={(v) => setDraft({ ...draft, injections_or_procedures: v })} />
        <EditInput label="Therapy" value={draft.therapy_mentions ?? ""} onChange={(v) => setDraft({ ...draft, therapy_mentions: v })} />
      </div>
      <EditTextarea label="Residual Symptoms" value={draft.residual_symptom_language ?? ""} onChange={(v) => setDraft({ ...draft, residual_symptom_language: v })} />
      <EditTextarea label="Work Restrictions" value={draft.work_restrictions ?? ""} onChange={(v) => setDraft({ ...draft, work_restrictions: v })} />
      <EditTextarea label="Functional Limitations" value={draft.functional_limitations ?? ""} onChange={(v) => setDraft({ ...draft, functional_limitations: v })} />

      <div className="flex flex-wrap gap-3 pt-1">
        <FlagToggle label="Objective Support" checked={draft.objective_support_flag ?? false} onChange={(v) => setDraft({ ...draft, objective_support_flag: v })} />
        <FlagToggle label="Invasive Treatment" checked={draft.invasive_treatment_flag ?? false} onChange={(v) => setDraft({ ...draft, invasive_treatment_flag: v })} />
        <FlagToggle label="Residual Symptoms" checked={draft.residual_symptom_flag ?? false} onChange={(v) => setDraft({ ...draft, residual_symptom_flag: v })} />
        <FlagToggle label="Functional Impact" checked={draft.functional_impact_flag ?? false} onChange={(v) => setDraft({ ...draft, functional_impact_flag: v })} />
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button onClick={onSave} disabled={isPending} className="flex items-center gap-1 text-[9px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Save className="h-3 w-3" /> Save
        </button>
        <button onClick={onCancel} className="text-[9px] font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-accent">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Primitives ────────────────────────────────────────

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-[11px] text-foreground">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-[10px] text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function FlagPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
      active
        ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]"
        : "bg-accent border-border text-muted-foreground"
    }`}>
      {active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

function FlagToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[9px] text-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-border" />
      {label}
    </label>
  );
}

function FlagStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-[14px] font-bold tabular-nums ${highlight ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>{value}</p>
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

function EditInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-ring" />
    </div>
  );
}

function EditTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-ring resize-none" />
    </div>
  );
}

export default InjuryReviewPanel;
