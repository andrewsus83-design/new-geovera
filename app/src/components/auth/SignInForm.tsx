"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

type Step = "credentials" | "otp";

export default function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [brandSlug, setBrandSlug] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandSlug.trim() || !waNumber.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wa-auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_slug: brandSlug.trim(), wa_number: waNumber.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Gagal kirim OTP"); return; }
      setInfo("OTP dikirim ke WhatsApp kamu. Cek pesan masuk.");
      setStep("otp");
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wa-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_slug: brandSlug.trim(), wa_number: waNumber.trim(), otp_code: otp.trim() }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "OTP salah"); return; }

      const { error: authErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "email",
      });
      if (authErr) { setError("Gagal buat sesi: " + authErr.message); return; }

      router.push(data.redirect || "/analytics");
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "var(--gv-color-bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
    }}>
      {/* AI glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        background: "var(--gv-color-ai-glow)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{
        width: "100%",
        maxWidth: "420px",
        background: "var(--gv-color-bg-surface)",
        border: "1px solid var(--gv-color-neutral-200)",
        padding: "48px 40px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-block", marginBottom: "24px" }}>
            <Image
              src="/images/logo/auth-logo.svg"
              width={160}
              height={33}
              alt="GeoVera"
              priority
            />
          </div>
          <h1 style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--gv-color-neutral-900)",
            margin: "0 0 8px",
            letterSpacing: "-0.3px",
          }}>
            {step === "credentials" ? "Masuk ke GeoVera" : "Verifikasi WhatsApp"}
          </h1>
          <p style={{
            fontSize: "14px",
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            margin: 0,
            lineHeight: 1.5,
          }}>
            {step === "credentials"
              ? "Gunakan nama brand dan nomor WhatsApp kamu"
              : `Masukkan kode OTP yang dikirim ke +${waNumber.replace(/\D/g, "")}`}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: "16px",
            padding: "10px 14px",
            background: "var(--gv-color-danger-50)",
            border: "1px solid #FECACA",
            fontSize: "13px",
            color: "var(--gv-color-danger-700)",
            fontFamily: "var(--gv-font-body)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}>
            {/* Warning icon — WIRED style */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" style={{ flexShrink: 0, marginTop: "1px" }}>
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {error}
          </div>
        )}

        {/* Info */}
        {info && !error && (
          <div style={{
            marginBottom: "16px",
            padding: "10px 14px",
            background: "var(--gv-color-success-50)",
            border: "1px solid #A7F3D0",
            fontSize: "13px",
            color: "var(--gv-color-success-700)",
            fontFamily: "var(--gv-font-body)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}>
            {/* Check icon — WIRED style */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" style={{ flexShrink: 0, marginTop: "1px" }}>
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            {info}
          </div>
        )}

        {/* Step 1: brand + WA */}
        {step === "credentials" && (
          <form onSubmit={handleSendOtp}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <Field
                label="Nama Brand"
                value={brandSlug}
                onChange={setBrandSlug}
                placeholder="geovera"
                hint="Nama brand kamu (lowercase, tanpa spasi)"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                    <rect x="2" y="7" width="20" height="14" rx="0"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                  </svg>
                }
              />
              <Field
                label="Nomor WhatsApp"
                value={waNumber}
                onChange={setWaNumber}
                placeholder="628xxxxxxxxx"
                type="tel"
                hint="Format internasional, mulai dari 62"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.72 19.79 19.79 0 01.07 5.07a2 2 0 012-2.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 10.09a16 16 0 006 6l.41-.41a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                }
              />
              <SubmitBtn loading={loading} label="Kirim Kode OTP" loadingLabel="Mengirim…" />
            </div>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={labelStyle}>Kode OTP (6 digit)</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  required
                  autoFocus
                  style={{
                    ...inputStyle,
                    textAlign: "center",
                    fontSize: "24px",
                    letterSpacing: "10px",
                    fontWeight: 700,
                    fontFamily: "var(--gv-font-mono, monospace)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--gv-color-primary-500)")}
                  onBlur={e => (e.target.style.borderColor = "var(--gv-color-neutral-200)")}
                />
              </div>
              <SubmitBtn loading={loading} label="Verifikasi & Masuk" loadingLabel="Memverifikasi…" />
              <button
                type="button"
                onClick={() => { setStep("credentials"); setOtp(""); setError(""); setInfo(""); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--gv-color-primary-500)",
                  fontSize: "13px",
                  fontFamily: "var(--gv-font-body)",
                  padding: 0,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Ubah nomor / kirim ulang OTP
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p style={{
          textAlign: "center",
          marginTop: "32px",
          fontSize: "12px",
          color: "var(--gv-color-neutral-400)",
          fontFamily: "var(--gv-font-body)",
          lineHeight: 1.6,
          borderTop: "1px solid var(--gv-color-neutral-100)",
          paddingTop: "20px",
        }}>
          Hanya pengguna terdaftar yang dapat masuk.<br />
          Hubungi admin untuk mendaftarkan nomor kamu.
        </p>
      </div>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--gv-color-neutral-700)",
  marginBottom: "6px",
  fontFamily: "var(--gv-font-body)",
  letterSpacing: "0.01em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: "44px",
  padding: "0 14px",
  border: "1px solid var(--gv-color-neutral-200)",
  borderRadius: 0,
  fontSize: "14px",
  fontFamily: "var(--gv-font-body)",
  color: "var(--gv-color-neutral-900)",
  background: "white",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 150ms",
};

function Field({ label, value, onChange, placeholder, type = "text", hint, icon }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        {icon && (
          <div style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--gv-color-neutral-400)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}>
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{ ...inputStyle, paddingLeft: icon ? "38px" : "14px" }}
          onFocus={e => (e.target.style.borderColor = "var(--gv-color-primary-500)")}
          onBlur={e => (e.target.style.borderColor = "var(--gv-color-neutral-200)")}
        />
      </div>
      {hint && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: "100%",
        height: "48px",
        background: loading ? "var(--gv-color-primary-400)" : "var(--gv-color-primary-500)",
        border: "none",
        borderRadius: 0,
        fontSize: "15px",
        fontWeight: 600,
        color: "white",
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "var(--gv-font-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        letterSpacing: "0.01em",
      }}
    >
      {loading && (
        <div style={{
          width: 16, height: 16,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.4)",
          borderTopColor: "white",
          animation: "gv-spin 0.8s linear infinite",
        }} />
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}
