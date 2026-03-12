/**
 * NegotiateIQ — Counteroffer Capture Form
 *
 * Manual-first capture of incoming negotiation movement.
 * Includes paste-parsing assistance with human confirmation.
 */

import { useState, useCallback } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logNegotiationEvent } from "@/hooks/useNegotiateSession";
import { parseCounterofferText, type ParsedCounterofferCandidate } from "@/lib/negotiateCounterofferParser";
import {
  DollarSign,
  Calendar,
  User,
  MessageSquare,
  Send,
  Clipboard,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";

const CHANNELS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "demand_letter", label: "Demand Letter" },
  { value: "portal", label: "Portal" },
  { value: "mediation", label: "Mediation" },
  { value: "other", label: "Other" },
] as const;

const counterofferSchema = z.object({
  amount: z.number().positive("Amount must be positive").max(100_000_000, "Amount too large"),
  receivedAt: z.string().min(1, "Date is required"),
  sender: z.string().trim().min(1, "Sender is required").max(200),
  channel: z.string().min(1, "Channel is required"),
  roundNumber: z.number().int().positive(),
  notes: z.string().max(5000).optional(),
  deadline: z.string().optional(),
  attachmentRef: z.string().max(500).optional(),
  statedRationale: z.string().max(5000).optional(),
});

type CounterofferFormData = z.infer<typeof counterofferSchema>;

