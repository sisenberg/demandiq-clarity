/**
 * Attorney Intelligence Card — NegotiateIQ
 *
 * Shows attorney profile, historical tendencies, observations.
 * Transparent and explainable — clearly labeled as decision support.
 */

import { useState } from "react";
import { useAttorneyProfile, useAddAttorneyObservation } from "@/hooks/useAttorneyIntelligence";
import { OBSERVATION_TAGS } from "@/lib/attorneyPatternEngine";
import {
  UserSearch,
  Building2,
  TrendingUp,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Stethoscope,
  Syringe,
  Hash,
  Clock,
  MessageSquare,
} from "lucide-react";

interface AttorneyIntelligenceCardProps {
  attorneyName: string | undefined;
  firmName: string | undefined;
  caseId: string;
  sessionId?: string;
}

const AttorneyIntelligenceCard = ({
  attorneyName,
  firmName,
  caseId,
  sessionId,
}: AttorneyIntelligenceCardProps) => {
  const { data: profile, isLoading } = useAttorneyProfile(attorneyName, firmName);
  const addObs = useAddAttorneyObservation();
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [freeText, setFreeText] = useState("");

  if (!attorneyName) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <UserSearch className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attorney Intelligence
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          No opposing counsel identified for this case. Add party data to enable attorney intelligence.
        </p>
      </div>
    );
  }

  const handleAddObservation = () => {
    if (!selectedTag && !freeText.trim()) return;
    addObs.mutate({
      caseId,
      sessionId,
      attorneyName: attorneyName!,
      firmName: firmName ?? "",
      observationType: selectedTag || "free_text",
      observationText: selectedTag
        ? OBSERVATION_TAGS.find((t) => t.key === selectedTag)?.label ?? selectedTag
        : freeText.trim(),
    });
    setSelectedTag("");
    setFreeText("");
    setShowAddForm(false);
  };

  const stats = profile?.historicalStats;
  const tagSummary = profile?.tagSummary ?? {};

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
            <UserSearch className="h-3 w-3 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-[11px] font-semibold text-foreground">Attorney Intelligence</h3>
            <p className="text-[9px] text-muted-foreground">{attorneyName}{firmName ? ` · ${firmName}` : ""}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Decision-support disclaimer */}
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-[hsl(var(--status-attention))]/5 border border-[hsl(var(--status-attention))]/20">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Decision support only. Historical patterns are heuristic summaries from closed matters and adjuster observations — not rules or predictions.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Identity */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-foreground">{firmName || "No firm on record"}</span>
                </div>
                {stats && stats.priorCaseCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {stats.priorCaseCount} prior case{stats.priorCaseCount !== 1 ? "s" : ""} in corpus
                    </span>
                  </div>
                )}
              </div>

              {/* Historical Tendencies */}
              {stats && stats.priorCaseCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Historical Tendencies
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {stats.avgDemandToSettlementRatio != null && (
                      <StatChip icon={FileText} label="Demand→Settlement" value={`${stats.avgDemandToSettlementRatio}×`} />
                    )}
                    {stats.avgNegotiationDays != null && (
                      <StatChip icon={Clock} label="Avg Duration" value={`${stats.avgNegotiationDays}d`} />
                    )}
                    {stats.hasSurgeryRate != null && (
                      <StatChip icon={Stethoscope} label="Surgery Cases" value={`${stats.hasSurgeryRate}%`} />
                    )}
                    {stats.hasInjectionRate != null && (
                      <StatChip icon={Syringe} label="Injection Cases" value={`${stats.hasInjectionRate}%`} />
                    )}
                  </div>
                  {stats.commonProviders.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[9px] text-muted-foreground font-medium mb-0.5">Common Providers</p>
                      <div className="flex flex-wrap gap-1">
                        {stats.commonProviders.map((p) => (
                          <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {stats.commonInjuryCategories.length > 0 && (
                    <div>
                      <p className="text-[9px] text-muted-foreground font-medium mb-0.5">Common Injuries</p>
                      <div className="flex flex-wrap gap-1">
                        {stats.commonInjuryCategories.map((c) => (
                          <span key={c} className="text-[8px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stats && stats.priorCaseCount === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No historical claims found for this attorney in the calibration corpus.</p>
              )}

              {/* Tag summary across all observations */}
              {Object.keys(tagSummary).length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Observed Patterns
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(tagSummary).map(([tag, count]) => {
                      const label = OBSERVATION_TAGS.find((t) => t.key === tag)?.label ?? tag;
                      return (
                        <div key={tag} className="flex items-center justify-between px-2 py-1 rounded bg-accent/50">
                          <span className="text-[10px] text-foreground">{label}</span>
                          <span className="text-[8px] font-bold text-muted-foreground">{count}×</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Case-level observations */}
              {(profile?.observations ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent Observations
                    </h4>
                  </div>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {profile!.observations.slice(0, 8).map((obs) => (
                      <div key={obs.id} className="px-2 py-1.5 rounded border border-border bg-card/50">
                        <p className="text-[10px] text-foreground leading-relaxed">{obs.observationText}</p>
                        <p className="text-[8px] text-muted-foreground mt-0.5">
                          {new Date(obs.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {obs.observationType !== "free_text" && (
                            <span className="ml-1 px-1 py-0.5 rounded bg-accent text-[7px] font-bold uppercase">{obs.observationType.replace(/_/g, " ")}</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add observation form */}
              {showAddForm ? (
                <div className="space-y-2 p-2.5 rounded-lg border border-border bg-accent/20">
                  <p className="text-[10px] font-semibold text-foreground">Add Observation</p>
                  <div className="flex flex-wrap gap-1">
                    {OBSERVATION_TAGS.map((tag) => (
                      <button
                        key={tag.key}
                        onClick={() => setSelectedTag(selectedTag === tag.key ? "" : tag.key)}
                        className={`text-[9px] px-2 py-1 rounded-md border transition-colors ${
                          selectedTag === tag.key
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  {!selectedTag && (
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="Or enter a free-text observation…"
                      rows={2}
                      className="w-full text-[10px] rounded-md border border-border bg-background px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddObservation}
                      disabled={!selectedTag && !freeText.trim()}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setSelectedTag(""); setFreeText(""); }}
                      className="text-[10px] px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add Observation
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

function StatChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-accent/50 border border-border">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[8px] text-muted-foreground leading-none">{label}</p>
        <p className="text-[11px] font-semibold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default AttorneyIntelligenceCard;
