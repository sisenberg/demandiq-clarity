import { useState, useMemo } from "react";
import {
  useCaseChronologyCandidates,
  useCandidateEvidenceLinks,
  useGenerateChronology,
  useUpdateCandidateStatus,
  useEditCandidate,
  useMergeCandidates,
  CHRONO_CATEGORY_LABEL,
  type ChronologyCandidateRow,
  type ChronologyCandidateStatus,
} from "@/hooks/useChronologyCandidates";
import { useAuditLog } from "@/hooks/useAuditLog";
import { ConfidenceBadge } from "./DocumentMetadataPanel";
import {
  Clock,
  Sparkles,
  Loader2,
  Check,
  X,
  EyeOff,
  Merge,
  ExternalLink,
  Pencil,
  ChevronDown,
  ChevronRight,
  FileText,
  Quote,
  Filter,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DraftChronologyPanelProps {
  caseId: string;
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "accepted", label: "Accepted" },
  { key: "suppressed", label: "Suppressed" },
];

const CATEGORY_DOT: Record<string, string> = {
  accident: "bg-destructive",
  first_treatment: "bg-[hsl(var(--status-attention))]",
  treatment: "bg-[hsl(var(--status-processing))]",
  imaging: "bg-[hsl(var(--status-review))]",
  injection: "bg-[hsl(var(--status-approved))]",
  surgery: "bg-destructive",
  ime: "bg-muted-foreground",
  demand: "bg-primary",
  legal: "bg-primary",
  billing: "bg-[hsl(var(--status-attention))]",
  correspondence: "bg-muted-foreground",
  investigation: "bg-[hsl(var(--status-review))]",
  representation: "bg-primary",
  administrative: "bg-muted-foreground",
  other: "bg-muted-foreground",
};

