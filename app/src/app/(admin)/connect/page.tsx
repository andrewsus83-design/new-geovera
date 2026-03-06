"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import type { Platform } from "@/components/connect/PlatformList";
import PlatformFeatures from "@/components/connect/PlatformFeatures";
import PlatformIcon from "@/components/shared/PlatformIcon";
import { supabase } from "@/lib/supabase";

// ── Config ───────────────────────────────────────────────────────────────────
const META_APP_ID       = process.env.NEXT_PUBLIC_META_APP_ID || "2433287687103599";
const META_REDIRECT_URI = process.env.NEXT_PUBLIC_META_REDIRECT_URI || "https://vozjwptzutolvkvfpknk.supabase.co/functions/v1/meta-oauth-callback";
const DEMO_BRAND_ID     = process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";
const DEMO_USER_ID      = process.env.NEXT_PUBLIC_DEMO_USER_ID || "deea702c-8e84-4cc1-a712-5d1a6062d1be";
const TIKTOK_CLIENT_KEY = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY || "";
const TIKTOK_REDIRECT_URI = process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI || "https://report.geovera.xyz/api/tiktok/callback";

const META_SCOPE = [
  "instagram_manage_comments",
  "instagram_basic",
  "pages_manage_engagement",
  "pages_read_engagement",
  "pages_show_list",
].join(",");

const CURRENT_PLAN = "premium";
const planOrder: Record<string, number> = { basic: 0, premium: 1, enterprise: 2 };
const planLabel: Record<string, string> = { basic: "Basic", premium: "Premium", enterprise: "Enterprise" };

const MIN_PLATFORMS_FOR_BASIC = 3;

const DEFAULT_PLATFORMS: Platform[] = [
  { id: "instagram", name: "Instagram",      icon: "📸", connected: false, plan: "basic" },
  { id: "facebook",  name: "Facebook Page",  icon: "📘", connected: false, plan: "basic" },
  { id: "reels",     name: "Reels",          icon: "🎬", connected: false, plan: "premium" },
  { id: "tiktok",    name: "TikTok",         icon: "🎵", connected: false, plan: "premium" },
  { id: "x",         name: "X (Twitter)",    icon: "𝕏",  connected: false, plan: "basic" },
  { id: "blog",      name: "Blog",           icon: "✍️", connected: false, plan: "basic" },
  { id: "linkedin",  name: "LinkedIn",       icon: "💼", connected: false, plan: "premium" },
  { id: "youtube-shorts", name: "YouTube Shorts", icon: "▶️", connected: false, plan: "premium" },
  { id: "youtube-video",  name: "YouTube Video",  icon: "🎥", connected: false, plan: "enterprise" },
];

