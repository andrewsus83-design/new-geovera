"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.751 10.194c0-.72-.059-1.245-.188-1.789H10.18v3.247h4.92c-.099.807-.634 2.022-1.825 2.839l-.016.108 2.65 2.013.184.018C17.779 15.104 18.751 12.858 18.751 10.194z" fill="#4285F4"/>
    <path d="M10.179 18.75c2.41 0 4.434-.778 5.912-2.12l-2.818-2.138c-.754.515-1.766.875-3.094.875-2.361 0-4.365-1.527-5.08-3.636l-.104.009-2.756 2.09-.036.098C3.671 16.786 6.687 18.75 10.179 18.75z" fill="#34A853"/>
    <path d="M5.1 11.73c-.188-.544-.297-1.127-.297-1.73 0-.603.109-1.186.287-1.73l-.004-.116L2.295 6.03l-.09.043C1.598 7.258 1.251 8.59 1.251 10c0 1.41.347 2.742.952 3.928L5.1 11.73z" fill="#FBBC05"/>
    <path d="M10.179 4.633c1.676 0 2.807.71 3.452 1.303l2.52-2.41C14.604 2.115 12.59 1.25 10.179 1.25 6.687 1.25 3.671 3.214 2.203 6.072l2.887 2.197C5.814 6.16 7.818 4.633 10.179 4.633z" fill="#EB4335"/>
  </svg>
);

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(decodeURIComponent(oauthError));
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/callback" },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in gagal.");
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const { error: signupError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signupError) { setError(signupError.message); return; }
        setError("");
        // Show success message - check email
        alert("Cek email kamu untuk konfirmasi akun!");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }

      // Route based on onboarding + subscription status
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_completed, status")
          .eq("id", session.user.id)
          .single();
        if (profile?.status === "active") { router.push("/getting-started"); return; }
        if (!profile?.onboarding_completed) { router.push("/onboarding"); return; }
      }
      router.push("/pricing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal. Coba lagi.");
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
      {/* AI glow overlay */}
      <div style={{
        position: "fixed",
        inset: 0,
        background: "var(--gv-color-ai-glow)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Auth Card */}
      <div style={{
        width: "100%",
        maxWidth: "440px",
        background: "var(--gv-color-bg-surface)",
        borderRadius: "var(--gv-radius-xl)",
        boxShadow: "var(--gv-shadow-modal)",
        padding: "48px 40px",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Logo + Brand */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "var(--gv-radius-md)",
            background: "var(--gv-gradient-primary)",
            marginBottom: "16px",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="rgba(255,255,255,0.95)" fillRule="evenodd"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--gv-color-neutral-900)",
            margin: "0 0 8px",
          }}>
            {mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}
          </h1>
          <p style={{
            fontSize: "15px",
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            margin: 0,
          }}>
            {mode === "signin" ? "Masuk ke GeoVera untuk melanjutkan" : "Bergabung dengan GeoVera hari ini"}
          </p>
        </div>

        {/* Google Button — Primary */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          style={{
            width: "100%",
            height: "52px",
            background: googleLoading ? "var(--gv-color-neutral-100)" : "var(--gv-color-bg-surface)",
            border: "1.5px solid var(--gv-color-neutral-200)",
            borderRadius: "var(--gv-radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--gv-color-neutral-900)",
            cursor: googleLoading ? "not-allowed" : "pointer",
            fontFamily: "var(--gv-font-body)",
            boxShadow: "var(--gv-shadow-card)",
            transition: "all var(--gv-duration-normal) var(--gv-easing-default)",
            marginBottom: "20px",
          }}
          onMouseEnter={e => {
            if (!googleLoading) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gv-color-neutral-300)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gv-color-neutral-200)";
          }}
        >
          {googleLoading ? (
            <div style={{
              width: 20, height: 20,
              borderRadius: "50%",
              border: "2px solid var(--gv-color-neutral-300)",
              borderTopColor: "var(--gv-color-primary-500)",
              animation: "gv-spin 0.8s linear infinite",
            }} />
          ) : <GoogleIcon />}
          {googleLoading ? "Menghubungkan…" : "Lanjutkan dengan Google"}
        </button>

        {/* Divider */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--gv-color-neutral-200)" }} />
          <span style={{ fontSize: "13px", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>
            atau dengan email
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--gv-color-neutral-200)" }} />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "var(--gv-radius-sm)",
            background: "var(--gv-color-danger-50)",
            border: "1px solid #FECACA",
            fontSize: "14px",
            color: "var(--gv-color-danger-700)",
            fontFamily: "var(--gv-font-body)",
          }}>
            {error}
          </div>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailAuth}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Email */}
            <div>
              <label style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--gv-color-neutral-700)",
                marginBottom: "6px",
                fontFamily: "var(--gv-font-body)",
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@gmail.com"
                required
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 14px",
                  border: "1.5px solid var(--gv-color-neutral-200)",
                  borderRadius: "var(--gv-radius-sm)",
                  fontSize: "15px",
                  fontFamily: "var(--gv-font-body)",
                  color: "var(--gv-color-neutral-900)",
                  background: "white",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color var(--gv-duration-normal)",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--gv-color-primary-500)")}
                onBlur={e => (e.target.style.borderColor = "var(--gv-color-neutral-200)")}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--gv-color-neutral-700)",
                marginBottom: "6px",
                fontFamily: "var(--gv-font-body)",
              }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Min. 8 karakter" : "Password kamu"}
                  required
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 44px 0 14px",
                    border: "1.5px solid var(--gv-color-neutral-200)",
                    borderRadius: "var(--gv-radius-sm)",
                    fontSize: "15px",
                    fontFamily: "var(--gv-font-body)",
                    color: "var(--gv-color-neutral-900)",
                    background: "white",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color var(--gv-duration-normal)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--gv-color-primary-500)")}
                  onBlur={e => (e.target.style.borderColor = "var(--gv-color-neutral-200)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    color: "var(--gv-color-neutral-400)",
                    fontSize: "13px",
                  }}
                >
                  {showPassword ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "52px",
                background: loading ? "var(--gv-color-primary-400)" : "var(--gv-color-primary-500)",
                border: "none",
                borderRadius: "var(--gv-radius-md)",
                fontSize: "16px",
                fontWeight: 600,
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "var(--gv-font-body)",
                transition: "all var(--gv-duration-normal) var(--gv-easing-default)",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--gv-color-primary-600)";
              }}
              onMouseLeave={e => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--gv-color-primary-500)";
              }}
            >
              {loading ? (
                <div style={{
                  width: 18, height: 18,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "white",
                  animation: "gv-spin 0.8s linear infinite",
                }} />
              ) : null}
              {loading ? "Memproses…" : mode === "signin" ? "Masuk" : "Daftar"}
            </button>
          </div>
        </form>

        {/* Toggle mode */}
        <p style={{
          textAlign: "center",
          marginTop: "24px",
          fontSize: "14px",
          color: "var(--gv-color-neutral-500)",
          fontFamily: "var(--gv-font-body)",
        }}>
          {mode === "signin" ? "Belum punya akun? " : "Sudah punya akun? "}
          <button
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--gv-color-primary-500)",
              fontWeight: 600,
              fontSize: "14px",
              fontFamily: "var(--gv-font-body)",
            }}
          >
            {mode === "signin" ? "Daftar sekarang" : "Masuk"}
          </button>
        </p>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          marginTop: "16px",
          fontSize: "12px",
          color: "var(--gv-color-neutral-400)",
          fontFamily: "var(--gv-font-body)",
          lineHeight: 1.5,
        }}>
          Dengan masuk, kamu menyetujui{" "}
          <span style={{ color: "var(--gv-color-primary-500)" }}>Syarat & Ketentuan</span>{" "}
          dan{" "}
          <span style={{ color: "var(--gv-color-primary-500)" }}>Kebijakan Privasi</span>{" "}
          GeoVera.
        </p>
      </div>
    </div>
  );
}
