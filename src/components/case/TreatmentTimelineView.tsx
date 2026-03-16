import { useState } from "react";
import {
  Activity, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  Edit3, FileText, Save, Trash2, User, X, Zap, Stethoscope,
} from "lucide-react";
import {
  useCaseTreatmentEvents,
  useUpdateTreatmentEvent,
  useVerifyTreatmentEvent,
  useDeleteTreatmentEvent,
  useTriggerTreatmentExtraction,
  computeTimelineAggregates,
  EVENT_TYPE_LABEL,
  EVENT_TYPE_COLOR,
  type TreatmentEventRow,
} from "@/hooks/useTreatmentEvents";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
  medicalDocumentIds?: string[];
}

const TreatmentTimelineView = ({ caseId, tenantId, medicalDocumentIds = [] }: Props) => {
  const { user } = useAuth();
  const { data: events = [], isLoading } = useCaseTreatmentEvents(caseId);
  const triggerExtraction = useTriggerTreatmentExtraction();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const agg = computeTimelineAggregates(events);

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
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Treatment Timeline</h3>
          <span className="text-[9px] font-medium text-muted-foreground">
            {events.length} event{events.length !== 1 ? "s" : ""}
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
            {triggerExtraction.isPending ? "Extracting…" : "Extract Timeline"}
          </button>
        )}
      </div>

      {/* Aggregate Summary */}
      {events.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 py-3 border-b border-border bg-accent/30">
          <AggStat label="First Treatment" value={agg.firstDate ? formatShortDate(agg.firstDate) : "—"} />
          <AggStat label="Last Treatment" value={agg.lastDate ? formatShortDate(agg.lastDate) : "—"} />
          <AggStat label="Duration" value={`${agg.durationDays} days`} />
          <AggStat label="Providers" value={agg.providerCount.toString()} />
          <AggStat label="Verified" value={`${agg.verified}/${agg.totalEvents}`} />
        </div>
      )}

      {/* Empty state */}
      {events.length === 0 && (
        <div className="px-5 py-8 text-center">
          <Stethoscope className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No treatment events extracted yet.</p>
          {medicalDocumentIds.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Click "Extract Timeline" to process {medicalDocumentIds.length} medical record{medicalDocumentIds.length !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[29px] top-0 bottom-0 w-px bg-border" />

          <div className="divide-y divide-border">
            {events.map((ev, idx) => (
              <TimelineEventCard
                key={ev.id}
                event={ev}
                isExpanded={expandedId === ev.id}
                onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                userId={user?.id ?? ""}
                isFirst={idx === 0}
                isLast={idx === events.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Timeline Event Card ───────────────────────────────

function TimelineEventCard({
  event,
  isExpanded,
  onToggle,
  userId,
  isFirst,
  isLast,
}: {
  event: TreatmentEventRow;
  isExpanded: boolean;
  onToggle: () => void;
  userId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const updateEvent = useUpdateTreatmentEvent();
  const verifyEvent = useVerifyTreatmentEvent();
  const deleteEvent = useDeleteTreatmentEvent();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<TreatmentEventRow>>({});

  const typeColor = EVENT_TYPE_COLOR[event.event_type] ?? EVENT_TYPE_COLOR.other;
  const typeLabel = EVENT_TYPE_LABEL[event.event_type] ?? event.event_type;
  const confPct = event.extraction_confidence != null ? Math.round(event.extraction_confidence * 100) : null;
  const isVerified = event.verification_status === "verified";

  const startEdit = () => {
    setDraft({
      provider_name: event.provider_name,
      visit_date: event.visit_date,
      event_type: event.event_type,
      specialty: event.specialty,
      body_part_reference: event.body_part_reference,
      symptoms_or_complaints: event.symptoms_or_complaints,
      treatment_plan_notes: event.treatment_plan_notes,
      event_summary: event.event_summary,
    });
    setEditing(true);
  };

  const save = () => {
    updateEvent.mutate({ eventId: event.id, patch: draft }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <div className="relative">
      {/* Timeline dot */}
      <div className="absolute left-[23px] top-[18px] z-10">
        <div className={`h-3 w-3 rounded-full border-2 border-background ${
          isVerified ? "bg-[hsl(var(--status-approved))]" : "bg-primary"
        }`} />
      </div>

      {/* Content */}
      <div className="pl-12 pr-5 py-3">
        {/* Collapsed header */}
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 text-left group"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className="text-[10px] font-mono text-muted-foreground w-[72px]">
              {event.visit_date || "No date"}
            </span>
          </div>

          <span className={`text-[8px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${typeColor}`}>
            {typeLabel}
          </span>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium text-foreground truncate block">
              {event.event_summary || event.provider_name || "Treatment event"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {event.provider_name && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" /> {event.provider_name.slice(0, 20)}
              </span>
            )}
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

        {/* Expanded detail */}
        {isExpanded && (
          <div className="mt-3 ml-5 space-y-3">
            {editing ? (
              <EditForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setEditing(false)} isPending={updateEvent.isPending} />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <DetailField icon={User} label="Provider" value={event.provider_name} />
                  <DetailField icon={Stethoscope} label="Specialty" value={event.specialty} />
                  <DetailField label="Body Part" value={event.body_part_reference} />
                  <DetailField label="Event Type" value={typeLabel} />
                </div>

                {event.symptoms_or_complaints && (
                  <DetailBlock label="Symptoms / Complaints" value={event.symptoms_or_complaints} />
                )}
                {event.treatment_plan_notes && (
                  <DetailBlock label="Treatment / Plan" value={event.treatment_plan_notes} />
                )}

                {/* Source evidence */}
                {event.source_snippet && (
                  <div className="rounded-lg bg-accent/50 border border-border px-3 py-2">
                    <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Source Evidence</p>
                    <p className="text-[10px] text-foreground italic">"{event.source_snippet}"</p>
                    <p className="text-[8px] text-muted-foreground mt-1">
                      Page {event.source_page ?? "?"}
                      {event.source_document_id && ` · Doc ${event.source_document_id.slice(0, 8)}…`}
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
                      onClick={() => verifyEvent.mutate({ eventId: event.id, userId })}
                      className="flex items-center gap-1 text-[9px] font-medium px-2.5 py-1.5 rounded-md bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] hover:bg-[hsl(var(--status-approved))]/20 transition-colors"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Verify
                    </button>
                  )}
                  <button
                    onClick={() => deleteEvent.mutate({ eventId: event.id })}
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
    </div>
  );
}

// ─── Edit Form ─────────────────────────────────────────

function EditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  isPending,
}: {
  draft: Partial<TreatmentEventRow>;
  setDraft: (d: Partial<TreatmentEventRow>) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <EditInput label="Provider" value={draft.provider_name ?? ""} onChange={(v) => setDraft({ ...draft, provider_name: v })} />
        <EditInput label="Visit Date" value={draft.visit_date ?? ""} onChange={(v) => setDraft({ ...draft, visit_date: v })} type="date" />
        <div className="space-y-1">
          <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Event Type</label>
          <select
            value={draft.event_type ?? "office_visit"}
            onChange={(e) => setDraft({ ...draft, event_type: e.target.value })}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <EditInput label="Specialty" value={draft.specialty ?? ""} onChange={(v) => setDraft({ ...draft, specialty: v })} />
        <EditInput label="Body Part" value={draft.body_part_reference ?? ""} onChange={(v) => setDraft({ ...draft, body_part_reference: v })} />
      </div>
      <EditTextarea label="Symptoms / Complaints" value={draft.symptoms_or_complaints ?? ""} onChange={(v) => setDraft({ ...draft, symptoms_or_complaints: v })} />
      <EditTextarea label="Treatment / Plan" value={draft.treatment_plan_notes ?? ""} onChange={(v) => setDraft({ ...draft, treatment_plan_notes: v })} />
      <EditInput label="Summary" value={draft.event_summary ?? ""} onChange={(v) => setDraft({ ...draft, event_summary: v })} />

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

function DetailField({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {Icon && <Icon className="h-2.5 w-2.5" />} {label}
      </p>
      <p className="text-[11px] text-foreground">{value || "—"}</p>
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

function EditInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
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

function AggStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

function formatShortDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return d;
  }
}

export default TreatmentTimelineView;
