"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_idr: number;
  billing_cycle: string;
  features: string[];
  is_popular: boolean;
}

interface BankSettings {
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  bank_transfer_note: string;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [bankSettings, setBankSettings] = useState<BankSettings | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; full_name?: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState<{ invoice_number: string; plan: Plan } | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace("/signin"); return; }
      setUser({
        id: session.user.id,
        email: session.user.email || "",
        full_name: session.user.user_metadata?.full_name,
      });

      // Check existing subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("status, invoice_number, plan_id")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingSub?.status === "active") { router.replace("/getting-started"); return; }
      if (existingSub?.status === "proof_uploaded") { setExistingStatus("proof_uploaded"); }
      if (existingSub?.status === "pending_payment") { setExistingStatus("pending_payment"); }

      // Fetch plans and bank settings in parallel
      const [{ data: plansData }, { data: settingsData }] = await Promise.all([
        supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("app_settings").select("key,value"),
      ]);

      if (plansData) setPlans(plansData.map(p => ({ ...p, features: p.features as string[] })));
      if (settingsData) {
        const s: Record<string, string> = {};
        settingsData.forEach(r => { s[r.key] = r.value; });
        setBankSettings({
          bank_name: s.bank_name || "",
          bank_account_no: s.bank_account_no || "",
          bank_account_name: s.bank_account_name || "",
          bank_transfer_note: s.bank_transfer_note || "",
        });
      }
      setLoading(false);
    }
    init();
  }, [router]);

  const handleSelectPlan = async (plan: Plan) => {
    if (submitting || !user) return;
    setSelectedPlan(plan);
    setSubmitting(true);
    try {
      // Create subscription record
      const { data: sub, error } = await supabase
        .from("subscriptions")
        .insert({ user_id: user.id, plan_id: plan.id, status: "pending_payment" })
        .select("invoice_number")
        .single();

      if (error) throw error;

      // Trigger invoice email via edge function
      await supabase.functions.invoke("send-invoice", {
        body: {
          user_id: user.id,
          email: user.email,
          full_name: user.full_name || user.email,
          plan_name: plan.name,
          plan_price: plan.price_idr,
          invoice_number: sub.invoice_number,
          bank_settings: bankSettings,
        },
      }).catch(() => null); // Non-blocking — email best effort

      setInvoiceCreated({ invoice_number: sub.invoice_number, plan });
    } catch (err) {
      console.error("Error creating subscription:", err);
      alert("Gagal membuat invoice. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--gv-color-bg-base)" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--gv-color-neutral-200)", borderTopColor: "var(--gv-color-primary-500)", animation: "gv-spin 0.8s linear infinite" }} />
      </div>
    );
  }

  // Waiting for approval screen
  if (existingStatus === "proof_uploaded") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--gv-color-bg-base)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, width: "100%", background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-xl)", boxShadow: "var(--gv-shadow-modal)", padding: "48px 40px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gv-color-primary-50)", border: "2px solid var(--gv-color-primary-300)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="var(--gv-color-primary-500)" strokeWidth="2"/><path d="M14 9v5l3 3" stroke="var(--gv-color-primary-500)" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <h2 style={{ fontFamily: "var(--gv-font-heading)", fontSize: 22, fontWeight: 700, color: "var(--gv-color-neutral-900)", margin: "0 0 12px" }}>
            Bukti Transfer Sedang Diverifikasi
          </h2>
          <p style={{ fontSize: 15, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)", lineHeight: 1.6, margin: 0 }}>
            Tim GeoVera akan memverifikasi pembayaranmu dalam <strong>1×24 jam</strong>. Kamu akan mendapat notifikasi email saat akun diaktifkan.
          </p>
          <button
            onClick={() => { supabase.auth.signOut(); router.replace("/signin"); }}
            style={{ marginTop: 28, padding: "10px 24px", borderRadius: 8, border: "1px solid var(--gv-color-neutral-300)", background: "white", cursor: "pointer", fontSize: 14, fontFamily: "var(--gv-font-body)", color: "var(--gv-color-neutral-600)" }}
          >
            Keluar
          </button>
        </div>
      </div>
    );
  }

  // Invoice success screen
  if (invoiceCreated) {
    return (
      <InvoiceScreen
        invoice={invoiceCreated}
        bank={bankSettings!}
        userEmail={user?.email || ""}
        onUploadProof={() => router.push(`/payment/proof/${invoiceCreated.invoice_number}`)}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "var(--gv-color-bg-base)",
      position: "relative",
    }}>
      {/* AI glow */}
      <div style={{
        position: "fixed",
        inset: 0,
        background: "var(--gv-color-ai-glow)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "64px 24px 80px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 56px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: "var(--gv-radius-full)",
            background: "var(--gv-color-primary-50)",
            border: "1px solid var(--gv-color-primary-200)",
            marginBottom: 20,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gv-color-primary-500)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-primary-700)", fontFamily: "var(--gv-font-body)" }}>
              Pilih plan terbaik untuk kamu
            </span>
          </div>
          <h1 style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: "clamp(28px, 5vw, 40px)",
            fontWeight: 700,
            color: "var(--gv-color-neutral-900)",
            margin: "0 0 16px",
            lineHeight: 1.2,
          }}>
            Mulai perjalanan{" "}
            <span style={{ color: "var(--gv-color-primary-500)" }}>GeoVera</span>
          </h1>
          <p style={{
            fontSize: 17,
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            margin: 0,
            lineHeight: 1.6,
          }}>
            Selamat datang{user?.full_name ? `, ${user.full_name}` : ""}! Pilih plan yang sesuai kebutuhan brand kamu.
          </p>
        </div>

        {/* Plans Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
          gap: 24,
          maxWidth: 980,
          margin: "0 auto",
        }}>
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              loading={submitting && selectedPlan?.id === plan.id}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: "center",
          marginTop: 40,
          fontSize: 13,
          color: "var(--gv-color-neutral-400)",
          fontFamily: "var(--gv-font-body)",
        }}>
          Pembayaran melalui transfer bank · Invoice dikirim ke email · Cancel kapan saja
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, loading, onSelect }: {
  plan: Plan;
  loading: boolean;
  onSelect: (p: Plan) => void;
}) {
  const [hover, setHover] = useState(false);
  const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--gv-color-bg-surface)",
        borderRadius: "var(--gv-radius-xl)",
        border: plan.is_popular
          ? "2px solid var(--gv-color-primary-400)"
          : `1.5px solid ${hover ? "var(--gv-color-neutral-300)" : "var(--gv-color-neutral-200)"}`,
        padding: "32px 28px",
        boxShadow: plan.is_popular ? "0 8px 32px rgba(95,143,139,0.15)" : hover ? "var(--gv-shadow-card)" : "none",
        transition: "all var(--gv-duration-normal) var(--gv-easing-default)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {plan.is_popular && (
        <div style={{
          position: "absolute",
          top: -14,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--gv-gradient-primary)",
          color: "white",
          fontSize: 12,
          fontWeight: 700,
          padding: "4px 16px",
          borderRadius: "var(--gv-radius-full)",
          fontFamily: "var(--gv-font-body)",
          whiteSpace: "nowrap",
          letterSpacing: "0.04em",
        }}>
          PALING POPULER
        </div>
      )}

      {/* Plan name */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: "var(--gv-font-heading)",
          fontSize: 20,
          fontWeight: 700,
          color: "var(--gv-color-neutral-900)",
          margin: "0 0 6px",
        }}>
          {plan.name}
        </h2>
        <p style={{
          fontSize: 14,
          color: "var(--gv-color-neutral-500)",
          fontFamily: "var(--gv-font-body)",
          margin: 0,
          lineHeight: 1.5,
        }}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
        }}>
          <span style={{
            fontFamily: "var(--gv-font-heading)",
            fontSize: 36,
            fontWeight: 700,
            color: plan.is_popular ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-900)",
          }}>
            {formatIDR(plan.price_idr)}
          </span>
        </div>
        <p style={{
          fontSize: 13,
          color: "var(--gv-color-neutral-400)",
          fontFamily: "var(--gv-font-body)",
          margin: "4px 0 0",
        }}>
          per {plan.billing_cycle === "monthly" ? "bulan" : plan.billing_cycle === "annual" ? "tahun" : "sekali"}
        </p>
      </div>

      {/* Features */}
      <ul style={{
        listStyle: "none",
        padding: 0,
        margin: "0 0 28px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
      }}>
        {plan.features.map((f, i) => (
          <li key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: "var(--gv-color-neutral-700)",
            fontFamily: "var(--gv-font-body)",
          }}>
            <span style={{
              color: "var(--gv-color-primary-500)",
              flexShrink: 0,
              marginTop: 1,
            }}>
              <CheckIcon />
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan)}
        disabled={loading}
        style={{
          width: "100%",
          height: 48,
          background: plan.is_popular ? "var(--gv-color-primary-500)" : "transparent",
          border: plan.is_popular ? "none" : "1.5px solid var(--gv-color-neutral-300)",
          borderRadius: "var(--gv-radius-md)",
          fontSize: 15,
          fontWeight: 600,
          color: plan.is_popular ? "white" : "var(--gv-color-neutral-700)",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "var(--gv-font-body)",
          transition: "all var(--gv-duration-normal)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {loading ? (
          <div style={{
            width: 16, height: 16,
            borderRadius: "50%",
            border: `2px solid ${plan.is_popular ? "rgba(255,255,255,0.4)" : "var(--gv-color-neutral-300)"}`,
            borderTopColor: plan.is_popular ? "white" : "var(--gv-color-primary-500)",
            animation: "gv-spin 0.8s linear infinite",
          }} />
        ) : null}
        {loading ? "Memproses…" : `Pilih ${plan.name}`}
      </button>
    </div>
  );
}

