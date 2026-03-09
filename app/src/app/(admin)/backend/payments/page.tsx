"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SubRow {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  proof_url: string | null;
  proof_uploaded_at: string | null;
  created_at: string;
  notes: string | null;
  user_profiles: { full_name: string | null; email: string | null } | null;
  plans: { name: string | null; price_idr: number | null } | null;
}

type FilterTab = "all" | "proof_uploaded" | "pending_payment" | "active" | "rejected";

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment:  { label: "Menunggu Bayar",  color: "var(--gv-color-warning-700)",  bg: "var(--gv-color-warning-50)"  },
  proof_uploaded:   { label: "Bukti Diupload",  color: "var(--gv-color-primary-700)",  bg: "var(--gv-color-primary-50)"  },
  active:           { label: "Disetujui",       color: "var(--gv-color-success-700)",  bg: "var(--gv-color-success-50)"  },
  rejected:         { label: "Ditolak",         color: "var(--gv-color-danger-700)",   bg: "var(--gv-color-danger-50)"   },
};

function fmt(n: number | null) {
  if (!n) return "—";
  return "Rp " + n.toLocaleString("id-ID");
}

export default function BackendPaymentsPage() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("proof_uploaded");
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("id, user_id, invoice_number, status, proof_url, proof_uploaded_at, created_at, notes, user_profiles(full_name, email), plans(name, price_idr)")
      .order("proof_uploaded_at", { ascending: false, nullsFirst: false });
    setSubs((data as unknown as SubRow[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function approve(sub: SubRow) {
    setActionId(sub.id);
    await supabase.rpc("activate_subscription_user", { sub_id: sub.id });
    showToast(`Invoice ${sub.invoice_number} disetujui!`);
    setActionId(null);
    load();
  }

  async function reject(subId: string, note: string) {
    setActionId(subId);
    await supabase.from("subscriptions").update({ status: "rejected", notes: note || null }).eq("id", subId);
    showToast("Pembayaran ditolak.");
    setRejectId(null);
    setRejectNote("");
    setActionId(null);
    load();
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "proof_uploaded", label: "Perlu Review" },
    { key: "pending_payment", label: "Belum Bayar" },
    { key: "active", label: "Disetujui" },
    { key: "rejected", label: "Ditolak" },
  ];

  const filtered = filter === "all" ? subs : subs.filter(s => s.status === filter);

  return (
    <div style={{ padding: 32 }}>
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: "var(--gv-color-neutral-900)", color: "white", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontFamily: "var(--gv-font-body)", boxShadow: "var(--gv-shadow-modal)" }}>{toast}</div>
      )}

      {/* Proof image modal */}
      {proofModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setProofModal(null)}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 8, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <img src={proofModal} alt="Bukti transfer" style={{ maxWidth: "80vw", maxHeight: "80vh", display: "block" }} />
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <a href={proofModal} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--gv-color-primary-500)", fontFamily: "var(--gv-font-body)" }}>Buka di tab baru</a>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, padding: 32, maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Tolak Pembayaran</h3>
            <p style={{ fontSize: 14, color: "var(--gv-color-neutral-600)", fontFamily: "var(--gv-font-body)", margin: "0 0 12px" }}>Alasan penolakan (opsional):</p>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Contoh: Bukti transfer tidak jelas, nominal tidak sesuai..."
              style={{ width: "100%", height: 80, padding: "10px 12px", borderRadius: 8, border: "1.5px solid var(--gv-color-neutral-200)", fontSize: 14, fontFamily: "var(--gv-font-body)", resize: "vertical", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setRejectId(null); setRejectNote(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gv-color-neutral-300)", background: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Batal</button>
              <button
                disabled={!!actionId}
                onClick={() => reject(rejectId, rejectNote)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--gv-color-danger-500)", color: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14, fontWeight: 600 }}
              >
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 24px" }}>
        Manajemen Pembayaran
      </h1>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--gv-color-bg-surface)", borderRadius: 10, padding: 4, boxShadow: "var(--gv-shadow-card)", width: "fit-content" }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
            padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: filter === tab.key ? 600 : 400,
            fontFamily: "var(--gv-font-body)",
            background: filter === tab.key ? "var(--gv-color-primary-500)" : "transparent",
            color: filter === tab.key ? "white" : "var(--gv-color-neutral-600)",
            transition: "all 0.15s",
          }}>
            {tab.label} ({tab.key === "all" ? subs.length : subs.filter(s => s.status === tab.key).length})
          </button>
        ))}
      </div>

      <div style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-card)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--gv-color-bg-base)" }}>
              {["Invoice", "Pengguna", "Plan", "Nominal", "Bukti Transfer", "Diupload", "Status", "Aksi"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Memuat…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Tidak ada data</td></tr>
            ) : filtered.map((sub, i) => {
              const s = STATUS_INFO[sub.status] || { label: sub.status, color: "var(--gv-color-neutral-700)", bg: "var(--gv-color-neutral-100)" };
              return (
                <tr key={sub.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--gv-color-neutral-100)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "var(--gv-color-neutral-800)", fontFamily: "var(--gv-font-body)" }}>{sub.invoice_number}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-800)", fontFamily: "var(--gv-font-body)" }}>{sub.user_profiles?.full_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>{sub.user_profiles?.email || "—"}</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--gv-color-neutral-700)", fontFamily: "var(--gv-font-body)" }}>{sub.plans?.name || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-800)", fontFamily: "var(--gv-font-body)" }}>{fmt(sub.plans?.price_idr ?? null)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {sub.proof_url ? (
                      <button
                        onClick={() => setProofModal(sub.proof_url!)}
                        style={{
                          padding: "5px 12px", fontSize: 12, fontWeight: 600,
                          background: "var(--gv-color-primary-50)", color: "var(--gv-color-primary-600)",
                          border: "1px solid var(--gv-color-primary-200)", borderRadius: 6, cursor: "pointer",
                          fontFamily: "var(--gv-font-body)",
                        }}
                      >
                        Lihat Bukti
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Belum upload</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)" }}>
                    {sub.proof_uploaded_at ? new Date(sub.proof_uploaded_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: s.color, background: s.bg, fontFamily: "var(--gv-font-body)" }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {sub.status === "proof_uploaded" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          disabled={actionId === sub.id}
                          onClick={() => approve(sub)}
                          style={{
                            padding: "5px 12px", fontSize: 12, fontWeight: 600,
                            background: "var(--gv-color-success-500)", color: "white",
                            border: "none", borderRadius: 6, cursor: "pointer",
                            fontFamily: "var(--gv-font-body)", opacity: actionId === sub.id ? 0.6 : 1,
                          }}
                        >
                          Setujui
                        </button>
                        <button
                          disabled={!!actionId}
                          onClick={() => setRejectId(sub.id)}
                          style={{
                            padding: "5px 12px", fontSize: 12, fontWeight: 600,
                            background: "transparent", color: "var(--gv-color-danger-600)",
                            border: "1px solid var(--gv-color-danger-300)", borderRadius: 6, cursor: "pointer",
                            fontFamily: "var(--gv-font-body)",
                          }}
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                    {(sub.status === "active" || sub.status === "rejected") && (
                      <span style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>
                        {sub.status === "active" ? "✓ Selesai" : "✗ Ditolak"}
                      </span>
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
