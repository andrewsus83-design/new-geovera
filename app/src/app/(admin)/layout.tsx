"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Routes inside (admin) that don't need an active subscription
const OPEN_PATHS = ["/backend", "/pricing"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Skip gate for backend admin routes and pricing
    const skip = OPEN_PATHS.some(p => pathname.startsWith(p));
    if (skip) { setReady(true); return; }

    async function gate() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/signin"); return; }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("status, is_admin")
        .eq("id", session.user.id)
        .single();

      // Admin bypasses all gates
      const isAdmin = profile?.is_admin || session.user.email === "andrewsus83@gmail.com";
      if (isAdmin) { setReady(true); return; }

      // Active users get in
      if (profile?.status === "active") { setReady(true); return; }

      // Everyone else → pricing / waiting
      router.replace("/pricing");
    }
    gate();
  }, [pathname, router]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gv-color-bg-base)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--gv-color-neutral-200)", borderTopColor: "var(--gv-color-primary-500)", animation: "gv-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-screen" style={{ background: "var(--gv-color-bg-base)" }}>
      {children}
    </div>
  );
}