function InvoiceScreen({ invoice, bank, userEmail, onUploadProof }: {
  invoice: { invoice_number: string; plan: Plan };
  bank: BankSettings;
  userEmail: string;
  onUploadProof: () => void;
}) {
  const formatIDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "var(--gv-color-bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
    }}>
      <div style={{
        position: "fixed", inset: 0,
        background: "var(--gv-color-ai-glow)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: "var(--gv-color-bg-surface)",
        borderRadius: "var(--gv-radius-xl)",
        boxShadow: "var(--gv-shadow-modal)",
        padding: "48px 40px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Success icon */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "var(--gv-color-success-50)",
            border: "2px solid var(--gv-color-success-500)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
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
            margin: "0 0 8px",
          }}>
            Invoice Berhasil Dibuat!
          </h2>
          <p style={{
            fontSize: 15,
            color: "var(--gv-color-neutral-500)",
            fontFamily: "var(--gv-font-body)",
            margin: 0,
          }}>
            Detail pembayaran dikirim ke <strong>{userEmail}</strong>
          </p>
        </div>

        {/* Invoice details */}
        <div style={{
          background: "var(--gv-color-bg-surface-sunken)",
          borderRadius: "var(--gv-radius-md)",
          padding: "20px 24px",
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)" }}>No. Invoice</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-body)" }}>{invoice.invoice_number}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)" }}>Plan</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-body)" }}>{invoice.plan.name}</span>
          </div>
          <div style={{ height: 1, background: "var(--gv-color-neutral-200)", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--gv-color-neutral-700)", fontFamily: "var(--gv-font-body)" }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--gv-color-primary-500)", fontFamily: "var(--gv-font-heading)" }}>
              {formatIDR(invoice.plan.price_idr)}
            </span>
          </div>
        </div>

        {/* Bank transfer info */}
        <div style={{
          background: "var(--gv-color-primary-50)",
          borderRadius: "var(--gv-radius-md)",
          border: "1px solid var(--gv-color-primary-200)",
          padding: "20px 24px",
          marginBottom: 28,
        }}>
          <p style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--gv-color-primary-700)",
            fontFamily: "var(--gv-font-body)",
            marginBottom: 14,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            Transfer ke rekening berikut
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Bank", bank.bank_name],
              ["No. Rekening", bank.bank_account_no],
              ["Atas Nama", bank.bank_account_name],
              ["Berita Transfer", invoice.invoice_number],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--gv-color-neutral-500)", fontFamily: "var(--gv-font-body)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-body)" }}>{val}</span>
              </div>
            ))}
          </div>
          <p style={{
            marginTop: 12,
            fontSize: 12,
            color: "var(--gv-color-primary-700)",
            fontFamily: "var(--gv-font-body)",
            lineHeight: 1.5,
          }}>
            {bank.bank_transfer_note}
          </p>
        </div>

        {/* Upload proof button */}
        <button
          onClick={onUploadProof}
          style={{
            width: "100%",
            height: 52,
            background: "var(--gv-color-primary-500)",
            border: "none",
            borderRadius: "var(--gv-radius-md)",
            fontSize: 16,
            fontWeight: 600,
            color: "white",
            cursor: "pointer",
            fontFamily: "var(--gv-font-body)",
            transition: "all var(--gv-duration-normal)",
            marginBottom: 12,
          }}
        >
          Upload Bukti Transfer
        </button>
        <p style={{
          textAlign: "center",
          fontSize: 13,
          color: "var(--gv-color-neutral-400)",
          fontFamily: "var(--gv-font-body)",
          margin: 0,
        }}>
          Akun akan aktif setelah admin memverifikasi pembayaran
        </p>
      </div>
    </div>
  );
}
