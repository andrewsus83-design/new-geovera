"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef } from "react";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import BrandEditPanel from "@/components/home/BrandEditPanel";
import DesignAssetsEditPanel from "@/components/home/DesignAssetsEditPanel";
import type { Agent } from "@/components/ai-agent/AgentList";
import AgentDetailCard from "@/components/ai-agent/AgentDetailCard";
import SubscriptionTierCard, { PLANS } from "@/components/home/SubscriptionTierCard";
import type { PlanId } from "@/components/home/SubscriptionTierCard";
import PlanDetailPanel from "@/components/home/PlanDetailPanel";
import PlatformIcon from "@/components/shared/PlatformIcon";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  UserCircleIcon, DollarLineIcon, LockIcon, AiIcon,
  BrandIcon, UserIcon, PlugInIcon, ShootingStarIcon,
} from "@/icons";
import type { HiredAgent } from "@/components/ai-agent/HireAgentPanel";

const SUPABASE_FN_URL = "https://vozjwptzutolvkvfpknk.supabase.co/functions/v1";
const FALLBACK_BRAND_ID = process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

// Late platform id map
const LATE_PLATFORM: Record<string, string> = {
  tiktok: "tiktok", instagram: "instagram", facebook: "facebook",
  youtube: "youtube", linkedin: "linkedin", x: "twitter",
  threads: "threads", reddit: "reddit", gbp: "google_business",
};

const LS_CONNECTIONS = "gv_connections";
const SS_PENDING = "gv_pending_connect";

const loadLS = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(LS_CONNECTIONS) || "[]")); } catch { return new Set(); }
};
const saveLS = (ps: Platform[]) => {
  try { localStorage.setItem(LS_CONNECTIONS, JSON.stringify(ps.filter(p => p.connected).map(p => p.id))); } catch {}
};

interface Platform {
  id: string; name: string; icon: string; connected: boolean;
  handle?: string; plan: "basic" | "premium" | "enterprise";
}
const CONNECT_PLAN = "enterprise";
const planOrder: Record<string, number> = { basic: 0, premium: 1, enterprise: 2 };
const planLabel: Record<string, string> = { basic: "Basic", premium: "Premium", enterprise: "Partner" };
const initialPlatforms: Platform[] = [
  { id: "tiktok",    name: "TikTok",                  icon: "🎵", connected: false, plan: "premium" },
  { id: "instagram", name: "Instagram",               icon: "📸", connected: true,  handle: "geovera.id", plan: "basic" },
  { id: "facebook",  name: "Facebook",                icon: "💬", connected: false, plan: "basic" },
  { id: "youtube",   name: "YouTube",                 icon: "▶️", connected: false, plan: "premium" },
  { id: "linkedin",  name: "LinkedIn",                icon: "💼", connected: false, plan: "premium" },
  { id: "x",         name: "X (Twitter)",             icon: "𝕏",  connected: false, plan: "basic" },
  { id: "threads",   name: "Threads",                 icon: "🧵", connected: false, plan: "premium" },
  { id: "reddit",    name: "Reddit",                  icon: "🟠", connected: false, plan: "basic" },
  { id: "gbp",       name: "Google Business Profile", icon: "📍", connected: false, plan: "enterprise" },
];

const CEO_AGENT: Agent = {
  id: "ceo", name: "CEO Agent", title: "Strategic Planning & Oversight",
  icon: "🧑‍💼", active: true, locked: false,
  description: "Your AI CEO handles high-level strategic decisions, budget allocation, partnership evaluations, and KPI setting.",
  dailyTasks: ["Review and optimize marketing budget allocation", "Evaluate partnership and collaboration proposals", "Set and track monthly KPIs and growth targets", "Analyze competitor landscape and market trends"],
  skills: ["Strategy", "Analytics", "Budget", "Partnerships", "KPIs", "Market Analysis"],
  recentActivity: [
    { title: "Reviewed Q1 Marketing Budget", time: "2h ago" },
    { title: "Set March KPIs for Team", time: "5h ago" },
    { title: "Analyzed Competitor Strategy Report", time: "1d ago" },
  ],
};
const CMO_AGENT: Agent = {
  id: "cmo", name: "CMO Agent", title: "Marketing & Content Strategy",
  icon: "📣", active: true, locked: false,
  description: "Your AI CMO creates and manages content across all platforms — captions, hashtags, scheduling, and trending topics.",
  dailyTasks: ["Create and schedule social media content", "Write blog posts and long-form articles", "Monitor and respond to trending topics", "Optimize content for SEO and engagement"],
  skills: ["Content", "Social Media", "Copywriting", "SEO", "Trends", "Branding"],
  recentActivity: [
    { title: "Created Instagram Carousel: Summer Collection", time: "1h ago" },
    { title: "Scheduled 3 TikTok Videos", time: "3h ago" },
    { title: "Published Blog: Eco-Friendly Materials", time: "1d ago" },
  ],
};
const HOME_AGENTS: Agent[] = [CEO_AGENT, CMO_AGENT];

// ── Types ──────────────────────────────────────────────────────────────────
type HomeTab = "profile" | "billing" | "security" | "agents";
type ProfileSub = "brand_dna" | "detail" | "connect";
type BillingSub = "plan" | "payment";
type SecuritySub = "password" | "twofa" | "session";
type AgentId = "ceo" | "cmo";

const PLAN_LABEL: Record<string, string> = { BASIC: "Basic", PREMIUM: "Premium", PARTNER: "Partner" };
const PLAN_PRICE_IDR: Record<string, Record<string, string>> = {
  BASIC:   { monthly: "Rp 5.990.000",  yearly: "Rp 65.835.000" },
  PREMIUM: { monthly: "Rp 10.485.000", yearly: "Rp 115.335.000" },
  PARTNER: { monthly: "Rp 16.485.000", yearly: "Rp 181.335.000" },
};

interface InvoiceRow { id: string; external_id: string; created_at: string; amount: number; currency: string; status: string; }
interface SubData {
  plan: string; billing_cycle: string; status: string;
  current_period_end: string; amount_paid: number; currency: string; payment_method: string;
}
interface TrainedModel {
  id: string; dataset_name: string; theme: string; training_status: string;
  model_path: string | null; metadata: { trigger_word?: string; lora_model?: string } | null;
}

