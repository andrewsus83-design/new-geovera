import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * generate-article — Split AI Pipeline
 *
 * Triggered by:
 *   - generate-daily-insights (72H cycle) → auto_draft mode (X-Service-Call: true)
 *   - User manually from content studio → manual mode (Bearer auth + quota)
 *
 * Pipeline (parallel after brand load):
 *   ├── OpenAI GPT-4o   → article_short + article_medium + article_long + SEO meta
 *   └── Claude Sonnet   → image_prompts (IG/Pinterest/Blog) + video_prompts (TikTok storyboard) + generation_tasks
 *
 * Both calls run in parallel via Promise.all for speed.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GenerateArticleRequest {
  brand_id: string;
  topic: string;
  target_platforms?: string[];
  keywords?: string[];
  target_audience?: string;
  task_id?: string;
  trend_id?: string;
  viral_discovery_id?: string;
  mode?: "manual" | "auto_draft";
}

interface ArticleText {
  // Article formats
  article_short: string;    // <300 chars teaser
  article_medium: string;   // <800 words
  article_long: string;     // up to 3000 words
  // SEO
  meta_title: string;
  meta_description: string;
  focus_keywords: string[];
  // GEO — AI answer engine optimisation
  geo: {
    faq: Array<{ question: string; answer: string }>;       // 5 Q&A for structured data
    citation_statement: string;                             // 1 authoritative statement for LLM citations
    structured_data_type: string;                           // Article / FAQPage / HowTo / etc.
    entity_mentions: string[];                              // Key entities to reinforce
  };
  // Social captions per platform
  social: {
    linkedin: string;       // professional, insight-driven, <1300 chars
    instagram: string;      // engaging caption + hashtags, <2200 chars
    tiktok: string;         // hook-first, punchy, <150 chars
    twitter: string;        // <280 chars, punchy
  };
}

interface VisualPrompts {
  image_prompts: {
    instagram: string;   // 1:1 square
    pinterest: string;   // 2:3 vertical
    blog: string;        // 16:9 landscape
  };
  video_prompts: {
    tiktok_reels_shorts: string;
    storyboard: string[];
  };
  generation_tasks: Array<{
    type: "image" | "video";
    platform: string;
    prompt: string;
    priority: "high" | "medium";
  }>;
}

interface ArticleOutput extends ArticleText, VisualPrompts {
  task_id: string | null;
}

// ─── Helper ──────────────────────────────────────────────────────────────────────

