"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import PlatformIcon from "@/components/shared/PlatformIcon";

/* ══════════════════════════════════════════════════════════════════════════
   /auto-reply — GeoVera Auto-Reply Dashboard
   DS v5.8 compliant
══════════════════════════════════════════════════════════════════════════ */

const DEMO_BRAND_ID = process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

type ReplyStatus = "queued" | "processing" | "sent" | "failed" | "skipped";
type AttentionClassification = "purchase_intent" | "complaint" | "question" | "influencer" | "vip" | "spam" | "neutral";

interface ReplyQueueItem {
  id: string;
  comment_id: string;
  platform: string;
  commenter_username: string;
  comment_text: string;
  profile_tier: string;
  profile_score: number;
  weight: number;
  ai_reply_draft: string | null;
  status: ReplyStatus;
  created_at: string;
  sent_at: string | null;
}

interface AttentionItem {
  id: string;
  comment_id: string;
  platform: string;
  commenter_username: string;
  comment_text: string;
  classification: AttentionClassification;
  ai_suggestion: string | null;
  sentiment: string | null;
  urgency: string | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
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

const STATUS_CONFIG: Record<ReplyStatus, { label: string; color: string; bg: string }> = {
  queued:     { label: "Queued",     color: "#D97706", bg: "#FEF3C7" },
  processing: { label: "Processing", color: "#2563EB", bg: "#DBEAFE" },
  sent:       { label: "Sent",       color: "#16A34A", bg: "#DCFCE7" },
  failed:     { label: "Failed",     color: "#DC2626", bg: "#FEE2E2" },
  skipped:    { label: "Skipped",    color: "#6B7280", bg: "#F3F4F6" },
};

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "2px 8px 2px 4px", borderRadius: 6,
      background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)",
    }}>
      <PlatformIcon id={platform.toLowerCase()} size={14} />
      {platform}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.medium;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-[14px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{title}</p>
      <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>{subtitle}</p>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-[14px] p-4 flex flex-col gap-1" style={{
      background: "var(--gv-color-bg-surface)",
      border: "1px solid var(--gv-color-neutral-200)",
    }}>
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--gv-color-neutral-400)" }}>{label}</p>
      <p className="text-[22px] font-bold leading-none" style={{ color: color || "var(--gv-color-neutral-900)" }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>{sub}</p>}
    </div>
  );
}

