import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vozjwptzutolvkvfpknk.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { brand_slug, wa_number, otp_code } = await request.json();
    if (!brand_slug || !wa_number || !otp_code) {
      return NextResponse.json({ ok: false, error: "Data tidak lengkap" }, { status: 400 });
    }

    const wa = String(wa_number).replace(/\D/g, "");
    const slug = String(brand_slug).toLowerCase().trim();

    const supabase = getSupabase();

    // Find and validate OTP
    const { data: otpRow } = await supabase
      .from("wa_otp")
      .select("*")
      .eq("brand_slug", slug)
      .eq("wa_number", wa)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return NextResponse.json({ ok: false, error: "OTP tidak valid atau sudah kadaluarsa" }, { status: 400 });
    }

    // Check attempts (max 5)
    if ((otpRow.attempts ?? 0) >= 5) {
      return NextResponse.json({ ok: false, error: "Terlalu banyak percobaan. Minta OTP baru." }, { status: 429 });
    }

    if (otpRow.otp_code !== String(otp_code).trim()) {
      await supabase.from("wa_otp").update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq("id", otpRow.id);
      return NextResponse.json({ ok: false, error: "OTP salah" }, { status: 400 });
    }

    // Mark OTP as verified
    await supabase.from("wa_otp").update({ verified: true }).eq("id", otpRow.id);

    // Find user_id from brand_users
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand tidak ditemukan" }, { status: 404 });
    }

    const { data: brandUser } = await supabase
      .from("brand_users")
      .select("user_id")
      .eq("brand_id", brand.id)
      .eq("wa_number", wa)
      .eq("is_active", true)
      .maybeSingle();

    const userId = brandUser?.user_id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "User tidak ditemukan" }, { status: 404 });
    }

    // Get user email from auth.users
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !user?.email) {
      return NextResponse.json({ ok: false, error: "Akun tidak ditemukan" }, { status: 404 });
    }

    // Generate magic link token (server-side, no email sent)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://geovera.geovera.xyz"}/analytics` },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return NextResponse.json({ ok: false, error: "Gagal buat sesi" }, { status: 500 });
    }

    // Update last_login_at
    await supabase
      .from("brand_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("brand_id", brand.id)
      .eq("wa_number", wa);

    return NextResponse.json({
      ok: true,
      token_hash: linkData.properties.hashed_token,
      type: "email" as const,
      redirect: "/analytics",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
