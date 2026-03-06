import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * unified-strategy-engine — 2-Level Research Pipeline
 *
 * Level 1 ("quick") — Social Connect initial research:
 *   Step 1: Perplexity sonar + Gemini brand indexing (PARALLEL)
 *   Step 2: Firecrawl — scrape top 3 competitor URLs
 *   Step 3: Claude Sonnet — unified 5-section strategy JSON
 *
 * Level 2 ("full") — Deep research (Premium / Partner only):
 *   Step 1: Perplexity sonar-deep + Gemini brand indexing (PARALLEL)
 *   Step 2: Firecrawl — scrape top 6 competitor URLs
 *   Step 3: Apify Google Search Scraper — organic SERP data for top keywords
 *   Step 4: Claude Sonnet — unified strategy with all data sources
 *
 * Cache: 7-day TTL per (brand_id, depth) in gv_unified_strategy.
 * Smart delta: if same brand + depth was cached < 7 days ago, return cached.
 * Force refresh via force_refresh=true.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestBody {
  brand_id: string;
  depth?: "quick" | "full";
  force_refresh?: boolean;
}

interface BrandContext {
  id: string;
  brand_name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  subscription_tier: string | null;
  target_market: string | null;
  competitors: string[] | null;
}

interface FirecrawlPage {
  url: string;
  markdown: string;
  title: string | null;
}

interface PerplexityResearch {
  raw: string;
  competitors_found: string[];
  top_keywords: string[];
}

interface ApifySearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

