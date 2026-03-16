import { useState } from "react";
import {
  User, Briefcase, Building2, Shield, Users, CheckCircle2,
  Edit3, Save, X, AlertTriangle, GitMerge, Scissors, Star,
} from "lucide-react";
import {
  useCaseEntityClusters,
  useClusterMembers,
  useRenameCluster,
  useSetPrimaryCluster,
  useMergeClusters,
  useSplitMember,
  useNormalizeEntities,
  ENTITY_TYPE_SINGULAR,
  type EntityClusterRow,
  type ClusterMemberRow,
} from "@/hooks/useEntityClusters";

interface Props {
  caseId: string;
}

const IDENTITY_TYPES = ["claimant", "attorney", "law_firm", "insurer"];
const ROLE_ICON: Record<string, React.ElementType> = {
  claimant: User,
  attorney: Briefcase,
  law_firm: Building2,
  insurer: Shield,
  provider: Users,
  facility: Building2,
};

const PartyNormalizationPanel = ({ caseId }: Props) => {
  const { data: allClusters = [], isLoading } = useCaseEntityClusters(caseId);
  const normalizeEntities = useNormalizeEntities();
  const [expandedType, setExpandedType] = useState<string | null>(null);

  // Filter to identity-relevant types
  const identityClusters = allClusters.filter((c) => IDENTITY_TYPES.includes(c.entity_type));
  const grouped = IDENTITY_TYPES.reduce<Record<string, EntityClusterRow[]>>((acc, type) => {
    acc[type] = identityClusters.filter((c) => c.entity_type === type);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="card-elevated p-6 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (identityClusters.length === 0) {
    return (
      <div className="card-elevated p-5 text-center space-y-3">
        <Users className="h-7 w-7 text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">No normalized parties found.</p>
        <button
          onClick={() => normalizeEntities.mutate(caseId)}
          disabled={normalizeEntities.isPending}
          className="inline-flex items-center gap-1.5 text-[10px] font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {normalizeEntities.isPending ? "Normalizing…" : "Run Entity Normalization"}
        </button>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Party Normalization</h3>
        </div>
        <button
          onClick={() => normalizeEntities.mutate(caseId)}
          disabled={normalizeEntities.isPending}
          className="text-[9px] font-medium px-3 py-1.5 rounded-md bg-accent text-foreground hover:bg-accent/80 disabled:opacity-50 transition-colors"
        >
          {normalizeEntities.isPending ? "Running…" : "Re-normalize"}
        </button>
      </div>

      <div className="divide-y divide-border">
        {IDENTITY_TYPES.map((type) => {
          const clusters = grouped[type];
          if (clusters.length === 0) return null;
          const Icon = ROLE_ICON[type] ?? User;
          const isExpanded = expandedType === type;
          const hasDuplicates = clusters.length > 1;

          return (
            <div key={type}>
              <button
                onClick={() => setExpandedType(isExpanded ? null : type)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-foreground">
                    {ENTITY_TYPE_SINGULAR[type] ?? type}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {clusters.length} record{clusters.length !== 1 ? "s" : ""}
                  </span>
                  {hasDuplicates && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]">
                      <AlertTriangle className="h-2.5 w-2.5" /> Possible duplicates
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-2">
                  {clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      caseId={caseId}
                      otherClusters={clusters.filter((c) => c.id !== cluster.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Cluster Card with members ─────────────────────────

function ClusterCard({
  cluster,
  caseId,
  otherClusters,
}: {
  cluster: EntityClusterRow;
  caseId: string;
  otherClusters: EntityClusterRow[];
}) {
  const { data: members = [] } = useClusterMembers(cluster.id);
  const renameCluster = useRenameCluster();
  const setPrimary = useSetPrimaryCluster();
  const mergeClusters = useMergeClusters();
  const splitMember = useSplitMember();

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cluster.canonical_value ?? cluster.display_value);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);

  const displayName = cluster.canonical_value ?? cluster.display_value;

  const handleSave = () => {
    renameCluster.mutate({ clusterId: cluster.id, newValue: editValue }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Cluster header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-accent/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {cluster.is_primary && (
            <Star className="h-3 w-3 text-primary shrink-0" fill="currentColor" />
          )}
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <button onClick={handleSave} disabled={renameCluster.isPending} className="p-1 rounded hover:bg-accent text-primary">
                <Save className="h-3 w-3" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-foreground truncate">{displayName}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <button onClick={() => { setEditValue(displayName); setEditing(true); }} className="p-1 rounded hover:bg-accent text-muted-foreground" title="Edit name">
              <Edit3 className="h-3 w-3" />
            </button>
          )}
          {!cluster.is_primary && (
            <button
              onClick={() => setPrimary.mutate({ clusterId: cluster.id, caseId, entityType: cluster.entity_type })}
              className="p-1 rounded hover:bg-accent text-muted-foreground" title="Set as primary"
            >
              <Star className="h-3 w-3" />
            </button>
          )}
          {otherClusters.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMergeTarget(mergeTarget ? null : otherClusters[0].id)}
                className="p-1 rounded hover:bg-accent text-muted-foreground" title="Merge into another"
              >
                <GitMerge className="h-3 w-3" />
              </button>
              {mergeTarget && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px]">
                  <p className="text-[9px] text-muted-foreground font-semibold mb-1.5 uppercase">Merge into:</p>
                  {otherClusters.map((other) => (
                    <button
                      key={other.id}
                      onClick={() => {
                        mergeClusters.mutate({ sourceClusterId: cluster.id, targetClusterId: other.id });
                        setMergeTarget(null);
                      }}
                      className="w-full text-left text-[10px] px-2 py-1.5 rounded hover:bg-accent text-foreground truncate"
                    >
                      {other.canonical_value ?? other.display_value}
                    </button>
                  ))}
                  <button onClick={() => setMergeTarget(null)} className="w-full text-left text-[10px] px-2 py-1 text-muted-foreground">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Members — raw extracted values */}
      {members.length > 0 && (
        <div className="px-4 py-2 space-y-1">
          <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-semibold">Raw extracted values</p>
          {members.map((m) => (
            <MemberRow key={m.id} member={m} canSplit={members.length > 1} onSplit={() => splitMember.mutate({ memberId: m.id, member: m })} />
          ))}
        </div>
      )}

      {/* Confidence */}
      {cluster.confidence != null && (
        <div className="px-4 py-1.5 border-t border-border">
          <span className="text-[8px] text-muted-foreground">
            Match confidence: {Math.round(cluster.confidence * 100)}% · {cluster.source_count} source{cluster.source_count !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Member Row ────────────────────────────────────────

function MemberRow({ member, canSplit, onSplit }: {
  member: ClusterMemberRow;
  canSplit: boolean;
  onSplit: () => void;
}) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-foreground truncate">"{member.raw_value}"</p>
        {member.source_snippet && (
          <p className="text-[8px] text-muted-foreground/60 italic truncate" title={member.source_snippet}>
            p.{member.source_page ?? "?"}: {member.source_snippet.slice(0, 60)}…
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {member.match_score != null && (
          <span className="text-[8px] text-muted-foreground">{Math.round(member.match_score * 100)}%</span>
        )}
        {canSplit && (
          <button onClick={onSplit} className="p-0.5 rounded hover:bg-accent text-muted-foreground" title="Split out">
            <Scissors className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default PartyNormalizationPanel;
