"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SETTING_LABELS: Record<string, { label: string; placeholder: string; multiline?: boolean }> = {
  bank_name:         { label: "Nama Bank", placeholder: "BCA / Mandiri / BNI / BRI" },
  bank_account_no:   { label: "Nomor Rekening", placeholder: "1234567890" },
  bank_account_name: { label: "Nama Pemilik Rekening", placeholder: "PT GeoVera Indonesia" },
  bank_transfer_note:{ label: "Catatan Transfer", placeholder: "Mohon cantumkan nomor invoice sebagai keterangan transfer", multiline: true },
  support_email:     { label: "Email Support", placeholder: "support@geovera.xyz" },
  app_name:          { label: "Nama Aplikasi", placeholder: "GeoVera" },
};


export default function BackendSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("key, value").then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
      setSettings(map);
      setLoading(false);
    });
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function save() {
    setSaving(true);
    const updates = Object.entries(settings).map(([key, value]) =>
      supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" })
    );
    await Promise.all(updates);
    setSaving(false);
    showToast("Pengaturan berhasil disimpan!");
  }

  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: "var(--gv-color-neutral-900)", color: "white", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontFamily: "var(--gv-font-body)", boxShadow: "var(--gv-shadow-modal)" }}>{toast}</div>
      )}

      <h1 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 8px" }}>
        Pengaturan Aplikasi
      </h1>
      <p style={{ fontSize: 14, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", margin: "0 0 32px" }}>
        Kelola informasi bank dan pengaturan umum platform GeoVera.
      </p>

      {loading ? (
        <div style={{ color: "var(--gv-color-neutral-400)", fontFamily: "var(--gv-font-body)" }}>Memuat…</div>
      ) : (
        <>
          {/* Bank Info Section */}
          <div style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-card)", padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 15, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="9" rx="1.5" stroke="var(--gv-color-primary-500)" strokeWidth="1.3"/><path d="M1 8h14" stroke="var(--gv-color-primary-500)" strokeWidth="1.3"/><path d="M4 5V3.5a4 4 0 018 0V5" stroke="var(--gv-color-primary-500)" strokeWidth="1.3"/></svg>
              Informasi Rekening Bank
            </h2>
            {["bank_name", "bank_account_no", "bank_account_name", "bank_transfer_note"].map(key => {
              const meta = SETTING_LABELS[key];
              return (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", marginBottom: 6, fontFamily: "var(--gv-font-body)" }}>
                    {meta.label}
                  </label>
                  {meta.multiline ? (
                    <textarea
                      value={settings[key] || ""}
                      onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                      placeholder={meta.placeholder}
                      style={{ width: "100%", height: 80, padding: "10px 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", resize: "vertical", boxSizing: "border-box", outline: "none" }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={settings[key] || ""}
                      onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                      placeholder={meta.placeholder}
                      style={{ width: "100%", height: 42, padding: "0 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", boxSizing: "border-box", outline: "none" }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* General Settings */}
          <div style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-card)", padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 15, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="var(--gv-color-primary-500)" strokeWidth="1.3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" stroke="var(--gv-color-primary-500)" strokeWidth="1.3" strokeLinecap="round"/></svg>
              Pengaturan Umum
            </h2>
            {["app_name", "support_email"].map(key => {
              const meta = SETTING_LABELS[key];
              return (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-700)", marginBottom: 6, fontFamily: "var(--gv-font-body)" }}>
                    {meta.label}
                  </label>
                  <input
                    type="text"
                    value={settings[key] || ""}
                    onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    placeholder={meta.placeholder}
                    style={{ width: "100%", height: 42, padding: "0 12px", border: "1.5px solid var(--gv-color-neutral-200)", borderRadius: 8, fontSize: 14, fontFamily: "var(--gv-font-body)", boxSizing: "border-box", outline: "none" }}
                  />
                </div>
              );
            })}
          </div>

          <button
            disabled={saving}
            onClick={save}
            style={{
              width: "100%", height: 48, borderRadius: 10, border: "none",
              background: saving ? "var(--gv-color-primary-300)" : "var(--gv-color-primary-500)",
              color: "white", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "var(--gv-font-body)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {saving ? (
              <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", animation: "gv-spin 0.8s linear infinite" }} />Menyimpan…</>
            ) : "Simpan Pengaturan"}
          </button>
        </>
      )}
    </div>
  );
}