export default function AutoReplyPage() {
  const [tab, setTab] = useState<"queue" | "attention" | "settings">("queue");
  const [queueItems, setQueueItems] = useState<ReplyQueueItem[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileRightOpen, setMRO] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [queueRes, attentionRes, rateLimitRes] = await Promise.all([
      supabase
        .from("gv_reply_queue")
        .select("*")
        .eq("brand_id", DEMO_BRAND_ID)
        .in("status", ["queued", "processing", "failed"])
        .order("weight", { ascending: false })
        .limit(50),
      supabase
        .from("gv_attention_queue")
        .select("*")
        .eq("brand_id", DEMO_BRAND_ID)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("gv_reply_rate_limit")
        .select("platform, last_reply_at, cooldown_seconds")
        .eq("brand_id", DEMO_BRAND_ID),
    ]);
    setQueueItems((queueRes.data ?? []) as ReplyQueueItem[]);
    setAttentionItems((attentionRes.data ?? []) as AttentionItem[]);
    setRateLimits((rateLimitRes.data ?? []) as RateLimit[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Stats
  const sentToday = 0; // Would query with date filter
  const pendingCount = queueItems.filter(i => i.status === "queued").length;
  const unreadAttention = attentionItems.filter(i => !i.is_read).length;
  const failedCount = queueItems.filter(i => i.status === "failed").length;

  /* ── LEFT NAV ── */
  const left = <NavColumn />;

  /* ── CENTER COLUMN ── */
  const center = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--gv-color-neutral-900)", fontFamily: "Georgia, serif" }}>
              Auto Reply
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
              Smart comment management — AI-powered replies & human review queue
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <StatCard label="Pending" value={pendingCount} sub="in queue" color={pendingCount > 0 ? "#D97706" : undefined} />
          <StatCard label="Sent Today" value={sentToday} sub="auto-replies" color="#16A34A" />
          <StatCard label="Review" value={unreadAttention} sub="need attention" color={unreadAttention > 0 ? "#DC2626" : undefined} />
          <StatCard label="Failed" value={failedCount} sub="retrying" color={failedCount > 0 ? "#DC2626" : undefined} />
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mt-4 border-b" style={{ borderColor: "var(--gv-color-neutral-200)" }}>
          {([
            { key: "queue",     label: "Reply Queue",    count: pendingCount },
            { key: "attention", label: "Human Review",   count: unreadAttention },
            { key: "settings",  label: "Settings",       count: null },
          ] as { key: typeof tab; label: string; count: number | null }[]).map(({ key, label, count }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-all relative"
                style={{
                  color: isActive ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-500)",
                  marginBottom: -1,
                  background: "none", border: "none",
                  borderBottom: isActive ? "2px solid var(--gv-color-primary-600)" : "2px solid transparent",
                }}
              >
                {label}
                {count !== null && count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 5,
                    background: key === "attention" ? "#FEE2E2" : "var(--gv-color-primary-50, #EDF5F4)",
                    color: key === "attention" ? "#DC2626" : "var(--gv-color-primary-600)",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-6 py-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-[12px] h-[88px]" style={{ background: "var(--gv-color-neutral-100)" }} />
            ))}
          </div>
        ) : (
          <>
            {/* REPLY QUEUE TAB */}
            {tab === "queue" && (
              queueItems.length === 0 ? (
                <EmptyState icon="✅" title="Queue kosong" subtitle="Semua komentar sudah dibalas atau belum ada yang masuk." />
              ) : (
                <div className="flex flex-col gap-3">
                  {queueItems.map(item => (
                    <div
                      key={item.id}
                      className="rounded-[14px] p-4 cursor-pointer transition-all hover:shadow-md"
                      style={{
                        background: selectedItem === item.id ? "var(--gv-color-primary-50, #EDF5F4)" : "var(--gv-color-bg-surface)",
                        border: `1.5px solid ${selectedItem === item.id ? "var(--gv-color-primary-300, #A8C5C2)" : "var(--gv-color-neutral-200)"}`,
                      }}
                      onClick={() => { setSelectedItem(item.id === selectedItem ? null : item.id); setMRO(true); }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[13px] font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>
                              @{item.commenter_username}
                            </span>
                            <PlatformBadge platform={item.platform} />
                            <TierBadge tier={item.profile_tier} />
                          </div>
                          <p className="text-[12px] line-clamp-2" style={{ color: "var(--gv-color-neutral-600)" }}>
                            {item.comment_text}
                          </p>
                          {item.ai_reply_draft && (
                            <p className="text-[11px] mt-2 italic line-clamp-1" style={{ color: "var(--gv-color-primary-500, #5F8F8B)" }}>
                              AI draft: {item.ai_reply_draft}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                            background: STATUS_CONFIG[item.status].bg,
                            color: STATUS_CONFIG[item.status].color,
                          }}>
                            {STATUS_CONFIG[item.status].label}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                            Score: {Math.round(item.profile_score)}/100
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* HUMAN REVIEW TAB */}
            {tab === "attention" && (
              attentionItems.length === 0 ? (
                <EmptyState icon="👀" title="Tidak ada yang perlu review" subtitle="Komentar penting akan muncul di sini untuk ditindaklanjuti." />
              ) : (
                <div className="flex flex-col gap-3">
                  {attentionItems.map(item => {
                    const cls = CLASSIFICATION_CONFIG[item.classification] || CLASSIFICATION_CONFIG.neutral;
                    return (
                      <div
                        key={item.id}
                        className="rounded-[14px] p-4 cursor-pointer transition-all hover:shadow-md"
                        style={{
                          background: !item.is_read ? "var(--gv-color-bg-surface)" : "var(--gv-color-neutral-50, #F9FAFB)",
                          border: `1.5px solid ${!item.is_read ? "var(--gv-color-neutral-300)" : "var(--gv-color-neutral-200)"}`,
                        }}
                        onClick={() => { setSelectedItem(item.id === selectedItem ? null : item.id); setMRO(true); }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {!item.is_read && (
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#DC2626" }} />
                              )}
                              <span className="text-[13px] font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>
                                @{item.commenter_username}
                              </span>
                              <PlatformBadge platform={item.platform} />
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                                background: cls.bg, color: cls.color,
                              }}>
                                {cls.icon} {cls.label}
                              </span>
                            </div>
                            <p className="text-[12px] line-clamp-2" style={{ color: "var(--gv-color-neutral-600)" }}>
                              {item.comment_text}
                            </p>
                            {item.ai_suggestion && (
                              <p className="text-[11px] mt-2 italic line-clamp-1" style={{ color: "var(--gv-color-primary-500, #5F8F8B)" }}>
                                AI saran: {item.ai_suggestion}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {item.urgency && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                                background: item.urgency === "high" ? "#FEE2E2" : item.urgency === "medium" ? "#FEF3C7" : "#F3F4F6",
                                color: item.urgency === "high" ? "#DC2626" : item.urgency === "medium" ? "#D97706" : "#6B7280",
                              }}>
                                {item.urgency} urgency
                              </span>
                            )}
                            <span className="text-[10px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                              {new Date(item.created_at).toLocaleDateString("id", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* SETTINGS TAB */}
            {tab === "settings" && (
              <div className="flex flex-col gap-5">
                {/* Tier rate limits */}
                <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50, #F9FAFB)" }}>
                    <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Auto-Reply Rate Limits</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>Tier-based cooldown per platform</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
                    {[
                      { tier: "Basic",   cooldown: "10 min", jitter: "4 min", replies: "~6/h", bg: "#F9FAFB" },
                      { tier: "Premium", cooldown: "5 min",  jitter: "2 min", replies: "~12/h", bg: "#EDF5F4" },
                      { tier: "Partner", cooldown: "3 min",  jitter: "1 min", replies: "~20/h", bg: "#EDE9FE" },
                    ].map(t => (
                      <div key={t.tier} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-[12px] font-semibold" style={{ color: "var(--gv-color-neutral-800)" }}>{t.tier}</p>
                          <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>Cooldown: {t.cooldown} + {t.jitter} jitter</p>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-[6px]" style={{ background: t.bg, color: "var(--gv-color-neutral-700)" }}>
                          ~{t.replies}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Smart Hash profile tiers */}
                <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50, #F9FAFB)" }}>
                    <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Smart Hash Profile Tiers</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>SHA-256 profile cache — cache expiry per tier</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
                    {[
                      { tier: "VIP",    score: "≥85",  cache: "7 days",  description: "Influencer / verified / high-follower" },
                      { tier: "High",   score: "60–84", cache: "14 days", description: "Engaged followers, has bio & profile pic" },
                      { tier: "Medium", score: "35–59", cache: "21 days", description: "Normal followers, partial profile" },
                      { tier: "Low",    score: "<35",   cache: "30 days", description: "New accounts, minimal engagement" },
                      { tier: "Bot",    score: "—",     cache: "30 days", description: "Bot pattern detected — auto-skip" },
                    ].map(t => (
                      <div key={t.tier} className="flex items-start justify-between px-4 py-3 gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <TierBadge tier={t.tier.toLowerCase()} />
                            <span className="text-[11px]" style={{ color: "var(--gv-color-neutral-500)" }}>Score: {t.score}</span>
                          </div>
                          <p className="text-[11px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>{t.description}</p>
                        </div>
                        <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--gv-color-neutral-600)" }}>
                          Cache {t.cache}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform rate limit status */}
                {rateLimits.length > 0 && (
                  <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid var(--gv-color-neutral-200)" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)", background: "var(--gv-color-neutral-50, #F9FAFB)" }}>
                      <p className="text-[13px] font-bold" style={{ color: "var(--gv-color-neutral-800)" }}>Live Rate Limit Status</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: "var(--gv-color-neutral-100)" }}>
                      {rateLimits.map(r => {
                        const lastMs = r.last_reply_at ? new Date(r.last_reply_at).getTime() : 0;
                        const cooldownMs = (r.cooldown_seconds || 600) * 1000;
                        const readyAt = lastMs + cooldownMs;
                        const isReady = Date.now() >= readyAt;
                        const secsLeft = Math.max(0, Math.round((readyAt - Date.now()) / 1000));
                        return (
                          <div key={r.platform} className="flex items-center justify-between px-4 py-3">
                            <PlatformBadge platform={r.platform} />
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                              background: isReady ? "#DCFCE7" : "#FEF3C7",
                              color: isReady ? "#16A34A" : "#D97706",
                            }}>
                              {isReady ? "Ready" : `${secsLeft}s cooldown`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  /* ── RIGHT COLUMN — item detail ── */
  const selectedQueueItem = queueItems.find(i => i.id === selectedItem);
  const selectedAttentionItem = attentionItems.find(i => i.id === selectedItem);

  const right = (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4">
      {(!selectedQueueItem && !selectedAttentionItem) ? (
        <div>
          <p className="text-[13px] font-bold mb-4" style={{ color: "var(--gv-color-neutral-800)" }}>Detail</p>
          <EmptyState icon="👆" title="Pilih item" subtitle="Klik komentar di kiri untuk melihat detail dan AI draft reply." />
        </div>
      ) : selectedQueueItem ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gv-color-neutral-400)" }}>Comment Detail</p>
            <div className="rounded-[12px] p-4" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[14px] font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>@{selectedQueueItem.commenter_username}</span>
                <PlatformBadge platform={selectedQueueItem.platform} />
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--gv-color-neutral-700)" }}>
                {selectedQueueItem.comment_text}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[10px] p-3" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--gv-color-neutral-400)" }}>Profile Tier</p>
              <TierBadge tier={selectedQueueItem.profile_tier} />
            </div>
            <div className="rounded-[10px] p-3" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--gv-color-neutral-400)" }}>Score</p>
              <p className="text-[18px] font-bold" style={{ color: "var(--gv-color-primary-600, #3D6B68)" }}>{Math.round(selectedQueueItem.profile_score)}<span className="text-[12px] font-normal">/100</span></p>
            </div>
          </div>

          {selectedQueueItem.ai_reply_draft && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gv-color-neutral-400)" }}>AI Draft Reply</p>
              <div className="rounded-[12px] p-4" style={{ background: "#EDF5F4", border: "1px solid #C8DBD9" }}>
                <p className="text-[13px] leading-relaxed italic" style={{ color: "#1F2428" }}>
                  &ldquo;{selectedQueueItem.ai_reply_draft}&rdquo;
                </p>
              </div>
              <p className="text-[10px] mt-2" style={{ color: "var(--gv-color-neutral-400)" }}>
                Reply akan dikirim otomatis sesuai jadwal cooldown.
              </p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gv-color-neutral-400)" }}>Queue Weight</p>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--gv-color-neutral-200)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(selectedQueueItem.weight * 100)}%`, background: "var(--gv-color-primary-500, #5F8F8B)" }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>
              Priority: {Math.round(selectedQueueItem.weight * 100)}% — higher weight replies first
            </p>
          </div>
        </div>
      ) : selectedAttentionItem ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gv-color-neutral-400)" }}>Comment Detail</p>
            <div className="rounded-[12px] p-4" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[14px] font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>@{selectedAttentionItem.commenter_username}</span>
                <PlatformBadge platform={selectedAttentionItem.platform} />
                {(() => {
                  const cls = CLASSIFICATION_CONFIG[selectedAttentionItem.classification] || CLASSIFICATION_CONFIG.neutral;
                  return (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: cls.bg, color: cls.color }}>
                      {cls.icon} {cls.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--gv-color-neutral-700)" }}>
                {selectedAttentionItem.comment_text}
              </p>
            </div>
          </div>

          {selectedAttentionItem.ai_suggestion && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--gv-color-neutral-400)" }}>AI Suggestion</p>
              <div className="rounded-[12px] p-4" style={{ background: "#EDF5F4", border: "1px solid #C8DBD9" }}>
                <p className="text-[13px] leading-relaxed" style={{ color: "#1F2428" }}>
                  {selectedAttentionItem.ai_suggestion}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[10px] p-3" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--gv-color-neutral-400)" }}>Sentiment</p>
              <p className="text-[13px] font-semibold capitalize" style={{ color: "var(--gv-color-neutral-800)" }}>{selectedAttentionItem.sentiment || "—"}</p>
            </div>
            <div className="rounded-[10px] p-3" style={{ background: "var(--gv-color-neutral-50, #F9FAFB)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--gv-color-neutral-400)" }}>Urgency</p>
              <p className="text-[13px] font-semibold capitalize" style={{ color: "var(--gv-color-neutral-800)" }}>{selectedAttentionItem.urgency || "—"}</p>
            </div>
          </div>

          <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>
            Received: {new Date(selectedAttentionItem.created_at).toLocaleString("id", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      ) : null}
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
          mobileBackLabel="Auto Reply"
        />
      </div>
    </div>
  );
}
