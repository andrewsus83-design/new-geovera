import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// PATCH /api/tasks/[id]
// Persists task actions: complete, snooze, dismiss/reject
// Called from calendar/tasks UI when user acts on a task

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vozjwptzutolvkvfpknk.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

type TaskAction = "complete" | "snooze" | "dismiss" | "reject" | "in_progress";

interface PatchBody {
  action: TaskAction;
  reason?: string;        // optional reason for reject/dismiss
  snooze_hours?: number;  // hours to snooze (default 24)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const { id: taskId } = await params;
  const body: PatchBody = await request.json().catch(() => ({})) as PatchBody;
  const { action, reason, snooze_hours = 24 } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400, headers: cors });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Build update payload based on action
  const now = new Date().toISOString();
  let updatePayload: Record<string, unknown>;

  switch (action) {
    case "complete":
      updatePayload = {
        status: "completed",
        completed_at: now,
        updated_at: now,
      };
      break;

    case "in_progress":
      updatePayload = {
        status: "in_progress",
        started_at: now,
        updated_at: now,
      };
      break;

    case "snooze":
      updatePayload = {
        status: "snoozed",
        snoozed_until: new Date(Date.now() + snooze_hours * 3_600_000).toISOString(),
        updated_at: now,
      };
      break;

    case "dismiss":
    case "reject":
      updatePayload = {
        status: "dismissed",
        dismiss_reason: reason ?? null,
        dismissed_at: now,
        updated_at: now,
      };
      break;

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400, headers: cors });
  }

  const { data, error } = await sb
    .from("gv_tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .select("id, status, updated_at")
    .single();

  if (error) {
    console.error("[PATCH /api/tasks/:id] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  }

  // If task was rejected/dismissed — optionally feed to training data for learning loop
  if ((action === "reject" || action === "dismiss") && reason) {
    await sb.from("gv_content_training_data").insert({
      brand_id: data?.id ?? null,   // Will be resolved below if needed
      content_type: "task_feedback",
      feedback_type: action,
      feedback_text: reason,
      source_id: taskId,
      source_table: "gv_tasks",
      created_at: now,
    }).then(({ error: fbErr }) => {
      if (fbErr) console.warn("[PATCH /api/tasks/:id] Training data insert failed:", fbErr.message);
    });
  }

  // Update gv_daily_insights aggregate counters
  if (action === "complete") {
    await sb.rpc("increment_daily_insight_counter", {
      p_task_id: taskId,
      p_field: "tasks_completed",
    }).then(({ error: rpcErr }) => {
      if (rpcErr) console.warn("[PATCH /api/tasks/:id] Counter RPC failed:", rpcErr.message);
    });
  } else if (action === "snooze") {
    await sb.rpc("increment_daily_insight_counter", {
      p_task_id: taskId,
      p_field: "tasks_snoozed",
    }).then(({ error: rpcErr }) => {
      if (rpcErr) console.warn("[PATCH /api/tasks/:id] Counter RPC failed:", rpcErr.message);
    });
  } else if (action === "dismiss" || action === "reject") {
    await sb.rpc("increment_daily_insight_counter", {
      p_task_id: taskId,
      p_field: "tasks_dismissed",
    }).then(({ error: rpcErr }) => {
      if (rpcErr) console.warn("[PATCH /api/tasks/:id] Counter RPC failed:", rpcErr.message);
    });
  }

  return NextResponse.json(
    { ok: true, task_id: taskId, action, ...data },
    { status: 200, headers: cors }
  );
}