// ── BottomHomeTab ──────────────────────────────────────────────────────────
function BottomHomeTab({ active, onSelect }: { active: HomeTab; onSelect: (t: HomeTab) => void }) {
  const tabs: { id: HomeTab; label: string; icon: React.ReactNode }[] = [
    { id: "profile",  label: "Profile",  icon: <UserCircleIcon className="w-4 h-4" /> },
    { id: "billing",  label: "Billing",  icon: <DollarLineIcon className="w-4 h-4" /> },
    { id: "security", label: "Security", icon: <LockIcon className="w-4 h-4" /> },
    { id: "agents",   label: "AI Agent", icon: <AiIcon className="w-4 h-4" /> },
  ];
  return (
    <div className="overflow-hidden" style={{
      borderRadius: "var(--gv-radius-2xl)",
      border: "1px solid var(--gv-color-glass-border)",
      background: "var(--gv-color-glass-bg)",
      backdropFilter: "blur(var(--gv-blur-lg))",
      WebkitBackdropFilter: "blur(var(--gv-blur-lg))",
      boxShadow: "var(--gv-shadow-sidebar)",
    }}>
      <div className="flex items-center px-3 py-2 gap-1">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-[14px] text-[13px] font-semibold transition-all"
              style={{
                color: isActive ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-500)",
                background: isActive ? "var(--gv-color-primary-50)" : "transparent",
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Left nav item helper ───────────────────────────────────────────────────
function NavItem({
  icon, label, sub, active, onClick,
}: {
  icon: React.ReactNode; label: string; sub?: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-all"
      style={{
        background: active ? "var(--gv-color-primary-50)" : "transparent",
        border: active ? "1px solid var(--gv-color-primary-200)" : "1px solid transparent",
      }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] flex-shrink-0"
        style={{ background: active ? "var(--gv-color-primary-100)" : "var(--gv-color-neutral-100)" }}>
        <span style={{ color: active ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-400)" }}>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold truncate"
          style={{ color: active ? "var(--gv-color-primary-700)" : "var(--gv-color-neutral-700)" }}>
          {label}
        </p>
        {sub && <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{sub}</p>}
      </div>
    </button>
  );
}

// ── BillingToggle ──────────────────────────────────────────────────────────
function BillingToggle({ yearly, onChange }: { yearly: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] bg-[var(--gv-color-neutral-50)] border border-[var(--gv-color-neutral-100)] px-4 py-3">
      <div>
        <p className="text-[12px] font-semibold text-[var(--gv-color-neutral-900)]">Billing cycle</p>
        <p className="text-[11px] text-[var(--gv-color-neutral-400)] mt-0.5">
          {yearly ? "Yearly — pay 11 months, get 1 free" : "Monthly billing"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-medium ${!yearly ? "text-[var(--gv-color-neutral-900)]" : "text-[var(--gv-color-neutral-400)]"}`}>Monthly</span>
        <button
          onClick={() => onChange(!yearly)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${yearly ? "bg-[var(--gv-color-primary-500)]" : "bg-[var(--gv-color-neutral-300)]"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${yearly ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-[11px] font-medium ${yearly ? "text-[var(--gv-color-primary-600)]" : "text-[var(--gv-color-neutral-400)]"}`}>
          Yearly
          {yearly && <span className="ml-1 rounded-full bg-[var(--gv-color-primary-50)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--gv-color-primary-700)]">1 mo free</span>}
        </span>
      </div>
    </div>
  );
}

// ── Subscription Panel (center — billing > plan) ───────────────────────────
function SubscriptionPanel({
  selectedPlanId, onSelectPlan, currentPlan, billingYearly, onBillingChange,
}: {
  selectedPlanId: PlanId; onSelectPlan: (id: PlanId) => void;
  currentPlan: PlanId; billingYearly: boolean; onBillingChange: (v: boolean) => void;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Subscription Plans</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Choose the plan that fits your brand</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
        <BillingToggle yearly={billingYearly} onChange={onBillingChange} />
        {PLANS.map((plan) => (
          <SubscriptionTierCard
            key={plan.id} plan={plan}
            isCurrent={plan.id === currentPlan}
            isSelected={selectedPlanId === plan.id}
            onClick={() => onSelectPlan(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Billing Panel (right — billing > payment) ──────────────────────────────
function BillingPanel({ brandId }: { brandId: string }) {
  const [sub, setSub] = useState<SubData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [subRes, invRes] = await Promise.all([
          fetch("/api/payment", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_subscription", brand_id: brandId }),
          }),
          supabase.from("gv_invoices").select("id, external_id, created_at, amount, currency, status")
            .eq("brand_id", brandId).order("created_at", { ascending: false }).limit(10),
        ]);
        const subData = await subRes.json();
        if (subData.success && subData.subscription) setSub(subData.subscription as SubData);
        if (invRes.data) setInvoices(invRes.data as InvoiceRow[]);
      } catch { /* keep empty */ }
      setLoading(false);
    };
    load();
  }, [brandId]);

  const planKey = sub?.plan?.toUpperCase() ?? "";
  const cycle = sub?.billing_cycle ?? "monthly";
  const idrPrice = PLAN_PRICE_IDR[planKey]?.[cycle] ?? "—";
  const nextBilling = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtAmt = (amt: number, cur: string) => `${cur} ${amt.toLocaleString()}`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Billing</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">
          {sub ? `Next billing: ${nextBilling}` : loading ? "Loading…" : "No active subscription"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
        {loading && <div className="flex items-center justify-center py-8"><div className="h-6 w-6 rounded-full border-2 border-brand-200 border-t-brand-500 animate-spin" /></div>}
        {!loading && (
          <>
            <div className="rounded-[12px] border border-[var(--gv-color-neutral-200)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--gv-color-neutral-50)] border-b border-[var(--gv-color-neutral-100)]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">Current Subscription</p>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-[#F3F4F6]">
                  {[
                    { label: "Plan", value: sub ? <span className="inline-flex items-center rounded-full bg-[var(--gv-color-primary-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gv-color-primary-700)]">{PLAN_LABEL[planKey] ?? planKey}</span> : "—" },
                    { label: "Price", value: sub ? idrPrice + (cycle === "yearly" ? " / yr" : " / bln") : "—" },
                    { label: "Billing Cycle", value: sub ? (cycle === "yearly" ? "Yearly" : "Monthly") : "—" },
                    { label: "Next Billing", value: nextBilling },
                    { label: "Status", value: sub ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sub.status === "active" ? "bg-[#ECFDF3] text-[#047857]" : "bg-[#F3F4F6] text-[var(--gv-color-neutral-500)]"}`}>{sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}</span> : <span className="text-[var(--gv-color-neutral-400)]">No subscription</span> },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--gv-color-neutral-400)] w-1/3">{label}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--gv-color-neutral-900)] font-medium">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sub && (
              <div className="rounded-[12px] border border-[var(--gv-color-neutral-200)] overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--gv-color-neutral-50)] border-b border-[var(--gv-color-neutral-100)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">Payment Method · Xendit</p>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {[
                      { label: "Gateway", value: "Xendit" },
                      { label: "Method", value: sub.payment_method || "—" },
                      { label: "Currency", value: "IDR (Indonesian Rupiah)" },
                    ].map(({ label, value }) => (
                      <tr key={label}>
                        <td className="px-4 py-2.5 text-[12px] text-[var(--gv-color-neutral-400)] w-1/3">{label}</td>
                        <td className="px-4 py-2.5 text-[12px] text-[var(--gv-color-neutral-900)] font-medium">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-[12px] border border-[var(--gv-color-neutral-200)] overflow-hidden">
              <div className="px-4 py-2.5 bg-[var(--gv-color-neutral-50)] border-b border-[var(--gv-color-neutral-100)]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">Invoice History</p>
              </div>
              {invoices.length === 0 ? (
                <p className="px-4 py-5 text-[12px] text-[var(--gv-color-neutral-400)] text-center">No invoices yet</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--gv-color-neutral-100)]">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--gv-color-neutral-400)] uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-[var(--gv-color-neutral-400)] uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-[var(--gv-color-neutral-400)] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-4 py-2.5 text-[12px] text-[var(--gv-color-neutral-500)]">{fmtDate(inv.created_at)}</td>
                        <td className="px-4 py-2.5 text-right text-[12px] text-[var(--gv-color-neutral-900)] font-medium">{fmtAmt(inv.amount, inv.currency)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            inv.status === "PAID" || inv.status === "SETTLED" ? "bg-[#ECFDF3] text-[#047857]"
                            : inv.status === "PENDING" ? "bg-[#FFFBEB] text-[#B45309]"
                            : "bg-[#F3F4F6] text-[var(--gv-color-neutral-500)]"
                          }`}>
                            {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Connect All Panel ──────────────────────────────────────────────────────
function ConnectAllPanel({
  platforms, replyEnabled, isAccessible, onToggleConnect, onToggleReply,
}: {
  platforms: Platform[]; replyEnabled: Record<string, boolean>;
  isAccessible: (p: Platform) => boolean;
  onToggleConnect: (id: string) => void; onToggleReply: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Connected Platforms</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">{platforms.filter((p) => p.connected).length} of {platforms.length} connected</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-5 py-2.5 border-b border-[var(--gv-color-neutral-100)] bg-[var(--gv-color-neutral-50)]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">Platform</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)] w-16 text-center">Connect</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)] w-16 text-center">Auto-Reply</span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className="divide-y divide-[#F3F4F6]">
          {platforms.map((platform) => {
            const accessible = isAccessible(platform);
            const isConnected = platform.connected;
            const replyOn = replyEnabled[platform.id] ?? false;
            return (
              <div key={platform.id} className={`grid grid-cols-[1fr_auto_auto] gap-x-3 items-center px-5 py-3 ${!accessible ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 ${!accessible ? "opacity-40" : ""}`}>
                    <PlatformIcon id={platform.id} size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-medium text-[var(--gv-color-neutral-900)] truncate">{platform.name}</p>
                      {!accessible && (
                        <span className="rounded-full bg-[#FFF7ED] px-1.5 py-0.5 text-[9px] font-semibold text-[#C2410C] flex-shrink-0">
                          {planLabel[platform.plan]}+
                        </span>
                      )}
                    </div>
                    {platform.handle && accessible && isConnected && <p className="text-[11px] text-[var(--gv-color-neutral-400)] truncate">@{platform.handle}</p>}
                    {!isConnected && accessible && <p className="text-[11px] text-[var(--gv-color-neutral-400)]">Not connected</p>}
                  </div>
                </div>
                <div className="w-16 flex justify-center">
                  {accessible ? (
                    <button onClick={() => onToggleConnect(platform.id)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isConnected ? "bg-[var(--gv-color-primary-500)]" : "bg-[var(--gv-color-neutral-300)]"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${isConnected ? "translate-x-5.5" : "translate-x-0.5"}`} />
                    </button>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#D1D5DB]">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                </div>
                <div className="w-16 flex justify-center">
                  {accessible ? (
                    <button onClick={() => onToggleReply(platform.id)} disabled={!isConnected}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${replyOn && isConnected ? "bg-[#10B981]" : "bg-[var(--gv-color-neutral-300)]"}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${replyOn && isConnected ? "translate-x-5.5" : "translate-x-0.5"}`} />
                    </button>
                  ) : <span className="text-[11px] text-[#D1D5DB]">—</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mx-4 mt-3 mb-4 rounded-[12px] border border-[#A8D5CF] bg-[var(--gv-color-primary-50)] p-3">
          <p className="text-[12px] font-semibold text-[var(--gv-color-primary-700)]">Late Auto-Reply Limits</p>
          <p className="text-[11px] text-[#5F8F8B] mt-1">Basic: 50/day · Premium: 100/day · Partner: 150/day</p>
        </div>
      </div>
    </div>
  );
}

// ── Security sub-panels ────────────────────────────────────────────────────
function PasswordPanel() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = () => {
    setErr("");
    if (!currentPw) { setErr("Current password is required."); return; }
    if (newPw.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setErr("Passwords do not match."); return; }
    setSaved(true);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Reset Password</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Use a strong password with letters, numbers, and symbols</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5">
        <div className="space-y-3 max-w-sm">
          {[
            { id: "current", label: "Current Password", value: currentPw, setter: setCurrentPw, placeholder: "••••••••" },
            { id: "new",     label: "New Password",     value: newPw,     setter: setNewPw,     placeholder: "Min. 8 characters" },
            { id: "confirm", label: "Confirm Password", value: confirmPw, setter: setConfirmPw, placeholder: "••••••••" },
          ].map(({ id, label, value, setter, placeholder }) => (
            <div key={id}>
              <label className="block text-[12px] font-semibold text-[#4A545B] mb-1.5">{label}</label>
              <input type="password" value={value} onChange={(e) => setter(e.target.value)}
                placeholder={placeholder} className="gv-input" />
            </div>
          ))}
          {err  && <p className="text-[12px] text-[#DC2626]">{err}</p>}
          {saved && <p className="text-[12px] text-[var(--gv-color-primary-600)] font-medium">✓ Password updated successfully</p>}
          <button onClick={handleSave} className="gv-btn-primary w-full mt-2">Update Password</button>
        </div>
      </div>
    </div>
  );
}

function TwoFAPanel() {
  const [enabled, setEnabled] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleToggle = () => {
    if (!enabled) { setEnabled(true); setShowQr(true); }
    else { setEnabled(false); setShowQr(false); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Two-Factor Authentication</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Add an extra layer of security to your account</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-semibold text-[var(--gv-color-neutral-900)]">Two-Factor Auth</p>
            <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">{enabled ? "Enabled — your account is protected" : "Disabled — enable for extra security"}</p>
          </div>
          <button onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${enabled ? "bg-[var(--gv-color-primary-500)]" : "bg-[var(--gv-color-neutral-300)]"}`}>
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {enabled && (
          <div className="rounded-[12px] border border-[#A8D5CF] bg-[var(--gv-color-primary-50)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--gv-color-primary-600)] flex-shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              <p className="text-[12px] font-semibold text-[var(--gv-color-primary-700)]">2FA is enabled on your account</p>
            </div>
            {showQr && (
              <div>
                <p className="text-[12px] text-[var(--gv-color-neutral-500)] mb-2">Scan with your authenticator app:</p>
                <div className="w-28 h-28 rounded-[10px] bg-white border border-[var(--gv-color-neutral-200)] flex items-center justify-center mx-auto">
                  <svg viewBox="0 0 100 100" className="w-24 h-24">
                    {[0,30,60].map(x => [0,30,60].map(y => (
                      <rect key={`${x}-${y}`} x={x+2} y={y+2} width="26" height="26" rx="3" fill="none" stroke="#374151" strokeWidth="2"/>
                    )))}
                    <rect x="8" y="8" width="14" height="14" rx="1" fill="#374151"/>
                    <rect x="38" y="8" width="14" height="14" rx="1" fill="#374151"/>
                    <rect x="8" y="38" width="14" height="14" rx="1" fill="#374151"/>
                    <rect x="38" y="38" width="6" height="6" rx="1" fill="#374151"/>
                    <rect x="50" y="38" width="6" height="6" rx="1" fill="#374151"/>
                    <rect x="68" y="8" width="14" height="14" rx="1" fill="#374151"/>
                    <rect x="68" y="68" width="14" height="14" rx="1" fill="#374151"/>
                    <rect x="8" y="68" width="14" height="14" rx="1" fill="#374151"/>
                  </svg>
                </div>
                <p className="text-[10px] text-[var(--gv-color-neutral-400)] text-center mt-1">Demo QR — connect real auth in production</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)] mb-2">Recovery Codes</p>
              <div className="grid grid-cols-2 gap-1.5">
                {["8F2K-9XPQ", "3M7R-2WNT", "6B4H-5CYL", "1J9V-8ZUE"].map((code) => (
                  <code key={code} className="rounded-[6px] bg-white border border-[var(--gv-color-neutral-200)] px-2 py-1.5 text-[10px] font-mono text-[var(--gv-color-neutral-900)] text-center">{code}</code>
                ))}
              </div>
              <p className="text-[10px] text-[var(--gv-color-neutral-400)] mt-1.5">Save these codes in a safe place. Each can only be used once.</p>
            </div>
            <button onClick={() => { setEnabled(false); setShowQr(false); }}
              className="w-full rounded-[10px] border border-[#FCA5A5] py-2 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
              Disable 2FA
            </button>
          </div>
        )}
        {!enabled && (
          <div className="rounded-[12px] border border-dashed border-[var(--gv-color-neutral-200)] p-4 text-center">
            <p className="text-[12px] text-[var(--gv-color-neutral-400)]">2FA is currently <span className="font-semibold text-[#4A545B]">disabled</span>. Enable it above to protect your account.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionPanel() {
  const sessions = [
    { device: "MacBook Pro · Chrome", location: "Jakarta, ID", time: "Current session", current: true },
    { device: "iPhone 15 · Safari",   location: "Jakarta, ID", time: "2 hours ago",    current: false },
  ];
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Active Sessions</h3>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Devices currently signed into your account</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-2">
        {sessions.map((s) => (
          <div key={s.device} className={`rounded-[12px] border p-3.5 flex items-center justify-between gap-3 ${s.current ? "border-[#A8D5CF] bg-[var(--gv-color-primary-50)]" : "border-[var(--gv-color-neutral-200)] bg-white"}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[var(--gv-color-neutral-900)] truncate">{s.device}</p>
                {s.current && <span className="rounded-full bg-[var(--gv-color-primary-500)] px-1.5 py-0.5 text-[8px] font-bold text-white flex-shrink-0">Now</span>}
              </div>
              <p className="text-[11px] text-[var(--gv-color-neutral-400)] mt-0.5">{s.location} · {s.time}</p>
            </div>
            {!s.current && (
              <button className="flex-shrink-0 text-[11px] font-semibold text-[#DC2626] hover:text-[#B91C1C] transition-colors">Revoke</button>
            )}
          </div>
        ))}
        <div className="mt-4 rounded-[12px] border border-dashed border-[var(--gv-color-neutral-200)] p-3 text-center">
          <p className="text-[12px] text-[var(--gv-color-neutral-400)]">Revoking a session will sign that device out immediately.</p>
        </div>
      </div>
    </div>
  );
}

// ── Agent Config Center ────────────────────────────────────────────────────
function AgentConfigCenter({
  agentId, brandId, currentPlan, trainedModels, hiredAgent, onHired,
}: {
  agentId: AgentId; brandId: string; currentPlan: PlanId;
  trainedModels: TrainedModel[]; hiredAgent: HiredAgent | null;
  onHired: (a: HiredAgent) => void;
}) {
  const isPartner = currentPlan === "enterprise";
  const role = agentId.toUpperCase() as "CEO" | "CMO";
  const roleIcon = agentId === "ceo" ? "🧑‍💼" : "📣";

  const [personaName, setPersonaName] = useState(hiredAgent?.persona_name ?? "");
  const [personaTitle, setPersonaTitle] = useState(hiredAgent?.persona_title ?? "");
  const [description, setDescription] = useState(hiredAgent?.persona_description ?? "");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(hiredAgent?.profile_pic_url ?? null);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [mindsetFile, setMindsetFile] = useState<File | null>(null);
  const [skillsetFile, setSkillsetFile] = useState<File | null>(null);
  const [selectedChar, setSelectedChar] = useState<string | null>(hiredAgent?.anchor_character_url ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadStep, setUploadStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const profileRef = useRef<HTMLInputElement>(null);
  const datasetRef = useRef<HTMLInputElement>(null);
  const mindsetRef = useRef<HTMLInputElement>(null);
  const skillsetRef = useRef<HTMLInputElement>(null);

  // Reset form when agent changes
  useEffect(() => {
    setPersonaName(hiredAgent?.persona_name ?? "");
    setPersonaTitle(hiredAgent?.persona_title ?? "");
    setDescription(hiredAgent?.persona_description ?? "");
    setProfilePreview(hiredAgent?.profile_pic_url ?? null);
    setProfileFile(null); setDatasetFile(null); setMindsetFile(null); setSkillsetFile(null);
    setSelectedChar(hiredAgent?.anchor_character_url ?? null);
    setError(null); setSuccess(null);
  }, [agentId, hiredAgent]);

  const uploadJson = async (type: string, file: File): Promise<string> => {
    const path = `${brandId}/${role.toLowerCase()}-${type}-${Date.now()}.json`;
    const { error: upErr } = await supabase.storage.from("agent-datasets").upload(path, file, { upsert: true, contentType: "application/json" });
    if (upErr) throw new Error(`${type} upload failed: ${upErr.message}`);
    return supabase.storage.from("agent-datasets").getPublicUrl(path).data.publicUrl;
  };

  const handleSave = async () => {
    if (!personaName.trim()) { setError("Persona name is required"); return; }
    setSaving(true); setError(null);
    try {
      let profilePicUrl = hiredAgent?.profile_pic_url ?? null;
      let datasetUrl = hiredAgent?.dataset_url ?? null;
      let mindsetUrl = hiredAgent?.mindset_url ?? null;
      let skillsetUrl = hiredAgent?.skillset_url ?? null;

      if (profileFile) {
        setUploadStep("Uploading photo…");
        const ext = profileFile.name.split(".").pop();
        const path = `${brandId}/${role.toLowerCase()}-profile-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("agent-profiles").upload(path, profileFile, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        profilePicUrl = supabase.storage.from("agent-profiles").getPublicUrl(path).data.publicUrl;
      }
      if (datasetFile) { setUploadStep("Uploading dataset…"); datasetUrl = await uploadJson("dataset", datasetFile); }
      if (mindsetFile) { setUploadStep("Uploading mindset…"); mindsetUrl = await uploadJson("mindset", mindsetFile); }
      if (skillsetFile) { setUploadStep("Uploading skillset…"); skillsetUrl = await uploadJson("skillset", skillsetFile); }

      setUploadStep("Saving agent…");

      const payload = {
        brand_id: brandId, role, is_active: true,
        persona_name: personaName.trim(),
        persona_title: personaTitle.trim() || null,
        persona_description: description.trim() || null,
        profile_pic_url: profilePicUrl,
        dataset_url: datasetUrl, mindset_url: mindsetUrl, skillset_url: skillsetUrl,
        anchor_character_url: selectedChar ?? null,
        images_urls: hiredAgent?.images_urls ?? [],
      };

      let result;
      if (hiredAgent?.id) {
        const { data, error: updErr } = await supabase.from("gv_ai_agents").update(payload).eq("id", hiredAgent.id).select().single();
        if (updErr) throw new Error(updErr.message);
        result = data;
      } else {
        const { data, error: insErr } = await supabase.from("gv_ai_agents").insert({ ...payload, dataset_summary: null }).select().single();
        if (insErr) throw new Error(insErr.message);
        result = data;
      }

      onHired(result as HiredAgent);
      setSuccess(`${personaName} saved as ${role}!`);
      setProfileFile(null); setDatasetFile(null); setMindsetFile(null); setSkillsetFile(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save agent");
    } finally {
      setSaving(false); setUploadStep("");
    }
  };

  const FileRow = ({ label, hint, file, onClick }: { label: string; hint: string; file: File | null; onClick: () => void }) => (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl border border-dashed p-2.5 text-left transition-colors ${file ? "border-brand-400 bg-brand-50/40" : "border-[var(--gv-color-neutral-200)] hover:border-brand-400"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${file ? "bg-brand-100" : "bg-[#F3F4F6]"}`}>
        {file ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-500"><polyline points="20 6 9 17 4 12" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--gv-color-neutral-400)]">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#4A545B]">{label}</p>
        <p className={`text-[10px] truncate mt-0.5 ${file ? "text-brand-500" : "text-[var(--gv-color-neutral-400)]"}`}>
          {file ? file.name : hint}
        </p>
      </div>
      {!file && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#D1D5DB] flex-shrink-0">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{roleIcon}</span>
          <div>
            <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>
              Configure {role} Agent
            </h3>
            <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">
              {hiredAgent ? "Update your agent persona" : "Set up your AI agent persona"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-4">
        {error   && <div className="rounded-[10px] bg-[#FEF2F2] border border-[#FCA5A5] px-3 py-2 text-[12px] text-[#DC2626]">{error}</div>}
        {success && <div className="rounded-[10px] bg-[var(--gv-color-primary-50)] border border-[#A8D5CF] px-3 py-2 text-[12px] text-[var(--gv-color-primary-700)] font-medium">{success}</div>}

        {/* Profile photo */}
        <div>
          <label className="block text-[12px] font-semibold text-[#4A545B] mb-2">Profile Photo</label>
          <div onClick={() => profileRef.current?.click()}
            className="flex items-center gap-3 rounded-[12px] border border-dashed border-[var(--gv-color-neutral-200)] p-3 cursor-pointer hover:border-brand-400 transition-colors">
            {profilePreview ? (
              <Image src={profilePreview} alt="preview" width={44} height={44} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0 text-xl">{roleIcon}</div>
            )}
            <div>
              <p className="text-[12px] font-semibold text-[#4A545B]">{profileFile ? profileFile.name : "Upload photo"}</p>
              <p className="text-[10px] text-[var(--gv-color-neutral-400)]">JPG, PNG, WebP · max 5MB</p>
            </div>
          </div>
          <input ref={profileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProfileFile(f); setProfilePreview(URL.createObjectURL(f)); } }} />
        </div>

        {/* Persona info */}
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#4A545B] mb-1.5">Persona Name *</label>
            <input value={personaName} onChange={(e) => setPersonaName(e.target.value)}
              placeholder={agentId === "ceo" ? "e.g. Steve Jobs" : "e.g. Gary Vaynerchuk"}
              className="gv-input" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4A545B] mb-1.5">Title</label>
            <input value={personaTitle} onChange={(e) => setPersonaTitle(e.target.value)}
              placeholder={agentId === "ceo" ? "e.g. Visionary Co-founder · Apple" : "e.g. Digital Marketing Expert"}
              className="gv-input" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4A545B] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Describe the mindset and approach this persona brings…"
              className="gv-input resize-none" />
          </div>
        </div>

        {/* Training files */}
        <div>
          <label className="block text-[12px] font-semibold text-[#4A545B] mb-2">Training Files <span className="font-normal text-[var(--gv-color-neutral-400)]">(.json)</span></label>
          <div className="space-y-1.5">
            <FileRow label="Dataset" hint={hiredAgent?.dataset_url ? "Uploaded ✓" : "Training data · facts, Q&A, references"} file={datasetFile} onClick={() => datasetRef.current?.click()} />
            <FileRow label="Mindset" hint={hiredAgent?.mindset_url ? "Uploaded ✓" : "Thinking patterns · principles · worldview"} file={mindsetFile} onClick={() => mindsetRef.current?.click()} />
            <FileRow label="Skillset" hint={hiredAgent?.skillset_url ? "Uploaded ✓" : "Expertise · capabilities · domain knowledge"} file={skillsetFile} onClick={() => skillsetRef.current?.click()} />
          </div>
          <input ref={datasetRef}  type="file" accept="application/json,.json" className="hidden" onChange={(e) => setDatasetFile(e.target.files?.[0] ?? null)} />
          <input ref={mindsetRef}  type="file" accept="application/json,.json" className="hidden" onChange={(e) => setMindsetFile(e.target.files?.[0] ?? null)} />
          <input ref={skillsetRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => setSkillsetFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* Character selection (Partner only) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[12px] font-semibold text-[#4A545B]">Anchor Character</label>
            {!isPartner && (
              <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[9px] font-semibold text-[#C2410C]">Partner only</span>
            )}
          </div>
          {isPartner ? (
            trainedModels.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[var(--gv-color-neutral-200)] p-4 text-center">
                <p className="text-[12px] text-[var(--gv-color-neutral-400)]">No trained characters yet. Train a character in Content Studio first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {trainedModels.map((m) => {
                  const isSelected = selectedChar === (m.metadata?.lora_model ?? m.id);
                  return (
                    <button key={m.id} type="button"
                      onClick={() => setSelectedChar(isSelected ? null : (m.metadata?.lora_model ?? m.id))}
                      className={`rounded-[12px] border p-2.5 text-left transition-all ${isSelected ? "border-brand-400 bg-brand-50/40" : "border-[var(--gv-color-neutral-200)] hover:border-brand-300"}`}>
                      <p className="text-[12px] font-semibold text-[var(--gv-color-neutral-900)] truncate">{m.dataset_name}</p>
                      <p className="text-[10px] text-[var(--gv-color-neutral-400)] truncate mt-0.5">{m.theme}</p>
                      {isSelected && <p className="text-[9px] font-semibold text-brand-500 mt-1">Selected</p>}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="rounded-[12px] border border-dashed border-[var(--gv-color-neutral-200)] p-4 text-center opacity-50 pointer-events-none">
              <p className="text-[12px] text-[var(--gv-color-neutral-400)]">Upgrade to Partner to assign a trained character to this agent.</p>
            </div>
          )}
        </div>

        {saving && uploadStep && <p className="text-[10px] text-brand-500 text-center">{uploadStep}</p>}
      </div>

      <div className="flex-shrink-0 px-5 py-4 border-t border-[var(--gv-color-neutral-100)]">
        <button onClick={handleSave} disabled={saving || !personaName.trim()}
          className="gv-btn-primary w-full disabled:opacity-60">
          {saving ? "Saving…" : hiredAgent ? `Update ${role} Agent` : `Hire as ${role}`}
        </button>
      </div>
    </div>
  );
}

// ── Main HomePage ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<HomeTab>("profile");
  const [profileSub, setProfileSub] = useState<ProfileSub>("brand_dna");
  const [billingSub, setBillingSub] = useState<BillingSub>("plan");
  const [securitySub, setSecuritySub] = useState<SecuritySub>("password");
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>("ceo");
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("basic");
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // Brand / auth state
  const [brandId, setBrandId] = useState<string>(FALLBACK_BRAND_ID);
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [currentPlan, setCurrentPlan] = useState<PlanId>("basic");
  const [billingYearly, setBillingYearly] = useState(false);

  // Connect state
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [replyEnabled, setReplyEnabled] = useState<Record<string, boolean>>({ instagram: true });
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Agent state
  const [hiredAgents, setHiredAgents] = useState<HiredAgent[]>([]);
  const [trainedModels, setTrainedModels] = useState<TrainedModel[]>([]);

  const billingCycle: "monthly" | "yearly" = billingYearly ? "yearly" : "monthly";
  const connectedCount = platforms.filter((p) => p.connected).length;
  const isAccessible = (p: Platform) => planOrder[p.plan] <= planOrder[CONNECT_PLAN];
  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId)!;

  const selectedAgent = selectedAgentId === "ceo" ? CEO_AGENT : CMO_AGENT;
  const hiredAgent = hiredAgents.find((h) => h.role === selectedAgentId.toUpperCase()) ?? null;

  // Load on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.opener && window.location.search.includes("oauth_done=1")) {
      window.opener.postMessage({ type: "gv_oauth_done" }, window.location.origin);
      window.close();
      return;
    }

    const resolveBrandId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        setUserEmail(user.email ?? "");
        setUserName(user.user_metadata?.full_name ?? user.email ?? "");
        const { data: ub } = await supabase.from("user_brands").select("brand_id")
          .eq("user_id", user.id).order("created_at", { ascending: true }).limit(1).single();
        if (ub?.brand_id) {
          setBrandId(ub.brand_id);
          try {
            const res = await fetch("/api/payment", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "get_subscription", brand_id: ub.brand_id }),
            });
            const subData = await res.json();
            if (subData.success) {
              const tier = subData.brand_payment?.subscription_tier as string | undefined;
              const planId: PlanId = tier === "partner" ? "enterprise" : (tier as PlanId) ?? "basic";
              setCurrentPlan(planId);
              setSelectedPlanId(planId);
            }
          } catch { /* keep defaults */ }
        }
      } catch { /* keep fallback */ }
    };
    resolveBrandId();

    const handleOAuthMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "gv_oauth_done") setTimeout(() => refreshStatus(), 1500);
    };
    window.addEventListener("message", handleOAuthMessage);

    const pendingId = sessionStorage.getItem(SS_PENDING);
    if (pendingId) {
      sessionStorage.removeItem(SS_PENDING);
      setPlatforms((prev) => {
        const updated = prev.map((p) => (p.id === pendingId ? { ...p, connected: true } : p));
        saveLS(updated);
        setSaveToast(`✅ ${updated.find(p => p.id === pendingId)?.name || pendingId} connected!`);
        setTimeout(() => setSaveToast(null), 4000);
        return updated;
      });
    }

    const saved = loadLS();
    if (saved.size > 0) setPlatforms((prev) => prev.map((p) => ({ ...p, connected: saved.has(p.id) })));
    refreshStatus();
    return () => window.removeEventListener("message", handleOAuthMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load hired agents + trained models when brandId resolves
  useEffect(() => {
    if (!brandId) return;
    const load = async () => {
      const [{ data: agentData }, { data: modelData }] = await Promise.all([
        supabase.from("gv_ai_agents").select("*").eq("brand_id", brandId).eq("is_active", true).in("role", ["CEO", "CMO"]),
        supabase.from("gv_trained_models").select("id, dataset_name, theme, training_status, model_path, metadata").eq("brand_id", brandId).eq("training_status", "completed"),
      ]);
      if (agentData) setHiredAgents(agentData as HiredAgent[]);
      if (modelData) setTrainedModels(modelData as TrainedModel[]);
    };
    load();
  }, [brandId]);

  const refreshStatus = async () => {
    try {
      const { data: conns, error } = await supabase.from("social_connections")
        .select("platform, platform_username").eq("brand_id", brandId).eq("status", "active");
      if (error || !conns) return;
      const connectedPlatforms = new Set(conns.map((c) => c.platform as string));
      setPlatforms((prev) => {
        const updated = prev.map((p) => ({
          ...p, connected: connectedPlatforms.has(p.id),
          handle: conns.find((c) => c.platform === p.id)?.platform_username || p.handle,
        }));
        saveLS(updated);
        return updated;
      });
    } catch { /* silently fail */ }
  };

  const handleToggleConnect = async (id: string) => {
    const platform = platforms.find((p) => p.id === id);
    if (!platform) return;
    if (!platform.connected) {
      try {
        const latePlatform = LATE_PLATFORM[id] || id;
        const res = await fetch(`${SUPABASE_FN_URL}/social-connect?platform=${latePlatform}&brand_id=${brandId}`);
        const data = await res.json() as { auth_url?: string; error?: string };
        if (data.auth_url) {
          const popup = window.open(data.auth_url, "oauth_connect", "width=600,height=700,left=200,top=100,noopener=0");
          if (popup) {
            const poll = setInterval(() => {
              if (popup.closed) {
                clearInterval(poll);
                setTimeout(async () => { await refreshStatus(); setSaveToast(`✅ ${platform.name} — checking connection…`); setTimeout(() => setSaveToast(null), 3000); }, 1500);
              }
            }, 600);
          } else {
            sessionStorage.setItem(SS_PENDING, id);
            window.location.href = data.auth_url;
          }
          return;
        } else {
          setSaveToast(`❌ Failed to connect ${platform.name}: ${data.error || "unknown error"}`);
          setTimeout(() => setSaveToast(null), 4000);
        }
      } catch {
        setSaveToast(`❌ Connection error for ${platform.name}`);
        setTimeout(() => setSaveToast(null), 4000);
      }
    } else {
      setPlatforms((prev) => { const updated = prev.map((p) => (p.id === id ? { ...p, connected: false } : p)); saveLS(updated); return updated; });
    }
  };
  const handleToggleReply = (id: string) => setReplyEnabled((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Left columns ────────────────────────────────────────────────
  const profileLeft = (
    <NavColumn>
      <div className="px-1 mb-4">
        <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--gv-color-neutral-800)" }}>Profile</h3>
        <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Manage your brand identity</p>
      </div>
      <div className="space-y-1">
        <NavItem icon={<BrandIcon className="w-4 h-4" />} label="Brand DNA" sub="Story · Values · Voice"
          active={profileSub === "brand_dna"} onClick={() => { setProfileSub("brand_dna"); setMobileRightOpen(true); }} />
        <NavItem icon={<UserIcon className="w-4 h-4" />} label="Detail" sub="Info · Edit brand details"
          active={profileSub === "detail"} onClick={() => { setProfileSub("detail"); setMobileRightOpen(true); }} />
        <NavItem icon={<PlugInIcon className="w-4 h-4" />} label="Connect" sub={`${connectedCount} of ${platforms.length} connected`}
          active={profileSub === "connect"} onClick={() => { setProfileSub("connect"); setMobileRightOpen(true); }} />
      </div>
    </NavColumn>
  );

  const billingLeft = (
    <NavColumn>
      <div className="px-1 mb-4">
        <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--gv-color-neutral-800)" }}>Billing</h3>
        <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Subscription &amp; payments</p>
      </div>
      <div className="space-y-1">
        <NavItem icon={<ShootingStarIcon className="w-4 h-4" />} label="Plan" sub="Subscription · Upgrade"
          active={billingSub === "plan"} onClick={() => { setBillingSub("plan"); setMobileRightOpen(true); }} />
        <NavItem icon={<DollarLineIcon className="w-4 h-4" />} label="Payment" sub="Xendit · IDR · Invoices"
          active={billingSub === "payment"} onClick={() => { setBillingSub("payment"); setMobileRightOpen(true); }} />
      </div>
    </NavColumn>
  );

  const securityLeft = (
    <NavColumn>
      <div className="px-1 mb-4">
        <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--gv-color-neutral-800)" }}>Security</h3>
        <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Account security settings</p>
      </div>
      <div className="space-y-1">
        <NavItem icon={<LockIcon className="w-4 h-4" />} label="Reset Password" sub="Change your password"
          active={securitySub === "password"} onClick={() => { setSecuritySub("password"); setMobileRightOpen(true); }} />
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
          label="Two-Factor Auth" sub="2FA · Authenticator app"
          active={securitySub === "twofa"} onClick={() => { setSecuritySub("twofa"); setMobileRightOpen(true); }} />
        <NavItem
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
          label="Sessions" sub="Active devices · Revoke"
          active={securitySub === "session"} onClick={() => { setSecuritySub("session"); setMobileRightOpen(true); }} />
      </div>
    </NavColumn>
  );

  const agentLeft = (
    <NavColumn>
      <div className="px-1 mb-4">
        <h3 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "var(--gv-color-neutral-800)" }}>AI Agents</h3>
        <p className="text-xs mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Configure your AI team</p>
      </div>
      <div className="space-y-1">
        {(["ceo", "cmo"] as AgentId[]).map((id) => {
          const agent = id === "ceo" ? CEO_AGENT : CMO_AGENT;
          const hired = hiredAgents.find((h) => h.role === id.toUpperCase());
          return (
            <NavItem
              key={id}
              icon={<span className="text-base leading-none">{agent.icon}</span>}
              label={agent.name}
              sub={hired ? hired.persona_name : "Not configured"}
              active={selectedAgentId === id}
              onClick={() => { setSelectedAgentId(id); setMobileRightOpen(true); }}
            />
          );
        })}
      </div>
    </NavColumn>
  );

  // ── Center columns ───────────────────────────────────────────────
  const profileCenter = (
    <div className="h-full overflow-hidden">
      {profileSub === "brand_dna" && (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
            <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Brand DNA</h3>
            <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Your brand&apos;s story, values, and voice</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5 space-y-4">
            <div className="rounded-[14px] bg-[var(--gv-color-neutral-50)] border border-[var(--gv-color-neutral-100)] p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">Brand Story</p>
              <p className="text-[13px] text-[#4A545B] leading-relaxed">
                GeoVera is a marketing intelligence platform built for modern brands navigating the complexity of multi-channel digital growth. Rooted in Jakarta&apos;s vibrant startup ecosystem, GeoVera blends AI-driven automation with human-centric brand storytelling.
              </p>
              <p className="text-[13px] text-[var(--gv-color-neutral-500)] leading-relaxed">
                At its core, GeoVera believes that every brand has a unique story worth telling — and that the right intelligence layer can amplify that story across every platform, every audience, and every moment that matters.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Brand Voice", value: "Bold · Intelligent · Accessible" },
                { label: "Target Audience", value: "Founders · CMOs · Digital marketers" },
                { label: "Core Values", value: "Innovation · Clarity · Results" },
                { label: "Positioning", value: "AI-Powered Intelligence for Growth" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-[12px] border border-[var(--gv-color-neutral-200)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gv-color-neutral-400)]">{label}</p>
                  <p className="text-[12px] text-[var(--gv-color-neutral-900)] font-medium mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {profileSub === "detail" && <BrandEditPanel />}
      {profileSub === "connect" && (
        <ConnectAllPanel
          platforms={platforms} replyEnabled={replyEnabled}
          isAccessible={isAccessible}
          onToggleConnect={handleToggleConnect}
          onToggleReply={handleToggleReply}
        />
      )}
    </div>
  );

  const billingCenter = (
    <div className="h-full overflow-hidden">
      {billingSub === "plan" && (
        <SubscriptionPanel
          selectedPlanId={selectedPlanId}
          onSelectPlan={(id) => { setSelectedPlanId(id); setMobileRightOpen(true); }}
          currentPlan={currentPlan}
          billingYearly={billingYearly}
          onBillingChange={setBillingYearly}
        />
      )}
      {billingSub === "payment" && <BillingPanel brandId={brandId} />}
    </div>
  );

  const securityCenter = (
    <div className="h-full overflow-hidden">
      {securitySub === "password" && <PasswordPanel />}
      {securitySub === "twofa"    && <TwoFAPanel />}
      {securitySub === "session"  && <SessionPanel />}
    </div>
  );

  const agentCenter = (
    <AgentConfigCenter
      agentId={selectedAgentId}
      brandId={brandId}
      currentPlan={currentPlan}
      trainedModels={trainedModels}
      hiredAgent={hiredAgent}
      onHired={(a) => {
        setHiredAgents((prev) => {
          const idx = prev.findIndex((h) => h.role === a.role);
          return idx >= 0 ? prev.map((h, i) => (i === idx ? a : h)) : [...prev, a];
        });
      }}
    />
  );

  // ── Right columns ────────────────────────────────────────────────
  const profileRight = (
    <>
      {profileSub === "brand_dna" && <BrandEditPanel />}
      {profileSub === "detail"    && <DesignAssetsEditPanel />}
      {profileSub === "connect"   && (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
            <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Connected</h3>
            <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">{connectedCount} of {platforms.length} platforms active</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-2">
            {platforms.filter(p => p.connected).length === 0 ? (
              <p className="text-[12px] text-[var(--gv-color-neutral-400)] text-center py-8">No platforms connected yet</p>
            ) : (
              platforms.filter(p => p.connected).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-[12px] border border-[#A8D5CF] bg-[var(--gv-color-primary-50)] px-3 py-2.5">
                  <PlatformIcon id={p.id} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--gv-color-neutral-900)]">{p.name}</p>
                    {p.handle && <p className="text-[11px] text-[var(--gv-color-neutral-400)]">@{p.handle}</p>}
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--gv-color-primary-700)] bg-[#C6E3DF] rounded-full px-2 py-0.5">Connected</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );

  const billingRight = (
    <>
      {billingSub === "plan" && (
        <PlanDetailPanel
          plan={selectedPlan} currentPlan={currentPlan}
          brandId={brandId} userId={userId}
          userEmail={userEmail} userName={userName}
          billingCycle={billingCycle}
        />
      )}
      {billingSub === "payment" && (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
            <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Xendit Payment</h3>
            <p className="text-[12px] text-[var(--gv-color-neutral-400)] mt-0.5">Secure payment gateway · IDR</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
            {[
              { label: "Gateway", value: "Xendit", icon: "🔒" },
              { label: "Currency", value: "IDR (Indonesian Rupiah)", icon: "🇮🇩" },
              { label: "Methods", value: "Bank Transfer · VA · QRIS · Cards", icon: "💳" },
              { label: "Security", value: "PCI-DSS compliant · Encrypted", icon: "🛡️" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-[12px] border border-[var(--gv-color-neutral-200)] p-3 flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-[11px] font-semibold text-[var(--gv-color-neutral-400)] uppercase tracking-wider">{label}</p>
                  <p className="text-[13px] text-[var(--gv-color-neutral-900)] font-medium mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const securityRight = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-[var(--gv-color-neutral-100)] px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FEE2E2]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#DC2626]">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 className="text-[16px] font-bold text-[var(--gv-color-neutral-900)]" style={{ fontFamily: "Georgia, serif" }}>Security Tips</h3>
        </div>
        <p className="text-[12px] text-[var(--gv-color-neutral-400)]">Keep your account safe</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
        {[
          { title: "Use a strong password", desc: "At least 12 characters with letters, numbers, and symbols.", color: "#EDF5F4", border: "#A8D5CF", text: "#3D6562" },
          { title: "Enable Two-Factor Auth", desc: "2FA adds a critical second layer of protection to your account.", color: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
          { title: "Review active sessions", desc: "Regularly check and revoke any sessions you don't recognize.", color: "#FFF7ED", border: "#FCD34D", text: "#B45309" },
          { title: "Never share credentials", desc: "Your password and 2FA codes should never be shared with anyone.", color: "#FEF2F2", border: "#FCA5A5", text: "#DC2626" },
        ].map((tip) => (
          <div key={tip.title} className="rounded-[12px] border p-3" style={{ background: tip.color, borderColor: tip.border }}>
            <p className="text-[13px] font-semibold" style={{ color: tip.text }}>{tip.title}</p>
            <p className="text-[12px] mt-0.5" style={{ color: tip.text, opacity: 0.8 }}>{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const agentRight = (
    <AgentDetailCard agent={selectedAgent} hiredAgent={hiredAgent} brandId={brandId} />
  );

  // ── Render ───────────────────────────────────────────────────────
  const leftCol  = activeTab === "profile" ? profileLeft  : activeTab === "billing" ? billingLeft  : activeTab === "security" ? securityLeft  : agentLeft;
  const centerCol = activeTab === "profile" ? profileCenter : activeTab === "billing" ? billingCenter : activeTab === "security" ? securityCenter : agentCenter;
  const rightCol  = activeTab === "profile" ? profileRight  : activeTab === "billing" ? billingRight  : activeTab === "security" ? securityRight  : agentRight;

  return (
    <div className="flex flex-col h-full">
      {saveToast && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-[12px] px-4 py-3 text-[13px] font-medium shadow-lg ${
          saveToast.startsWith("✅") ? "bg-[var(--gv-color-primary-50)] text-[var(--gv-color-primary-700)] border border-[#A8D5CF]" : "bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5]"
        }`}>
          {saveToast}
        </div>
      )}

      {/* ── Three-column layout ── */}
      <div className="flex-1 min-h-0">
        <ThreeColumnLayout
          left={leftCol}
          center={centerCol}
          right={rightCol}
          mobileRightOpen={mobileRightOpen}
          onMobileBack={() => setMobileRightOpen(false)}
          mobileBackLabel="Home"
        />
      </div>

      {/* ── Bottom tab bar — outside columns ── */}
      <nav
        className="flex-shrink-0 flex justify-center pt-0 pb-4"
        style={{ background: "var(--gv-color-bg-base)" }}
      >
        <BottomHomeTab
          active={activeTab}
          onSelect={(t) => {
            setActiveTab(t);
            setMobileRightOpen(false);
          }}
        />
      </nav>
    </div>
  );
}