interface CounterofferCaptureFormProps {
  sessionId: string;
  caseId: string;
  nextRoundNumber: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const T = (name: string) => supabase.from(name as any) as any;

const CounterofferCaptureForm = ({
  sessionId,
  caseId,
  nextRoundNumber,
  onSuccess,
  onCancel,
}: CounterofferCaptureFormProps) => {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 16));
  const [sender, setSender] = useState("");
  const [channel, setChannel] = useState("phone");
  const [roundNumber, setRoundNumber] = useState(nextRoundNumber);
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [attachmentRef, setAttachmentRef] = useState("");
  const [statedRationale, setStatedRationale] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Paste parsing
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedCounterofferCandidate | null>(null);
  const [showPasteHelper, setShowPasteHelper] = useState(false);

  const handleParse = useCallback(() => {
    if (!pasteText.trim()) return;
    const result = parseCounterofferText(pasteText);
    setParsed(result);
  }, [pasteText]);

  const applyParsed = useCallback(() => {
    if (!parsed) return;
    if (parsed.amount != null) setAmount(String(parsed.amount));
    if (parsed.deadline) setDeadline(parsed.deadline);
    setParsed(null);
    setShowPasteHelper(false);
    setPasteText("");
    toast.success("Parsed values applied — please review before saving");
  }, [parsed]);

  const submitMutation = useMutation({
    mutationFn: async (data: CounterofferFormData) => {
      if (!user || !tenantId) throw new Error("Not authenticated");

      // Insert counteroffer
      const { data: coRow, error: coErr } = await T("negotiation_counteroffers")
        .insert({
          session_id: sessionId,
          case_id: caseId,
          tenant_id: tenantId,
          direction: "received",
          amount: data.amount,
          received_at: data.receivedAt,
          source_channel: data.channel,
          notes: data.notes ?? "",
          recorded_by: user.id,
          round_id: null,
        })
        .select("id")
        .single();
      if (coErr) throw coErr;

      // Upsert round
      const { data: existingRounds } = await T("negotiation_rounds")
        .select("id")
        .eq("session_id", sessionId)
        .eq("round_number", data.roundNumber)
        .limit(1);

      if (existingRounds && existingRounds.length > 0) {
        await T("negotiation_rounds")
          .update({
            their_counteroffer: data.amount,
            their_counteroffer_at: data.receivedAt,
            notes: data.notes ?? "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRounds[0].id);
      } else {
        await T("negotiation_rounds")
          .insert({
            session_id: sessionId,
            case_id: caseId,
            tenant_id: tenantId,
            round_number: data.roundNumber,
            their_counteroffer: data.amount,
            their_counteroffer_at: data.receivedAt,
            notes: data.notes ?? "",
          });
      }

      // Update session
      await T("negotiation_sessions")
        .update({
          current_counteroffer: data.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      // Log event
      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "counteroffer_received",
        summary: `Counteroffer of ${fmtCurrency(data.amount)} received via ${data.channel} from ${data.sender}`,
        afterValue: {
          amount: data.amount,
          channel: data.channel,
          sender: data.sender,
          round: data.roundNumber,
          stated_rationale: data.statedRationale || null,
          deadline: data.deadline || null,
        },
      });

      // If stated rationale, also add as note
      if (data.statedRationale?.trim()) {
        await T("negotiation_notes").insert({
          session_id: sessionId,
          case_id: caseId,
          tenant_id: tenantId,
          author_id: user.id,
          content: `Claimant counsel stated rationale: ${data.statedRationale}`,
          note_type: "rationale",
        });
      }

      return coRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negotiate-rounds", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-events", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-session", caseId] });
      qc.invalidateQueries({ queryKey: ["negotiate-counteroffers", sessionId] });
      toast.success("Counteroffer recorded");
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const parsed = counterofferSchema.safeParse({
      amount: parseFloat(amount),
      receivedAt,
      sender,
      channel,
      roundNumber,
      notes: notes || undefined,
      deadline: deadline || undefined,
      attachmentRef: attachmentRef || undefined,
      statedRationale: statedRationale || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    submitMutation.mutate(parsed.data);
  };

  return (
    <div className="space-y-4">
      {/* Paste Helper */}
      <div className="rounded-xl border border-border bg-card p-3">
        <button
          onClick={() => setShowPasteHelper(!showPasteHelper)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:underline"
        >
          <Clipboard className="h-3 w-3" />
          Paste email/note to extract details
        </button>

        {showPasteHelper && (
          <div className="mt-3 space-y-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full text-[11px] px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none"
              rows={4}
              placeholder="Paste email body, voicemail note, or letter text…"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleParse}
                disabled={!pasteText.trim()}
                className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                Extract
              </button>
              <button
                onClick={() => { setShowPasteHelper(false); setPasteText(""); setParsed(null); }}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            {parsed && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Parsed Results
                  <span className={`ml-1 text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                    parsed.confidence === "high"
                      ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
                      : parsed.confidence === "medium"
                        ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                        : "bg-accent text-muted-foreground"
                  }`}>
                    {parsed.confidence} confidence
                  </span>
                </p>
                {parsed.amount != null && (
                  <p className="text-[11px] text-foreground">
                    Amount: <span className="font-bold">{fmtCurrency(parsed.amount)}</span>
                  </p>
                )}
                {parsed.deadline && (
                  <p className="text-[11px] text-foreground">
                    Deadline: <span className="font-bold">{parsed.deadline}</span>
                  </p>
                )}
                {parsed.amount == null && !parsed.deadline && (
                  <p className="text-[11px] text-muted-foreground">No amount or deadline detected.</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={applyParsed}
                    disabled={parsed.amount == null && !parsed.deadline}
                    className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Apply to Form
                  </button>
                  <button
                    onClick={() => setParsed(null)}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount *" error={errors.amount} icon={DollarSign}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
            placeholder="e.g. 75000"
          />
        </FormField>

        <FormField label="Received At *" error={errors.receivedAt} icon={Calendar}>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
          />
        </FormField>

        <FormField label="Sender *" error={errors.sender} icon={User}>
          <input
            type="text"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
            placeholder="Attorney name or firm"
            maxLength={200}
          />
        </FormField>

        <FormField label="Channel *" error={errors.channel} icon={MessageSquare}>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Round #" error={errors.roundNumber}>
          <input
            type="number"
            value={roundNumber}
            onChange={(e) => setRoundNumber(parseInt(e.target.value, 10) || 1)}
            min={1}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
          />
        </FormField>

        <FormField label="Deadline (optional)">
          <input
            type="text"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
            placeholder="e.g. March 20, 2026"
            maxLength={100}
          />
        </FormField>
      </div>

      <FormField label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-[11px] px-2.5 py-2 rounded-md border border-border bg-background text-foreground resize-none"
          rows={2}
          placeholder="Any context about this counteroffer…"
          maxLength={5000}
        />
      </FormField>

      <FormField label="Stated Rationale from Claimant Counsel (optional)">
        <textarea
          value={statedRationale}
          onChange={(e) => setStatedRationale(e.target.value)}
          className="w-full text-[11px] px-2.5 py-2 rounded-md border border-border bg-background text-foreground resize-none"
          rows={2}
          placeholder="What did they say justifies this position?"
          maxLength={5000}
        />
      </FormField>

      <FormField label="Document / Attachment Ref (optional)">
        <input
          type="text"
          value={attachmentRef}
          onChange={(e) => setAttachmentRef(e.target.value)}
          className="w-full text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-background text-foreground"
          placeholder="Reference to uploaded document if applicable"
          maxLength={500}
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {submitMutation.isPending ? "Saving…" : "Record Counteroffer"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

function FormField({
  label,
  error,
  icon: Icon,
  children,
}: {
  label: string;
  error?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-[9px] text-destructive mt-0.5">
          <AlertCircle className="h-2.5 w-2.5" />
          {error}
        </p>
      )}
    </div>
  );
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export default CounterofferCaptureForm;
