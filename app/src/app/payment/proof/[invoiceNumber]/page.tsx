"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProofUploadPage({ params }: { params: Promise<{ invoiceNumber: string }> }) {
  const { invoiceNumber } = use(params);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [subId, setSubId] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/signin"); return; }

      const { data } = await supabase
        .from("subscriptions")
        .select("id, proof_url")
        .eq("invoice_number", invoiceNumber)
        .eq("user_id", session.user.id)
        .single();

      if (!data) { router.replace("/pricing"); return; }
      if (data.proof_url) setDone(true);
      setSubId(data.id);
    }
    check();
  }, [invoiceNumber, router]);

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      setError("Hanya file gambar atau PDF yang diizinkan.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB.");
      return;
    }
    setError("");
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !subId || uploading) return;
    setUploading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop();
      const path = `proofs/${invoiceNumber}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("payment-proofs").getPublicUrl(path);

      await supabase.from("subscriptions").update({
        proof_url: publicUrl,
        proof_uploaded_at: new Date().toISOString(),
      }).eq("id", subId);

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload gagal. Coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--gv-color-bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div style={{
          maxWidth: 440,
          width: "100%",
          background: "var(--gv-color-bg-surface)",
          borderRadius: "var(--gv-radius-xl)",
          boxShadow: "var(--gv-shadow-modal)",
          padding: "48px 40px",
          textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "var(--gv-color-success-50)",
            border: "2px solid var(--gv-color-success-500)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l6 6L23 8" stroke="var(--gv-color-success-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gv-color-neutral-900)",
            margin: "0 0 12px",
          }}>
            Bukti Transfer Diterima!
          </h2>
          <p style={{
            fontSize: 15,
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}>
            Tim GeoVera akan memverifikasi pembayaranmu dalam <strong>1×24 jam</strong>.
            Kamu akan mendapat notifikasi email saat akun aktif.
          </p>
          <p style={{
            fontSize: 13,
            color: "var(--gv-color-neutral-400)",
            fontFamily: "var(--gv-font-body)",
          }}>
            No. Invoice: <strong style={{ color: "var(--gv-color-neutral-700)" }}>{invoiceNumber}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--gv-color-bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
    }}>
      <div style={{
        position: "fixed", inset: 0,
        background: "var(--gv-color-ai-glow)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        maxWidth: 480,
        width: "100%",
        background: "var(--gv-color-bg-surface)",
        borderRadius: "var(--gv-radius-xl)",
        boxShadow: "var(--gv-shadow-modal)",
        padding: "48px 40px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: "var(--gv-radius-md)",
            background: "var(--gv-color-primary-50)",
            border: "1px solid var(--gv-color-primary-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2v13M5 9l6-6 6 6M3 19h16" stroke="var(--gv-color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--gv-color-neutral-900)",
            margin: "0 0 8px",
          }}>
            Upload Bukti Transfer
          </h1>
          <p style={{
            fontSize: 14,
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            margin: 0,
          }}>
            Invoice <strong>{invoiceNumber}</strong> · Format: JPG, PNG, atau PDF · Maks. 5 MB
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => document.getElementById("proof-file-input")?.click()}
          style={{
            border: `2px dashed ${drag ? "var(--gv-color-primary-400)" : file ? "var(--gv-color-primary-300)" : "var(--gv-color-neutral-300)"}`,
            borderRadius: "var(--gv-radius-lg)",
            background: drag ? "var(--gv-color-primary-50)" : file ? "var(--gv-color-bg-surface-sunken)" : "var(--gv-color-bg-base)",
            padding: "32px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all var(--gv-duration-normal)",
            marginBottom: 20,
          }}
        >
          <input
            id="proof-file-input"
            type="file"
            accept="image/*,.pdf"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {preview ? (
            <img src={preview} alt="preview" style={{
              maxHeight: 180, maxWidth: "100%",
              borderRadius: "var(--gv-radius-sm)",
              objectFit: "contain",
            }} />
          ) : (
            <>
              <div style={{
                width: 44, height: 44,
                borderRadius: "var(--gv-radius-sm)",
                background: "var(--gv-color-neutral-100)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10M4 9l6-6 6 6M3 17h14" stroke="var(--gv-color-neutral-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: 14, color: "var(--gv-color-neutral-700)", margin: "0 0 4px", fontFamily: "var(--gv-font-body)", fontWeight: 500 }}>
                {file ? file.name : "Klik atau drag & drop file di sini"}
              </p>
              <p style={{ fontSize: 13, color: "var(--gv-color-neutral-400)", margin: 0, fontFamily: "var(--gv-font-body)" }}>
                JPG, PNG, PDF · Maks. 5 MB
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            padding: "10px 14px",
            borderRadius: "var(--gv-radius-sm)",
            background: "var(--gv-color-danger-50)",
            border: "1px solid #FECACA",
            fontSize: 14,
            color: "var(--gv-color-danger-700)",
            fontFamily: "var(--gv-font-body)",
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            width: "100%",
            height: 52,
            background: !file ? "var(--gv-color-neutral-200)" : "var(--gv-color-primary-500)",
            border: "none",
            borderRadius: "var(--gv-radius-md)",
            fontSize: 16,
            fontWeight: 600,
            color: !file ? "var(--gv-color-neutral-400)" : "white",
            cursor: !file || uploading ? "not-allowed" : "pointer",
            fontFamily: "var(--gv-font-body)",
            transition: "all var(--gv-duration-normal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {uploading ? (
            <div style={{
              width: 18, height: 18,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "white",
              animation: "gv-spin 0.8s linear infinite",
            }} />
          ) : null}
          {uploading ? "Mengupload…" : "Kirim Bukti Transfer"}
        </button>
      </div>
    </div>
  );
}
