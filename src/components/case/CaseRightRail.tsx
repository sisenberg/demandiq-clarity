import { useState, useRef, useEffect } from "react";
import type { CaseRow } from "@/hooks/useCases";
import type { DocumentRow } from "@/hooks/useDocuments";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import {
  MessageSquare,
  Bot,
  Send,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  User,
  BookOpen,
  Stethoscope,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from "lucide-react";

// ─── Mock AI Chat ───────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: CitationSource[];
  feedback?: "up" | "down" | null;
  timestamp: string;
}

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: "m-0",
    role: "assistant",
    text: "I'm your case analyst assistant for **Martinez v. Pacific Freight Lines**. I have access to all uploaded documents and extracted data. Ask me anything about the injuries, treatment, liability, or gaps in this case.",
    timestamp: "Just now",
  },
];

/** Mock responses keyed by partial query match */
const MOCK_RESPONSES: { match: RegExp; response: ChatMessage }[] = [
  {
    match: /first.*(treat|report|visit)/i,
    response: {
      id: "",
      role: "assistant",
      text: "The **first treatment** was an emergency room visit at **Mercy General Hospital** on **November 15, 2024** — the same day as the accident. The claimant presented with acute cervical strain, right shoulder contusion, and radiating pain to the right upper extremity. CT of the head was negative for intracranial abnormality.",
      citations: [
        { docName: "ER Records — Mercy General", page: "pg. 1", excerpt: "Patient presents with acute cervical strain, right shoulder contusion.", relevance: "direct" },
        { docName: "ER Records — Mercy General", page: "pg. 4", excerpt: "CT head without contrast: no acute intracranial abnormality.", relevance: "corroborating" },
      ],
      timestamp: "",
    },
  },
  {
    match: /prior.*(complaint|condition|history|pre.?exist)/i,
    response: {
      id: "",
      role: "assistant",
      text: "There is one **potential pre-existing condition** flagged in the records. Dr. Chen notes *'possible pre-existing degenerative changes at L4-L5'* in the lumbar region. However, **no prior treatment records** for lumbar symptoms have been identified. The defense IME by Dr. Roberts does not directly address pre-existing lumbar issues but questions the necessity of surgical intervention for the cervical herniation.\n\nRecommendation: Request prior PCP records to confirm or rule out pre-existing lumbar complaints.",
      citations: [
        { docName: "Dr. Chen Ortho Eval", page: "pg. 3", relevance: "contradicting" },
        { docName: "IME Report — Dr. Roberts", page: "pg. 5", relevance: "corroborating" },
      ],
      timestamp: "",
    },
  },
  {
    match: /imaging.*(neck|cervic|spine|herniat)/i,
    response: {
      id: "",
      role: "assistant",
      text: "The primary imaging supporting the **neck injury** is the cervical MRI performed on **December 2, 2024** at Regional Radiology. It confirmed a **central disc herniation at C5-C6 with moderate foraminal narrowing**. Neurosurgical consultation was recommended based on these findings.\n\nThe initial ER visit included a CT of the head which was negative — this rules out acute intracranial injury but does not address the cervical disc pathology that was later confirmed by MRI.",
      citations: [
        { docName: "MRI Report — Regional Radiology", page: "pg. 7", excerpt: "Central disc herniation at C5-C6 with moderate foraminal narrowing.", relevance: "direct" },
        { docName: "ER Records — Mercy General", page: "pg. 4", relevance: "contextual" },
      ],
      timestamp: "",
    },
  },
  {
    match: /gap|break.*(treat|care|therap)/i,
    response: {
      id: "",
      role: "assistant",
      text: "Two treatment gaps have been identified:\n\n1. **14-day gap** between ER visit (11/15) and first orthopedic follow-up (11/18 or 11/28 depending on which record is consulted — dates need reconciliation).\n\n2. **~8-week gap** between the first ESI on 01/15/2025 and the second ESI on 03/10/2025 during which no treatment visits are documented.\n\nAdditionally, the patient completed only **24 of 36 prescribed PT sessions** (67% compliance), which the defense may characterize as a treatment gap or non-compliance.",
      citations: [
        { docName: "PT Records — Advanced Rehab", page: "pg. 22", relevance: "contradicting" },
      ],
      timestamp: "",
    },
  },
  {
    match: /demand|settlement|value/i,
    response: {
      id: "",
      role: "assistant",
      text: "The **initial demand** was transmitted on **March 1, 2025** for **$285,000**.\n\n**Breakdown:**\n- Medical specials (billed): $87,450\n- Medical specials (adjusted): ~$62,200\n- General damages (pain & suffering, loss of enjoyment): $197,550\n\nThe demand package included medical chronology, billing summary, liability memo, and supporting exhibits. No counter-offer has been received as of current records.",
      citations: [
        { docName: "Demand Letter v1", page: "pg. 1", relevance: "direct" },
      ],
      timestamp: "",
    },
  },
];

