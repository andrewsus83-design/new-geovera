"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_idr: number;
  billing_cycle: string;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
}

const EMPTY_PLAN: Omit<Plan, "id"> = {
  name: "", slug: "", description: "", price_idr: 0,
  billing_cycle: "monthly", features: [], is_active: true, is_popular: false, sort_order: 0,
};

export default function BackendPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editPlan, setEditPlan] = useState<Partial<Plan> & typeof EMPTY_PLAN>(EMPTY_PLAN);
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    setPlans((data || []) as Plan[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openAdd() {
    setEditPlan({ ...EMPTY_PLAN });
    setFeaturesText("");
    setModal("add");
  }

  function openEdit(plan: Plan) {
    setEditPlan({ ...plan });
    setFeaturesText((plan.features || []).join("\n"));
    setModal("edit");
  }

  async function save() {
    if (!editPlan.name?.trim()) return;
    setSaving(true);

    const slug = editPlan.slug?.trim() || editPlan.name.toLowerCase().replace(/\s+/g, "-");
    const features = featuresText.split("\n").map(f => f.trim()).filter(Boolean);
    const payload = {
      name: editPlan.name.trim(),
      slug,
      description: editPlan.description?.trim() || null,
      price_idr: Number(editPlan.price_idr) || 0,
      billing_cycle: editPlan.billing_cycle || "monthly",
      features,
      is_active: editPlan.is_active ?? true,
      is_popular: editPlan.is_popular ?? false,
      sort_order: Number(editPlan.sort_order) || 0,
    };

    if (modal === "add") {
      await supabase.from("plans").insert(payload);
      showToast("Plan berhasil ditambahkan!");
    } else {
      await supabase.from("plans").update(payload).eq("id", editPlan.id!);
      showToast("Plan berhasil diperbarui!");
    }
    setSaving(false);
    setModal(null);
    load();
  }

  async function toggleActive(plan: Plan) {
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    load();
  }

  async function deletePlan(id: string) {
    await supabase.from("plans").delete().eq("id", id);
    setDeleteId(null);
    showToast("Plan dihapus.");
    load();
  }

  function fmt(n: number) {
    return "Rp " + n.toLocaleString("id-ID");
  }

  return (
    <div style={{ padding: 32 }}>
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: "var(--gv-color-neutral-900)", color: "white", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontFamily: "var(--gv-font-body)", boxShadow: "var(--gv-shadow-modal)" }}>{toast}</div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 12, padding: 32, maxWidth: 360, width: "100%" }}>
            <h3 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>Hapus Plan?</h3>
            <p style={{ fontSize: 14, color: "var(--gv-color-neutral-600)", fontFamily: "var(--gv-font-body)", margin: "0 0 24px" }}>Tindakan ini tidak dapat dibatalkan. Pastikan tidak ada pengguna aktif di plan ini.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--gv-color-neutral-300)", background: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Batal</button>
              <button onClick={() => deletePlan(deleteId)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--gv-color-danger-500)", color: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14, fontWeight: 600 }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 20, fontWeight: 700, margin: "0 0 24px" }}>
              {modal === "add" ? "Tambah Plan Baru" : "Edit Plan"}
            </h3>

            {[
              { label: "Nama Plan *", key: "name", type: "text", placeholder: "Basic" },
              { label: "Slug (URL)", key: "slug", type: "text", placeholder: "basic (auto-generated)" },
              { label: "Deskripsi", key: "description", type: "text", placeholder: "Cocok untuk personal & UMKM" },
              { label: "Harga (IDR)", key: "price_idr", type: "number", placeholder: "299000" },
              { label: "Urutan Tampil", key: "sort_order", type: "number", placeholder: "1" },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", marginBottom: 6, fontFamily: "var(--gv-font-body)" }}>{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(editPlan as Record<string, unknown>)[field.key] as string || ""}
                  onChange={e => setEditPlan(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: "100%", height: 40, padding: "0 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", boxSizing: "border-box", outline: "none" }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", marginBottom: 6, fontFamily: "var(--gv-font-body)" }}>Siklus Tagihan</label>
              <select
                value={editPlan.billing_cycle}
                onChange={e => setEditPlan(p => ({ ...p, billing_cycle: e.target.value }))}
                style={{ width: "100%", height: 40, padding: "0 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", boxSizing: "border-box" }}
              >
                <option value="monthly">Bulanan</option>
                <option value="annual">Tahunan</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", marginBottom: 4, fontFamily: "var(--gv-font-body)" }}>
                Fitur (satu per baris)
              </label>
              <textarea
                value={featuresText}
                onChange={e => setFeaturesText(e.target.value)}
                placeholder={"5 Platform Sosial Media\nAI Content Generator\n100 Post per Bulan"}
                style={{ width: "100%", height: 120, padding: "10px 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", cursor: "pointer" }}>
                <input type="checkbox" checked={editPlan.is_active} onChange={e => setEditPlan(p => ({ ...p, is_active: e.target.checked }))} />
                Aktif
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", cursor: "pointer" }}>
                <input type="checkbox" checked={editPlan.is_popular} onChange={e => setEditPlan(p => ({ ...p, is_popular: e.target.checked }))} />
                Tandai Popular
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--gv-color-neutral-300)", background: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Batal</button>
              <button
                disabled={saving || !editPlan.name?.trim()}
                onClick={save}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: saving ? "var(--gv-color-primary-300)" : "var(--gv-color-primary-500)", color: "white", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14, fontWeight: 600 }}
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: 0 }}>
          Manajemen Plan
        </h1>
        <button
          onClick={openAdd}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--gv-color-primary-500)", color: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          Tambah Plan
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {loading ? (
          <div style={{ color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", fontSize: 14 }}>Memuat…</div>
        ) : plans.map(plan => (
          <div key={plan.id} style={{
            background: "var(--gv-color-bg-surface)",
            borderRadius: "var(--gv-radius-lg)",
            boxShadow: "var(--gv-shadow-card)",
            padding: 24,
            border: plan.is_popular ? "2px solid var(--gv-color-primary-400)" : "1px solid var(--gv-color-neutral-100)",
            position: "relative",
          }}>
            {plan.is_popular && (
              <span style={{ position: "absolute", top: -10, left: 20, background: "var(--gv-color-primary-500)", color: "white", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, fontFamily: "var(--gv-font-body)" }}>POPULAR</span>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)" }}>{plan.name}</div>
                <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>/{plan.slug}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                color: plan.is_active ? "var(--gv-color-success-700)" : "var(--gv-color-neutral-500)",
                background: plan.is_active ? "var(--gv-color-success-50)" : "var(--gv-color-neutral-100)",
                fontFamily: "var(--gv-font-body)",
              }}>
                {plan.is_active ? "Aktif" : "Nonaktif"}
              </span>
            </div>

            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gv-color-primary-600)", fontFamily: "var(--gv-font-heading)", marginBottom: 4 }}>{fmt(plan.price_idr)}</div>
            <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)", marginBottom: 12 }}>/ {plan.billing_cycle === "monthly" ? "bulan" : plan.billing_cycle === "annual" ? "tahun" : "seumur hidup"}</div>

            {plan.description && (
              <div style={{ fontSize: 13, color: "var(--gv-color-neutral-600)", fontFamily: "var(--gv-font-body)", marginBottom: 12 }}>{plan.description}</div>
            )}

            <div style={{ marginBottom: 16 }}>
              {(plan.features || []).slice(0, 4).map((f, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--gv-color-neutral-700)", fontFamily: "var(--gv-font-body)", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--gv-color-success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </div>
              ))}
              {(plan.features || []).length > 4 && (
                <div style={{ fontSize: 12, color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>+{plan.features.length - 4} fitur lainnya</div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openEdit(plan)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--gv-color-neutral-300)", background: "white", cursor: "pointer", fontFamily: "var(--gv-font-body)", fontSize: 13, fontWeight: 600 }}>Edit</button>
              <button onClick={() => toggleActive(plan)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "var(--gv-font-body)", fontSize: 13, fontWeight: 600,
                background: plan.is_active ? "var(--gv-color-warning-50)" : "var(--gv-color-success-50)",
                color: plan.is_active ? "var(--gv-color-warning-700)" : "var(--gv-color-success-700)",
              }}>
                {plan.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button onClick={() => setDeleteId(plan.id)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--gv-color-danger-200)", background: "var(--gv-color-danger-50)", cursor: "pointer", color: "var(--gv-color-danger-600)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2.5a1 1 0 012 0v1M5 3.5l.5 8M9 3.5l-.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
