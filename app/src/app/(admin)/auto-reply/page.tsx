"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import PlatformIcon from "@/components/shared/PlatformIcon";

/* ══════════════════════════════════════════════════════════════════════════
   /auto-reply — GeoVera Auto-Reply Dashboard
   Layout: Left = NavColumn + Comments | Center = Calendar + Reply Compose | Right = Settings
   DS v5.9 compliant
══════════════════════════════════════════════════════════════════════════ */

const DEMO_BRAND_ID = process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

type ReplyStatus = "queued" | "processing" | "sent" | "failed" | "skipped";
type AttentionClassification = "purchase_intent" | "complaint" | "question" | "influencer" | "vip" | "spam" | "neutral";
type ReplyMode = "manual" | "ai";

interface CommentItem {
  id: string;
  source: "queue" | "attention";
  platform: string;
  commenter_username: string;
  comment_text: string;
  created_at: string;
  // queue fields
  status?: ReplyStatus;
  ai_reply_draft?: string | null;
  profile_tier?: string;
  profile_score?: number;
  weight?: number;
  // attention fields
  classification?: AttentionClassification;
  ai_suggestion?: string | null;
  sentiment?: string | null;
  urgency?: string | null;
  is_read?: boolean;
  is_resolved?: boolean;
}

interface RateLimit {
  platform: string;
  last_reply_at: string | null;
  cooldown_seconds: number;
}

