import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, CitationBlock, type CitationSource } from "./EvidenceCitation";
import { useSourceDrawer, MOCK_SOURCE_PAGES, type SourcePage } from "./SourceDrawer";
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Loader2,
  FileText,
  ChevronRight,
  RotateCcw,
  X,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────
interface EvidenceCard {
  docName: string;
  page: string;
  excerpt: string;
  relevance: "direct" | "corroborating" | "contradicting" | "contextual";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidenceCards?: EvidenceCard[];
  timestamp: Date;
}

// ─── Evidence search against mock source pages ───────
function searchEvidence(query: string): EvidenceCard[] {
  const q = query.toLowerCase();
  const results: EvidenceCard[] = [];

  for (const sp of MOCK_SOURCE_PAGES) {
    for (const h of sp.highlights) {
      if (h.text.toLowerCase().includes(q) || sp.extractedText.toLowerCase().includes(q)) {
        results.push({
          docName: sp.docName,
          page: sp.pageLabel,
          excerpt: h.text,
          relevance: h.relevance as any,
        });
      }
    }
    // Also match full text if query is about a topic
    const keywords = q.split(/\s+/).filter((w) => w.length > 3);
    if (keywords.length > 0) {
      const matchCount = keywords.filter((k) => sp.extractedText.toLowerCase().includes(k)).length;
      if (matchCount >= Math.ceil(keywords.length * 0.5) && !results.some((r) => r.docName === sp.docName && r.page === sp.pageLabel)) {
        const bestHighlight = sp.highlights[0];
        if (bestHighlight) {
          results.push({
            docName: sp.docName,
            page: sp.pageLabel,
            excerpt: bestHighlight.text,
            relevance: bestHighlight.relevance as any,
          });
        }
      }
    }
  }

  return results.slice(0, 5);
}

// ─── Mock AI responses ───────────────────────────────
function generateResponse(userMessage: string, _history: ChatMessage[]): { content: string; evidence: EvidenceCard[] } {
  const q = userMessage.toLowerCase();
  const evidence = searchEvidence(userMessage);

  if (q.includes("causation") || q.includes("cause")) {
    return {
      content: `## Causation Analysis\n\nBased on the available records, causation for the **cervical spine injury (C5-C6)** appears well-supported:\n\n1. **Mechanism consistent** — Rear-end collision at ~35 mph with hyperextension-hyperflexion mechanism documented in police report\n2. **Temporal correlation** — Symptoms presented immediately at ER on date of loss\n3. **Clinical progression** — ER findings → orthopedic consult → MRI confirmation follows expected pattern\n\n**Causation challenges:**\n- L4-L5 degenerative changes noted by Dr. Chen — no prior imaging for comparison\n- Right knee meniscus tear — mechanism less clearly linked to rear-end impact\n\n*See attached evidence cards for supporting citations.*`,
      evidence,
    };
  }
  if (q.includes("treatment gap") || q.includes("gap")) {
    return {
      content: `## Treatment Gap Analysis\n\nOne notable gap identified:\n\n- **PT Compliance Gap** — Only 24 of 36 prescribed sessions completed (67% compliance rate). This occurred between sessions in the March–April 2025 timeframe.\n- **Possible explanation** — Records do not document a reason for discontinuation. Defense may argue claimant was not following medical advice.\n\n**No significant gaps** between initial ER visit and orthopedic follow-up (3 days). MRI was obtained within 17 days of consult. Pain management referral timing was appropriate.\n\n*Recommendation: Obtain claimant statement regarding PT non-completion before finalizing demand.*`,
      evidence: evidence.length > 0 ? evidence : searchEvidence("physical therapy"),
    };
  }
  if (q.includes("evidence") || q.includes("support") || q.includes("find")) {
    return {
      content: `## Evidence Search Results\n\nI found **${evidence.length}** relevant source citations matching your query. Each citation links to the original source page — click any card below to view the full extracted text with highlighted excerpts.\n\n${evidence.length === 0 ? "No direct matches found. Try rephrasing your query or searching for specific medical terms, dates, or provider names." : "The evidence cards below show the most relevant excerpts with their relevance classification."}`,
      evidence,
    };
  }
  if (q.includes("summary") || q.includes("summarize") || q.includes("overview")) {
    return {
      content: `## Case Summary\n\n**Martinez v. Pacific Freight Lines** — Motor vehicle accident on 11/15/2024.\n\n### Key Facts\n- **Mechanism:** Rear-end collision at intersection, ~35 mph impact\n- **Primary injuries:** C5-C6 disc herniation, right shoulder contusion, right knee meniscus tear\n- **Treatment:** ER → Orthopedic (Dr. Chen) → PT → Pain Management (Dr. Patel, ESI x2)\n- **Total billed:** ~$87,450 across 7 providers\n- **IME:** Dr. Roberts disputes surgical necessity, acknowledges cervical pathology\n\n### Strengths\n- Clear liability (police report, witness corroboration)\n- MRI-confirmed disc herniation at C5-C6\n- Consistent treatment timeline\n\n### Weaknesses\n- Pre-existing L4-L5 degenerative changes\n- PT non-completion (24/36 sessions)\n- Right knee causation may be challenged`,
      evidence: searchEvidence("cervical disc herniation"),
    };
  }

  // Default response
  return {
    content: `I can help you analyze this case. Here are some things I can assist with:\n\n- **\"Summarize the case\"** — Get a structured overview\n- **\"Find evidence for [statement]\"** — Search source documents for supporting citations\n- **\"Analyze causation\"** — Review causation support and challenges\n- **\"Show treatment gaps\"** — Identify gaps in treatment timeline\n- **\"What are the key strengths?\"** — Demand strengths analysis\n- **\"Show supporting pages for [topic]\"** — Find relevant source pages\n\nI'll include evidence cards with direct links to source documents whenever relevant citations exist.`,
    evidence: [],
  };
}

