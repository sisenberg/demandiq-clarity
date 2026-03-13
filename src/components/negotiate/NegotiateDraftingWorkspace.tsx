/**
 * NegotiateIQ — Drafting Workspace
 *
 * 3-column split layout:
 *   Left: structured inputs (draft type, tone, custom instructions)
 *   Center: generated + editable draft content
 *   Right: context snippets from evaluation/strategy
 *
 * Drafting-only — no outbound send capability.
 */

import { useState, useMemo, useCallback } from "react";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";
import type { NegotiationRoundRow } from "@/types/negotiate-persistence";
import {
  generateDraft,
  DRAFT_TYPE_META,
  type DraftType,
  type DraftTone,
  type GeneratedDraft,
  type DraftContextSnippet,
} from "@/lib/negotiateDraftEngine";
import { useNegotiateDrafts, useSaveNegotiateDraft, type DraftVersionRow } from "@/hooks/useNegotiateDrafts";
import {
  FileEdit,
  Sparkles,
  Save,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  ShieldAlert,
  Info,
  Clipboard,
  CheckCircle2,
  ArrowDownUp,
  Target,
  AlertTriangle,
  ExternalLink,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

const DRAFT_TYPES = Object.entries(DRAFT_TYPE_META) as [DraftType, typeof DRAFT_TYPE_META[DraftType]][];

const TONE_OPTIONS: { value: DraftTone; label: string; description: string }[] = [
  { value: "neutral", label: "Neutral", description: "Professional, balanced language" },
  { value: "firm", label: "Firm", description: "Direct, assertive positioning" },
  { value: "collaborative", label: "Collaborative", description: "Cooperative, solution-oriented" },
];

const SNIPPET_ICONS: Record<DraftContextSnippet["source"], React.ElementType> = {
  evaluation: Target,
  strategy: ShieldAlert,
  round_history: ArrowDownUp,
  risk: AlertTriangle,
};

interface NegotiateDraftingWorkspaceProps {
  vm: NegotiationViewModel;
  strategy: GeneratedStrategy | null;
  rounds: NegotiationRoundRow[];
  sessionId: string;
  caseId: string;
}

const NegotiateDraftingWorkspace = ({
  vm,
  strategy,
  rounds,
  sessionId,
  caseId,
}: NegotiateDraftingWorkspaceProps) => {
  // ─── Input State ────────────────────────────────
  const [draftType, setDraftType] = useState<DraftType>("offer_letter");
  const [tone, setTone] = useState<DraftTone>("neutral");
  const [customInstructions, setCustomInstructions] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientFirm, setRecipientFirm] = useState("");

  // ─── Draft State ────────────────────────────────
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [editedExternal, setEditedExternal] = useState("");
  const [editedInternal, setEditedInternal] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // ─── Persistence ────────────────────────────────
  const { data: savedDrafts = [] } = useNegotiateDrafts(sessionId);
  const saveDraft = useSaveNegotiateDraft();

  const meta = DRAFT_TYPE_META[draftType];

  const handleGenerate = useCallback(() => {
    const result = generateDraft({
      draftType,
      tone,
      vm,
      strategy,
      rounds,
      customInstructions: customInstructions || undefined,
      recipientName: recipientName || undefined,
      recipientFirm: recipientFirm || undefined,
    });
    setDraft(result);
    setEditedExternal(result.externalContent);
    setEditedInternal(result.internalNotes);
  }, [draftType, tone, vm, strategy, rounds, customInstructions, recipientName, recipientFirm]);

  const handleSave = useCallback((isFinal: boolean) => {
    if (!draft) return;
    saveDraft.mutate({
      sessionId,
      caseId,
      draftType: draft.draftType,
      title: draft.title,
      externalContent: editedExternal,
      internalNotes: editedInternal,
      tone: draft.tone,
      contextSnippets: draft.contextSnippets,
      engineVersion: draft.engineVersion,
      isFinal,
    });
  }, [draft, editedExternal, editedInternal, sessionId, caseId, saveDraft]);

  const handleLoadVersion = useCallback((v: DraftVersionRow) => {
    setDraftType(v.draft_type as DraftType);
    setTone(v.tone as DraftTone);
    setEditedExternal(v.external_content);
    setEditedInternal(v.internal_notes);
    setDraft({
      draftType: v.draft_type as DraftType,
      tone: v.tone as DraftTone,
      audience: "attorney",
      title: v.title,
      externalContent: v.external_content,
      internalNotes: v.internal_notes,
      contextSnippets: (v.context_snippets ?? []) as DraftContextSnippet[],
      generatedAt: v.created_at,
      engineVersion: v.engine_version,
    });
    setShowVersionHistory(false);
    toast.info(`Loaded ${v.title} v${v.version}`);
  }, []);

  const typeDrafts = useMemo(() => savedDrafts.filter(d => d.draft_type === draftType), [savedDrafts, draftType]);

  return (
    <div className="flex h-full gap-0">
      {/* ── LEFT: Inputs ──────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-border bg-card/50 p-4 overflow-y-auto space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileEdit className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-semibold text-foreground">Draft Settings</h2>
        </div>

        {/* Draft Type */}
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Draft Type</label>
          <div className="space-y-1">
            {DRAFT_TYPES.map(([key, m]) => (
              <button
                key={key}
                onClick={() => setDraftType(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] transition-colors border ${
                  draftType === key
                    ? "border-primary bg-primary/5 text-foreground font-semibold"
                    : "border-transparent hover:bg-accent/50 text-muted-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {m.isInternal ? <Lock className="h-2.5 w-2.5" /> : <ExternalLink className="h-2.5 w-2.5" />}
                  {m.label}
                </span>
                <span className="text-[8px] text-muted-foreground block mt-0.5">{m.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Tone</label>
          <div className="flex gap-1">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value)}
                className={`flex-1 text-center px-2 py-1.5 rounded-md text-[9px] font-semibold transition-colors border ${
                  tone === t.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                }`}
                title={t.description}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient (for external drafts) */}
        {!meta.isInternal && (
          <div className="space-y-2">
            <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block">Recipient</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full text-[10px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
              placeholder="Counsel name"
            />
            <input
              type="text"
              value={recipientFirm}
              onChange={(e) => setRecipientFirm(e.target.value)}
              className="w-full text-[10px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
              placeholder="Firm name"
            />
          </div>
        )}

        {/* Custom Instructions */}
        <div>
          <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Custom Instructions</label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            className="w-full text-[10px] px-2.5 py-2 rounded-md border border-border bg-background text-foreground resize-none"
            rows={3}
            placeholder="Any specific points to include or exclude…"
            maxLength={2000}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate Draft
        </button>

        {/* Version History */}
        {typeDrafts.length > 0 && (
          <div>
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showVersionHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Clock className="h-2.5 w-2.5" />
              {typeDrafts.length} saved version{typeDrafts.length !== 1 ? "s" : ""}
            </button>
            {showVersionHistory && (
              <div className="mt-2 space-y-1">
                {typeDrafts.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleLoadVersion(v)}
                    className="w-full text-left px-2.5 py-1.5 rounded-md border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[9px] font-medium text-foreground">v{v.version}</span>
                      {v.is_final && (
                        <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
                          Final
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-muted-foreground mt-0.5">
                      {new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CENTER: Draft Editor ──────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {draft ? (
          <>
            {/* Draft Header */}
            <div className="shrink-0 px-5 py-3 border-b border-border bg-card/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-primary" />
                <h3 className="text-[12px] font-semibold text-foreground">{draft.title}</h3>
                <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  meta.isInternal
                    ? "bg-accent text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}>
                  {meta.isInternal ? "Internal" : "External"}
                </span>
                <span className="text-[8px] text-muted-foreground">
                  {TONE_OPTIONS.find(t => t.value === draft.tone)?.label} tone
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saveDraft.isPending}
                  className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-accent/50 transition-colors text-foreground disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  Save Draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saveDraft.isPending}
                  className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[hsl(var(--status-approved))] text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  <BookmarkCheck className="h-3 w-3" />
                  Save as Final
                </button>
              </div>
            </div>

            {/* Draft Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* External content (if applicable) */}
              {!meta.isInternal && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ExternalLink className="h-3 w-3 text-primary" />
                    <label className="text-[9px] font-semibold uppercase tracking-wider text-primary">External Communication</label>
                  </div>
                  <textarea
                    value={editedExternal}
                    onChange={(e) => setEditedExternal(e.target.value)}
                    className="w-full text-[11px] leading-relaxed px-4 py-3 rounded-xl border border-border bg-background text-foreground resize-none font-mono"
                    rows={Math.max(15, editedExternal.split("\n").length + 2)}
                  />
                </div>
              )}

              {/* Internal notes (always shown) */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {meta.isInternal ? "Internal Document" : "Internal Notes — DO NOT SEND"}
                  </label>
                </div>
                <textarea
                  value={editedInternal}
                  onChange={(e) => setEditedInternal(e.target.value)}
                  className="w-full text-[11px] leading-relaxed px-4 py-3 rounded-xl border border-dashed border-border bg-accent/20 text-foreground resize-none font-mono"
                  rows={Math.max(10, editedInternal.split("\n").length + 2)}
                />
              </div>

              {/* No-send disclaimer */}
              <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--status-attention))]/20 bg-[hsl(var(--status-attention))]/5 px-3 py-2">
                <Info className="h-3 w-3 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
                <p className="text-[9px] text-[hsl(var(--status-attention))] leading-relaxed">
                  This is a drafting tool only. No communications are sent from this workspace. Copy and review all content before sending through your approved communication channels.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
                <FileEdit className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-[13px] font-semibold text-foreground mb-1">Generate a Draft</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Select a draft type and tone on the left, then click "Generate Draft" to create an editable document grounded in the case evaluation and negotiation context.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Context Snippets ───────────────── */}
      <div className="w-[240px] shrink-0 border-l border-border bg-card/50 p-4 overflow-y-auto">
        <div className="flex items-center gap-1.5 mb-3">
          <Clipboard className="h-3 w-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Context</h3>
        </div>

        {draft ? (
          <div className="space-y-2">
            {draft.contextSnippets.map((s, i) => {
              const Icon = SNIPPET_ICONS[s.source] ?? Info;
              return (
                <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-[10px] text-foreground leading-relaxed">{s.value}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(s.value);
                      toast.success("Copied to clipboard");
                    }}
                    className="flex items-center gap-0.5 text-[8px] text-primary hover:underline mt-1"
                  >
                    <Clipboard className="h-2 w-2" />
                    Copy
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Show basic context even before generation */}
            <ContextPreview label="Eval Range" value={`${fmtC(vm.valuationRange.floor ?? 0)}–${fmtC(vm.valuationRange.stretch ?? 0)}`} />
            {strategy && <ContextPreview label="Target Zone" value={`${fmtC(strategy.targetSettlementZone.generated.low)}–${fmtC(strategy.targetSettlementZone.generated.high)}`} />}
            {vm.specials.totalBilled > 0 && <ContextPreview label="Specials" value={`Billed: ${fmtC(vm.specials.totalBilled)}${vm.specials.reductionPercent != null ? ` (${vm.specials.reductionPercent}% reduced)` : ""}`} />}
            {vm.expanders.slice(0, 2).map((d, i) => <ContextPreview key={`e${i}`} label={`Expander`} value={d.label} />)}
            {vm.reducers.slice(0, 2).map((d, i) => <ContextPreview key={`r${i}`} label={`Reducer`} value={d.label} />)}
            {rounds.length > 0 && (
              <ContextPreview
                label="Latest Round"
                value={`Rd ${rounds[rounds.length - 1].round_number}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function ContextPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[10px] text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function fmtC(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export default NegotiateDraftingWorkspace;