// ── Meta OAuth URL builder ────────────────────────────────────────────────────
function buildMetaOAuthUrl(brandId: string, userId: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", META_REDIRECT_URI);
  url.searchParams.set("state", `${brandId}:${userId}`);
  url.searchParams.set("scope", META_SCOPE);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

// ── TikTok PKCE OAuth URL builder ────────────────────────────────────────────
async function buildTikTokOAuthUrl(brandId: string): Promise<string> {
  // Generate PKCE code_verifier + code_challenge
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  // Embed verifier in state so the server-side callback can do the PKCE exchange
  // Format: "{brandId}:{source}:{verifier}"
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", TIKTOK_CLIENT_KEY);
  url.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", TIKTOK_REDIRECT_URI);
  url.searchParams.set("state", `${brandId}:connect:${verifier}`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ── Inner component (uses useSearchParams) ────────────────────────────────────
function ConnectPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [platforms, setPlatforms] = useState<Platform[]>(DEFAULT_PLATFORMS);
  const [replyEnabled, setReplyEnabled] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState("instagram");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load real connections from Supabase ──────────────────────────────────
  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data: connections } = await supabase
        .from("social_connections")
        .select("platform, platform_account_id, platform_username, platform_name, status, auto_reply_enabled")
        .eq("brand_id", DEMO_BRAND_ID)
        .eq("status", "active");

      if (connections && connections.length > 0) {
        const connectedPlatformIds = new Set(connections.map((c) => c.platform));
        const replyState: Record<string, boolean> = {};

        setPlatforms((prev) =>
          prev.map((p) => {
            const conn = connections.find((c) => c.platform === p.id);
            if (conn) {
              replyState[p.id] = conn.auto_reply_enabled ?? false;
              return {
                ...p,
                connected: true,
                handle: conn.platform_username || conn.platform_name || undefined,
              };
            }
            return { ...p, connected: false, handle: undefined };
          })
        );

        setReplyEnabled(replyState);
        // Select the first connected platform if available
        const firstConnected = connections[0]?.platform;
        if (firstConnected) setSelectedId(firstConnected);
      }
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handle OAuth callback result from URL params ──────────────────────────
  useEffect(() => {
    const success        = searchParams.get("success");
    const error          = searchParams.get("error");
    const connected      = searchParams.get("connected");
    const tiktokConnected = searchParams.get("tiktok_connected");

    if (tiktokConnected === "true") {
      setToast({ type: "success", msg: "✅ TikTok connected successfully!" });
      router.replace("/connect");
      loadConnections();
    } else if (success === "true") {
      const connectedList = connected?.split(",").join(", ") || "account";
      setToast({ type: "success", msg: `✅ Connected: ${connectedList}` });
      // Clean URL
      router.replace("/connect");
      // Reload connections
      loadConnections();
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:         "Access denied — you cancelled the connection.",
        missing_params:        "Connection failed — missing parameters.",
        invalid_state:         "Connection failed — invalid state.",
        token_exchange_failed: "Connection failed — could not exchange token.",
        long_token_failed:     "Connection failed — could not get long-lived token.",
        server_error:          "Connection failed — server error. Try again.",
      };
      setToast({ type: "error", msg: `❌ ${messages[error] || "Connection failed."}` });
      router.replace("/connect");
    } else {
      loadConnections();
    }
  }, [searchParams, router, loadConnections]);

  // Auto-hide toast after 5s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Connect / Disconnect logic ─────────────────────────────────────────────
  const handleToggleConnect = async (id: string) => {
    const platform = platforms.find((p) => p.id === id);
    if (!platform) return;

    // Meta platforms (Instagram + Facebook) → real OAuth
    if ((id === "instagram" || id === "facebook") && !platform.connected) {
      setConnecting(true);
      const oauthUrl = buildMetaOAuthUrl(DEMO_BRAND_ID, DEMO_USER_ID);
      window.location.href = oauthUrl;
      return;
    }

    // Disconnect from real Meta connection
    if ((id === "instagram" || id === "facebook") && platform.connected) {
      try {
        await supabase
          .from("social_connections")
          .update({ status: "disconnected" })
          .eq("brand_id", DEMO_BRAND_ID)
          .eq("platform", id);

        setPlatforms((prev) =>
          prev.map((p) => (p.id === id ? { ...p, connected: false, handle: undefined } : p))
        );
        setToast({ type: "success", msg: `Disconnected ${platform.name}` });
      } catch {
        setToast({ type: "error", msg: "Failed to disconnect. Try again." });
      }
      return;
    }

    // TikTok → real PKCE OAuth if client key configured, else mock toggle
    if (id === "tiktok") {
      if (!platform.connected && TIKTOK_CLIENT_KEY) {
        // Real OAuth
        setConnecting(true);
        try {
          const oauthUrl = await buildTikTokOAuthUrl(DEMO_BRAND_ID);
          window.location.href = oauthUrl;
        } catch {
          setConnecting(false);
          setToast({ type: "error", msg: "Failed to build TikTok OAuth URL." });
        }
        return;
      }
      // Mock toggle (no client key yet) — user can Save manually
      setPlatforms((prev) =>
        prev.map((p) => (p.id === "tiktok" ? { ...p, connected: !p.connected } : p))
      );
      setHasUnsaved(true);
      return;
    }

    // Other platforms — mock toggle + mark unsaved
    setPlatforms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, connected: !p.connected } : p))
    );
    setHasUnsaved(true);
  };

  // ── Save all toggled connections to Supabase ───────────────────────────────
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      // Upsert all non-Meta connected platforms (Meta is handled via real OAuth)
      const mockPlatforms = platforms.filter(
        (p) => p.connected && p.id !== "instagram" && p.id !== "facebook"
      );
      const disconnectedMock = platforms.filter(
        (p) => !p.connected && p.id !== "instagram" && p.id !== "facebook"
      );

      // Upsert connected
      for (const p of mockPlatforms) {
        await supabase.from("social_connections").upsert(
          {
            brand_id:            DEMO_BRAND_ID,
            platform:            p.id,
            platform_account_id: `demo_${p.id}_user`,
            platform_username:   `geovera_${p.id}`,
            status:              "active",
            connected_at:        now,
            updated_at:          now,
          },
          { onConflict: "brand_id,platform" }
        );
      }

      // Mark disconnected
      for (const p of disconnectedMock) {
        await supabase
          .from("social_connections")
          .update({ status: "disconnected", updated_at: now })
          .eq("brand_id", DEMO_BRAND_ID)
          .eq("platform", p.id);
      }

      setHasUnsaved(false);
      const names = mockPlatforms.map((p) => p.name).join(", ") || "connections";
      setToast({ type: "success", msg: `✅ Saved: ${names}` });
    } catch {
      setToast({ type: "error", msg: "Failed to save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-reply toggle ──────────────────────────────────────────────────────
  const handleToggleReply = async (id: string) => {
    const platform = platforms.find((p) => p.id === id);
    if (!platform?.connected) return;

    const newVal = !replyEnabled[id];
    setReplyEnabled((prev) => ({ ...prev, [id]: newVal }));

    // Persist to DB if it's a real Meta connection
    if (id === "instagram" || id === "facebook") {
      await supabase
        .from("social_connections")
        .update({ auto_reply_enabled: newVal })
        .eq("brand_id", DEMO_BRAND_ID)
        .eq("platform", id);
    }
  };

  const isAccessible = (platform: Platform) =>
    planOrder[platform.plan] <= planOrder[CURRENT_PLAN];

  const connectedCount = platforms.filter((p) => p.connected).length;
  const selectedPlatform = platforms.find((p) => p.id === selectedId) || platforms[0];

  // ── Left column ────────────────────────────────────────────────────────────
  const left = (
    <NavColumn>
      <h3
        className="text-sm font-semibold text-gray-900 dark:text-white px-1"
        style={{ fontFamily: "Georgia, serif" }}
      >
        Connect
      </h3>
      <p className="text-xs text-gray-400 px-1 mt-1">
        Manage your connected platforms and auto-reply settings.
      </p>
    </NavColumn>
  );

  // ── Center column ──────────────────────────────────────────────────────────
  const center = (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/30"
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div>
        {/* Deep Research Requirement Banner */}
        {!loading && (
          <div
            className="mb-4 rounded-[14px] px-4 py-3"
            style={{
              background: connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#F0FDF4" : "#FFFBEB",
              border: `1.5px solid ${connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#BBF7D0" : "#FDE68A"}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold uppercase tracking-widest"
                style={{ color: connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#16A34A" : "#D97706" }}>
                {connectedCount >= MIN_PLATFORMS_FOR_BASIC
                  ? "✓ Deep Research Ready"
                  : "⚡ Deep Research Requirement"}
              </p>
              <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5"
                style={{
                  background: connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#DCFCE7" : "#FEF3C7",
                  color: connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#16A34A" : "#D97706",
                }}>
                {connectedCount} / {MIN_PLATFORMS_FOR_BASIC} min
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-white/60 overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((connectedCount / MIN_PLATFORMS_FOR_BASIC) * 100, 100)}%`,
                  background: connectedCount >= MIN_PLATFORMS_FOR_BASIC
                    ? "linear-gradient(90deg, #16A34A, #22C55E)"
                    : "linear-gradient(90deg, #F59E0B, #FCD34D)",
                }}
              />
            </div>
            <p className="text-[12px]" style={{ color: connectedCount >= MIN_PLATFORMS_FOR_BASIC ? "#15803D" : "#92400E" }}>
              {connectedCount >= MIN_PLATFORMS_FOR_BASIC
                ? "Semua tier plan siap menggunakan Deep Research GeoVera."
                : `Plan Basic memerlukan minimal ${MIN_PLATFORMS_FOR_BASIC} platform terhubung agar Deep Research berjalan maksimal. Hubungkan ${MIN_PLATFORMS_FOR_BASIC - connectedCount} platform lagi.`}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/10 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600 dark:text-blue-400">
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Social Media</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {loading ? "Loading…" : `${connectedCount} connected · ${platforms.length} platforms`}
              </p>
            </div>
          </div>
          {/* Column labels */}
          <div className="flex items-center gap-5 pr-1">
            <span className="text-[10px] font-medium text-gray-400 w-9 text-center">Connect</span>
            <span className="text-[10px] font-medium text-gray-400 w-9 text-center">Reply</span>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-1 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          /* Platform rows */
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {platforms.map((platform) => {
              const accessible = isAccessible(platform);
              const isSelected = selectedId === platform.id;
              const isConnected = platform.connected;
              const replyOn = replyEnabled[platform.id] ?? false;
              const isMetaPlatform = platform.id === "instagram" || platform.id === "facebook";

              return (
                <div
                  key={platform.id}
                  onClick={() => setSelectedId(platform.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-brand-50/40 dark:bg-brand-500/5"
                      : accessible
                      ? "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      : "opacity-50"
                  }`}
                >
                  {/* Icon */}
                  <span className="flex-shrink-0" style={{ opacity: accessible ? 1 : 0.4, filter: accessible ? "none" : "grayscale(1)" }}>
                    <PlatformIcon id={platform.id} size={22} />
                  </span>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium leading-none ${accessible ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"}`}>
                        {platform.name}
                      </p>
                      {!accessible && (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-medium text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                          {planLabel[platform.plan]}+
                        </span>
                      )}
                      {isConnected && accessible && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                          Connected
                        </span>
                      )}
                      {isMetaPlatform && !isConnected && accessible && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          via Meta
                        </span>
                      )}
                    </div>
                    {platform.handle && accessible && (
                      <p className="text-[10px] text-gray-400 mt-0.5">@{platform.handle}</p>
                    )}
                    {!accessible && (
                      <p className="text-[10px] text-orange-500 mt-0.5">Upgrade to {planLabel[platform.plan]}</p>
                    )}
                    {isMetaPlatform && !isConnected && accessible && (
                      <p className="text-[10px] text-blue-400 mt-0.5">Click Connect to link via Facebook Login</p>
                    )}
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {accessible ? (
                      <>
                        {/* Connect toggle */}
                        <button
                          onClick={() => handleToggleConnect(platform.id)}
                          disabled={connecting}
                          title={isMetaPlatform ? (isConnected ? "Disconnect" : "Connect via Meta OAuth") : undefined}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            isConnected ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                          } ${connecting ? "opacity-50 cursor-wait" : ""}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${isConnected ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>

                        {/* Reply toggle */}
                        <button
                          onClick={() => handleToggleReply(platform.id)}
                          disabled={!isConnected}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            replyOn && isConnected ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${replyOn && isConnected ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </>
                    ) : (
                      /* Lock icon */
                      <div className="flex items-center gap-5">
                        <div className="w-9 flex justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 dark:text-gray-600">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </div>
                        <div className="w-9" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Meta info footer */}
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            <span className="font-medium text-gray-500 dark:text-gray-400">📘 Instagram & Facebook</span> are connected via Meta Login — one click connects both platforms. Your page tokens are stored securely and never expire.
          </p>
        </div>

        {/* Save button */}
        <div className="mt-4">
          <button
            onClick={handleSaveChanges}
            disabled={saving || !hasUnsaved}
            className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              hasUnsaved
                ? "bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
                : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
            } disabled:opacity-60`}
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {hasUnsaved ? "Save Changes" : "No changes"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const right = <PlatformFeatures platform={selectedPlatform} onConnect={handleToggleConnect} />;

  return <ThreeColumnLayout left={left} center={center} right={right} />;
}

// ── Export with Suspense boundary (required for useSearchParams) ──────────────
export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <ConnectPageInner />
    </Suspense>
  );
}
