import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vozjwptzutolvkvfpknk.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FONNTE_API = "https://api.fonnte.com/send";

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const { brand_slug, wa_number } = await request.json();
    if (!brand_slug || !wa_number) {
      return NextResponse.json({ ok: false, error: "brand_slug dan wa_number wajib diisi" }, { status: 400 });
    }

    const wa = String(wa_number).replace(/\D/g, "");
    const slug = String(brand_slug).toLowerCase().trim();

    const supabase = getSupabase();

    // Find brand by slug
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand tidak ditemukan" }, { status: 404 });
    }

    // Find user in brand_users OR brand owner
    const { data: brandUser } = await supabase
      .from("brand_users")
      .select("id, user_id, name")
      .eq("brand_id", brand.id)
      .eq("wa_number", wa)
      .eq("is_active", true)
      .maybeSingle();

    const { data: brandOwner } = await supabase
      .from("brands")
      .select("user_id")
      .eq("id", brand.id)
      .eq("wa_number", wa)
      .maybeSingle();

    if (!brandUser && !brandOwner) {
      return NextResponse.json({ ok: false, error: "Nomor WhatsApp tidak terdaftar untuk brand ini" }, { status: 403 });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Upsert OTP in wa_otp table
    await supabase.from("wa_otp").delete().eq("brand_slug", slug).eq("wa_number", wa);
    await supabase.from("wa_otp").insert({
      brand_slug: slug,
      wa_number: wa,
      otp_code: otp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
      attempts: 0,
      verified: false,
    });

    // Send OTP via Fonnte
    const { data: device } = await supabase
      .from("wa_devices")
      .select("fonnte_token")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const fontteToken = device?.fonnte_token
      ? (String(device.fonnte_token).match(/^[A-Z][A-Z0-9_]+$/)
        ? process.env[device.fonnte_token] ?? ""
        : device.fonnte_token)
      : process.env.FONNTE_TOKEN ?? "";

    if (fontteToken) {
      const msg = `*GeoVera Login OTP*\n\nKode OTP kamu: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan ke siapapun.`;
      await fetch(FONNTE_API, {
        method: "POST",
        headers: { Authorization: fontteToken, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ target: wa, message: msg, countryCode: "62" }).toString(),
      });
    }

    return NextResponse.json({ ok: true, message: "OTP terkirim ke WhatsApp kamu" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