const DEFAULT_RESPONSE: Omit<ChatMessage, "id" | "timestamp"> = {
  role: "assistant",
  text: "Based on the case file for **Martinez v. Pacific Freight Lines**, I can see this involves a rear-end collision on I-95 with cervical disc herniation (C5-C6) as the primary injury. The case has 5 documented injuries, 42 treatment visits across 5 providers, and a demand of $285,000.\n\nCould you be more specific about what aspect you'd like me to analyze? I can help with:\n- Injury causation and documentation\n- Treatment timeline and gaps\n- Liability and defense arguments\n- Billing and damages analysis",
  citations: [],
};

// ─── Patient Summary Data ───────────────────────────────
interface SummaryFact {
  label: string;
  value: string;
  citation?: CitationSource;
}

const PATIENT_FACTS: SummaryFact[] = [
  { label: "Claimant", value: "Elena Martinez, age 34" },
  { label: "Date of Loss", value: "November 15, 2024" },
  { label: "Mechanism", value: "Rear-end MVA at ~35 mph, defendant ran red light", citation: { docName: "Police Report #PR-2024-8812", page: "pg. 3", relevance: "direct" } },
  { label: "Primary Injury", value: "C5-C6 disc herniation with foraminal narrowing", citation: { docName: "MRI Report — Regional Radiology", page: "pg. 7", relevance: "direct" } },
  { label: "Secondary", value: "R. shoulder contusion, L4-L5 strain, R. knee meniscus tear" },
  { label: "Treating MDs", value: "Dr. Chen (Ortho), Dr. Patel (Pain Mgmt)" },
  { label: "Treatments", value: "24 PT sessions, 2 epidural injections, ER visit" },
  { label: "Total Billed", value: "$87,450 (adjusted ~$62,200)" },
  { label: "Demand", value: "$285,000 — transmitted 03/01/2025" },
  { label: "Liability", value: "Strong — defendant ran red light, witness corroboration", citation: { docName: "Witness Statement — K. Donovan", page: "pg. 1", relevance: "corroborating" } },
];

const KEY_FLAGS = [
  { type: "warning" as const, text: "Pre-existing degenerative changes at L4-L5 noted" },
  { type: "alert" as const, text: "Only 24/36 PT sessions completed (67%)" },
  { type: "warning" as const, text: "Defense IME disputes surgical necessity" },
  { type: "info" as const, text: "No counter-offer received yet" },
];

// ─── Component ──────────────────────────────────────────
interface CaseRightRailProps {
  caseData: CaseRow;
  documents: DocumentRow[];
}

const CaseRightRail = ({ caseData, documents }: CaseRightRailProps) => {
  return (
    <aside className="w-full lg:w-[var(--evidence-width)] shrink-0 border-l border-border flex flex-col h-full overflow-y-auto bg-muted/20">
      <div className="flex flex-col gap-4 p-4">
        <AIChatCard caseData={caseData} />
        <PatientSummaryCard caseData={caseData} documents={documents} />
      </div>
    </aside>
  );
};

