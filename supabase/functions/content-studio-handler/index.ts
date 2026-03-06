import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KIE_API_KEY = Deno.env.get("KIE_API_KEY") ?? "";
const KIE_BASE = "https://api.kie.ai/v1";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY") ?? "";
const HEYGEN_BASE = "https://api.heygen.com";

// Cloudflare Workers AI (Llama) — for training prompt engineering
const CF_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
const CF_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const CF_AI_GATEWAY_BASE = Deno.env.get("CF_AI_GATEWAY_BASE") ?? "";
const CF_WORKERS_AI = Deno.env.get("CF_AI_GATEWAY_WORKERS_AI")
  || (CF_AI_GATEWAY_BASE ? `${CF_AI_GATEWAY_BASE}/workers-ai` : "");
const LLAMA_FAST  = "@cf/meta/llama-3.1-8b-instruct";
const LLAMA_HEAVY = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// ── helpers ──────────────────────────────────────────────────────────────────

function kieHeaders() {
  return { "Authorization": `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" };
}

async function kiePost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    method: "POST", headers: kieHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`KIE API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function kieGet(path: string) {
  const res = await fetch(`${KIE_BASE}${path}`, { headers: kieHeaders() });
  if (!res.ok) throw new Error(`KIE API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// OpenAI Sora-2 — video generation for long durations (> 10s)
async function openAISoraGenerate(prompt: string, duration: number, aspectRatio: string): Promise<{ job_id: string; status: string }> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const sizeMap: Record<string, string> = { "9:16": "1080x1920", "16:9": "1920x1080", "1:1": "1080x1080" };
  const size = sizeMap[aspectRatio] ?? "1080x1920";
  const res = await fetch("https://api.openai.com/v1/video/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "sora-2", prompt, n: 1, size, quality: "high", duration }),
  });
  if (!res.ok) throw new Error(`OpenAI Sora error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { job_id: data.id, status: data.status ?? "queued" };
}

async function openAISoraPoll(jobId: string): Promise<{ status: string; video_url: string | null }> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch(`https://api.openai.com/v1/video/generations/${jobId}`, {
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
  });
  if (!res.ok) throw new Error(`OpenAI Sora poll error ${res.status}`);
  const data = await res.json();
  const video_url = data.generations?.[0]?.url ?? data.result?.url ?? null;
  return { status: data.status ?? "processing", video_url };
}

// HeyGen — avatar video generation (up to 3 minutes, YouTube format)
async function heygenGenerateAvatar(prompt: string, avatarId: string, voiceId: string): Promise<{ video_id: string }> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY not configured");
  const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: { "x-api-key": HEYGEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: "avatar", avatar_id: avatarId },
        voice: { type: "text", input_text: prompt, voice_id: voiceId },
      }],
      dimension: { width: 1920, height: 1080 },
      test: false,
    }),
  });
  if (!res.ok) throw new Error(`HeyGen error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.code !== 100) throw new Error(`HeyGen API error: ${data.message ?? "unknown"}`);
  return { video_id: data.data.video_id };
}

async function heygenPoll(videoId: string): Promise<{ status: string; video_url: string | null; thumbnail_url: string | null }> {
  if (!HEYGEN_API_KEY) throw new Error("HEYGEN_API_KEY not configured");
  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: { "x-api-key": HEYGEN_API_KEY },
  });
  if (!res.ok) throw new Error(`HeyGen poll error ${res.status}`);
  const data = await res.json();
  return {
    status: data.data?.status ?? "processing",
    video_url: data.data?.video_url ?? null,
    thumbnail_url: data.data?.thumbnail_url ?? null,
  };
}

// OpenAI — for high-quality smart prompts in image/video wizard steps
async function openAIChat(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// Cloudflare Llama — for training prompt engineering + smart looping learning
async function llamaChat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600,
  heavy = false,
): Promise<string> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) throw new Error("Cloudflare AI not configured");
  const model = heavy ? LLAMA_HEAVY : LLAMA_FAST;
  const hasGateway = CF_WORKERS_AI.length > 0;
  const url = hasGateway
    ? `${CF_WORKERS_AI}/${model}`
    : `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Cloudflare AI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result?.response?.trim() ?? "";
}