interface UnifiedStrategyOutput {
  seo_strategy: {
    top_competitors: string[];
    keyword_gaps: string[];
    content_clusters: Array<{ pillar: string; supporting: string[] }>;
    technical_priorities: string[];
    quick_wins: string[];
    score: number;
    actions: string[];
  };
  geo_strategy: {
    citation_sources: string[];
    answer_engine_gaps: string[];
    structured_data_needed: string[];
    rag_readiness_actions: string[];
    llm_visibility_score: number;
    actions: string[];
  };
  social_strategy: {
    platform_priorities: string[];
    content_format_mix: Record<string, string>;
    top_creator_tactics: string[];
    viral_hooks: string[];
    posting_cadence: Record<string, string>;
    actions: string[];
  };
  unified_recommendations: Array<{
    rank: number;
    title: string;
    impact: "high" | "medium" | "low";
    effort: "high" | "medium" | "low";
    category: "seo" | "geo" | "social" | "cross-channel";
    rationale: string;
    next_step: string;
  }>;
  competitive_context: {
    market_position: string;
    key_threats: string[];
    key_opportunities: string[];
    differentiators: string[];
    competitor_weaknesses: string[];
    summary: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Step 1a: Perplexity sonar ────────────────────────────────────────────────

async function runPerplexityResearch(
  brand: BrandContext,
  depth: "quick" | "full"
): Promise<PerplexityResearch> {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) {
    console.warn("[USE] No PERPLEXITY_API_KEY — skipping");
    return { raw: "", competitors_found: [], top_keywords: [] };
  }

  // Deep research uses sonar-deep for more comprehensive results
  const model = depth === "full" ? "sonar-deep-research" : "sonar";

  const query = `Comprehensive competitive analysis for ${brand.brand_name} (${brand.industry || "brand"}) in ${brand.country || "Indonesia"}${brand.website ? ` — website: ${brand.website}` : ""}:

1. SEO: Top 5 organic competitors with domain names. What keywords drive their traffic? What content gaps exist for ${brand.brand_name}?
2. GEO / AI Answer Engines: Which sources (Wikipedia, Reddit, YouTube, industry sites, news) are cited when AI models answer questions about ${brand.industry || "this industry"} in ${brand.country || "Indonesia"}?
3. Social: Leading creators and brands on Instagram, TikTok, YouTube in this space — what content formats and hooks drive engagement?
4. Opportunities: Where is ${brand.brand_name} underrepresented vs competitors? Top 5 specific gaps.

Provide specific domain names, keywords, URLs, and data-backed findings.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${perplexityKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: query }],
      max_tokens: depth === "full" ? 6000 : 3000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(50_000),
  });

  if (!res.ok) {
    console.error(`[USE] Perplexity ${res.status}: ${await res.text()}`);
    return { raw: "", competitors_found: [], top_keywords: [] };
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";

  // Light extraction — Claude does the heavy analysis
  const domainPattern = /\b([a-z0-9-]+\.[a-z]{2,})\b/gi;
  const domains = [...new Set((raw.match(domainPattern) ?? [])
    .filter(d => !d.includes("perplexity") && !d.includes("geovera") && d.length < 60)
    .slice(0, 12))];

  // Extract potential keywords (quoted phrases)
  const keywordPattern = /"([^"]{4,60})"/g;
  const keywords = [...raw.matchAll(keywordPattern)].map(m => m[1]).slice(0, 15);

  return {
    raw,
    competitors_found: domains.slice(0, 8),
    top_keywords: keywords,
  };
}

// ─── Step 1b: Gemini brand indexing (parallel with Perplexity) ───────────────

async function runGeminiIndexing(
  brand: BrandContext,
  perplexityContext: string
): Promise<string | null> {
  const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!geminiKey) {
    console.warn("[USE] No GOOGLE_AI_API_KEY — skipping Gemini step");
    return null;
  }

  const prompt = `You are a digital market intelligence analyst. Analyze the competitive positioning of ${brand.brand_name}.

Brand Profile:
- Name: ${brand.brand_name}
- Industry: ${brand.industry ?? "Not specified"}
- Country: ${brand.country ?? "Indonesia"}
- Website: ${brand.website ?? "Not specified"}
- Target Market: ${brand.target_market ?? "Not specified"}
- Known Competitors: ${brand.competitors?.join(", ") ?? "None provided"}

${perplexityContext ? `Research Context (from Perplexity):\n${perplexityContext.slice(0, 3000)}` : ""}

Provide a structured analysis covering:
1. **Brand Positioning**: Current market position and perceived strengths
2. **Content Authority**: Which topics/domains does this brand have authority in? Where are the gaps?
3. **Search Intent Mapping**: Primary search intents this brand should target (informational, commercial, transactional, navigational)
4. **AI Citation Readiness**: Is this brand likely to be cited by AI models (ChatGPT, Gemini, Perplexity)? What's missing?
5. **Competitor Weakness Matrix**: Specific weaknesses in top competitors that ${brand.brand_name} can exploit
6. **Quick Win Topics**: 5 specific content topics that could drive visibility within 30-60 days

Keep analysis focused, specific, and actionable. Under 800 words.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!res.ok) {
      console.error(`[USE] Gemini ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.warn("[USE] Gemini indexing failed:", err);
    return null;
  }
}

// ─── Step 2: Firecrawl competitor scrape ──────────────────────────────────────

async function scrapeCompetitors(
  competitorUrls: string[],
  maxPages: number
): Promise<FirecrawlPage[]> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey || competitorUrls.length === 0) return [];

  const targets = competitorUrls.slice(0, maxPages).map(url =>
    url.startsWith("http") ? url : `https://${url}`
  );

  console.log(`[USE] Firecrawl scraping ${targets.length} URLs`);

  const results = await Promise.allSettled(
    targets.map(async (url): Promise<FirecrawlPage | null> => {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const markdown: string = data.data?.markdown ?? "";
        if (!markdown) return null;
        return {
          url,
          markdown: markdown.slice(0, 5000), // 5K chars per page
          title: data.data?.metadata?.title ?? null,
        };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FirecrawlPage | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((p): p is FirecrawlPage => p !== null);
}

// ─── Step 3: Apify Google Search Scraper (deep / Level 2 only) ───────────────

async function runApifyDeepSearch(
  brand: BrandContext,
  keywords: string[]
): Promise<ApifySearchResult[]> {
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  if (!apifyToken || keywords.length === 0) {
    console.warn("[USE] No APIFY_API_TOKEN or no keywords — skipping Apify");
    return [];
  }

  // Use top 5 keywords for SERP scraping
  const searchQueries = [
    ...keywords.slice(0, 3),
    `${brand.brand_name} vs competitors`,
    `best ${brand.industry ?? "brand"} in ${brand.country ?? "Indonesia"}`,
  ].slice(0, 5);

  console.log(`[USE] Apify: scraping ${searchQueries.length} search queries`);

  try {
    const countryCode = brand.country?.toLowerCase() === "indonesia" ? "ID" : "US";
    const langCode   = brand.country?.toLowerCase() === "indonesia" ? "id" : "en";

    // Synchronous run with 50s timeout — returns dataset items directly
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=50&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries:          searchQueries.join("\n"),
          resultsPerPage:   5,
          maxPagesPerQuery: 1,
          languageCode:     langCode,
          countryCode,
          mobileResults:    false,
        }),
        signal: AbortSignal.timeout(55_000),
      }
    );

    if (!res.ok) {
      console.warn(`[USE] Apify error ${res.status}`);
      return [];
    }

    const items = await res.json();
    if (!Array.isArray(items)) return [];

    return items
      .filter((item: Record<string, unknown>) => item.title && item.url)
      .map((item: Record<string, unknown>) => ({
        title:       (item.title as string)       || "",
        url:         (item.url as string)         || "",
        description: (item.description as string) || "",
        position:    (item.position as number)    || 0,
      }))
      .slice(0, 25);
  } catch (err) {
    console.warn("[USE] Apify scraping failed:", err);
    return [];
  }
}

