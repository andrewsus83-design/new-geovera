import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KIE_BASE = "https://api.kie.ai/v1";

interface GenerateImageRequest {
  brand_id: string;
  prompt: string;
  target_platforms?: string[];
  aspect_ratio?: string;
  model?: string;
  negative_prompt?: string;
  lora_model?: string;
}

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
    const kieKey = Deno.env.get("KIE_API_KEY");
    if (!kieKey) {
      return new Response(
        JSON.stringify({ success: false, error: "KIE API key not configured" }),
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

    const requestData: GenerateImageRequest = await req.json();
    const {
      brand_id,
      prompt,
      target_platforms = ["instagram"],
      aspect_ratio = "1:1",
      model = "flux-2-pro",
      negative_prompt = "",
      lora_model = "",
    } = requestData;

    // Check brand + subscription
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

    if (!brand.subscription_tier || brand.subscription_tier === "free") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Image generation requires a paid subscription",
          code: "SUBSCRIPTION_REQUIRED",
          current_tier: brand.subscription_tier || "free",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch brand visual guidelines for enhanced prompt
    const { data: vg } = await supabaseClient
      .from("gv_brand_visual_guidelines")
      .select("style_keywords, visual_style, primary_colors, secondary_colors, accent_colors, image_prompt_template, lighting_preference, composition_preferences, background_preference, negative_keywords, training_status")
      .eq("brand_id", brand_id)
      .single();

    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (vg && vg.training_status === "trained") {
      if (vg.image_prompt_template) {
        enhancedPrompt = vg.image_prompt_template
          .replace("{brand_name}", brand.name)
          .replace("{prompt}", prompt)
          .replace("{style_keywords}", vg.style_keywords?.join(", ") || "modern")
          .replace("{composition_preferences}", vg.composition_preferences?.[0] || "balanced")
          .replace("{lighting_preference}", vg.lighting_preference || "natural");
      } else {
        const parts = [`Professional brand image for ${brand.name}: ${prompt}`];
        if (vg.style_keywords?.length) parts.push(`Style: ${vg.style_keywords.join(", ")}`);
        if (vg.visual_style) parts.push(`${vg.visual_style} aesthetic`);
        if (vg.lighting_preference) parts.push(`${vg.lighting_preference} lighting`);
        if (vg.composition_preferences?.[0]) parts.push(`Composition: ${vg.composition_preferences[0]}`);
        const colors = [...(vg.primary_colors || []), ...(vg.secondary_colors || []), ...(vg.accent_colors || [])];
        if (colors.length) parts.push(`Colors: ${colors.slice(0, 4).join(", ")}`);
        enhancedPrompt = parts.join(". ") + ". High quality, professional.";
      }
    }

    console.log("[generate-image] KIE Flux 2 Pro prompt:", enhancedPrompt.slice(0, 100));

    // ── Call KIE API — Flux 2 Pro ─────────────────────────────────────────────
    const payload: Record<string, unknown> = {
      prompt: enhancedPrompt,
      negative_prompt,
      aspect_ratio,
      model,
      num_images: 1,
    };
    if (lora_model) payload.lora_model = lora_model;

    const kieRes = await fetch(`${KIE_BASE}/image/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const kieData = await kieRes.json();

    if (!kieRes.ok) {
      throw new Error(`KIE API error ${kieRes.status}: ${JSON.stringify(kieData)}`);
    }

    const task_id = kieData.task_id ?? kieData.id ?? null;
    const image_url = kieData.image_url ?? kieData.url ?? null;
    const status = kieData.status ?? (image_url ? "completed" : "processing");

    // Save to gv_image_generations
    const { data: dbRecord, error: dbErr } = await supabaseClient
      .from("gv_image_generations")
      .insert({
        brand_id,
        prompt_text: enhancedPrompt,
        negative_prompt,
        aspect_ratio,
        ai_provider: "kie",
        ai_model: kieData.model ?? model,
        image_url,
        thumbnail_url: kieData.thumbnail_url ?? null,
        status,
        target_platform: target_platforms[0] ?? "instagram",
        style_preset: lora_model || null,
      })
      .select("id")
      .single();

    if (dbErr) console.error("[generate-image] DB insert failed:", dbErr.message);

    return new Response(
      JSON.stringify({
        success: true,
        task_id,
        db_id: dbRecord?.id ?? null,
        image_url,
        status,
        ai_provider: "kie",
        model: kieData.model ?? model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-image] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message, code: "GENERATION_FAILED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