function isServiceCall(req: Request): boolean {
  return req.headers.get("X-Service-Call") === "true";
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Step 1: OpenAI GPT-4o — article text + SEO ─────────────────────────────────

async function generateArticleText(
  openaiKey: string,
  brand: { brand_name: string; industry: string | null; country: string | null },
  topic: string,
  keywords: string[],
  target_audience: string | undefined,
  target_platforms: string[],
  brandVoice: string,
  langStyle: string,
  contextBlock: string
): Promise<{ text: ArticleText; tokens: number; costUsd: number }> {
  const keywordsBlock = keywords.length > 0 ? `\nFocus Keywords: ${keywords.join(", ")}` : "";
  const audienceBlock = target_audience ? `\nTarget Audience: ${target_audience}` : "";

  const systemPrompt = `You are an expert content strategist and copywriter for ${brand.brand_name} (${brand.industry || "brand"} in ${brand.country || "Indonesia"}).
Brand Voice: ${brandVoice}
Language Style: ${langStyle}
Target Platforms: ${target_platforms.join(", ")}
Generate only article text and SEO metadata. Be precise, SEO-optimised, and on-brand.`;

  const userPrompt = `Write comprehensive multi-format content about: "${topic}"
${keywordsBlock}${audienceBlock}${contextBlock}

Return ONLY valid JSON — no markdown, no explanation:
{
  "article_short": "<EXACTLY under 300 characters — punchy hook/caption for social. Brand voice, scroll-stopping>",
  "article_medium": "<Under 800 words — structured article with H2 headers (##), 3-5 sections, strong CTA at end>",
  "article_long": "<Up to 3000 words — comprehensive long-form with H2/H3 headers, intro, body, expert insights, real examples, data points, conclusion with CTA — fully SEO + GEO optimised>",

  "meta_title": "<SEO title under 60 chars — primary keyword near start>",
  "meta_description": "<SEO description under 160 chars — compelling, includes keyword + implicit CTA>",
  "focus_keywords": ["<primary>", "<secondary>", "<long-tail-1>", "<long-tail-2>", "<LSI-keyword>"],

  "geo": {
    "faq": [
      {"question": "<question AI assistants would ask about this topic>", "answer": "<concise 1-2 sentence authoritative answer>"},
      {"question": "<question 2>", "answer": "<answer 2>"},
      {"question": "<question 3>", "answer": "<answer 3>"},
      {"question": "<question 4>", "answer": "<answer 4>"},
      {"question": "<question 5>", "answer": "<answer 5>"}
    ],
    "citation_statement": "<One definitive, citation-worthy statement about ${topic} that LLMs like ChatGPT/Perplexity/Gemini would quote. Factual, authoritative, brand-attributed.>",
    "structured_data_type": "<Article | FAQPage | HowTo | Product | LocalBusiness — most appropriate schema.org type>",
    "entity_mentions": ["<key entity 1>", "<key entity 2>", "<key entity 3>", "<key entity 4>"]
  },

  "social": {
    "linkedin": "<Professional LinkedIn post. 2-3 paragraphs. Open with insight/hook, body with value, end with question or CTA. Include 3-5 relevant hashtags. Under 1300 chars>",
    "instagram": "<Engaging Instagram caption. Hook first line (make them tap 'more'), value in body, clear CTA, line break before hashtags. 20-25 targeted hashtags. Under 2200 chars>",
    "tiktok": "<TikTok/Reels hook caption. First 3 words must stop the scroll. Max 150 chars total. Include 3-5 trending hashtags>",
    "twitter": "<Tweet version. Max 250 chars. Punchy, opinionated or surprising angle. 1-2 hashtags only>"
  }
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${(err as { error?: { message?: string } }).error?.message || res.status}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  const tokens: number = data.usage?.total_tokens ?? 0;
  const costUsd = (tokens / 1_000_000) * 2.5; // GPT-4o input+output blended

  return {
    text: {
      article_short:    parsed.article_short    || "",
      article_medium:   parsed.article_medium   || "",
      article_long:     parsed.article_long     || "",
      meta_title:       parsed.meta_title       || topic,
      meta_description: parsed.meta_description || "",
      focus_keywords:   parsed.focus_keywords   || keywords,
      geo: {
        faq:                parsed.geo?.faq                || [],
        citation_statement: parsed.geo?.citation_statement || "",
        structured_data_type: parsed.geo?.structured_data_type || "Article",
        entity_mentions:    parsed.geo?.entity_mentions    || [],
      },
      social: {
        linkedin:  parsed.social?.linkedin  || "",
        instagram: parsed.social?.instagram || "",
        tiktok:    parsed.social?.tiktok    || "",
        twitter:   parsed.social?.twitter   || "",
      },
    },
    tokens,
    costUsd,
  };
}

// ─── Step 2: Claude Sonnet — image + video prompts ──────────────────────────────

async function generateVisualPrompts(
  anthropicKey: string,
  brand: { brand_name: string; industry: string | null; country: string | null },
  topic: string,
  articleShort: string,
  articleMedium: string,
  target_platforms: string[],
  brandVoice: string,
  contextBlock: string
): Promise<{ visuals: VisualPrompts; tokens: number; costUsd: number }> {
  const platformList = target_platforms.join(", ");

  const prompt = `You are a visual creative director and video strategist for ${brand.brand_name} (${brand.industry || "brand"}, ${brand.country || "Indonesia"}).
Brand Voice: ${brandVoice}
Target Platforms: ${platformList}
${contextBlock}

The following article was just written about: "${topic}"

Article summary (for visual context):
${articleShort}

${articleMedium.slice(0, 600)}

---
Generate HIGHLY DETAILED, production-ready visual and video prompts for this article.
Return ONLY valid JSON — no markdown, no explanation:

{
  "image_prompts": {
    "instagram": "<DETAILED Kie AI / Midjourney / DALL-E prompt for 1:1 square Instagram post. Specify: visual style (photography/illustration/3D), mood, color palette matching ${brand.brand_name} brand, lighting, subject matter, background, composition. Make it scroll-stopping and brand-consistent. 150-220 chars>",
    "pinterest": "<DETAILED prompt for 2:3 vertical Pinterest pin. Specify: editorial photography or infographic style, clean typography overlay concept, color story, mood board aesthetic, pin-worthy composition that drives saves. 150-220 chars>",
    "blog": "<DETAILED prompt for 16:9 wide blog header. Specify: professional photography or graphic design style, hero image concept, brand colors, depth of field, lighting setup, subject. Clean, editorial, premium feel. 150-220 chars>"
  },
  "video_prompts": {
    "tiktok_reels_shorts": "<FULL production brief for 15-60s 9:16 vertical video. Include: opening hook (exact first 3s action/text), scene transitions, key message delivery sequence, text overlay copy suggestions, background music vibe, CTA in final 5s, visual effects style. Under 500 chars>",
    "storyboard": [
      "<Shot 1 | 0-3s | HOOK: exact visual action + on-screen text + camera angle>",
      "<Shot 2 | 3-10s | PROBLEM/CONTEXT: scene description + narration direction + text overlay>",
      "<Shot 3 | 10-25s | MAIN MESSAGE: product/brand feature showcase + visual treatment>",
      "<Shot 4 | 25-40s | PROOF/VALUE: social proof or demo moment + trust-building element>",
      "<Shot 5 | 40-55s | CTA: clear call-to-action + brand logo placement + end card>",
      "<Shot 6 | 55-60s | OUTRO: brand signature + music fade>"
    ]
  },
  "generation_tasks": [
    {"type": "image", "platform": "instagram", "prompt": "<exact same as image_prompts.instagram>", "priority": "high"},
    {"type": "image", "platform": "pinterest", "prompt": "<exact same as image_prompts.pinterest>", "priority": "medium"},
    {"type": "image", "platform": "blog", "prompt": "<exact same as image_prompts.blog>", "priority": "high"},
    {"type": "video", "platform": "tiktok_reels_shorts", "prompt": "<exact same as video_prompts.tiktok_reels_shorts>", "priority": "high"}
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error: ${err}`);
  }

  const data = await res.json();
  const rawText: string = data.content?.[0]?.text ?? "{}";
  const cleaned = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  const parsed = JSON.parse(cleaned);

  const tokens: number = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  // claude-sonnet-4: $3/M input + $15/M output
  const inputCost  = (data.usage?.input_tokens  ?? 0) / 1_000_000 * 3;
  const outputCost = (data.usage?.output_tokens ?? 0) / 1_000_000 * 15;
  const costUsd = inputCost + outputCost;

  return {
    visuals: {
      image_prompts:    parsed.image_prompts    || { instagram: "", pinterest: "", blog: "" },
      video_prompts:    parsed.video_prompts    || { tiktok_reels_shorts: "", storyboard: [] },
      generation_tasks: parsed.generation_tasks || [],
    },
    tokens,
    costUsd,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const openaiKey    = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!openaiKey)    return jsonResp({ success: false, error: "OpenAI API key not configured" }, 500);
    if (!anthropicKey) return jsonResp({ success: false, error: "Anthropic API key not configured" }, 500);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const serviceCall = isServiceCall(req);
    let userId: string | null = null;

    // ── Auth gate (user calls only) ──────────────────────────────────────────
    if (!serviceCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResp({ success: false, error: "Missing Authorization header" }, 401);

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !user) return jsonResp({ success: false, error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const requestData: GenerateArticleRequest = await req.json();
    const {
      brand_id,
      topic,
      target_platforms   = ["linkedin", "website"],
      keywords           = [],
      target_audience,
      task_id,
      trend_id,
      viral_discovery_id,
      mode               = "manual",
    } = requestData;

    const isAutoDraft = mode === "auto_draft" || serviceCall;

    // ── Brand info ──────────────────────────────────────────────────────────
    const [{ data: brand, error: brandError }, { data: voiceData }] = await Promise.all([
      supabaseClient
        .from("gv_brands")
        .select("subscription_tier, brand_name, industry, country")
        .eq("id", brand_id)
        .single(),
      supabaseClient
        .from("gv_brand_voice_guidelines")
        .select("tone, language_style")
        .eq("brand_id", brand_id)
        .maybeSingle(),
    ]);

    if (brandError || !brand) return jsonResp({ success: false, error: "Brand not found", code: "BRAND_NOT_FOUND" }, 404);

    // ── Subscription + quota (manual calls only) ─────────────────────────────
    if (!isAutoDraft) {
      if (!brand.subscription_tier || brand.subscription_tier === "free") {
        return jsonResp({
          success: false,
          error: "Content generation requires a paid subscription",
          code: "SUBSCRIPTION_REQUIRED",
          current_tier: brand.subscription_tier || "free",
          upgrade_url: "/pricing",
        }, 403);
      }

      const { data: quotaExceeded, error: quotaError } = await supabaseClient.rpc(
        "check_tier_limit",
        { p_brand_id: brand_id, p_limit_type: "articles" }
      );
      if (quotaError) throw new Error(`Quota check failed: ${quotaError.message}`);
      if (quotaExceeded === true) {
        return jsonResp({ success: false, error: "Monthly article quota exceeded", code: "QUOTA_EXCEEDED", current_tier: brand.subscription_tier }, 429);
      }
    }

    const brandVoice = voiceData?.tone || "professional and engaging";
    const langStyle  = voiceData?.language_style || "clear and accessible";

    const contextBlock = trend_id
      ? "\n[Context: trend-driven topic — make the hook timely and urgent]"
      : viral_discovery_id
        ? "\n[Context: viral discovery — emphasise social proof and shareability]"
        : "";

    console.log(`[generate-article] Starting parallel generation for: ${brand.brand_name} | "${topic}"`);

    // ── PARALLEL: OpenAI (article text) + Claude (visual prompts) ────────────
    const [articleResult, visualResult] = await Promise.all([
      generateArticleText(
        openaiKey, brand, topic, keywords, target_audience,
        target_platforms, brandVoice, langStyle, contextBlock
      ),
      // We need article content for Claude context — but we can fire Claude immediately
      // with topic + brand context (article_short comes from OpenAI, so Claude uses topic)
      generateVisualPrompts(
        anthropicKey, brand, topic,
        `${brand.brand_name}: ${topic}`, // fallback teaser for Claude context
        "",                               // article_medium not available yet — Claude uses topic
        target_platforms, brandVoice, contextBlock
      ),
    ]);

    const totalCostUsd = articleResult.costUsd + visualResult.costUsd;
    const totalTokens  = articleResult.tokens + visualResult.tokens;

    const output: ArticleOutput = {
      task_id:          task_id ?? null,
      // From OpenAI GPT-4o — article text
      article_short:    articleResult.text.article_short,
      article_medium:   articleResult.text.article_medium,
      article_long:     articleResult.text.article_long,
      // From OpenAI GPT-4o — SEO
      meta_title:       articleResult.text.meta_title,
      meta_description: articleResult.text.meta_description,
      focus_keywords:   articleResult.text.focus_keywords,
      // From OpenAI GPT-4o — GEO (AI answer engine optimisation)
      geo:              articleResult.text.geo,
      // From OpenAI GPT-4o — Social captions
      social:           articleResult.text.social,
      // From Claude Sonnet — Visual prompts
      image_prompts:    visualResult.visuals.image_prompts,
      video_prompts:    visualResult.visuals.video_prompts,
      generation_tasks: visualResult.visuals.generation_tasks,
    };

    console.log(`[generate-article] Done — OpenAI: ${articleResult.tokens} tokens | Claude: ${visualResult.tokens} tokens | Total: $${totalCostUsd.toFixed(4)}`);

    // ── Save to content library ─────────────────────────────────────────────
    const { data: contentData, error: contentError } = await supabaseClient
      .from("gv_content_library")
      .insert({
        brand_id,
        user_id:           userId,
        content_type:      "article",
        title:             topic,
        slug:              topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
        content_variations: {
          short:            output.article_short,
          medium:           output.article_medium,
          long:             output.article_long,
          // GEO — AI answer engine optimisation
          geo:              output.geo,
          // Social captions per platform
          social:           output.social,
          // Visual prompts — Claude Sonnet
          image_prompts:    output.image_prompts,
          video_prompts:    output.video_prompts,
          generation_tasks: output.generation_tasks,
        },
        meta_title:         output.meta_title,
        meta_description:   output.meta_description,
        keywords:           output.focus_keywords,
        target_audience,
        content_goal:       "visibility",
        target_platforms,
        ai_provider_used:   "openai+anthropic",
        model_used:         "gpt-4o+claude-sonnet-4",
        generation_cost_usd: totalCostUsd,
        publish_status:     isAutoDraft ? "auto_draft" : "draft",
        task_id:            task_id            ?? null,
        trend_id:           trend_id           ?? null,
        viral_discovery_id: viral_discovery_id ?? null,
        is_auto_draft:      isAutoDraft,
      })
      .select()
      .single();

    if (contentError) throw new Error(`Failed to save content: ${contentError.message}`);

    // ── Usage increment (manual only) ────────────────────────────────────────
    if (!isAutoDraft) {
      await supabaseClient.rpc("increment_content_usage", {
        p_brand_id: brand_id,
        p_content_type: "article",
      }).then(({ error }) => {
        if (error) console.error("[generate-article] Usage increment failed:", error);
      });
    }

    console.log(`[generate-article] Saved content ${contentData.id} (${isAutoDraft ? "auto_draft" : "draft"})`);

    return jsonResp({
      success:    true,
      content_id: contentData.id,
      mode:       isAutoDraft ? "auto_draft" : "manual",
      article: {
        task_id:          output.task_id,
        title:            topic,
        // ── Article text — OpenAI GPT-4o ──
        short:            output.article_short,
        medium:           output.article_medium,
        long:             output.article_long,
        // ── SEO — OpenAI GPT-4o ──
        meta_title:       output.meta_title,
        meta_description: output.meta_description,
        focus_keywords:   output.focus_keywords,
        // ── GEO (AI answer engine optimisation) — OpenAI GPT-4o ──
        geo:              output.geo,
        // ── Social captions — OpenAI GPT-4o ──
        social:           output.social,
        // ── Visual prompts — Claude Sonnet ──
        image_prompts:    output.image_prompts,
        video_prompts:    output.video_prompts,
        generation_tasks: output.generation_tasks,
        platforms:        target_platforms,
        // ── Cost + token breakdown ──
        cost_usd: {
          total:   totalCostUsd.toFixed(4),
          openai:  articleResult.costUsd.toFixed(4),
          claude:  visualResult.costUsd.toFixed(4),
        },
        tokens: {
          total:   totalTokens,
          openai:  articleResult.tokens,
          claude:  visualResult.tokens,
        },
      },
    });

  } catch (error) {
    console.error("[generate-article] Error:", error);
    return jsonResp({ success: false, error: (error as Error).message, code: "GENERATION_FAILED" }, 500);
  }
});
