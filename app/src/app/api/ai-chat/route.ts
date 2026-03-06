import { NextRequest, NextResponse } from "next/server";

/**
 * /api/ai-chat — Next.js proxy for the Supabase ai-chat edge function.
 *
 * Unlike other edge function proxies (which use the service role key),
 * this route forwards the user's own JWT. The ai-chat edge function
 * validates the JWT server-side to identify the authenticated user.
 *
 * Flow: Browser → POST /api/ai-chat (with user JWT) → Edge Function ai-chat
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://vozjwptzutolvkvfpknk.supabase.co";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: cors }
  );
}

export async function POST(request: NextRequest) {
  try {
    // The ai-chat edge function validates the JWT itself — forward it as-is
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Authorization header with Bearer token required" },
        { status: 401, headers: cors }
      );
    }

    const body: unknown = await request.json();

    // Basic shape validation — guard against malformed requests
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400, headers: cors }
      );
    }

    const { brand_id, message } = body as Record<string, unknown>;
    if (!brand_id || !message) {
      return NextResponse.json(
        { success: false, error: "brand_id and message are required" },
        { status: 400, headers: cors }
      );
    }

    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader, // forward user JWT — NOT service role key
      },
      body: JSON.stringify(body),
    });

    const ct = upstream.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: `Edge function unavailable (HTTP ${upstream.status})`,
          code: "EDGE_FUNCTION_ERROR",
        },
        { status: 502, headers: cors }
      );
    }

    const result = await upstream.json();
    return NextResponse.json(result, {
      status: upstream.ok ? 200 : upstream.status,
      headers: cors,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[api/ai-chat] Error:", error);
    return NextResponse.json(
      { success: false, error: msg, code: "PROXY_ERROR" },
      { status: 500, headers: cors }
    );
  }
}
