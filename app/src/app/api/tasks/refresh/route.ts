import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/tasks/refresh
// Tier-gated manual refresh for 72H task cycle
// Basic: 1x | Premium: 2x | Partner: 3x per 72H window

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vozjwptzutolvkvfpknk.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const REFRESH_LIMITS: Record<string, number> = {
  basic: 1,
  premium: 2,
  partner: 3,
};

export async function POST(request: NextRequest) {
  // Auth: get user from bearer token
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get brand_id for this user
  let { brand_id } = await request.json().catch(() => ({})) as { brand_id?: string };
  if (!brand_id) {
    const { data: ub } = await sb
      .from("user_brands")
      .select("brand_id")
      .eq("user_id", user.id)
      .maybeSingle();
    brand_id = ub?.brand_id;
  }
  if (!brand_id) {
    return NextResponse.json({ error: "No brand found for this user" }, { status: 404 });
  }

  // Get subscription tier
  const { data: sub } = await sb
    .from("gv_subscriptions")
    .select("plan_id")
    .eq("brand_id", brand_id)
    .eq("status", "active")
    .maybeSingle();
  const tier = (sub?.plan_id ?? "basic") as string;
  const refreshLimit = REFRESH_LIMITS[tier] ?? 1;

  // Get active cycle
  const { data: cycle } = await sb
    .from("gv_task_cycles")
    .select("id, status, refresh_count, refresh_limit, expires_at, tasks_generated, tier")
    .eq("brand_id", brand_id)
    .in("status", ["done", "partial", "failed", "running"])
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    // No active cycle — trigger fresh cycle instead
    const fnRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/intelligence-72h`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ brand_id, tier, force: false }),
    });
    const fnData = await fnRes.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      action: "new_cycle",
      message: "No active cycle found, started new 72H cycle",
      ...fnData,
    });
  }

  // Check refresh limit
  const usedRefreshes = cycle.refresh_count ?? 0;
  if (usedRefreshes >= refreshLimit) {
    const expiresAt = new Date(cycle.expires_at);
    const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000));
    return NextResponse.json({
      ok: false,
      error: "refresh_limit_reached",
      message: `You have used all ${refreshLimit} refreshes for this cycle.`,
      tier,
      refresh_used: usedRefreshes,
      refresh_limit: refreshLimit,
      cycle_expires_in_hours: hoursLeft,
      upgrade_available: tier !== "partner",
    }, { status: 429 });
  }

  // Increment refresh count immediately (pessimistic lock)
  const { error: updateErr } = await sb
    .from("gv_task_cycles")
    .update({
      refresh_count: usedRefreshes + 1,
      status: "running",
    })
    .eq("id", cycle.id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update cycle" }, { status: 500 });
  }

  // Trigger intelligence-72h with force=true (skip existing cycle check)
  // Lightweight: skip Firecrawl scraping for refresh (faster ~30s vs ~90s)
  const fnRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/intelligence-72h`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ brand_id, tier, force: true }),
  });

  const fnData = await fnRes.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    action: "refreshed",
    tier,
    refresh_used: usedRefreshes + 1,
    refresh_limit: refreshLimit,
    refresh_remaining: refreshLimit - (usedRefreshes + 1),
    cycle_id: cycle.id,
    ...fnData,
  });
}