// ─── AI Chat Card ───────────────────────────────────────
const AIChatCard = ({ caseData }: { caseData: CaseRow }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [inDepth, setInDepth] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      text,
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Find matching mock response
    setTimeout(() => {
      const match = MOCK_RESPONSES.find((r) => r.match.test(text));
      const resp = match?.response ?? DEFAULT_RESPONSE;
      const assistantMsg: ChatMessage = {
        ...resp,
        id: `m-${Date.now()}-r`,
        timestamp: "Just now",
        feedback: null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  };

  const handleFeedback = (msgId: string, fb: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, feedback: m.feedback === fb ? null : fb } : m
      )
    );
  };

  return (
    <div className="card-elevated overflow-hidden flex flex-col" style={{ maxHeight: "60vh" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-card shrink-0">
        <Bot className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Case Analyst</h3>
        <span className="text-[9px] font-medium bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] px-1.5 py-0.5 rounded-full border border-[hsl(var(--status-approved)/0.2)]">
          Online
        </span>
        <div className="flex-1" />
        {/* In-depth toggle */}
        <button
          onClick={() => setInDepth(!inDepth)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Toggle in-depth analysis mode"
        >
          {inDepth ? (
            <ToggleRight className="h-4 w-4 text-primary" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">In-depth</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}
            >
              <div className={`text-xs leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "" : "text-foreground"}`}>
                <SimpleMarkdown text={msg.text} />
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1">
                  {msg.citations.map((c, i) => (
                    <CitationBadge key={i} source={c} />
                  ))}
                </div>
              )}

              {/* Feedback */}
              {msg.role === "assistant" && msg.id !== "m-0" && (
                <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center gap-1">
                  <button
                    onClick={() => handleFeedback(msg.id, "up")}
                    className={`p-1 rounded transition-colors ${
                      msg.feedback === "up"
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleFeedback(msg.id, "down")}
                    className={`p-1 rounded transition-colors ${
                      msg.feedback === "down"
                        ? "text-destructive bg-destructive/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                  <span className="text-[9px] text-muted-foreground ml-auto">{msg.timestamp}</span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-6 w-6 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-xl px-3 py-2.5">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {[
            "What treatment was first reported?",
            "Were there prior complaints?",
            "Summarize gaps in treatment",
            "What imaging supports the neck injury?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="text-[10px] font-medium px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about this case…"
            className="flex-1 px-3 py-2 text-xs border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {inDepth && (
          <p className="text-[9px] text-primary mt-1.5 flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            In-depth mode: responses will include deeper analysis and more citations
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Patient / Claim Summary Card ───────────────────────
const PatientSummaryCard = ({ caseData, documents }: { caseData: CaseRow; documents: DocumentRow[] }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 border-b border-border flex items-center gap-2 bg-card text-left hover:bg-accent/30 transition-colors"
      >
        <Stethoscope className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-xs font-semibold text-foreground flex-1">Patient & Claim Summary</h3>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} />
      </button>

      {expanded && (
        <div className="p-4">
          {/* Structured facts */}
          <div className="flex flex-col gap-2">
            {PATIENT_FACTS.map((fact, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-20 shrink-0 pt-0.5 text-right">
                  {fact.label}
                </span>
                <span className="text-xs text-foreground leading-relaxed flex-1">
                  {fact.value}
                  {fact.citation && <CitationBadge source={fact.citation} />}
                </span>
              </div>
            ))}
          </div>

          {/* Key flags */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Key Flags</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {KEY_FLAGS.map((flag, i) => (
                <FlagLine key={i} type={flag.type} text={flag.text} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────

function FlagLine({ type, text }: { type: "info" | "warning" | "alert"; text: string }) {
  const dotColor =
    type === "alert"
      ? "bg-destructive"
      : type === "warning"
      ? "bg-[hsl(var(--status-review))]"
      : "bg-primary";

  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
      <span className="text-[11px] text-foreground leading-relaxed">{text}</span>
    </div>
  );
}

/** Very simple bold/italic markdown renderer */
function SimpleMarkdown({ text }: { text: string }) {
  // Split on **bold** and *italic* patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default CaseRightRail;
