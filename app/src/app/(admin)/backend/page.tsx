"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  pendingApproval: number;
  activeSubscriptions: number;
  pendingPayment: number;
}

interface RecentSub {
  id: string;
  invoice_number: string;
  status: string;
  proof_uploaded_at: string | null;
  created_at: string;
  user_profiles: { full_name: string | null; email: string | null } | null;
  plans: { name: string | null } | null;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment:   { label: "Menunggu Bayar",  color: "var(--gv-color-warning-700)",  bg: "var(--gv-color-warning-50)"  },
  proof_uploaded:    { label: "Bukti Diupload",  color: "var(--gv-color-primary-700)",  bg: "var(--gv-color-primary-50)"  },
  active:            { label: "Aktif",           color: "var(--gv-color-success-700)",  bg: "var(--gv-color-success-50)"  },
  rejected:          { label: "Ditolak",         color: "var(--gv-color-danger-700)",   bg: "var(--gv-color-danger-50)"   },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] || { label: status, color: "var(--gv-color-neutral-700)", bg: "var(--gv-color-neutral-100)" };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: s.color, background: s.bg, fontFamily: "var(--gv-font-body)" }}>
      {s.label}
    </span>
  );
}

export default function BackendOverviewPage() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, pendingApproval: 0, activeSubscriptions: 0, pendingPayment: 0 });
  const [recent, setRecent] = useState<RecentSub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [usersRes, subsRes] = await Promise.all([
        supabase.from("user_profiles").select("id, status", { count: "exact" }),
        supabase.from("subscriptions").select("id, status, invoice_number, proof_uploaded_at, created_at, user_profiles(full_name, email), plans(name)", { count: "exact" }).order("created_at", { ascending: false }).limit(10),
      ]);

      const allUsers = usersRes.data || [];
      const allSubs = (subsRes.data as unknown as RecentSub[]) || [];

      setStats({
        totalUsers: allUsers.length,
        pendingApproval: allSubs.filter(s => s.status === "proof_uploaded").length,
        activeSubscriptions: allSubs.filter(s => s.status === "active").length,
        pendingPayment: allSubs.filter(s => s.status === "pending_payment").length,
      });
      setRecent(allSubs.slice(0, 8));
      setLoading(false);
    }
    load();
  }, []);

  const STAT_CARDS = [
    { label: "Total Pengguna", value: stats.totalUsers, color: "var(--gv-color-neutral-900)", href: "/backend/users" },
    { label: "Menunggu Persetujuan", value: stats.pendingApproval, color: "var(--gv-color-primary-600)", href: "/backend/payments" },
    { label: "Langganan Aktif", value: stats.activeSubscriptions, color: "var(--gv-color-success-600)", href: "/backend/payments" },
    { label: "Belum Bayar", value: stats.pendingPayment, color: "var(--gv-color-warning-600)", href: "/backend/payments" },
  ];

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 8px" }}>
        Overview Backend
      </h1>
      <p style={{ fontSize: 14, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", margin: "0 0 32px" }}>
        Ringkasan aktivitas platform GeoVera
      </p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {STAT_CARDS.map(card => (
          <Link key={card.label} href={card.href} style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--gv-color-bg-surface)",
              borderRadius: "var(--gv-radius-lg)",
              boxShadow: "var(--gv-shadow-card)",
              padding: "20px 24px",
              cursor: "pointer",
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.color, fontFamily: "var(--gv-font-heading)" }}>
                {loading ? "—" : card.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", marginTop: 4 }}>
                {card.label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent subscriptions */}
      <div style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-card)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--gv-color-neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 15, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: 0 }}>
            Transaksi Terbaru
          </h2>
          <Link href="/backend/payments" style={{ fontSize: 13, color: "var(--gv-color-primary-500)", fontFamily: "var(--gv-font-body)", textDecoration: "none", fontWeight: 500 }}>
            Lihat semua →
          </Link>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gv-color-bg-base)" }}>
              {["Invoice", "Pengguna", "Plan", "Status", "Tanggal"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Memuat…</td></tr>
            ) : recent.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Belum ada transaksi</td></tr>
            ) : recent.map((sub, i) => (
              <tr key={sub.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--gv-color-neutral-100)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "var(--gv-font-body)", color: "var(--gv-color-neutral-700)", fontWeight: 600 }}>{sub.invoice_number}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "var(--gv-font-body)", color: "var(--gv-color-neutral-700)" }}>
                  {sub.user_profiles?.full_name || sub.user_profiles?.email || "—"}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "var(--gv-font-body)", color: "var(--gv-color-neutral-600)" }}>{sub.plans?.name || "—"}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge status={sub.status} /></td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "var(--gv-font-body)", color: "var(--gv-color-neutral-500)" }}>
                  {new Date(sub.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