const DraftChronologyPanel = ({ caseId }: DraftChronologyPanelProps) => {
  const { data: candidates = [], isLoading } = useCaseChronologyCandidates(caseId);
  const generateChronology = useGenerateChronology();
  const updateStatus = useUpdateCandidateStatus();
  const editCandidate = useEditCandidate();
  const mergeCandidates = useMergeCandidates();
  const auditLog = useAuditLog();
  const [statusFilter, setStatusFilter] = useState("all");
  const [mergeMode, setMergeMode] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = candidates.filter((c) => c.status !== "merged");
    if (statusFilter !== "all") {
      items = items.filter((c) => c.status === statusFilter);
    }
    return items;
  }, [candidates, statusFilter]);

  const counts = useMemo(() => ({
    all: candidates.filter((c) => c.status !== "merged").length,
    draft: candidates.filter((c) => c.status === "draft").length,
    accepted: candidates.filter((c) => c.status === "accepted").length,
    suppressed: candidates.filter((c) => c.status === "suppressed").length,
  }), [candidates]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-[12px] font-semibold text-foreground">Draft Chronology</h3>
          {counts.all > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ({counts.draft} draft · {counts.accepted} accepted)
            </span>
          )}
        </div>
        <button
          onClick={() => generateChronology.mutate(caseId)}
          disabled={generateChronology.isPending}
          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {generateChronology.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {counts.all > 0 ? "Regenerate" : "Generate Chronology"}
        </button>
      </div>

      {/* Status filter pills */}
      {counts.all > 0 && (
        <div className="pill-toggle-group">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`${statusFilter === f.key ? "pill-toggle-active" : "pill-toggle-inactive"} relative`}
            >
              {f.label}
              <span className="ml-1 text-[8px] opacity-70">{counts[f.key as keyof typeof counts]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Loading chronology…</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && counts.all === 0 && (
        <div className="text-center py-6 rounded-lg border border-border bg-card">
          <Clock className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground">
            No chronology events yet. Process documents first, then generate.
          </p>
        </div>
      )}

      {/* Timeline */}
      {filtered.length > 0 && (
        <div className="relative">
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
          <div className="flex flex-col gap-0">
            {filtered.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                caseId={caseId}
                mergeMode={mergeMode}
                onStartMerge={() => setMergeMode(candidate.id)}
                onCancelMerge={() => setMergeMode(null)}
                onMergeInto={() => setMergeMode(null)}
                updateStatus={updateStatus}
                editCandidate={editCandidate}
                mergeCandidates={mergeCandidates}
                auditLog={auditLog}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Candidate Row ──────────────────────────────────────

interface CandidateRowProps {
  candidate: ChronologyCandidateRow;
  caseId: string;
  mergeMode: string | null;
  onStartMerge: () => void;
  onCancelMerge: () => void;
  onMergeInto: () => void;
  updateStatus: ReturnType<typeof useUpdateCandidateStatus>;
  editCandidate: ReturnType<typeof useEditCandidate>;
  mergeCandidates: ReturnType<typeof useMergeCandidates>;
  auditLog: ReturnType<typeof useAuditLog>;
}

function CandidateRow({
  candidate,
  caseId,
  mergeMode,
  onStartMerge,
  onCancelMerge,
  onMergeInto,
  updateStatus,
  editCandidate,
  mergeCandidates,
  auditLog,
}: CandidateRowProps) {

  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label: candidate.label,
    description: candidate.description,
    event_date: candidate.event_date,
  });

  const dotColor = CATEGORY_DOT[candidate.category] ?? "bg-muted-foreground";
  const displayLabel = candidate.user_corrected_label ?? candidate.label;
  const displayDesc = candidate.user_corrected_description ?? candidate.description;
  const displayDate = candidate.user_corrected_date ?? candidate.event_date;

  const isMergeSource = mergeMode === candidate.id;
  const isMergeTarget = mergeMode && mergeMode !== candidate.id;

  const handleSaveEdit = () => {
    auditLog.mutate({
      actionType: "chronology_edited",
      entityType: "chronology_event_candidates",
      entityId: candidate.id,
      caseId,
      beforeValue: { label: candidate.label, description: candidate.description, event_date: candidate.event_date },
      afterValue: { label: editForm.label, description: editForm.description, event_date: editForm.event_date },
    });
    editCandidate.mutate({
      candidateId: candidate.id,
      caseId,
      updates: {
        user_corrected_label: editForm.label !== candidate.machine_label ? editForm.label : undefined,
        user_corrected_description: editForm.description !== candidate.machine_description ? editForm.description : undefined,
        user_corrected_date: editForm.event_date !== candidate.machine_date ? editForm.event_date : undefined,
        label: editForm.label,
        description: editForm.description,
        event_date: editForm.event_date,
      },
    });
    setIsEditing(false);
  };

  const handleStatusChange = (newStatus: ChronologyCandidateStatus) => {
    auditLog.mutate({
      actionType: "chronology_status_changed",
      entityType: "chronology_event_candidates",
      entityId: candidate.id,
      caseId,
      beforeValue: { status: candidate.status },
      afterValue: { status: newStatus },
    });
    updateStatus.mutate({ candidateId: candidate.id, status: newStatus, caseId });
  };

  return (
    <div className={`flex gap-4 py-3 relative group ${isMergeTarget ? "bg-primary/5 rounded-lg px-2 -mx-2" : ""}`}>
      {/* Dot */}
      <div className="relative z-10 mt-1.5 shrink-0">
        <div className={`h-[11px] w-[11px] rounded-full ${dotColor} ring-2 ring-card`} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Date + category */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {displayDate || "No date"}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
            {CHRONO_CATEGORY_LABEL[candidate.category] ?? candidate.category}
          </span>
          {candidate.confidence != null && (
            <ConfidenceBadge confidence={candidate.confidence} />
          )}
          {/* Status badge */}
          {candidate.status !== "draft" && (
            <span className={`text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
              candidate.status === "accepted"
                ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]"
                : "bg-accent text-muted-foreground"
            }`}>
              {candidate.status}
            </span>
          )}
        </div>

        {/* Label + description */}
        {isEditing ? (
          <div className="space-y-1.5 mb-2">
            <input
              value={editForm.event_date}
              onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
              placeholder="YYYY-MM-DD"
              className="w-full text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30"
            />
            <input
              value={editForm.label}
              onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
              className="w-full text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30"
            />
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <div className="flex gap-1">
              <button onClick={handleSaveEdit} className="p-1 rounded text-primary hover:bg-primary/10">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground mb-0.5">{displayLabel}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{displayDesc}</p>
          </>
        )}

        {/* Actions bar */}
        <div className="flex items-center gap-1 mt-1.5">
          {/* Source link */}
          {candidate.source_document_id && (
            <Link
              to={`/documents/${candidate.source_document_id}`}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary transition-colors"
            >
              <FileText className="h-2.5 w-2.5" />
              {candidate.source_page ? `p.${candidate.source_page}` : "Source"}
            </Link>
          )}

          {/* Expand evidence */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
            Evidence
          </button>

          {/* Quick actions — visible on hover */}
          {!isEditing && !mergeMode && (
            <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              {candidate.status === "draft" && (
                <button
                  onClick={() => updateStatus.mutate({ candidateId: candidate.id, status: "accepted", caseId })}
                  className="p-1 rounded text-muted-foreground/50 hover:text-[hsl(var(--status-approved))] hover:bg-accent transition-colors"
                  title="Accept"
                >
                  <Check className="h-3 w-3" />
                </button>
              )}
              {candidate.status === "accepted" && (
                <button
                  onClick={() => updateStatus.mutate({ candidateId: candidate.id, status: "draft", caseId })}
                  className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                  title="Revert to draft"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => {
                  setEditForm({ label: displayLabel, description: displayDesc, event_date: displayDate });
                  setIsEditing(true);
                }}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => updateStatus.mutate({
                  candidateId: candidate.id,
                  status: candidate.status === "suppressed" ? "draft" : "suppressed",
                  caseId,
                })}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                title={candidate.status === "suppressed" ? "Restore" : "Suppress"}
              >
                <EyeOff className="h-3 w-3" />
              </button>
              <button
                onClick={onStartMerge}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                title="Merge into another"
              >
                <Merge className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Merge source label */}
          {isMergeSource && (
            <button onClick={onCancelMerge} className="ml-auto text-[9px] font-medium text-destructive">
              Cancel merge
            </button>
          )}

          {/* Merge target button */}
          {isMergeTarget && (
            <button
              onClick={() => {
                mergeCandidates.mutate({ sourceId: mergeMode!, targetId: candidate.id, caseId });
                onMergeInto();
              }}
              className="ml-auto flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Merge className="h-2.5 w-2.5" /> Merge here
            </button>
          )}
        </div>

        {/* Expanded evidence */}
        {expanded && (
          <EvidenceSection candidateId={candidate.id} />
        )}
      </div>
    </div>
  );
}

// ── Evidence Section ──────────────────────────────────────

function EvidenceSection({ candidateId }: { candidateId: string }) {
  const { data: links = [], isLoading } = useCandidateEvidenceLinks(candidateId);

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <p className="mt-2 text-[9px] text-muted-foreground italic">No evidence links</p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {links.map((link) => (
        <div key={link.id} className="flex items-start gap-2 pl-3 border-l-2 border-primary/20">
          <Link
            to={`/documents/${link.document_id}`}
            className="text-[9px] font-semibold text-primary shrink-0 mt-0.5 hover:underline"
          >
            {link.page_number ? `p.${link.page_number}` : "Doc"}
          </Link>
          {link.quoted_text && (
            <span className="text-[10px] text-foreground font-mono leading-relaxed">
              "{link.quoted_text}"
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default DraftChronologyPanel;
