import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--gv-color-bg-base)",
      fontFamily: "var(--gv-font-body)",
      padding: "24px",
      textAlign: "center",
    }}>
      <p style={{ fontSize: "72px", fontWeight: 700, color: "var(--gv-color-neutral-200)", margin: "0 0 8px", lineHeight: 1 }}>404</p>
      <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 12px", fontFamily: "var(--gv-font-heading)" }}>
        Halaman tidak ditemukan
      </h1>
      <p style={{ fontSize: "14px", color: "var(--gv-color-neutral-500)", margin: "0 0 28px" }}>
        Halaman yang kamu cari tidak ada.
      </p>
      <Link href="/" style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "10px 20px",
        background: "var(--gv-color-primary-500)",
        color: "white",
        fontSize: "14px",
        fontWeight: 600,
        textDecoration: "none",
      }}>
        Kembali ke Beranda
      </Link>
    </div>
  );
}
