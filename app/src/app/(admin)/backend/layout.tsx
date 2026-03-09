"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const NAV = [
  { href: "/backend", label: "Overview", icon: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/backend/users", label: "Users", icon: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 15.5c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  { href: "/backend/payments", label: "Payments", icon: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="4" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1 7.5h16" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="10" width="4" height="2" rx="0.5" fill="currentColor"/>
    </svg>
  )},
  { href: "/backend/plans", label: "Plans", icon: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5l2.06 4.17 4.6.67-3.33 3.24.79 4.58L9 12.27l-4.12 2.17.79-4.58L2.34 6.34l4.6-.67L9 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )},
  { href: "/backend/settings", label: "Settings", icon: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
];

export default function BackendLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/signin"); return; }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, is_admin")
        .eq("id", session.user.id)
        .single();

      const isAdminByEmail = session.user.email === "andrewsus83@gmail.com";
      if (!profile?.is_admin && !isAdminByEmail) { router.replace("/getting-started"); return; }
      setAdminName(profile?.full_name || session.user.email || "Admin");
      setChecking(false);
    }
    check();
  }, [router]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gv-color-bg-base)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--gv-color-neutral-200)", borderTopColor: "var(--gv-color-primary-500)", animation: "gv-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--gv-color-bg-base)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "var(--gv-color-bg-surface)",
        borderRight: "1px solid var(--gv-color-neutral-100)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--gv-color-neutral-100)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "var(--gv-gradient-primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="rgba(255,255,255,0.95)" fillRule="evenodd"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)", lineHeight: 1 }}>GeoVera</div>
              <div style={{ fontSize: 10, color: "var(--gv-color-primary-500)", fontFamily: "var(--gv-font-body)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Backend</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(item => {
            const active = item.href === "/backend"
              ? pathname === "/backend"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                fontFamily: "var(--gv-font-body)",
                color: active ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-600)",
                background: active ? "var(--gv-color-primary-50)" : "transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ color: active ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-400)" }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "16px 20px 0", borderTop: "1px solid var(--gv-color-neutral-100)", marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", marginBottom: 2 }}>Signed in as</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", fontFamily: "var(--gv-font-body)" }}>{adminName}</div>
          <button
            onClick={() => { supabase.auth.signOut(); router.replace("/signin"); }}
            style={{ marginTop: 10, fontSize: 13, color: "var(--gv-color-danger-600)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--gv-font-body)" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