const CLASSIFICATION_CONFIG: Record<AttentionClassification, { label: string; color: string; bg: string; icon: string }> = {
  purchase_intent:  { label: "Purchase Intent",  color: "#16A34A", bg: "#DCFCE7", icon: "💰" },
  complaint:        { label: "Complaint",         color: "#DC2626", bg: "#FEE2E2", icon: "⚠️" },
  question:         { label: "Question",          color: "#2563EB", bg: "#DBEAFE", icon: "❓" },
  influencer:       { label: "Influencer",        color: "#7C3AED", bg: "#EDE9FE", icon: "⭐" },
  vip:              { label: "VIP",               color: "#D97706", bg: "#FEF3C7", icon: "👑" },
  spam:             { label: "Spam",              color: "#6B7280", bg: "#F3F4F6", icon: "🚫" },
  neutral:          { label: "Neutral",           color: "#374151", bg: "#F9FAFB", icon: "💬" },
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  vip:    { label: "VIP",    color: "#D97706", bg: "#FEF3C7" },
  high:   { label: "High",   color: "#16A34A", bg: "#DCFCE7" },
  medium: { label: "Medium", color: "#2563EB", bg: "#DBEAFE" },
  low:    { label: "Low",    color: "#6B7280", bg: "#F3F4F6" },
  bot:    { label: "Bot",    color: "#9CA3AF", bg: "#F9FAFB" },
};

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600, padding: "2px 7px 2px 4px", borderRadius: 6,
      background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)",
    }}>
      <PlatformIcon id={platform.toLowerCase()} size={13} />
      {platform}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.medium;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export default function AutoReplyPage() {
  const [replyMode, setReplyMode]       = useState<ReplyMode>("ai");
  const [selectedDateKey, setSDK]       = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [comments, setComments]         = useState<CommentItem[]>([]);
  const [rateLimits, setRateLimits]     = useState<RateLimit[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mobileRightOpen, setMRO]       = useState(false);
  const [manualReply, setManualReply]   = useState("");
  const [aiEnabled, setAIEnabled]       = useState(true);
  const [aiTone, setAITone]             = useState<"professional" | "friendly" | "casual">("friendly");
  const [filter, setFilter]             = useState<"all" | "queue" | "attention">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [queueRes, attentionRes, rateLimitRes] = await Promise.all([
      supabase.from("gv_reply_queue").select("*").eq("brand_id", DEMO_BRAND_ID)
        .in("status", ["queued", "processing", "failed"]).order("weight", { ascending: false }).limit(100),
      supabase.from("gv_attention_queue").select("*").eq("brand_id", DEMO_BRAND_ID)
        .eq("is_resolved", false).order("created_at", { ascending: false }).limit(100),
      supabase.from("gv_reply_rate_limit").select("platform,last_reply_at,cooldown_seconds").eq("brand_id", DEMO_BRAND_ID),
    ]);

    const qItems: CommentItem[] = (queueRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, source: "queue" as const,
      platform: r.platform as string,
      commenter_username: r.commenter_username as string,
      comment_text: r.comment_text as string,
      created_at: r.created_at as string,
      status: r.status as ReplyStatus,
      ai_reply_draft: r.ai_reply_draft as string | null,
      profile_tier: r.profile_tier as string,
      profile_score: r.profile_score as number,
      weight: r.weight as number,
    }));

    const aItems: CommentItem[] = (attentionRes.data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, source: "attention" as const,
      platform: r.platform as string,
      commenter_username: r.commenter_username as string,
      comment_text: r.comment_text as string,
      created_at: r.created_at as string,
      classification: r.classification as AttentionClassification,
      ai_suggestion: r.ai_suggestion as string | null,
      sentiment: r.sentiment as string | null,
      urgency: r.urgency as string | null,
      is_read: r.is_read as boolean,
      is_resolved: r.is_resolved as boolean,
    }));

    setComments([...qItems, ...aItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setRateLimits((rateLimitRes.data ?? []) as RateLimit[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 7D window: 3 days back + today + 3 ahead ── */
  const sevenDays = useMemo(() => {
    const days: string[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of comments) {
      const key = toDateKey(c.created_at);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [comments]);

  /* ── Filtered comments ── */
  const filteredComments = useMemo(() => {
    let base = comments.filter(c => toDateKey(c.created_at) === selectedDateKey);
    if (filter === "queue")     base = base.filter(c => c.source === "queue");
    if (filter === "attention") base = base.filter(c => c.source === "attention");
    return base;
  }, [comments, selectedDateKey, filter]);

  const selectedComment = comments.find(c => c.id === selectedId) ?? null;

  /* ── Stats ── */
  const pendingCount    = comments.filter(c => c.source === "queue" && c.status === "queued").length;
  const unreadCount     = comments.filter(c => c.source === "attention" && !c.is_read).length;
  const todayDateKey    = new Date().toISOString().slice(0, 10);
  const todayCount      = countByDate[todayDateKey] || 0;

  /* ════════════════════════════════════════════════════════════
     LEFT COLUMN — NavColumn only (88px pill)
  ════════════════════════════════════════════════════════════ */
  const left = <NavColumn />;

  /* ════════════════════════════════════════════════════════════
     CENTER COLUMN — [MiniCalendar + Comment list] | [Header + Reply compose + Submenu]
  ════════════════════════════════════════════════════════════ */
  const center = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ─── Header: title + 7D date strip ─── */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <h1 className="text-[22px] font-bold leading-tight"
              style={{ color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)" }}>
              Reply
            </h1>
            <span className="gv-badge"
              style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)" }}>
              {filteredComments.length}/{comments.length}
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {sevenDays.map((dateStr) => {
              const d          = new Date(dateStr + "T00:00:00");
              const isToday    = dateStr === todayDateKey;
              const isSelected = dateStr === selectedDateKey;
              const dayName    = d.toLocaleDateString("en", { weekday: "short" });
              const dayNum     = d.getDate();
              const monthShort = d.toLocaleDateString("en", { month: "short" }).toUpperCase();
              const hasDot     = (countByDate[dateStr] ?? 0) > 0;
              const headerBg   = isSelected
                ? "linear-gradient(135deg, #3D6562 0%, #5F8F8B 100%)"
                : isToday ? "var(--gv-gradient-primary)"
                : "var(--gv-color-neutral-200)";
              const monthColor = (isSelected || isToday) ? "rgba(255,255,255,0.95)" : "var(--gv-color-neutral-500)";
              const bodyBg     = isSelected ? "var(--gv-color-primary-100)" : isToday ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)";
              const dayColor   = isSelected ? "var(--gv-color-primary-900)" : isToday ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-400)";
              return (
                <button
                  key={dateStr}
                  onClick={() => setSDK(dateStr)}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 transition-all duration-200"
                  style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
                >
                  <div style={{ display: "inline-flex", flexDirection: "column", borderRadius: 12, overflow: "hidden", width: 52, userSelect: "none" }}>
                    <div style={{ background: headerBg, padding: "5px 6px 4px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "var(--gv-font-heading)", fontWeight: 700, fontSize: 8, color: monthColor, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
                        {monthShort}
                      </span>
                    </div>
                    <div style={{ background: bodyBg, padding: "4px 6px 5px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                      <span style={{ fontFamily: "var(--gv-font-heading)", fontWeight: 800, fontSize: 22, lineHeight: 1, color: dayColor, letterSpacing: "-0.03em" }}>
                        {dayNum}
                      </span>
                      <span style={{ fontFamily: "var(--gv-font-body)", fontWeight: 500, fontSize: 8, color: "var(--gv-color-neutral-400)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                        {dayName}
                      </span>
                    </div>
                  </div>
                  {hasDot && (
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "var(--gv-color-primary-600)" : isToday ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-300)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Body: comment list | compose ─── */}
      <div className="flex flex-1 min-h-0">

        {/* LEFT sub-panel: filter tabs + comment list */}
        <div className="flex flex-col flex-shrink-0 border-r overflow-hidden" style={{ width: 272, borderColor: "var(--gv-color-neutral-100)" }}>
          {/* Filter tabs */}
          <div className="px-3 py-2 flex-shrink-0 flex gap-1">
            {([
              { key: "all",       label: "All" },
              { key: "queue",     label: "AI Queue" },
              { key: "attention", label: "Review" },
            ] as { key: typeof filter; label: string }[]).map(f => (
              <button key={f.key}
                onClick={() => setFilter(f.key)}
                className="text-[11px] font-semibold rounded-full px-2.5 py-1 transition-all"
                style={{
                  background: filter === f.key ? "var(--gv-color-primary-100)" : "var(--gv-color-neutral-100)",
                  color: filter === f.key ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-500)",
                }}
              >{f.label}</button>
            ))}
          </div>
          {/* Comment list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-[12px] animate-pulse h-[72px]" style={{ background: "var(--gv-color-neutral-100)" }} />
              ))
            ) : filteredComments.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-[24px] mb-2">💬</span>
                <p className="text-[12px] font-semibold" style={{ color: "var(--gv-color-neutral-600)" }}>No comments</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>
                  {selectedDateKey === todayDateKey ? "No comments today yet" : "No comments on this date"}
                </p>
              </div>
            ) : (
              filteredComments.map(item => {
                const isSelected = selectedId === item.id;
                const cls = item.classification ? CLASSIFICATION_CONFIG[item.classification] : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(isSelected ? null : item.id); setMRO(true); }}
                    className="w-full text-left rounded-[12px] p-3 transition-all"
                    style={{
                      background: isSelected ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                      border: `1.5px solid ${isSelected ? "var(--gv-color-primary-200)" : "var(--gv-color-neutral-100)"}`,
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {item.source === "attention" && !item.is_read && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#DC2626" }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[12px] font-bold truncate" style={{ color: "var(--gv-color-neutral-900)" }}>
                            @{item.commenter_username}
                          </span>
                          <PlatformIcon id={item.platform.toLowerCase()} size={12} />
                          {cls && (
                            <span className="text-[9px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                              style={{ background: cls.bg, color: cls.color }}>{cls.icon}</span>
                          )}
                          {item.urgency === "high" && (
                            <span className="text-[9px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                              style={{ background: "#FEE2E2", color: "#DC2626" }}>!</span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "var(--gv-color-neutral-500)" }}>
                          {item.comment_text}
                        </p>
                        {(item.ai_reply_draft || item.ai_suggestion) && (
                          <p className="text-[10px] mt-1 italic line-clamp-1" style={{ color: "var(--gv-color-primary-500)" }}>
                            AI: {item.ai_reply_draft || item.ai_suggestion}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: "var(--gv-color-neutral-400)" }}>
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ─── RIGHT sub-panel: compose + submenu ─── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Compose body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {!selectedComment ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
              style={{ background: "var(--gv-color-neutral-100)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gv-color-neutral-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <p className="text-[15px] font-bold" style={{ color: "var(--gv-color-neutral-700)" }}>Select a comment</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>
              Click any comment on the left to reply
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Comment bubble */}
            <div className="rounded-[16px] p-4" style={{ background: "var(--gv-color-neutral-50)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[14px] font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>
                  @{selectedComment.commenter_username}
                </span>
                <PlatformBadge platform={selectedComment.platform} />
                {selectedComment.profile_tier && <TierBadge tier={selectedComment.profile_tier} />}
                {selectedComment.classification && (() => {
                  const cls = CLASSIFICATION_CONFIG[selectedComment.classification];
                  return (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: cls.bg, color: cls.color }}>
                      {cls.icon} {cls.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--gv-color-neutral-700)" }}>
                {selectedComment.comment_text}
              </p>
              <p className="text-[11px] mt-2" style={{ color: "var(--gv-color-neutral-400)" }}>
                {new Date(selectedComment.created_at).toLocaleString("id", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>

            {/* Sentiment + Urgency (attention items) */}
            {selectedComment.source === "attention" && (selectedComment.sentiment || selectedComment.urgency) && (
              <div className="flex gap-2">
                {selectedComment.sentiment && (
                  <div className="flex-1 rounded-[12px] p-3" style={{ background: "var(--gv-color-bg-surface)", border: "1px solid var(--gv-color-neutral-100)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--gv-color-neutral-400)] mb-1">Sentiment</p>
                    <p className="text-[13px] font-semibold capitalize" style={{ color: "var(--gv-color-neutral-800)" }}>{selectedComment.sentiment}</p>
                  </div>
                )}
                {selectedComment.urgency && (
                  <div className="flex-1 rounded-[12px] p-3" style={{ background: "var(--gv-color-bg-surface)", border: "1px solid var(--gv-color-neutral-100)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--gv-color-neutral-400)] mb-1">Urgency</p>
                    <p className="text-[13px] font-semibold capitalize" style={{
                      color: selectedComment.urgency === "high" ? "#DC2626" : selectedComment.urgency === "medium" ? "#D97706" : "var(--gv-color-neutral-800)"
                    }}>{selectedComment.urgency}</p>
                  </div>
                )}
              </div>
            )}

            {/* MANUAL REPLY compose */}
            {replyMode === "manual" && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--gv-color-neutral-400)] mb-2">Your Reply</p>
                  <textarea
                    value={manualReply}
                    onChange={e => setManualReply(e.target.value)}
                    placeholder="Type your reply…"
                    rows={4}
                    className="w-full rounded-[14px] px-4 py-3 text-[14px] resize-none"
                    style={{
                      background: "var(--gv-color-bg-surface)",
                      border: "1.5px solid var(--gv-color-neutral-200)",
                      outline: "none",
                      color: "var(--gv-color-neutral-800)",
                      lineHeight: 1.6,
                    }}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px]" style={{ color: manualReply.length > 200 ? "#DC2626" : "var(--gv-color-neutral-400)" }}>
                      {manualReply.length}/280
                    </span>
                    <button
                      disabled={!manualReply.trim()}
                      className="px-5 py-2 rounded-[12px] text-[13px] font-bold text-white transition-all"
                      style={{
                        background: manualReply.trim() ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-200)",
                        cursor: manualReply.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Send Reply →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AI AUTO REPLY compose */}
            {replyMode === "ai" && (
              <div className="flex flex-col gap-3">
                {(selectedComment.ai_reply_draft || selectedComment.ai_suggestion) ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[12px] font-bold uppercase tracking-widest text-[var(--gv-color-neutral-400)]">AI Draft Reply</p>
                      <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                        style={{ background: "var(--gv-color-primary-100)", color: "var(--gv-color-primary-700)" }}>
                        Llama + Claude
                      </span>
                    </div>
                    <div className="rounded-[14px] p-4 relative" style={{ background: "var(--gv-color-primary-50)", border: "1.5px solid var(--gv-color-primary-200)" }}>
                      <p className="text-[14px] italic leading-relaxed" style={{ color: "var(--gv-color-neutral-800)" }}>
                        &ldquo;{selectedComment.ai_reply_draft || selectedComment.ai_suggestion}&rdquo;
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2.5 rounded-[12px] text-[13px] font-bold text-white transition-all hover:opacity-85"
                        style={{ background: "var(--gv-color-primary-600)", boxShadow: "0 3px 10px rgba(61,107,104,0.25)" }}>
                        ✓ Send AI Reply
                      </button>
                      <button className="px-4 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all hover:opacity-80"
                        onClick={() => { setManualReply(selectedComment.ai_reply_draft || selectedComment.ai_suggestion || ""); setReplyMode("manual"); }}
                        style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)" }}>
                        Edit
                      </button>
                      <button className="px-4 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all hover:opacity-80"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}>
                        Skip
                      </button>
                    </div>
                    <p className="text-[11px] mt-2 text-center" style={{ color: "var(--gv-color-neutral-400)" }}>
                      Reply will auto-send during cooldown window if not actioned
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[14px] p-4 text-center" style={{ background: "var(--gv-color-neutral-50)", border: "1px solid var(--gv-color-neutral-200)" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--gv-color-neutral-600)" }}>⏳ AI draft generating…</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Llama + Claude are composing a reply</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom submenu: Manual Reply | AI Auto Reply ── */}
      <div className="flex-shrink-0 border-t" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
        <div className="flex">
          {([
            {
              key: "manual" as ReplyMode,
              label: "Manual Reply",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              ),
              desc: "Write your own response",
            },
            {
              key: "ai" as ReplyMode,
              label: "AI Auto Reply",
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2a2 2 0 012 2v0a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2z"/><path d="M12 18a2 2 0 012 2v0a2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2z"/>
                  <path d="M4.93 4.93a2 2 0 012.83 0 2 2 0 010 2.83 2 2 0 01-2.83 0 2 2 0 010-2.83z"/><path d="M16.24 16.24a2 2 0 012.83 0 2 2 0 010 2.83 2 2 0 01-2.83 0 2 2 0 010-2.83z"/>
                  <path d="M2 12a2 2 0 012-2h0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2z"/><path d="M18 12a2 2 0 012-2h0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2z"/>
                  <path d="M4.93 19.07a2 2 0 010-2.83 2 2 0 012.83 0 2 2 0 010 2.83 2 2 0 01-2.83 0z"/><path d="M16.24 7.76a2 2 0 010-2.83 2 2 0 012.83 0 2 2 0 010 2.83 2 2 0 01-2.83 0z"/>
                </svg>
              ),
              desc: "AI writes & sends replies",
            },
          ] as { key: ReplyMode; label: string; icon: React.ReactNode; desc: string }[]).map(mode => {
            const isActive = replyMode === mode.key;
            return (
              <button
                key={mode.key}
                onClick={() => setReplyMode(mode.key)}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-all"
                style={{
                  background: isActive ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                  borderTop: `2px solid ${isActive ? "var(--gv-color-primary-600)" : "transparent"}`,
                  color: isActive ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-400)",
                }}
              >
                <span style={{ color: isActive ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-400)" }}>{mode.icon}</span>
                <span className="text-[12px] font-bold">{mode.label}</span>
                <span className="text-[10px]" style={{ color: isActive ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-400)" }}>
                  {mode.desc}
                </span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
      </div>
    </div>
);

  /* ════════════════════════════════════════════════════════════
     RIGHT COLUMN — Settings
  ════════════════════════════════════════════════════════════ */
  const right = (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--gv-color-neutral-400)" }}>
        Settings
      </p>

      {/* AI Auto Reply toggle */}
      <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50)" }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>AI Auto Reply</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
              {aiEnabled ? "Active — AI replies automatically" : "Paused — manual only"}
            </p>
          </div>
          <button
            onClick={() => setAIEnabled(!aiEnabled)}
            className="w-12 h-6 rounded-full transition-all flex-shrink-0 relative"
            style={{ background: aiEnabled ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-200)" }}
          >
            <span className="absolute top-0.5 bottom-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: aiEnabled ? "calc(100% - 22px)" : 2, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {/* Tone picker */}
        <div className="px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--gv-color-neutral-400)] mb-2">Reply Tone</p>
          <div className="flex gap-1.5">
            {(["professional", "friendly", "casual"] as typeof aiTone[]).map(t => (
              <button key={t} onClick={() => setAITone(t)}
                className="flex-1 py-1.5 rounded-[8px] text-[11px] font-semibold capitalize transition-all"
                style={{
                  background: aiTone === t ? "var(--gv-color-primary-100)" : "var(--gv-color-neutral-50)",
                  color: aiTone === t ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-500)",
                  border: `1px solid ${aiTone === t ? "var(--gv-color-primary-200)" : "var(--gv-color-neutral-200)"}`,
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rate limits */}
      <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50)" }}>
          <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Rate Limits by Tier</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>Cooldown + jitter per platform</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
          {[
            { tier: "Basic",   cooldown: "10 min", jitter: "4 min", replies: "~6/h" },
            { tier: "Premium", cooldown: "5 min",  jitter: "2 min", replies: "~12/h" },
            { tier: "Partner", cooldown: "3 min",  jitter: "1 min", replies: "~20/h" },
          ].map(t => (
            <div key={t.tier} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--gv-color-neutral-800)" }}>{t.tier}</p>
                <p className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>{t.cooldown} + {t.jitter} jitter</p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-[6px]"
                style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)" }}>
                {t.replies}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Profile tiers */}
      <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50)" }}>
          <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Smart Hash Profile Tiers</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>SHA-256 profile cache — expiry per tier</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
          {[
            { tier: "vip",    score: "≥85",   cache: "7d",  desc: "Influencer / verified / high-follower" },
            { tier: "high",   score: "60–84", cache: "14d", desc: "Engaged, has bio & profile pic" },
            { tier: "medium", score: "35–59", cache: "21d", desc: "Normal followers, partial profile" },
            { tier: "low",    score: "<35",   cache: "30d", desc: "New accounts, minimal engagement" },
            { tier: "bot",    score: "—",     cache: "30d", desc: "Bot pattern detected — auto-skip" },
          ].map(t => (
            <div key={t.tier} className="flex items-start justify-between px-4 py-2.5 gap-2">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TierBadge tier={t.tier} />
                  <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>Score: {t.score}</span>
                </div>
                <p className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>{t.desc}</p>
              </div>
              <span className="text-[10px] font-medium flex-shrink-0 mt-1" style={{ color: "var(--gv-color-neutral-500)" }}>
                {cache_label(t.cache)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live platform rate limit status */}
      {rateLimits.length > 0 && (
        <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50)" }}>
            <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Live Platform Status</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
            {rateLimits.map(r => {
              const lastMs    = r.last_reply_at ? new Date(r.last_reply_at).getTime() : 0;
              const readyAt   = lastMs + (r.cooldown_seconds || 600) * 1000;
              const isReady   = Date.now() >= readyAt;
              const secsLeft  = Math.max(0, Math.round((readyAt - Date.now()) / 1000));
              return (
                <div key={r.platform} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <PlatformIcon id={r.platform.toLowerCase()} size={14} />
                    <span className="text-[12px] font-medium capitalize" style={{ color: "var(--gv-color-neutral-700)" }}>{r.platform}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                    background: isReady ? "#DCFCE7" : "#FEF3C7",
                    color: isReady ? "#16A34A" : "#D97706",
                  }}>
                    {isReady ? "Ready" : `${secsLeft}s`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ThreeColumnLayout
          left={left}
          center={center}
          right={right}
          mobileRightOpen={mobileRightOpen}
          onMobileBack={() => setMRO(false)}
          mobileBackLabel="Reply"
        />
      </div>
    </div>
  );
}

function cache_label(s: string) { return `Cache ${s}`; }
