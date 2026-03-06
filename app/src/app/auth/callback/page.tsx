"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/*
  /auth/callback — Supabase email confirmation & OAuth callback handler
  Supabase redirects here after email confirmation with ?code=xxx
  We exchange the code for a session, then route to dashboard or onboarding.
*/
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Check for OAuth error in URL params (e.g., user denied access)
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      const desc = params.get("error_description") || oauthError;
      router.replace("/signin?error=" + encodeURIComponent(desc));
      return;
    }

    // supabase-js v2 with detectSessionInUrl:true auto-exchanges ?code=
    // when getSession() is called — no manual exchange needed
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        router.replace("/onboarding");
        return;
      }

      // Check if user already has a brand → go to dashboard
      const { data: brands } = await supabase
        .from("user_brands")
        .select("brand_id")
        .eq("user_id", session.user.id)
        .limit(1);

      if (brands && brands.length > 0) {
        router.replace("/getting-started");
      } else {
        router.replace("/onboarding");
      }
    });
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "white",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #E5E7EB",
          borderTopColor: "#3D6B68",
          animation: "spin 0.8s linear infinite",
          marginBottom: 16,
        }}
      />
      <p style={{ color: "#6B7280", fontSize: 14 }}>Memverifikasi akun…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