// ── today midnight UTC ────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const { action, brand_id, ...data } = body;

    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const noKieActions = ["check_daily_usage", "generate_smart_prompt", "submit_feedback"];
    if (!KIE_API_KEY && !noKieActions.includes(action)) {
      return new Response(JSON.stringify({ error: "KIE_API_KEY not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = (d: unknown, status = 200) =>
      new Response(JSON.stringify(d), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ── CHECK DAILY USAGE ────────────────────────────────────────────────────
    if (action === "check_daily_usage") {
      const midnight = todayISO();
      // 7 days ago (weekly window for HeyGen quota)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [imgRes, vidRes, avatarRes] = await Promise.all([
        supabase.from("gv_image_generations")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brand_id)
          .gte("created_at", midnight)
          .not("status", "in", '("failed","error","cancelled")'),
        supabase.from("gv_video_generations")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brand_id)
          .gte("created_at", midnight)
          .neq("ai_model", "heygen-avatar")
          .not("video_status", "in", '("failed","error","cancelled")'),
        supabase.from("gv_video_generations")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brand_id)
          .eq("ai_model", "heygen-avatar")
          .gte("created_at", weekAgo),  // counts ALL attempts (no retry = quota consumed even on fail)
      ]);
      return json({ success: true, images_today: imgRes.count ?? 0, videos_today: vidRes.count ?? 0, avatar_videos_this_week: avatarRes.count ?? 0 });
    }

    // ── GENERATE SMART PROMPT (OpenAI + history learning) ────────────────────
    if (action === "generate_smart_prompt") {
      const { prompt_type = "image", subject_type = "product" } = data;
      // Sanitize user-controlled fields — strip newlines/control chars, cap length (prevent prompt injection)
      const sanitize = (v: unknown, max = 200) =>
        String(v ?? "").replace(/[\n\r\t]/g, " ").replace(/[`${}]/g, "").trim().slice(0, max);
      const model_name  = sanitize(data.model_name);
      const topic_style = sanitize(data.topic_style);
      const task_context = sanitize(data.task_context);

      // Fetch recent successful generations + RLHF feedback learning data
      const [imgHistory, vidHistory, likedImgs, dislikedImgs] = await Promise.all([
        supabase.from("gv_image_generations")
          .select("prompt_text, status, target_platform, style_preset")
          .eq("brand_id", brand_id)
          .in("status", ["completed", "succeeded"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("gv_video_generations")
          .select("hook, video_status, target_platform")
          .eq("brand_id", brand_id)
          .in("video_status", ["completed", "succeeded"])
          .order("created_at", { ascending: false })
          .limit(3),
        supabase.from("gv_image_generations")
          .select("prompt_text")
          .eq("brand_id", brand_id)
          .eq("feedback", "liked")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("gv_image_generations")
          .select("prompt_text")
          .eq("brand_id", brand_id)
          .eq("feedback", "disliked")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const recentImgPrompts = (imgHistory.data ?? []).map((r: { prompt_text: string }) => `  - ${r.prompt_text}`).join("\n");
      const recentVidHooks = (vidHistory.data ?? []).map((r: { hook: string }) => `  - ${r.hook}`).join("\n");
      const likedList2 = (likedImgs.data ?? []).map((r: { prompt_text: string }) => r.prompt_text).filter(Boolean);
      const dislikedList2 = (dislikedImgs.data ?? []).map((r: { prompt_text: string }) => r.prompt_text).filter(Boolean);

      // ── Llama reverse engineering step (if feedback exists) ──────────────
      // Llama analyzes liked/disliked patterns → extracts rules → OpenAI uses those rules
      let llamaREInsights = "";
      if (likedList2.length > 0 || dislikedList2.length > 0) {
        try {
          llamaREInsights = await llamaChat(
            `You are an image quality pattern analyst. Reverse-engineer the quality signals from user-rated prompts.
Analyze LIKED vs DISLIKED prompts and extract precise rules:
- Lighting, composition, color, mood, style, background patterns
Output ONLY the structured rules (max 120 words):
✅ REPLICATE: [rules from liked]
❌ AVOID: [rules from disliked]`,
            `${likedList2.length > 0 ? `LIKED (${likedList2.length}): ${likedList2.join(" | ")}` : ""}
${dislikedList2.length > 0 ? `DISLIKED (${dislikedList2.length}): ${dislikedList2.join(" | ")}` : ""}`,
            250,
            false,
          );
        } catch (e) {
          console.error("Llama RE (smart prompt) failed:", e instanceof Error ? e.message : e);
        }
      }

      const subjectLabel = subject_type === "both" ? "character and product together" : subject_type;
      const isVideo = prompt_type === "video";

      const systemPrompt = `You are a world-class ${isVideo ? "video" : "photography"} director and creative AI prompt engineer for social media brands.

Your specialty is crafting highly specific, commercially powerful ${isVideo ? "video" : "image"} generation prompts that produce stunning, viral-worthy content.

Brand context:
- Subject: ${subjectLabel}${model_name ? ` — specifically "${model_name}"` : ""}
- Style/Topic: ${topic_style || "commercial brand content"}
${task_context ? `- Task context: ${task_context}` : ""}

Learning from this brand's recent successful content:
${recentImgPrompts ? `Recent images that worked:\n${recentImgPrompts}` : ""}
${recentVidHooks ? `Recent videos that worked:\n${recentVidHooks}` : ""}${llamaREInsights ? `\n\nRLHF Quality Rules (reverse-engineered by Llama from user ratings):\n${llamaREInsights}` : ""}

Rules:
1. Generate ONE highly detailed, specific prompt only — no explanation, no quotes, just the prompt
2. Include lighting style, composition, mood, setting, technical quality descriptors
3. Make it commercially optimized for social media (Instagram/TikTok)
4. Apply the RLHF quality rules above — replicate liked patterns, eliminate disliked patterns
5. Keep it under 150 words`;

      const userMsg = isVideo
        ? `Generate a compelling ${topic_style} video prompt for ${subjectLabel} content. Include movement, mood, setting, and style direction.`
        : `Generate a stunning commercial ${topic_style || "product"} photography prompt for ${subjectLabel}. Include lighting, composition, setting, and technical quality.`;

      const prompt = await openAIChat(systemPrompt, userMsg, 200);
      return json({ success: true, prompt });
    }

    // ── GENERATE SYNTHETICS (for training — uses Llama + Flux-2 Pro, bypasses daily quota) ──
    if (action === "generate_synthetics") {
      const { name, training_type = "product", count = 8, past_datasets = [] } = data;
      if (!name) return json({ error: "name is required" }, 400);

      const typeLabel = training_type === "character" ? "person/character" : "product";

      // Smart looping learning context from past training datasets
      const pastContext = Array.isArray(past_datasets) && past_datasets.length > 0
        ? `\n\nLearning from ${past_datasets.length} previously trained datasets in this brand:\n${past_datasets.map((d: { dataset_name: string; theme: string }) => `- ${d.dataset_name} (${d.theme})`).join("\n")}\nApply pattern recognition from these to create better-optimized training data.`
        : "";

      // ── STEP 1: Fetch RLHF feedback data for Llama reverse engineering ────
      const [likedRows, dislikedRows] = await Promise.all([
        supabase.from("gv_image_generations")
          .select("prompt_text")
          .eq("brand_id", brand_id)
          .eq("feedback", "liked")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("gv_image_generations")
          .select("prompt_text")
          .eq("brand_id", brand_id)
          .eq("feedback", "disliked")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const likedList = (likedRows.data ?? []).map((r: { prompt_text: string }) => r.prompt_text).filter(Boolean);
      const dislikedList = (dislikedRows.data ?? []).map((r: { prompt_text: string }) => r.prompt_text).filter(Boolean);

      // ── STEP 2: Llama reverse engineering — extract quality rules from feedback ──
      let reverseEngineeredRules = "";
      if (likedList.length > 0 || dislikedList.length > 0) {
        try {
          reverseEngineeredRules = await llamaChat(
            `You are an expert AI image quality analyst. Your job is to reverse-engineer patterns from user feedback to extract actionable quality rules for AI image prompt engineering.

Analyze the LIKED vs DISLIKED image prompts, then extract precise, structured quality rules:
- Examine lighting conditions, composition angles, background types, color tones, mood, style elements
- For LIKED: identify what consistently works — replicate these
- For DISLIKED: identify what consistently fails — eliminate these

Return a structured rule set (max 200 words):
✅ REPLICATE from liked:
- [specific rule]
❌ AVOID from disliked:
- [specific rule]`,
            `${likedList.length > 0 ? `LIKED prompts (${likedList.length}):\n${likedList.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "No liked examples yet."}

${dislikedList.length > 0 ? `DISLIKED prompts (${dislikedList.length}):\n${dislikedList.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "No disliked examples yet."}

Reverse-engineer the quality patterns. Be specific about technical elements (lighting, angles, backgrounds, style).`,
            400,
            true, // heavy Llama (70B) for RE — accuracy over speed for training quality
          );
        } catch (e) {
          console.error("Llama reverse engineering failed:", e instanceof Error ? e.message : e);
        }
      }

      const rlhfContext = reverseEngineeredRules
        ? `\n\nRLHF Reverse-Engineered Quality Rules (derived from this brand's user ratings):\n${reverseEngineeredRules}\n\nApply these rules strictly to every prompt — replicate liked patterns, eliminate disliked patterns.`
        : "";

      // ── STEP 3: Main Llama prompt generation — uses reverse-engineered rules ──
      let prompts: string[] = [];
      try {
        const systemMsg = `You are an expert AI training data engineer specializing in Flux-2 Pro image generation model fine-tuning.

Your task: Generate exactly ${count} highly varied, technically optimized training image prompts for a LoRA fine-tuning dataset.

Subject: ${typeLabel} named "${name}"
Base model: Flux-2 Pro (requires specific prompt format for best results)${pastContext}${rlhfContext}

Requirements for each prompt:
- Different angle/perspective (front, 3/4, side, back, overhead, close-up, environmental)
- Different lighting scenario (studio strobe, natural window, golden hour, dramatic, soft box, ring light)
- Different background context (white studio, gradient, lifestyle, dark, outdoor, textured)
- Include technical photography terms (f-stop, focal length hints, exposure)
- Optimized for Flux-2 Pro: use descriptive, detailed language; avoid vague terms
- Each prompt: 30-60 words, highly specific and distinct
${rlhfContext ? "- Strictly apply the RLHF quality rules above — this is mandatory" : ""}

Return ONLY a valid JSON array of ${count} prompt strings. No explanation, no markdown, just the array.`;

        const raw = await llamaChat(
          systemMsg,
          `Generate ${count} Flux-2 Pro training prompts for "${name}" (${typeLabel}). Make each unique in angle, lighting, and setting.${rlhfContext ? " Apply the RLHF quality rules strictly." : ""}`,
          900,
          true, // heavy Llama (70B) for best JSON reliability and prompt quality
        );

        // Parse JSON array from Llama response
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) prompts = parsed.slice(0, count);
        }
      } catch (e) {
        console.error("Llama prompt generation failed:", e instanceof Error ? e.message : e);
      }

      // Fallback: hardcoded varied prompts if Llama fails
      if (prompts.length === 0) {
        prompts = [
          `${typeLabel} "${name}", front view, white seamless studio background, professional strobe lighting, f/8, sharp detail, commercial product photography, Flux-2 Pro optimized`,
          `${typeLabel} "${name}", 45-degree left angle, soft natural window light, minimalist white backdrop, lifestyle product shot, high-end commercial`,
          `${typeLabel} "${name}", right profile view, dramatic side lighting, dark gradient background, luxury brand aesthetic, cinematic quality`,
          `${typeLabel} "${name}", back view, soft gradient background, editorial photography style, premium quality, studio environment`,
          `${typeLabel} "${name}", overhead top-down flatlay, minimal props arrangement, warm neutral tones, social media lifestyle`,
          `${typeLabel} "${name}", macro close-up detail shot, studio ring light, sharp focus extreme detail, textural quality`,
          `${typeLabel} "${name}", environmental lifestyle context, natural outdoor setting, golden hour warm light, authentic brand story`,
          `${typeLabel} "${name}", hero shot low angle, cinematic dramatic lighting, premium magazine cover quality, high fashion aesthetic`,
        ].slice(0, count);
      }

      // Generate images in parallel batches of 4 using Flux-2 Pro for highest quality training data
      const results: string[] = [];
      const BATCH = 4;
      for (let i = 0; i < prompts.length; i += BATCH) {
        const batch = prompts.slice(i, i + BATCH);
        const settled = await Promise.allSettled(
          batch.map((prompt) => kiePost("/image/generate", { prompt, aspect_ratio: "1:1", model: "flux-2-pro", num_images: 1 }))
        );
        for (const r of settled) {
          if (r.status === "fulfilled") {
            const url = r.value?.image_url ?? r.value?.url ?? null;
            if (url) results.push(url);
          }
        }
      }

      return json({
        success: true,
        synthetic_urls: results,
        count: results.length,
        reverse_engineered_rules: reverseEngineeredRules || null,
        rlhf_applied: likedList.length > 0 || dislikedList.length > 0,
      });
    }

    // ── GENERATE IMAGE ───────────────────────────────────────────────────────
    if (action === "generate_image") {
      const { prompt, aspect_ratio = "1:1", model = "kie-flux", negative_prompt = "", lora_model = "" } = data;
      if (!prompt) return json({ error: "prompt is required" }, 400);

      const payload: Record<string, unknown> = { prompt, negative_prompt, aspect_ratio, model, num_images: 1 };
      if (lora_model) payload.lora_model = lora_model;

      const kieRes = await kiePost("/image/generate", payload);

      const { data: inserted, error: insertErr } = await supabase.from("gv_image_generations").insert({
        brand_id,
        prompt_text: prompt,
        negative_prompt,
        aspect_ratio,
        ai_provider: "kie",
        ai_model: kieRes.model ?? model,
        image_url: kieRes.image_url ?? kieRes.url ?? null,
        thumbnail_url: kieRes.thumbnail_url ?? null,
        status: kieRes.status ?? "completed",
        target_platform: data.platform ?? "instagram",
        style_preset: lora_model || null,
      }).select("id").single();
      if (insertErr) console.error("generate_image DB insert failed:", insertErr.message);

      return json({
        success: true,
        task_id: kieRes.task_id ?? kieRes.id ?? null,
        image_url: kieRes.image_url ?? kieRes.url ?? null,
        status: kieRes.status ?? "completed",
        db_id: inserted?.id ?? null,
        raw: kieRes,
      });
    }

    // ── GENERATE VIDEO ───────────────────────────────────────────────────────
    // Routing: duration > 10s → OpenAI Sora-2, otherwise → Kie API
    if (action === "generate_video") {
      const { prompt, duration = 8, aspect_ratio = "9:16", model = "kling-v1", image_url = "" } = data;
      if (!prompt) return json({ error: "prompt is required" }, 400);

      const useOpenAI = Number(duration) > 10;
      let task_id: string | null = null;
      let video_url: string | null = null;
      let status = "processing";
      let ai_model = model;

      if (useOpenAI) {
        // OpenAI Sora-2 for long-duration videos (11–25s)
        const soraRes = await openAISoraGenerate(prompt, Number(duration), aspect_ratio);
        task_id = soraRes.job_id;
        status = soraRes.status;
        ai_model = "sora-2";
      } else {
        // Kie API for short videos (≤ 10s)
        const payload: Record<string, unknown> = { prompt, duration, aspect_ratio, model, mode: data.mode ?? "standard" };
        if (image_url) payload.image_url = image_url;
        const kieRes = await kiePost("/video/generate", payload);
        task_id = kieRes.task_id ?? kieRes.id ?? null;
        video_url = kieRes.video_url ?? null;
        status = kieRes.status ?? "processing";
        ai_model = kieRes.model ?? model;
      }

      const { data: inserted, error: insertErr } = await supabase.from("gv_video_generations").insert({
        brand_id,
        target_platform: data.platform ?? "tiktok",
        hook: prompt,
        ai_model,
        status,
        generation_mode: useOpenAI ? "openai" : "kie",
        runway_task_id: task_id,
        video_url,
        video_thumbnail_url: null,
        video_aspect_ratio: aspect_ratio,
        video_status: status,
      }).select("id").single();
      if (insertErr) console.error("generate_video DB insert failed:", insertErr.message);

      return json({ success: true, task_id, video_url, status, db_id: inserted?.id ?? null });
    }

    // ── LIST HEYGEN AVATARS ───────────────────────────────────────────────────
    if (action === "list_avatars") {
      if (!HEYGEN_API_KEY) return json({ error: "HEYGEN_API_KEY not configured" }, 503);
      const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
        headers: { "x-api-key": HEYGEN_API_KEY },
      });
      if (!res.ok) throw new Error(`HeyGen list_avatars error ${res.status}`);
      const d = await res.json();
      return json({ success: true, avatars: d.data?.avatars ?? d.avatars ?? d.data ?? [] });
    }

    // ── LIST HEYGEN VOICES ────────────────────────────────────────────────────
    if (action === "list_voices") {
      if (!HEYGEN_API_KEY) return json({ error: "HEYGEN_API_KEY not configured" }, 503);
      const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
        headers: { "x-api-key": HEYGEN_API_KEY },
      });
      if (!res.ok) throw new Error(`HeyGen list_voices error ${res.status}`);
      const d = await res.json();
      return json({ success: true, voices: d.data?.voices ?? d.voices ?? d.data ?? [] });
    }

    // ── GENERATE AVATAR VIDEO (HeyGen — 1/week, max 60s, no retry) ───────────
    if (action === "generate_avatar_video") {
      const {
        prompt,
        avatar_id = "default",
        voice_id = "default",
      } = data;
      if (!prompt) return json({ error: "prompt is required" }, 400);
      if (!HEYGEN_API_KEY) return json({ error: "HEYGEN_API_KEY not configured" }, 503);

      // ── Weekly quota check (1 video/week, no retry — counts all attempts) ──
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: weeklyCount } = await supabase.from("gv_video_generations")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand_id)
        .eq("ai_model", "heygen-avatar")
        .gte("created_at", weekAgo);

      if ((weeklyCount ?? 0) >= 1) {
        return json({
          success: false,
          error: "Weekly HeyGen avatar video limit reached (1 video/week)",
          code: "WEEKLY_QUOTA_EXCEEDED",
          weekly_used: weeklyCount,
          weekly_limit: 1,
        }, 429);
      }

      // ── Cap prompt at 700 chars ≈ 60 seconds of speech ───────────────────
      const cappedPrompt = String(prompt).slice(0, 700);

      // ── Insert to DB FIRST (no-retry: quota consumed even if HeyGen fails) ─
      const { data: inserted, error: insertErr } = await supabase.from("gv_video_generations").insert({
        brand_id,
        target_platform: "youtube",
        hook: cappedPrompt,
        ai_model: "heygen-avatar",
        status: "processing",
        generation_mode: "heygen",
        runway_task_id: null,
        video_url: null,
        video_thumbnail_url: null,
        video_aspect_ratio: "16:9",
        video_status: "processing",
      }).select("id").single();
      if (insertErr) console.error("generate_avatar_video DB insert failed:", insertErr.message);

      // ── Call HeyGen API ───────────────────────────────────────────────────
      let heygenVideoId: string | null = null;
      try {
        const heyRes = await heygenGenerateAvatar(cappedPrompt, String(avatar_id), String(voice_id));
        heygenVideoId = heyRes.video_id;
        // Update DB with task ID
        if (inserted?.id) {
          await supabase.from("gv_video_generations")
            .update({ runway_task_id: heygenVideoId })
            .eq("id", inserted.id);
        }
      } catch (heyErr) {
        // Still return success=false but quota is already consumed
        const errMsg = heyErr instanceof Error ? heyErr.message : "HeyGen API failed";
        if (inserted?.id) {
          await supabase.from("gv_video_generations")
            .update({ video_status: "failed", status: "failed" })
            .eq("id", inserted.id);
        }
        return json({ success: false, error: errMsg, code: "HEYGEN_FAILED", db_id: inserted?.id ?? null }, 500);
      }

      return json({ success: true, task_id: heygenVideoId, status: "processing", db_id: inserted?.id ?? null });
    }

    // ── CHECK TASK STATUS ────────────────────────────────────────────────────
    if (action === "check_task") {
      const { task_id, db_id, task_type, generation_mode = "kie" } = data;
      if (!task_id) return json({ error: "task_id is required" }, 400);

      let status = "processing";
      let image_url: string | null = null;
      let video_url: string | null = null;
      let thumbnail_url: string | null = null;

      if (generation_mode === "openai") {
        const pollRes = await openAISoraPoll(String(task_id));
        status = pollRes.status;
        video_url = pollRes.video_url;
        // Normalize OpenAI statuses
        if (status === "succeeded") status = "completed";
        if (status === "failed") status = "failed";
      } else if (generation_mode === "heygen") {
        const pollRes = await heygenPoll(String(task_id));
        status = pollRes.status;
        video_url = pollRes.video_url;
        thumbnail_url = pollRes.thumbnail_url;
        if (status === "completed") status = "completed";
      } else {
        const kieRes = await kieGet(`/task/${task_id}`);
        status = kieRes.status ?? "processing";
        image_url = kieRes.image_url ?? kieRes.result?.image_url ?? null;
        video_url = kieRes.video_url ?? kieRes.result?.video_url ?? null;
        thumbnail_url = kieRes.thumbnail_url ?? null;
      }

      if (db_id && ["completed", "succeeded", "success"].includes(status)) {
        if (task_type === "image") {
          await supabase.from("gv_image_generations").update({
            status: "completed",
            image_url,
            thumbnail_url,
          }).eq("id", db_id);
        } else if (task_type === "video") {
          await supabase.from("gv_video_generations").update({
            video_status: "completed",
            video_url,
            video_thumbnail_url: thumbnail_url,
          }).eq("id", db_id);
        }
      }

      return json({ success: true, status, image_url, video_url });
    }

    // ── TRAIN PRODUCT / CHARACTER ────────────────────────────────────────────
    if (action === "train_product" || action === "train_character") {
      const { name, trigger_word, image_urls, steps = 1000 } = data;
      const training_type = action === "train_character" ? "character" : "product";
      if (!name || !image_urls?.length) return json({ error: "name and image_urls are required" }, 400);

      const tw = trigger_word ?? name.toLowerCase().replace(/\s+/g, "_");

      const kieRes = await kiePost("/training/create", {
        name, trigger_word: tw, image_urls, training_type, steps,
        base_model: "flux-2-pro", // Optimized Flux-2 Pro base for highest quality LoRA
      });

      await supabase.from("gv_lora_datasets").insert({
        brand_id,
        dataset_name: name,
        theme: training_type,
        image_count: image_urls.length,
        training_status: "training",
        storage_path: `kie://${kieRes.training_id ?? kieRes.id}`,
        metadata: { trigger_word: tw, kie_training_id: kieRes.training_id ?? kieRes.id, steps },
      });

      return json({
        success: true,
        training_id: kieRes.training_id ?? kieRes.id ?? null,
        status: kieRes.status ?? "training",
        trigger_word: tw,
        raw: kieRes,
      });
    }

    // ── CHECK TRAINING STATUS ────────────────────────────────────────────────
    if (action === "check_training") {
      const { training_id } = data;
      if (!training_id) return json({ error: "training_id is required" }, 400);

      const kieRes = await kieGet(`/training/${training_id}`);
      const status = kieRes.status ?? "training";

      if (["completed", "succeeded", "success"].includes(status)) {
        await supabase.from("gv_lora_datasets").update({
          training_status: "completed",
          model_path: kieRes.model_url ?? kieRes.model_path ?? null,
        }).contains("metadata", { kie_training_id: training_id });
      }

      return json({
        success: true, status,
        model_url: kieRes.model_url ?? null,
        progress: kieRes.progress ?? null,
        raw: kieRes,
      });
    }

    // ── GET HISTORY ──────────────────────────────────────────────────────────
    if (action === "get_history") {
      const limit = Number(data.limit ?? 20);
      const type = data.type ?? "all";
      const results: Record<string, unknown> = {};

      if (type === "all" || type === "image") {
        const { data: imgs } = await supabase
          .from("gv_image_generations")
          .select("id, prompt_text, image_url, thumbnail_url, status, ai_model, target_platform, style_preset, created_at, feedback")
          .eq("brand_id", brand_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        results.images = imgs ?? [];
      }

      if (type === "all" || type === "video") {
        const { data: vids } = await supabase
          .from("gv_video_generations")
          .select("id, hook, video_url, video_thumbnail_url, video_status, ai_model, target_platform, video_aspect_ratio, created_at, feedback")
          .eq("brand_id", brand_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        results.videos = vids ?? [];
      }

      if (type === "all" || type === "training") {
        const { data: trainings } = await supabase
          .from("gv_lora_datasets")
          .select("id, dataset_name, theme, image_count, training_status, model_path, metadata, created_at")
          .eq("brand_id", brand_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        results.trainings = trainings ?? [];
      }

      return json({ success: true, ...results });
    }

    // ── SUBMIT FEEDBACK (RLHF — trains smart prompt AI) ─────────────────────
    if (action === "submit_feedback") {
      const { db_id, content_type, feedback } = data;
      if (!db_id || !content_type || !feedback) {
        return json({ error: "db_id, content_type, and feedback are required" }, 400);
      }
      if (!["liked", "disliked"].includes(feedback)) {
        return json({ error: "feedback must be liked or disliked" }, 400);
      }

      let dbError: string | null = null;
      if (content_type === "image") {
        const { error } = await supabase.from("gv_image_generations")
          .update({ feedback })
          .eq("id", db_id)
          .eq("brand_id", brand_id);
        if (error) dbError = error.message;
      } else if (content_type === "video") {
        const { error } = await supabase.from("gv_video_generations")
          .update({ feedback })
          .eq("id", db_id)
          .eq("brand_id", brand_id);
        if (error) dbError = error.message;
      } else {
        return json({ error: "content_type must be image or video" }, 400);
      }

      if (dbError) return json({ error: `Failed to save feedback: ${dbError}` }, 500);
      return json({ success: true, feedback, db_id });
    }

    return json({ error: "Invalid action" }, 400);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("content-studio-handler error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
