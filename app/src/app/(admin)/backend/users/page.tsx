"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  company: string | null;
  status: string;
  is_admin: boolean;
  created_at: string;
  sub?: {
    status: string;
    invoice_number: string | null;
    plans: { name: string | null } | null;
  } | null;
}

const USER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",   color: "var(--gv-color-warning-700)",  bg: "var(--gv-color-warning-50)"  },
  active:     { label: "Aktif",    color: "var(--gv-color-success-700)",  bg: "var(--gv-color-success-50)"  },
  suspended:  { label: "Suspend",  color: "var(--gv-color-danger-700)",   bg: "var(--gv-color-danger-50)"   },
};

type FilterTab = "all" | "pending" | "active" | "suspended";

export default function BackendUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, company, status, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // fetch subscriptions for each user
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("user_id, status, invoice_number, plans(name)")
      .order("created_at", { ascending: false });

    const subMap: Record<string, UserRow["sub"]> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (subs || []).forEach((s: any) => {
      if (!subMap[s.user_id]) subMap[s.user_id] = { status: s.status, invoice_number: s.invoice_number, plans: Array.isArray(s.plans) ? s.plans[0] ?? null : s.plans };
    });

    setUsers(data.map(u => ({ ...u, sub: subMap[u.id] || null })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function setUserStatus(userId: string, status: "active" | "suspended" | "pending") {
    setActionId(userId);
    await supabase.from("user_profiles").update({ status }).eq("id", userId);
    if (status === "active") {
      // Also activate latest subscription
      await supabase.from("subscriptions")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "proof_uploaded");
    }
    showToast(status === "active" ? "Pengguna diaktifkan!" : status === "suspended" ? "Pengguna disuspend." : "Status direset.");
    setActionId(null);
    load();
  }

  const filtered = filter === "all" ? users : users.filter(u => u.status === filter);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "pending", label: "Pending" },
    { key: "active", label: "Aktif" },
    { key: "suspended", label: "Suspend" },
  ];

  return (
    <div style={{ padding: 32 }}>
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 9999,
          background: "var(--gv-color-neutral-900)", color: "white",
          padding: "12px 20px", borderRadius: 10, fontSize: 14,
          fontFamily: "var(--gv-font-body)", boxShadow: "var(--gv-shadow-modal)",
        }}>{toast}</div>
      )}

      <h1 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 24px" }}>
        Manajemen Pengguna
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--gv-color-bg-surface)", borderRadius: 10, padding: 4, boxShadow: "var(--gv-shadow-card)", width: "fit-content" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
            fontFamily: "var(--gv-font-body)",
            background: filter === tab.key ? "var(--gv-color-primary-500)" : "transparent",
            color: filter === tab.key ? "white" : "var(--gv-color-neutral-600)",
            transition: "all 0.15s",
          }}>{tab.label} ({tab.key === "all" ? users.length : users.filter(u => u.status === tab.key).length})</button>
        ))}
      </div>

      <div style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-card)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gv-color-bg-base)" }}>
              {["Pengguna", "Email", "Perusahaan", "Plan / Invoice", "Status Akun", "Aksi"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Memuat…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Tidak ada pengguna</td></tr>
            ) : filtered.map((user, i) => {
              const s = USER_STATUS[user.status] || { label: user.status, color: "var(--gv-color-neutral-700)", bg: "var(--gv-color-neutral-100)" };
              return (
                <tr key={user.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--gv-color-neutral-100)" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: "var(--gv-gradient-primary)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>
                        {(user.full_name || user.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-body)" }}>
                          {user.full_name || "—"}
                          {user.is_admin && <span style={{ marginLeft: 6, fontSize: 10, background: "var(--gv-color-primary-100)", color: "var(--gv-color-primary-700)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>ADMIN</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>
                          {new Date(user.created_at).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--gv-color-neutral-700)", fontFamily: "var(--gv-font-body)" }}>{user.email || "—"}</td>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--gv-color-neutral-600)", fontFamily: "var(--gv-font-body)" }}>{user.company || "—"}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {user.sub ? (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-800)", fontFamily: "var(--gv-font-body)" }}>{user.sub.plans?.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>{user.sub.invoice_number}</div>
                      </div>
                    ) : <span style={{ color: "var(--gv-color-neutral-300)", fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: s.color, background: s.bg, fontFamily: "var(--gv-font-body)" }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {user.is_admin ? (
                      <span style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Admin</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        {user.status !== "active" && (
                          <button
                            disabled={actionId === user.id}
                            onClick={() => setUserStatus(user.id, "active")}
                            style={{
                              padding: "5px 12px", fontSize: 12, fontWeight: 600,
                              background: "var(--gv-color-success-500)", color: "white",
                              border: "none", borderRadius: 6, cursor: "pointer",
                              fontFamily: "var(--gv-font-body)", opacity: actionId === user.id ? 0.6 : 1,
                            }}
                          >
                            Aktifkan
                          </button>
                        )}
                        {user.status !== "suspended" && (
                          <button
                            disabled={actionId === user.id}
                            onClick={() => setUserStatus(user.id, "suspended")}
                            style={{
                              padding: "5px 12px", fontSize: 12, fontWeight: 600,
                              background: "transparent", color: "var(--gv-color-danger-600)",
                              border: "1px solid var(--gv-color-danger-300)", borderRadius: 6, cursor: "pointer",
                              fontFamily: "var(--gv-font-body)", opacity: actionId === user.id ? 0.6 : 1,
                            }}
                          >
                            Suspend
                          </button>
                        )}
                        {user.status === "suspended" && (
                          <button
                            disabled={actionId === user.id}
                            onClick={() => setUserStatus(user.id, "pending")}
                            style={{
                              padding: "5px 12px", fontSize: 12, fontWeight: 600,
                              background: "transparent", color: "var(--gv-color-neutral-600)",
                              border: "1px solid var(--gv-color-neutral-300)", borderRadius: 6, cursor: "pointer",
                              fontFamily: "var(--gv-font-body)", opacity: actionId === user.id ? 0.6 : 1,
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