// ─── Step 4: Claude unified strategy analysis ─────────────────────────────────

async function runClaudeStrategy(
  brand: BrandContext,
  research: PerplexityResearch,
  geminiAnalysis: string | null,
  competitorPages: FirecrawlPage[],
  apifyResults: ApifySearchResult[],
  depth: "quick" | "full"
): Promise<UnifiedStrategyOutput> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const perplexityBlock = research.raw
    ? `\n\n=== PERPLEXITY RESEARCH (${depth === "full" ? "Deep" : "Standard"}) ===\n${research.raw.slice(0, 6000)}`
    : "";

  const geminiBlock = geminiAnalysis
    ? `\n\n=== GEMINI MARKET ANALYSIS ===\n${geminiAnalysis}`
    : "";

  const firecrawlBlock = competitorPages.length > 0
    ? `\n\n=== COMPETITOR PAGE CONTENT (Firecrawl — ${competitorPages.length} pages) ===\n` +
      competitorPages.map(p => `[${p.url}]\nTitle: ${p.title ?? "Unknown"}\n${p.markdown}\n---`).join("\n")
    : "";

  const apifyBlock = apifyResults.length > 0
    ? `\n\n=== SERP DATA (Apify — ${apifyResults.length} results) ===\n` +
      apifyResults.slice(0, 15).map(r => `#${r.position} ${r.title} | ${r.url}\n${r.description}`).join("\n\n")
    : "";

  const systemPrompt = `You are GeoVera's unified strategy AI. Produce a comprehensive cross-channel digital strategy covering SEO, GEO (AI answer engine optimization), and Social Media — in structured JSON.

Research sources provided: ${[
    research.raw ? "Perplexity" : null,
    geminiAnalysis ? "Gemini" : null,
    competitorPages.length > 0 ? "Firecrawl" : null,
    apifyResults.length > 0 ? "Apify SERP" : null,
  ].filter(Boolean).join(" + ")}.

Respond ONLY with valid JSON. Be specific, actionable, and data-driven. Reference actual competitor names and domains from the research.`;

  const userPrompt = `Generate unified digital strategy for:

Brand: ${brand.brand_name}
Industry: ${brand.industry ?? "Not specified"}
Country: ${brand.country ?? "Indonesia"}
Website: ${brand.website ?? "Not specified"}
Target Market: ${brand.target_market ?? "Not specified"}
Known Competitors: ${brand.competitors?.join(", ") ?? "See research"}
Analysis Depth: ${depth === "full" ? "Level 2 — Deep Research" : "Level 1 — Standard Research"}
${perplexityBlock}${geminiBlock}${firecrawlBlock}${apifyBlock}

Return ONLY valid JSON with this EXACT schema:
{
  "seo_strategy": {
    "top_competitors": ["domain1.com", "domain2.com", "...up to 5"],
    "keyword_gaps": ["keyword gap 1", "...up to 10"],
    "content_clusters": [
      {"pillar": "pillar topic", "supporting": ["subtopic 1", "subtopic 2", "subtopic 3"]}
    ],
    "technical_priorities": ["priority 1", "...up to 6"],
    "quick_wins": ["quick win 1", "...up to 5"],
    "score": 0,
    "actions": ["action 1", "action 2", "action 3"]
  },
  "geo_strategy": {
    "citation_sources": ["source 1", "...up to 8"],
    "answer_engine_gaps": ["gap 1", "...up to 6"],
    "structured_data_needed": ["schema type 1", "schema type 2"],
    "rag_readiness_actions": ["action 1", "...up to 5"],
    "llm_visibility_score": 0,
    "actions": ["action 1", "action 2", "action 3"]
  },
  "social_strategy": {
    "platform_priorities": ["Platform 1 — reason", "Platform 2 — reason"],
    "content_format_mix": {"Instagram": "40% Reels, 40% Carousels, 20% Stories", "TikTok": "..."},
    "top_creator_tactics": ["tactic 1", "...up to 5"],
    "viral_hooks": ["hook 1", "...up to 5"],
    "posting_cadence": {"Instagram": "5x/week", "TikTok": "7x/week"},
    "actions": ["action 1", "action 2", "action 3"]
  },
  "unified_recommendations": [
    {
      "rank": 1,
      "title": "Recommendation title",
      "impact": "high",
      "effort": "low",
      "category": "seo",
      "rationale": "Why this matters for ${brand.brand_name}",
      "next_step": "First specific action to take"
    }
  ],
  "competitive_context": {
    "market_position": "One sentence current position",
    "key_threats": ["threat 1", "threat 2", "threat 3"],
    "key_opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
    "differentiators": ["differentiator 1", "differentiator 2"],
    "competitor_weaknesses": ["weakness 1", "weakness 2"],
    "summary": "2-3 sentence executive overview"
  }
}

Requirements:
- seo_strategy.score: 0-100 (estimated current SEO strength vs competitors)
- geo_strategy.llm_visibility_score: 0-100 (how well brand appears in AI answers)
- unified_recommendations: top 7 cross-channel actions ranked by impact/effort
- Reference specific brand names, domains, keywords from the research data provided`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const rawText: string = data.content?.[0]?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  try {
    return JSON.parse(cleaned) as UnifiedStrategyOutput;
  } catch {
    throw new Error("Claude returned malformed JSON for unified strategy");
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Auth (service calls bypass) ──────────────────────────────────────────
    const isServiceCall = req.headers.get("X-Service-Call") === "true";
    if (!isServiceCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResponse({ success: false, error: "Missing Authorization header" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    const body: RequestBody = await req.json();
    const { brand_id, force_refresh = false } = body;
    if (!brand_id) return jsonResponse({ success: false, error: "brand_id is required" }, 400);

    // ── Brand context ────────────────────────────────────────────────────────
    const { data: brand, error: brandError } = await supabase
      .from("gv_brands")
      .select("id, brand_name, website, industry, country, subscription_tier, target_market, competitors")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) return jsonResponse({ success: false, error: "Brand not found" }, 404);

    // ── Tier-based depth ─────────────────────────────────────────────────────
    const tier = brand.subscription_tier ?? "basic";
    const requestedDepth = body.depth ?? "quick";
    // Basic tier → Level 1 only (no Apify)
    const depth: "quick" | "full" = (tier === "basic") ? "quick" : requestedDepth;

    console.log(`[USE] brand=${brand.brand_name} | tier=${tier} | depth=${depth} | force=${force_refresh}`);

    // ── Cache check (7-day TTL, smart delta) ────────────────────────────────
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("gv_unified_strategy")
        .select("result, created_at, expires_at, sources_used")
        .eq("brand_id", brand_id)
        .eq("depth", depth)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(`[USE] Cache hit — expires ${cached.expires_at}`);
        return jsonResponse({
          success:      true,
          cached:       true,
          depth,
          strategy:     cached.result,
          sources_used: cached.sources_used ?? [],
          generated_at: cached.created_at,
          expires_at:   cached.expires_at,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEVEL 1 & 2 — Step 1: Perplexity + Gemini in PARALLEL
    // ══════════════════════════════════════════════════════════════════════════
    console.log("[USE] Step 1: Perplexity + Gemini (parallel)...");
    const [research] = await Promise.all([
      runPerplexityResearch(brand as BrandContext, depth),
    ]);

    // Fire Gemini immediately (uses Perplexity raw context if available)
    const geminiAnalysis = await runGeminiIndexing(brand as BrandContext, research.raw);
    console.log(`[USE] Step 1 done — ${research.competitors_found.length} competitors found | Gemini: ${geminiAnalysis ? "✓" : "✗"}`);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2: Firecrawl — both levels (3 URLs for L1, 6 for L2)
    // ══════════════════════════════════════════════════════════════════════════
    const competitorUrls = [
      ...(brand.competitors ?? []),
      ...research.competitors_found,
    ].filter(Boolean);

    const maxFirecrawlPages = depth === "full" ? 6 : 3;
    let competitorPages: FirecrawlPage[] = [];
    if (competitorUrls.length > 0) {
      console.log(`[USE] Step 2: Firecrawl — up to ${maxFirecrawlPages} URLs...`);
      competitorPages = await scrapeCompetitors(competitorUrls, maxFirecrawlPages);
      console.log(`[USE] Firecrawl done — ${competitorPages.length} pages scraped`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3: Apify SERP data (Level 2 / full only)
    // ══════════════════════════════════════════════════════════════════════════
    let apifyResults: ApifySearchResult[] = [];
    if (depth === "full") {
      console.log("[USE] Step 3: Apify deep search (Level 2)...");
      apifyResults = await runApifyDeepSearch(brand as BrandContext, research.top_keywords);
      console.log(`[USE] Apify done — ${apifyResults.length} SERP results`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4: Claude unified strategy (all sources)
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`[USE] Step ${depth === "full" ? 4 : 3}: Claude strategy analysis...`);
    const strategy = await runClaudeStrategy(
      brand as BrandContext,
      research,
      geminiAnalysis,
      competitorPages,
      apifyResults,
      depth
    );
    console.log("[USE] Claude done");

    // ── Save to cache ────────────────────────────────────────────────────────
    const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const sourcesUsed = [
      "perplexity",
      geminiAnalysis ? "gemini" : null,
      competitorPages.length > 0 ? "firecrawl" : null,
      apifyResults.length > 0 ? "apify" : null,
      "claude",
    ].filter(Boolean);

    await supabase
      .from("gv_unified_strategy")
      .upsert(
        {
          brand_id,
          depth,
          result:         strategy,
          perplexity_raw: research.raw.slice(0, 10_000),
          sources_used:   sourcesUsed,
          expires_at:     expiresAt,
        },
        { onConflict: "brand_id,depth" }
      )
      .then(({ error }) => {
        if (error) console.error("[USE] Cache save failed:", error.message);
      });

    return jsonResponse({
      success:                 true,
      cached:                  false,
      depth,
      level:                   depth === "full" ? 2 : 1,
      strategy,
      sources_used:            sourcesUsed,
      competitor_pages_scraped: competitorPages.length,
      apify_results:           apifyResults.length,
      generated_at:            new Date().toISOString(),
      expires_at:              expiresAt,
    });

  } catch (error) {
    console.error("[USE] Fatal error:", error);
    return jsonResponse({
      success: false,
      error:   error instanceof Error ? error.message : "Unknown error",
      code:    "STRATEGY_FAILED",
    }, 500);
  }
});