// ─── Quick prompts ───────────────────────────────────
const QUICK_PROMPTS = [
  "Summarize the case",
  "Analyze causation",
  "Show treatment gaps",
  "Find evidence for cervical disc herniation",
];

// ─── Main Component ─────────────────────────────────
const CaseChatView = () => {
  const { pkg } = useCasePackage();
  const { openSource } = useSourceDrawer();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourcePage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const { content, evidence } = generateResponse(text, [...messages, userMsg]);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-resp`,
        role: "assistant",
        content,
        evidenceCards: evidence,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCitationClick = (card: EvidenceCard) => {
    // Find source page and show in right panel
    const sp = MOCK_SOURCE_PAGES.find(
      (s) => s.docName.toLowerCase().includes(card.docName.toLowerCase().substring(0, 15)) && s.pageLabel === card.page
    );
    if (sp) setSelectedSource(sp);
    else openSource({ docName: card.docName, page: card.page, excerpt: card.excerpt, relevance: card.relevance });
  };

  return (
    <div className="flex h-[calc(100vh-180px)] -m-5 border-t border-border">
      {/* LEFT: Chat thread */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-foreground">Evidence Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Ask about the case · Citations link to source pages</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Evidence-Grounded Analysis</h3>
              <p className="text-[11px] text-muted-foreground max-w-xs mb-5 leading-relaxed">
                Ask questions about the case. I'll search source documents and provide evidence-linked answers.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-[11px] font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/15 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent"
              }`}>
                {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-foreground" />}
              </div>

              <div className={`flex flex-col gap-2 max-w-[85%] min-w-0 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Message bubble */}
                <div className={`rounded-xl px-3.5 py-2.5 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border rounded-bl-sm"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none text-[12px] leading-relaxed text-foreground [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:mt-0 [&_h2]:mb-2 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:mb-2 [&_li]:mb-0.5 [&_strong]:text-foreground [&_em]:text-muted-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[12px] leading-relaxed">{msg.content}</p>
                  )}
                </div>

                {/* Evidence cards */}
                {msg.evidenceCards && msg.evidenceCards.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
                      {msg.evidenceCards.length} Source Citations
                    </span>
                    {msg.evidenceCards.map((card, i) => (
                      <EvidenceCardCompact key={i} card={card} onClick={() => handleCitationClick(card)} />
                    ))}
                  </div>
                )}

                <span className="text-[9px] text-muted-foreground/60 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-foreground" />
              </div>
              <div className="bg-card border border-border rounded-xl rounded-bl-sm px-3.5 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-[11px] text-muted-foreground">Searching case records…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-card shrink-0">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the case… (Enter to send)"
              rows={1}
              className="w-full pr-10 pl-3 py-2.5 text-[12px] bg-accent/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/10 disabled:text-muted-foreground/30 disabled:hover:bg-transparent transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Source document viewer */}
      <div className="w-[400px] shrink-0 flex flex-col bg-background hidden lg:flex">
        {selectedSource ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0 bg-card">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{selectedSource.docName}</p>
                <p className="text-[10px] text-muted-foreground">Page {selectedSource.pageNumber}</p>
              </div>
              <button onClick={() => setSelectedSource(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {/* Highlights */}
              {selectedSource.highlights.length > 0 && (
                <div className="mb-4 space-y-2">
                  {selectedSource.highlights.map((h, i) => {
                    const relStyle: Record<string, string> = {
                      direct: "border-primary/20 bg-primary/5",
                      corroborating: "border-[hsl(var(--status-approved)/0.2)] bg-[hsl(var(--status-approved-bg))]",
                      contradicting: "border-destructive/20 bg-destructive/5",
                      contextual: "border-border bg-accent",
                    };
                    return (
                      <div key={i} className={`rounded-lg border p-2.5 ${relStyle[h.relevance] ?? relStyle.contextual}`}>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{h.relevance}</span>
                        <p className="text-[11px] text-foreground leading-relaxed mt-1 font-mono">"{h.text}"</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full text */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Extracted Text</p>
                <pre className="text-[11px] text-foreground leading-relaxed font-mono whitespace-pre-wrap">
                  {selectedSource.extractedText}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[12px] font-medium text-foreground mb-1">Source Document Viewer</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Click any evidence citation in the chat to view the original source page here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Evidence Card (compact for chat) ────────────────
function EvidenceCardCompact({ card, onClick }: { card: EvidenceCard; onClick: () => void }) {
  const relStyle: Record<string, string> = {
    direct: "border-l-primary bg-primary/3",
    corroborating: "border-l-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved-bg))]",
    contradicting: "border-l-destructive bg-destructive/3",
    contextual: "border-l-muted-foreground bg-accent",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-border ${relStyle[card.relevance] ?? ""} border-l-[3px] p-2.5 hover:border-primary/30 transition-colors group`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen className="h-2.5 w-2.5 text-primary" />
        <span className="text-[10px] font-semibold text-foreground truncate flex-1">{card.docName}</span>
        <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">{card.page}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 font-mono">"{card.excerpt}"</p>
    </button>
  );
}

export default CaseChatView;
