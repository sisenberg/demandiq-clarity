import { useState, useMemo } from "react";
import {
  useCaseEntityClusters,
  useClusterMembers,
  useNormalizeEntities,
  useRenameCluster,
  useSetPrimaryCluster,
  useMergeClusters,
  useSplitMember,
  ENTITY_TYPE_LABEL,
  ENTITY_TYPE_SINGULAR,
  type EntityClusterRow,
  type ClusterMemberRow,
} from "@/hooks/useEntityClusters";
import { ConfidenceBadge } from "./DocumentMetadataPanel";
import {
  Users,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Star,
  Pencil,
  Check,
  X,
  Merge,
  Split,
  FileText,
  Quote,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DetectedEntitiesPanelProps {
  caseId: string;
}

const DetectedEntitiesPanel = ({ caseId }: DetectedEntitiesPanelProps) => {
  const { data: clusters = [], isLoading } = useCaseEntityClusters(caseId);
  const normalizeEntities = useNormalizeEntities();

  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<{ sourceId: string; entityType: string } | null>(null);

  // Group clusters by entity_type
  const byType = useMemo(() => {
    const grouped: Record<string, EntityClusterRow[]> = {};
    for (const c of clusters) {
      if (!grouped[c.entity_type]) grouped[c.entity_type] = [];
      grouped[c.entity_type].push(c);
    }
    return grouped;
  }, [clusters]);

  const entityTypes = Object.keys(byType);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-[12px] font-semibold text-foreground">Detected Entities</h3>
          {clusters.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              ({clusters.length} across {entityTypes.length} types)
            </span>
          )}
        </div>
        <button
          onClick={() => normalizeEntities.mutate(caseId)}
          disabled={normalizeEntities.isPending}
          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {normalizeEntities.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {clusters.length > 0 ? "Re-normalize" : "Detect Entities"}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Loading entities…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && clusters.length === 0 && (
        <div className="text-center py-6 rounded-lg border border-border bg-card">
          <Users className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground">
            No entities detected yet. Run classification on documents first, then normalize.
          </p>
        </div>
      )}

      {/* Entity type groups */}
      {entityTypes.map((entityType) => {
        const typeClusters = byType[entityType];
        const isExpanded = expandedType === entityType;
        const primary = typeClusters.find((c) => c.is_primary);

        return (
          <div key={entityType} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Type header */}
            <button
              onClick={() => setExpandedType(isExpanded ? null : entityType)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/20 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-[11px] font-semibold text-foreground flex-1 text-left">
                {ENTITY_TYPE_LABEL[entityType] ?? entityType}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {typeClusters.length} {typeClusters.length === 1 ? "entity" : "entities"}
              </span>
              {primary && (
                <span className="text-[9px] font-medium text-primary truncate max-w-[150px]">
                  {primary.canonical_value ?? primary.display_value}
                </span>
              )}
            </button>

            {/* Expanded cluster list */}
            {isExpanded && (
              <div className="border-t border-border/50 divide-y divide-border/30">
                {typeClusters.map((cluster) => (
                  <ClusterRow
                    key={cluster.id}
                    cluster={cluster}
                    isExpanded={expandedCluster === cluster.id}
                    onToggle={() =>
                      setExpandedCluster(expandedCluster === cluster.id ? null : cluster.id)
                    }
                    mergeMode={mergeMode}
                    onStartMerge={() =>
                      setMergeMode({ sourceId: cluster.id, entityType: cluster.entity_type })
                    }
                    onCancelMerge={() => setMergeMode(null)}
                    onMergeInto={(targetId) => {
                      setMergeMode(null);
                    }}
                    caseId={caseId}
                    siblingClusters={typeClusters}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Cluster Row ──────────────────────────────────────

interface ClusterRowProps {
  cluster: EntityClusterRow;
  isExpanded: boolean;
  onToggle: () => void;
  mergeMode: { sourceId: string; entityType: string } | null;
  onStartMerge: () => void;
  onCancelMerge: () => void;
  onMergeInto: (targetId: string) => void;
  caseId: string;
  siblingClusters: EntityClusterRow[];
}

function ClusterRow({
  cluster,
  isExpanded,
  onToggle,
  mergeMode,
  onStartMerge,
  onCancelMerge,
  onMergeInto,
  caseId,
  siblingClusters,
}: ClusterRowProps) {
  const { data: members = [] } = useClusterMembers(isExpanded ? cluster.id : undefined);
  const renameCluster = useRenameCluster();
  const setPrimary = useSetPrimaryCluster();
  const mergeClusters = useMergeClusters();
  const splitMember = useSplitMember();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const displayName = cluster.canonical_value ?? cluster.display_value;
  const isMergeTarget =
    mergeMode && mergeMode.sourceId !== cluster.id && mergeMode.entityType === cluster.entity_type;
  const isMergeSource = mergeMode?.sourceId === cluster.id;

  const handleStartEdit = () => {
    setEditValue(displayName);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    renameCluster.mutate({ clusterId: cluster.id, newValue: editValue });
    setIsEditing(false);
  };

  return (
    <div className={`group ${isMergeTarget ? "bg-primary/5" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggle} className="shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
          )}
        </button>

        {cluster.is_primary && (
          <Star className="h-3 w-3 text-primary shrink-0" fill="currentColor" />
        )}

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 text-[11px] px-2 py-1 rounded border border-primary/30 bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="p-1 rounded text-primary hover:bg-primary/10">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-medium text-foreground flex-1 truncate">
            {displayName}
          </span>
        )}

        <ConfidenceBadge confidence={cluster.confidence} />

        <span className="text-[9px] text-muted-foreground shrink-0">
          {cluster.source_count} ref{cluster.source_count !== 1 ? "s" : ""}
        </span>

        {/* Merge target button */}
        {isMergeTarget && (
          <button
            onClick={() => {
              mergeClusters.mutate({
                sourceClusterId: mergeMode!.sourceId,
                targetClusterId: cluster.id,
              });
              onMergeInto(cluster.id);
            }}
            className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Merge className="h-2.5 w-2.5" /> Merge here
          </button>
        )}

        {/* Actions (only when not in merge mode) */}
        {!mergeMode && !isEditing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100">
            <button
              onClick={handleStartEdit}
              className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
              title="Rename"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            {!cluster.is_primary && (
              <button
                onClick={() =>
                  setPrimary.mutate({
                    clusterId: cluster.id,
                    caseId,
                    entityType: cluster.entity_type,
                  })
                }
                className="p-1 rounded text-muted-foreground/50 hover:text-primary hover:bg-accent transition-colors"
                title="Set as primary"
              >
                <Star className="h-2.5 w-2.5" />
              </button>
            )}
            {siblingClusters.length > 1 && (
              <button
                onClick={onStartMerge}
                className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                title="Merge into another"
              >
                <Merge className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {isMergeSource && (
          <button
            onClick={onCancelMerge}
            className="text-[9px] font-medium text-destructive hover:text-destructive/80"
          >
            Cancel merge
          </button>
        )}
      </div>

      {/* Expanded members */}
      {isExpanded && members.length > 0 && (
        <div className="pl-8 pr-3 pb-2 space-y-1.5">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onSplit={() => splitMember.mutate({ memberId: member.id, member })}
              canSplit={members.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Member Row ────────────────────────────────────────

function MemberRow({
  member,
  onSplit,
  canSplit,
}: {
  member: ClusterMemberRow;
  onSplit: () => void;
  canSplit: boolean;
}) {
  const [showSnippet, setShowSnippet] = useState(false);

  return (
    <div className="group">
      <div className="flex items-center gap-2 py-1">
        <span className="text-[10px] text-muted-foreground font-mono flex-1 truncate">
          {member.raw_value}
        </span>

        {member.match_score != null && (
          <ConfidenceBadge confidence={member.match_score} />
        )}

        {member.document_id && (
          <Link
            to={`/documents/${member.document_id}`}
            className="p-0.5 rounded text-muted-foreground/40 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
            title="View document"
          >
            <FileText className="h-2.5 w-2.5" />
          </Link>
        )}

        {member.source_snippet && (
          <button
            onClick={() => setShowSnippet(!showSnippet)}
            className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="View source"
          >
            <Quote className="h-2.5 w-2.5" />
          </button>
        )}

        {canSplit && (
          <button
            onClick={onSplit}
            className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            title="Split into separate entity"
          >
            <Split className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {showSnippet && member.source_snippet && (
        <div className="ml-2 px-2 py-1.5 rounded bg-accent/50 border-l-2 border-primary/30 mb-1">
          <p className="text-[9px] text-muted-foreground font-mono leading-relaxed">
            "{member.source_snippet}"
          </p>
          {member.source_page && (
            <span className="text-[8px] text-muted-foreground/60">Page {member.source_page}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default DetectedEntitiesPanel;
