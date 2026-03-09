"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavColumn from "@/components/shared/NavColumn";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════════════════════════════════
   GeoVera AI Chat — DS v7.0
   ─────────────────────────────────────────────────────────────────────
   • Liquid glass surfaces + depth system
   • Mode-specific accent colors (SEO blue / GEO purple / Social pink / General teal)
   • Daily suggested prompts from gv_keywords (5 basic / 10 premium / 20 partner)
   • Daily cost cap enforcement ($0.30 / $0.80 / $1.20 by tier)
   • Per-message token + cost metadata with animated reveal
   • Spring-eased micro-animations throughout
   • Session history in right panel with live stats
══════════════════════════════════════════════════════════════════════ */

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMode = "general" | "seo" | "geo" | "social";

interface Message {
  id:           string;
  role:         "user" | "assistant";
  message:      string;
  created_at:   string;
  tokens_used?: number;
  cost_usd?:    number;
  model_used?:  string;
  isThinking?:  boolean;
  isError?:     boolean;
}

interface ChatSession {
  id:             string;
  title:          string;
  message_count:  number;
  total_tokens:   number;
  total_cost_usd: number;
  updated_at:     string;
}

interface BrandInfo {
  id:                 string;
  brand_name:         string;
  brand_category:     string | null;
  brand_country:      string | null;
  subscription_tier:  string | null;
}

interface SuggestedPrompt {
  keyword:      string;
  keyword_type: "seo" | "geo" | "social";
}

// ─── DS v7.0 Config ───────────────────────────────────────────────────────────

const MODES: Record<ChatMode, {
  label:       string;
  accent:      string;
  light:       string;
  border:      string;
  text:        string;
  description: string;
  icon:        string;
}> = {
  general: {
    label:       "General",
    accent:      "#5F8F8B",
    light:       "#EDF5F4",
    border:      "#A8D5CF",
    text:        "#3D6562",
    description: "Brand strategy & general insights",
    icon:        "✦",
  },
  seo: {
    label:       "SEO",
    accent:      "#3B82F6",
    light:       "#EFF6FF",
    border:      "#BFDBFE",
    text:        "#1D4ED8",
    description: "Google rankings, keywords & backlinks",
    icon:        "◎",
  },
  geo: {
    label:       "GEO",
    accent:      "#8B5CF6",
    light:       "#F5F3FF",
    border:      "#DDD6FE",
    text:        "#6D28D9",
    description: "AI citation & answer engine optimization",
    icon:        "◈",
  },
  social: {
    label:       "Social",
    accent:      "#EC4899",
    light:       "#FDF2F8",
    border:      "#FBCFE8",
    text:        "#BE185D",
    description: "TikTok, Instagram, YouTube & more",
    icon:        "◉",
  },
};

const TIER_CONFIG: Record<string, { dailyCap: number; suggestedCount: number; label: string }> = {
  partner:   { dailyCap: 1.20, suggestedCount: 20, label: "Partner"   },
  premium:   { dailyCap: 0.80, suggestedCount: 10, label: "Premium"   },
  basic:     { dailyCap: 0.30, suggestedCount: 5,  label: "Basic"     },
  essential: { dailyCap: 0.30, suggestedCount: 5,  label: "Essential" },
  starter:   { dailyCap: 0.15, suggestedCount: 3,  label: "Starter"   },
  free:      { dailyCap: 0.10, suggestedCount: 3,  label: "Free"      },
};

function getTierConfig(tier: string | null) {
  return TIER_CONFIG[tier ?? "basic"] ?? TIER_CONFIG.basic;
}

