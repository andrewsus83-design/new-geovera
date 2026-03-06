"use client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen" style={{ background: "var(--gv-color-bg-base)" }}>
      {children}
    </div>
  );
}
