"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ══════════════════════════════════════════════════════════════════
   /onboarding — Brand Profile Setup (6-step multi-step form)
   DS v5.8 full-bleed
══════════════════════════════════════════════════════════════════ */

const COUNTRIES = [
  "Indonesia", "Malaysia", "Singapore", "Thailand", "Philippines",
  "Vietnam", "Myanmar", "Cambodia", "Brunei", "Laos",
  "Australia", "India", "Japan", "South Korea", "China",
  "United States", "United Kingdom", "Germany", "France", "Netherlands",
  "Canada", "Brazil", "Mexico", "UAE", "Saudi Arabia", "Other",
];

interface FormData {
  brand_name: string;
  website_url: string;
  instagram_handle: string;
  tiktok_handle: string;
  country: string;
  whatsapp_number: string;
}

const STEPS = [
  {
    id: "brand_name",
    step: 1,
    icon: "🏷️",
    title: "Nama Brand kamu?",
    subtitle: "Nama resmi brand atau bisnis yang akan kamu kelola.",
    placeholder: "Contoh: Batik Nusantara",
    type: "text",
    required: true,
    hint: "",
  },
  {
    id: "website_url",
    step: 2,
    icon: "🌐",
    title: "Website brand kamu?",
    subtitle: "URL website resmi brand (opsional, tapi membantu riset lebih dalam).",
    placeholder: "https://batiknusantara.com",
    type: "url",
    required: false,
    hint: "Opsional — lewati jika belum punya website",
  },
  {
    id: "instagram_handle",
    step: 3,
    icon: "📸",
    title: "Instagram brand kamu?",
    subtitle: "Username Instagram tanpa tanda @",
    placeholder: "batiknusantara",
    type: "text",
    required: false,
    prefix: "@",
    hint: "Opsional",
  },
  {
    id: "tiktok_handle",
    step: 4,
    icon: "🎵",
    title: "TikTok brand kamu?",
    subtitle: "Username TikTok tanpa tanda @",
    placeholder: "batiknusantara",
    type: "text",
    required: false,
    prefix: "@",
    hint: "Opsional",
  },
  {
    id: "country",
    step: 5,
    icon: "📍",
    title: "Negara operasional brand?",
    subtitle: "Di mana brand kamu berbasis dan beroperasi.",
    placeholder: "Pilih negara",
    type: "select",
    required: true,
    hint: "",
  },
  {
    id: "whatsapp_number",
    step: 6,
    icon: "💬",
    title: "Nomor WhatsApp kamu?",
    subtitle: "Untuk notifikasi dan komunikasi seputar akun GeoVera.",
    placeholder: "+62 812 3456 7890",
    type: "tel",
    required: true,
    hint: "Format internasional: +62...",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    brand_name: "", website_url: "", instagram_handle: "",
    tiktok_handle: "", country: "", whatsapp_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/signin"); return; }
      setUserId(session.user.id);
      // Check if already completed onboarding
      supabase.from("user_profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.onboarding_completed) router.replace("/pricing");
        });
    });
  }, [router]);

  const current = STEPS[step];
  const value = form[current.id as keyof FormData];
  const isLast = step === STEPS.length - 1;

  function validate(): string {
    if (current.required && !value.trim()) return "Field ini wajib diisi.";
    if (current.id === "website_url" && value && !value.startsWith("http")) return "URL harus dimulai dengan https://";
    if (current.id === "whatsapp_number" && value && !/^\+?[\d\s\-()]{8,}$/.test(value)) return "Format nomor tidak valid.";
    return "";
  }

  function next() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    if (isLast) { submit(); return; }
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 200);
  }

  function back() {
    setError("");
    setAnimating(true);
    setTimeout(() => { setStep(s => s - 1); setAnimating(false); }, 200);
  }

  function skip() {
    setError("");
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 200);
  }

  async function submit() {
    if (!userId) return;
    setSaving(true);

    // Clean handles (remove @)
    const instagram = form.instagram_handle.replace(/^@/, "").trim();
    const tiktok = form.tiktok_handle.replace(/^@/, "").trim();

    const { error: dbErr } = await supabase.from("brand_profiles").upsert({
      user_id: userId,
      brand_name: form.brand_name.trim(),
      website_url: form.website_url.trim() || null,
      instagram_handle: instagram || null,
      tiktok_handle: tiktok || null,
      country: form.country,
      whatsapp_number: form.whatsapp_number.trim(),
      research_status: "pending",
    }, { onConflict: "user_id" });

    if (dbErr) {
      setSaving(false);
      setError("Gagal menyimpan. Coba lagi.");
      return;
    }

    await supabase.from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);

    setDone(true);
    setTimeout(() => router.replace("/pricing"), 2500);
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gv-color-bg-base)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--gv-color-neutral-200)", borderTopColor: "var(--gv-color-primary-500)", animation: "gv-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Done / launching screen
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--gv-color-bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ position: "fixed", inset: 0, background: "var(--gv-color-ai-glow)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 480, width: "100%", background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-xl)", boxShadow: "var(--gv-shadow-modal)", padding: "56px 40px", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🚀</div>
          <h2 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 24, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 12px" }}>
            Brand profile tersimpan!
          </h2>
          <p style={{ fontSize: 15, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", lineHeight: 1.6, margin: "0 0 28px" }}>
            GeoVera akan memulai <strong>deep research</strong> untuk brand kamu — membangun DNA, konteks, aset, dan tone yang unik.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--gv-color-primary-500)", fontSize: 14, fontFamily: "var(--gv-font-body)", fontWeight: 600 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--gv-color-primary-200)", borderTopColor: "var(--gv-color-primary-500)", animation: "gv-spin 0.8s linear infinite" }} />
            Mengarahkan ke halaman plan…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--gv-color-bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, background: "var(--gv-color-ai-glow)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 520, width: "100%", position: "relative", zIndex: 1 }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)" }}>
              Langkah {step + 1} dari {STEPS.length}
            </span>
            <span style={{ fontSize: 13, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>
              Brand Setup
            </span>
          </div>
          <div style={{ height: 4, background: "var(--gv-color-neutral-200)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${((step + 1) / STEPS.length) * 100}%`,
              background: "var(--gv-gradient-primary)",
              borderRadius: 4,
              transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--gv-color-bg-surface)",
          borderRadius: "var(--gv-radius-xl)",
          boxShadow: "var(--gv-shadow-modal)",
          padding: "48px 40px",
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.2s, transform 0.2s",
        }}>
          {/* Step icon + label */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>{current.icon}</div>
            <h1 style={{
              fontFamily: "var(--gv-font-heading)",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--gv-color-neutral-900)",
              margin: "0 0 8px",
              lineHeight: 1.25,
            }}>
              {current.title}
            </h1>
            <p style={{
              fontSize: 15,
              color: "var(--gv-color-neutral-500)",
              fontFamily: "var(--gv-font-body)",
              margin: 0,
              lineHeight: 1.6,
            }}>
              {current.subtitle}
            </p>
          </div>

          {/* Input */}
          <div style={{ marginBottom: error ? 12 : 28 }}>
            {current.type === "select" ? (
              <select
                value={value}
                onChange={e => { setForm(f => ({ ...f, [current.id]: e.target.value })); setError(""); }}
                style={{
                  width: "100%", height: 52, padding: "0 16px",
                  border: "1.5px solid var(--gv-color-neutral-200)",
                  borderRadius: "var(--gv-radius-md)",
                  fontSize: 16, fontFamily: "var(--gv-font-body)",
                  color: value ? "var(--gv-color-neutral-900)" : "var(--gv-color-neutral-400)",
                  background: "white", outline: "none", boxSizing: "border-box",
                  appearance: "none",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--gv-color-primary-500)")}
                onBlur={e => (e.target.style.borderColor = "var(--gv-color-neutral-200)")}
              >
                <option value="" disabled>Pilih negara…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <div style={{ position: "relative" }}>
                {(current as { prefix?: string }).prefix && (
                  <span style={{
                    position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                    fontSize: 16, fontWeight: 600, color: "var(--gv-color-neutral-500)",
                    fontFamily: "var(--gv-font-body)", pointerEvents: "none",
                  }}>
                    {(current as { prefix?: string }).prefix}
                  </span>
                )}
                <input
                  type={current.type}
                  value={value}
                  placeholder={current.placeholder}
                  autoFocus
                  onChange={e => { setForm(f => ({ ...f, [current.id]: e.target.value })); setError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") next(); }}
                  style={{
                    width: "100%", height: 52,
                    padding: (current as { prefix?: string }).prefix ? "0 16px 0 36px" : "0 16px",
                    border: `1.5px solid ${error ? "var(--gv-color-danger-400)" : "var(--gv-color-neutral-200)"}`,
                    borderRadius: "var(--gv-radius-md)",
                    fontSize: 16, fontFamily: "var(--gv-font-body)",
                    color: "var(--gv-color-neutral-900)",
                    background: "white", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => { if (!error) e.target.style.borderColor = "var(--gv-color-primary-500)"; }}
                  onBlur={e => { if (!error) e.target.style.borderColor = "var(--gv-color-neutral-200)"; }}
                />
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "var(--gv-color-danger-600)", fontFamily: "var(--gv-font-body)", marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {step > 0 && (
              <button
                onClick={back}
                style={{
                  height: 52, padding: "0 20px",
                  border: "1.5px solid var(--gv-color-neutral-200)",
                  borderRadius: "var(--gv-radius-md)",
                  background: "white", cursor: "pointer",
                  fontSize: 15, fontFamily: "var(--gv-font-body)",
                  color: "var(--gv-color-neutral-600)",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            <button
              onClick={next}
              disabled={saving}
              style={{
                flex: 1, height: 52,
                background: saving ? "var(--gv-color-primary-300)" : "var(--gv-color-primary-500)",
                border: "none", borderRadius: "var(--gv-radius-md)",
                fontSize: 16, fontWeight: 600, color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "var(--gv-font-body)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.15s",
              }}
            >
              {saving ? (
                <><div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", animation: "gv-spin 0.8s linear infinite" }} />Menyimpan…</>
              ) : isLast ? (
                <><span>Mulai Riset Brand</span> <span style={{ fontSize: 18 }}>🚀</span></>
              ) : (
                <><span>Lanjut</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>
              )}
            </button>

            {!current.required && !isLast && (
              <button
                onClick={skip}
                style={{
                  height: 52, padding: "0 16px",
                  border: "none", background: "none",
                  cursor: "pointer", fontSize: 14,
                  fontFamily: "var(--gv-font-body)",
                  color: "var(--gv-color-neutral-400)",
                  whiteSpace: "nowrap",
                }}
              >
                Lewati
              </button>
            )}
          </div>

          {current.hint && (
            <p style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", textAlign: "center", margin: "16px 0 0" }}>
              {current.hint}
            </p>
          )}
        </div>

        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? "var(--gv-color-primary-500)" : i < step ? "var(--gv-color-primary-200)" : "var(--gv-color-neutral-200)",
              transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