function fmtCost(usd: number) {
  return usd < 0.01 ? `$${(usd * 100).toFixed(3)}¢` : `$${usd.toFixed(4)}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Micro-components ────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="gv7-thinking-dot inline-block w-1.5 h-1.5 rounded-full"
          style={{ background: "var(--gv-color-primary-400)" }}
        />
      ))}
    </div>
  );
}

function ModeTab({
  mode,
  active,
  onClick,
}: {
  mode:    ChatMode;
  active:  boolean;
  onClick: () => void;
}) {
  const m = MODES[mode];
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0"
      style={{
        background:  active ? m.light : "transparent",
        border:      `1.5px solid ${active ? m.border : "var(--gv-color-neutral-200)"}`,
        color:       active ? m.text  : "var(--gv-color-neutral-500)",
        boxShadow:   active ? `0 2px 8px ${m.accent}22` : "none",
        transform:   active ? "scale(1.02)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 10 }}>{m.icon}</span>
      {m.label}
    </button>
  );
}

function SuggestedChip({
  prompt,
  mode,
  onClick,
}: {
  prompt:  SuggestedPrompt;
  mode:    ChatMode;
  onClick: (text: string) => void;
}) {
  const m = MODES[mode];
  const typeMode = (prompt.keyword_type as ChatMode) in MODES
    ? (prompt.keyword_type as ChatMode)
    : mode;
  const tm = MODES[typeMode];

  return (
    <button
      onClick={() => onClick(prompt.keyword)}
      className="flex-shrink-0 text-left px-3 py-2 rounded-[12px] text-[12px] leading-snug transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background:  tm.light,
        border:      `1.5px solid ${tm.border}`,
        color:       tm.text,
        maxWidth:    240,
      }}
    >
      <span className="line-clamp-2">{prompt.keyword}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [brand,           setBrand]           = useState<BrandInfo | null>(null);
  const [userId,          setUserId]          = useState<string>("");
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [sessions,        setSessions]        = useState<ChatSession[]>([]);
  const [currentSession,  setCurrentSession]  = useState<string | null>(null);
  const [suggested,       setSuggested]       = useState<SuggestedPrompt[]>([]);
  const [chatMode,        setChatMode]        = useState<ChatMode>("general");
  const [input,           setInput]           = useState("");
  const [sending,         setSending]         = useState(false);
  const [loading,         setLoading]         = useState(true);
  const [dailySpend,      setDailySpend]      = useState(0);
  const [showHistory,     setShowHistory]     = useState(false);
  const [mobileRight,     setMobileRight]     = useState(false);
  const [copiedId,        setCopiedId]        = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const tierConfig = getTierConfig(brand?.subscription_tier ?? null);
  const capRemain  = Math.max(0, tierConfig.dailyCap - dailySpend);
  const capPct     = Math.min(100, (dailySpend / tierConfig.dailyCap) * 100);
  const capColor   = capPct >= 90 ? "#EF4444" : capPct >= 70 ? "#F59E0B" : "#5F8F8B";

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/signin"); return; }
      setUserId(user.id);

      const { data: ub } = await supabase
        .from("user_brands")
        .select("brand_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!ub?.brand_id) { setLoading(false); return; }

      const { data: b } = await supabase
        .from("gv_brands")
        .select("id, brand_name, brand_category, brand_country, subscription_tier")
        .eq("id", ub.brand_id)
        .single();

      if (b) setBrand(b as BrandInfo);
      setLoading(false);
    }
    init();
  }, [router]);

  // ── Load sessions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!brand || !userId) return;
    const { data } = await supabase
      .from("gv_ai_chat_sessions")
      .select("id, title, message_count, total_tokens, total_cost_usd, updated_at")
      .eq("brand_id", brand.id)
      .eq("user_id",  userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (data) setSessions(data as ChatSession[]);
  }, [brand, userId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Load suggested prompts (tier-based) ────────────────────────────────────
  useEffect(() => {
    async function loadSuggested() {
      if (!brand) return;
      const { data } = await supabase
        .from("gv_keywords")
        .select("keyword, keyword_type")
        .eq("brand_id", brand.id)
        .eq("source",   "research_suggested")
        .in("keyword_type", ["seo", "geo", "social"])
        .eq("active", true)
        .limit(100);

      if (data && data.length > 0) {
        const shuffled = shuffle(data as SuggestedPrompt[]);
        setSuggested(shuffled.slice(0, tierConfig.suggestedCount));
      }
    }
    loadSuggested();
  }, [brand, tierConfig.suggestedCount]);

  // ── Daily spend check ──────────────────────────────────────────────────────
  useEffect(() => {
    async function checkDailySpend() {
      if (!brand || !userId) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("gv_ai_conversations")
        .select("cost_usd")
        .eq("brand_id", brand.id)
        .eq("user_id",  userId)
        .eq("role",     "assistant")
        .gte("created_at", today.toISOString());
      if (data) {
        const total = data.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
        setDailySpend(total);
      }
    }
    checkDailySpend();
  }, [brand, userId, messages]);

  // ── Load session messages ──────────────────────────────────────────────────
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("gv_ai_conversations")
      .select("id, role, message, created_at, tokens_used, cost_usd, model_used")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || !brand) return;
    if (capRemain <= 0) return; // cap reached

    setInput("");
    setSending(true);

    // Optimistic user message
    const tempUserId = `temp-u-${Date.now()}`;
    setMessages(prev => [...prev, {
      id:         tempUserId,
      role:       "user",
      message:    msg,
      created_at: new Date().toISOString(),
    }]);

    // Thinking indicator
    const tempAiId = `temp-ai-${Date.now()}`;
    setMessages(prev => [...prev, {
      id:          tempAiId,
      role:        "assistant",
      message:     "",
      created_at:  new Date().toISOString(),
      isThinking:  true,
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-chat", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          brand_id:   brand.id,
          session_id: currentSession,
          message:    msg,
          chat_mode:  chatMode,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setMessages(prev => prev.map(m =>
          m.id === tempAiId
            ? { ...m, isThinking: false, isError: true, message: json.error ?? "Something went wrong." }
            : m
        ));
        return;
      }

      // Update temp AI message with real response
      setMessages(prev => prev.map(m =>
        m.id === tempAiId
          ? {
              ...m,
              id:         json.message_id ?? tempAiId,
              message:    json.response,
              isThinking: false,
              tokens_used: json.metadata?.tokens_used,
              cost_usd:    json.metadata?.cost_usd,
              model_used:  json.metadata?.model_used,
            }
          : m.id === tempUserId
            ? { ...m, id: `real-u-${Date.now()}` }
            : m
      ));

      // Set session
      if (!currentSession && json.session_id) {
        setCurrentSession(json.session_id);
      }

      await loadSessions();
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === tempAiId
          ? { ...m, isThinking: false, isError: true, message: "Network error — please try again." }
          : m
      ));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, brand, currentSession, chatMode, capRemain, loadSessions]);

  // ── New session ────────────────────────────────────────────────────────────
  function handleNewSession() {
    setCurrentSession(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  // ── Select session ─────────────────────────────────────────────────────────
  async function handleSelectSession(sessionId: string) {
    setCurrentSession(sessionId);
    await loadSessionMessages(sessionId);
    setMobileRight(false);
  }

  // ── Copy message ───────────────────────────────────────────────────────────
  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  // ── Textarea auto-height ───────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CENTER PANEL — Chat thread + input
  // ─────────────────────────────────────────────────────────────────────────
  const activeMode = MODES[chatMode];

  const centerPanel = (
    <div className="flex flex-col h-full" style={{ background: "var(--gv-color-bg-surface)" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${activeMode.accent} 0%, ${activeMode.accent}cc 100%)` }}
            >
              {activeMode.icon}
            </div>
            <div>
              <h1
                className="text-[22px] font-bold leading-tight"
                style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}
              >
                AI Chat
              </h1>
              <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                {brand?.brand_name ?? "Loading…"}
              </p>
            </div>
          </div>

          {/* Daily cost cap badge */}
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1.5 rounded-[10px] flex items-center gap-2"
              style={{
                background: "var(--gv-color-neutral-50)",
                border:     "1px solid var(--gv-color-neutral-200)",
              }}
            >
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] font-semibold" style={{ color: capColor }}>
                  {fmtCost(capRemain)} left
                </span>
                <div className="w-20 h-1 rounded-full overflow-hidden" style={{ background: "var(--gv-color-neutral-200)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${capPct}%`, background: capColor }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile: open history */}
            <button
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-[10px] transition-colors"
              style={{ background: "var(--gv-color-neutral-100)" }}
              onClick={() => setMobileRight(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(Object.keys(MODES) as ChatMode[]).map(m => (
            <ModeTab
              key={m}
              mode={m}
              active={chatMode === m}
              onClick={() => setChatMode(m)}
            />
          ))}
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar" style={{ minHeight: 0 }}>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="gv-animate-spin w-6 h-6 rounded-full border-2 border-transparent"
              style={{ borderTopColor: activeMode.accent, borderRightColor: `${activeMode.accent}44` }} />
          </div>
        ) : messages.length === 0 ? (
          /* ── Empty state ─────────────────────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Hero */}
            <div
              className="rounded-[20px] p-6 mb-5 text-center"
              style={{
                background: `linear-gradient(135deg, ${activeMode.light} 0%, white 100%)`,
                border:     `1.5px solid ${activeMode.border}`,
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl font-bold"
                style={{ background: `linear-gradient(135deg, ${activeMode.accent}, ${activeMode.accent}cc)`, color: "white" }}
              >
                {activeMode.icon}
              </div>
              <h2 className="text-[16px] font-bold mb-1" style={{ color: activeMode.text, fontFamily: "var(--gv-font-heading)" }}>
                {activeMode.label} Mode
              </h2>
              <p className="text-[12px]" style={{ color: "var(--gv-color-neutral-500)" }}>
                {activeMode.description}
              </p>
            </div>

            {/* Suggested prompts */}
            {suggested.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-3"
                  style={{ color: "var(--gv-color-neutral-400)" }}>
                  Suggested for you · {tierConfig.label}
                </p>
                <div className="flex flex-col gap-2">
                  {suggested.map((p, i) => (
                    <SuggestedChip
                      key={i}
                      prompt={p}
                      mode={chatMode}
                      onClick={text => handleSend(text)}
                    />
                  ))}
                </div>
              </div>
            )}

            {suggested.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[13px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                  Run a deep research first to get personalized suggestions
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Message thread ──────────────────────────────────────────── */
          <div className="flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id + idx}
                msg={msg}
                mode={chatMode}
                copiedId={copiedId}
                onCopy={handleCopy}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-3"
        style={{
          borderTop:  "1px solid var(--gv-color-neutral-200)",
          background: "var(--gv-color-bg-surface)",
        }}
      >
        {/* Cap reached warning */}
        {capRemain <= 0 && (
          <div
            className="mb-3 px-4 py-2.5 rounded-[12px] text-[12px] font-medium text-center"
            style={{ background: "var(--gv-color-danger-50)", color: "var(--gv-color-danger-700)", border: "1px solid #FECACA" }}
          >
            Daily limit reached ({tierConfig.label}: {fmtCost(tierConfig.dailyCap)}/day). Resets at midnight.
          </div>
        )}

        <div
          className="flex items-end gap-2 rounded-[16px] p-2"
          style={{
            background: "var(--gv-color-neutral-50)",
            border:     `1.5px solid ${sending ? activeMode.accent : "var(--gv-color-neutral-200)"}`,
            transition: "border-color 200ms ease",
            boxShadow:  sending ? `0 0 0 3px ${activeMode.accent}18` : "none",
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={sending || capRemain <= 0}
            placeholder={capRemain <= 0 ? "Daily limit reached" : `Ask about ${activeMode.description.toLowerCase()}…`}
            className="flex-1 resize-none outline-none text-[14px] leading-relaxed bg-transparent px-2 py-1.5"
            style={{
              color:       "var(--gv-color-neutral-900)",
              fontFamily:  "var(--gv-font-body)",
              minHeight:   36,
              maxHeight:   160,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || capRemain <= 0}
            className="flex-shrink-0 w-9 h-9 rounded-[12px] flex items-center justify-center transition-all duration-200"
            style={{
              background: !input.trim() || capRemain <= 0
                ? "var(--gv-color-neutral-200)"
                : `linear-gradient(135deg, ${activeMode.accent}, ${activeMode.accent}cc)`,
              color:     !input.trim() || capRemain <= 0 ? "var(--gv-color-neutral-400)" : "white",
              transform: sending ? "scale(0.92)" : "scale(1)",
              boxShadow: input.trim() && capRemain > 0 ? `0 4px 12px ${activeMode.accent}44` : "none",
            }}
          >
            {sending ? (
              <div className="gv-animate-spin w-4 h-4 rounded-full border-2 border-transparent border-t-white" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-[10px] mt-2" style={{ color: "var(--gv-color-neutral-300)" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RIGHT PANEL — Sessions + brand context
  // ─────────────────────────────────────────────────────────────────────────
  const rightPanel = (
    <div className="flex flex-col h-full" style={{ background: "var(--gv-color-bg-surface)" }}>

      {/* Header */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold" style={{ color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)" }}>
            History
          </h2>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all hover:opacity-85"
            style={{ background: `${activeMode.accent}12`, color: activeMode.accent, border: `1px solid ${activeMode.accent}30` }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>
        </div>
      </div>

      {/* Brand context card */}
      {brand && (
        <div className="flex-shrink-0 px-4 pt-4">
          <div
            className="rounded-[14px] p-3 mb-1"
            style={{
              background: "var(--gv7-bubble-ai-bg)",
              border:     "1.5px solid var(--gv7-bubble-ai-border)",
            }}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div
                className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: "var(--gv-gradient-primary)" }}
              >
                {brand.brand_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>
                  {brand.brand_name}
                </p>
                <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                  {brand.brand_category ?? "Brand"} · {brand.brand_country ?? "Global"}
                </p>
              </div>
            </div>
            {/* Daily cap progress */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-medium" style={{ color: "var(--gv-color-neutral-500)" }}>
                  Daily budget
                </span>
                <span className="text-[10px] font-semibold" style={{ color: capColor }}>
                  {fmtCost(dailySpend)} / {fmtCost(tierConfig.dailyCap)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gv-color-neutral-200)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${capPct}%`, background: capColor }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar" style={{ minHeight: 0 }}>
        {sessions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[12px]" style={{ color: "var(--gv-color-neutral-400)" }}>
              No conversations yet
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--gv-color-neutral-300)" }}>
              Start a new chat above
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className="w-full text-left rounded-[12px] p-3 transition-all duration-150 hover:scale-[1.005]"
                style={{
                  background: s.id === currentSession ? activeMode.light : "transparent",
                  border:     `1.5px solid ${s.id === currentSession ? activeMode.border : "var(--gv-color-neutral-100)"}`,
                }}
              >
                <p
                  className="text-[12px] font-semibold line-clamp-1 mb-1"
                  style={{ color: s.id === currentSession ? activeMode.text : "var(--gv-color-neutral-700)" }}
                >
                  {s.title || "Untitled session"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                    {s.message_count} msgs
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-300)" }}>·</span>
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                    {fmtCost(s.total_cost_usd ?? 0)}
                  </span>
                  <span className="ml-auto text-[10px]" style={{ color: "var(--gv-color-neutral-300)" }}>
                    {fmtTime(s.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested prompts footer */}
      {suggested.length > 0 && messages.length === 0 && (
        <div
          className="flex-shrink-0 px-4 pb-4 pt-3"
          style={{ borderTop: "1px solid var(--gv-color-neutral-100)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--gv-color-neutral-400)" }}>
            Quick prompts
          </p>
          <div className="flex flex-col gap-1.5">
            {suggested.slice(0, 3).map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p.keyword)}
                className="text-left text-[11px] px-2.5 py-2 rounded-[10px] line-clamp-1 transition-all duration-150 hover:opacity-80"
                style={{
                  background: MODES[(p.keyword_type as ChatMode) in MODES ? (p.keyword_type as ChatMode) : "general"].light,
                  color:      MODES[(p.keyword_type as ChatMode) in MODES ? (p.keyword_type as ChatMode) : "general"].text,
                  border:     `1px solid ${MODES[(p.keyword_type as ChatMode) in MODES ? (p.keyword_type as ChatMode) : "general"].border}`,
                }}
              >
                {p.keyword}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ThreeColumnLayout
      left={<NavColumn />}
      center={centerPanel}
      right={rightPanel}
      mobileRightOpen={mobileRight}
      onMobileBack={() => setMobileRight(false)}
      mobileBackLabel="Chat"
    />
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  mode,
  copiedId,
  onCopy,
}: {
  msg:      Message;
  mode:     ChatMode;
  copiedId: string | null;
  onCopy:   (text: string, id: string) => void;
}) {
  const m = MODES[mode];
  const isUser = msg.role === "user";
  const [showMeta, setShowMeta] = useState(false);

  return (
    <div
      className={`flex gv7-message-in ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div style={{ maxWidth: "82%" }}>

        {/* Role label */}
        <p
          className={`text-[10px] font-semibold mb-1 ${isUser ? "text-right" : "text-left"}`}
          style={{ color: isUser ? m.accent : "var(--gv-color-neutral-400)" }}
        >
          {isUser ? "You" : "GeoVera AI"}
        </p>

        {/* Bubble */}
        <div
          className="rounded-[18px] px-4 py-3"
          style={isUser ? {
            background: `linear-gradient(135deg, ${m.accent} 0%, ${m.accent}dd 100%)`,
            color:      "white",
            borderBottomRightRadius: 6,
            boxShadow:  `0 4px 16px ${m.accent}44`,
          } : msg.isError ? {
            background: "var(--gv7-bubble-error-bg)",
            border:     "1.5px solid var(--gv7-bubble-error-border)",
            color:      "var(--gv-color-danger-700)",
            borderBottomLeftRadius: 6,
          } : {
            background: "var(--gv7-bubble-ai-bg)",
            border:     "1.5px solid var(--gv7-bubble-ai-border)",
            color:      "var(--gv-color-neutral-900)",
            borderBottomLeftRadius: 6,
          }}
        >
          {msg.isThinking ? (
            <ThinkingDots />
          ) : (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
              {msg.message}
              {/* Streaming cursor placeholder */}
            </p>
          )}
        </div>

        {/* Metadata footer */}
        {!isUser && !msg.isThinking && (
          <div className={`flex items-center gap-3 mt-1.5 ${isUser ? "justify-end" : "justify-start"}`}>

            {/* Copy button */}
            <button
              onClick={() => onCopy(msg.message, msg.id)}
              className="text-[10px] flex items-center gap-1 transition-colors"
              style={{ color: copiedId === msg.id ? m.accent : "var(--gv-color-neutral-300)" }}
            >
              {copiedId === msg.id ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>

            {/* Token/cost toggle */}
            {(msg.tokens_used || msg.cost_usd) && (
              <button
                onClick={() => setShowMeta(v => !v)}
                className="text-[10px] transition-colors"
                style={{ color: showMeta ? m.accent : "var(--gv-color-neutral-300)" }}
              >
                {showMeta ? "hide stats" : "view stats"}
              </button>
            )}
          </div>
        )}

        {/* Expanded token/cost metadata */}
        {!isUser && showMeta && (msg.tokens_used || msg.cost_usd) && (
          <div
            className="mt-1.5 px-3 py-2 rounded-[10px] gv-animate-fade-in"
            style={{
              background: "var(--gv-color-neutral-50)",
              border:     "1px solid var(--gv-color-neutral-200)",
            }}
          >
            <div className="flex items-center gap-4">
              {msg.tokens_used && (
                <div>
                  <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--gv-color-neutral-400)" }}>Tokens</p>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{msg.tokens_used.toLocaleString()}</p>
                </div>
              )}
              {msg.cost_usd && (
                <div>
                  <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--gv-color-neutral-400)" }}>Cost</p>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{fmtCost(msg.cost_usd)}</p>
                </div>
              )}
              {msg.model_used && (
                <div>
                  <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--gv-color-neutral-400)" }}>Model</p>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{msg.model_used}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
