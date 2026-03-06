import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface GenerateVideoRequest {
  brand_id: string;
  prompt: string;
  duration?: number;          // seconds — default 5
  aspect_ratio?: string;      // "9:16" | "16:9" | "1:1"
  target_platform?: string;
}

// Sora-2 size map
const SORA_SIZE: Record<string, string> = {
  "9:16": "1080x1920",
  "16:9": "1920x1080",
  "1:1": "1080x1080",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: GenerateVideoRequest = await req.json();
    const {
      brand_id,
      prompt,
      duration = 5,
      aspect_ratio = "9:16",
      target_platform = "tiktok",
    } = requestData;

    // Premium/Partner only for video
    const { data: brand, error: brandError } = await supabaseClient
      .from("gv_brands")
      .select("subscription_tier, name")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ success: false, error: "Brand not found", code: "BRAND_NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tier = brand.subscription_tier ?? "free";
    if (tier === "free" || tier === "basic") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Video generation requires Premium or Partner subscription",
          code: "TIER_INSUFFICIENT",
          current_tier: tier,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap duration per tier
    const maxDuration = tier === "partner" ? 20 : 10;
    const clampedDuration = Math.min(duration, maxDuration);

    const size = SORA_SIZE[aspect_ratio] ?? "1080x1920";

    console.log(`[generate-video] Sora-2 job: ${clampedDuration}s ${size}`);

    // ── Submit async job to OpenAI Sora 2 ────────────────────────────────────
    const soraRes = await fetch("https://api.openai.com/v1/video/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sora-2",
        prompt,
        n: 1,
        size,
        quality: "high",
        duration: clampedDuration,
      }),
    });

    const soraData = await soraRes.json();

    if (!soraRes.ok) {
      throw new Error(`OpenAI Sora error ${soraRes.status}: ${JSON.stringify(soraData)}`);
    }

    const task_id = soraData.id ?? null;
    const status = soraData.status ?? "queued";

    // Save to gv_video_generations
    const { data: dbRecord, error: dbErr } = await supabaseClient
      .from("gv_video_generations")
      .insert({
        brand_id,
        target_platform,
        hook: prompt,
        ai_model: "sora-2",
        status,
        generation_mode: "openai",
        runway_task_id: task_id,
        video_url: null,
        video_thumbnail_url: null,
        video_aspect_ratio: aspect_ratio,
        video_status: status,
      })
      .select("id")
      .single();

    if (dbErr) console.error("[generate-video] DB insert failed:", dbErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        task_id,
        db_id: dbRecord?.id ?? null,
        status,
        duration: clampedDuration,
        generation_mode: "openai",
        model: "sora-2",
        // Poll via: content-studio-handler check_task with generation_mode="openai"
        poll_instruction: "Use content-studio-handler action=check_task with generation_mode=openai",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-video] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message, code: "GENERATION_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
