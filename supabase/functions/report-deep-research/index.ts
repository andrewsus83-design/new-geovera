import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ApifyClient }  from "https://esm.sh/apify-client@2.9.3";

// ─────────────────────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SK        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY")!;
const GOOGLE_AI_API_KEY  = Deno.env.get("GOOGLE_AI_API_KEY")!;
const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY")!;
const APIFY_API_TOKEN    = Deno.env.get("APIFY_API_TOKEN")!;
const FIRECRAWL_API_KEY  = Deno.env.get("FIRECRAWL_API_KEY")!;
const LATE_API_KEY       = Deno.env.get("LATE_API_KEY")!;
const LATE_API_BASE      = "https://getlate.dev/api/v1";
const FIRECRAWL_BASE     = "https://api.firecrawl.dev/v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_SK);

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Step1Output {
  brand_name: string;
  parent_company: string;
  official_website: string;
  social_media: { instagram?: string; tiktok?: string; facebook?: string; youtube?: string; };
  launch_date: string;
  category: string;
  sub_category: string;
  key_features: string[];
  target_demographic: string;
  market_positioning: string;
  competitors: string[];
  geographic_presence: string[];
  recent_news: string[];
  tagline: string;
  unique_selling_proposition: string;
}

interface DeepResearchRequest {
  report_id:       string;
  brand_name:      string;
  country:         string;
  brand_id:        string;
  surface_data:    Step1Output;
  competitor_list?: string[];
  social_handles?: { instagram?: string; tiktok?: string; };
}

interface SocialPost {
  platform: "instagram" | "tiktok";
  handle: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  postedAt: string | null;
  engagementTotal: number;
}

interface FirecrawlPage {
  url: string;
  markdown: string;
  title: string | null;
}

interface LateAccount {
  id: string;
  platform: string;
  name?: string;
  username?: string;
  followers?: number;
  [key: string]: unknown;
}

interface CompetitiveMatrix {
  brand_vs_competitors: {
    brand: string;
    social_presence: string;
    content_velocity: string;
    engagement_rate: string;
    top_content_themes: string[];
    estimated_followers: string;
  }[];
  market_trends: string[];
  seo_gaps: string[];
  ai_citation_patterns: string[];
  platform_insights: { instagram: string; tiktok: string; };
  summary: string;
}

interface DeepResearchOutput {
  strategic_insights: string[];
  opportunities: string[];
  threats: string[];
  recommended_actions: {
    priority: "high" | "medium" | "low";
    action: string;
    rationale: string;
    timeline: string;
    expected_impact: string;
  }[];
  competitive_intelligence: CompetitiveMatrix;
  social_benchmarks: {
    instagram_avg_engagement: string;
    tiktok_avg_engagement: string;
    top_performing_content_type: string;
    competitor_content_gaps: string[];
  };
  geo_recommendations: {
    queries_to_own: string[];
    citation_strategy: string;
    content_to_publish: string[];
  };
  seo_priority_gaps: string[];
  executive_summary: string;
  generated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Perplexity sonar-deep-research
// ─────────────────────────────────────────────────────────────────────────────

async function deepResearchPerplexity(
  brandName: string,
  country: string,
  surfaceData: Step1Output,
  competitorList: string[]
): Promise<string> {
  console.log("[deep-research] Step 1: Perplexity sonar-deep-research...");

  const competitorStr = competitorList.slice(0, 5).join(", ");

  const prompt = `Conduct deep competitive intelligence research on ${brandName} (${country}).

Brand context:
- Category: ${surfaceData.category} / ${surfaceData.sub_category}
- Website: ${surfaceData.official_website}
- Key competitors: ${competitorStr}
- Market positioning: ${surfaceData.market_positioning}
- USP: ${surfaceData.unique_selling_proposition}

Research Areas — provide specific, data-backed findings for each:

1. COMPETITIVE LANDSCAPE: market share estimates vs ${competitorStr}, recent campaigns/launches (last 6 months), pricing strategy comparison, where ${brandName} wins vs loses.

2. SEO GAPS: top organic keywords where competitors rank but ${brandName} does not, backlink profile differences, content topics competitors cover that ${brandName} hasn't addressed, featured snippet opportunities.

3. SOCIAL MEDIA TRENDS: trending hashtags and content formats in ${surfaceData.category} on TikTok/Instagram, which formats (Reels, Shorts, Stories, carousels) perform best, viral content patterns in this category (past 90 days), creator/influencer landscape.

4. AI CITATION PATTERNS (GEO): which brands in ${surfaceData.category} are cited by ChatGPT/Perplexity/Google SGE, what content types get cited, entity recognition gaps for ${brandName}.

5. CONSUMER SENTIMENT: common complaints about ${brandName} (Reddit, reviews, social), unmet needs, sentiment vs top 2 competitors.

6. EMERGING OPPORTUNITIES: underserved niches in ${surfaceData.category} in ${country}, regulatory/trend shifts, partnership opportunities.

Provide specific data, real URLs, actual statistics. Cite sources where possible.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-deep-research",
      messages: [
        { role: "system", content: "You are a senior competitive intelligence analyst. Provide deep, specific, data-backed research. Cite sources where available." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens:  6000,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Perplexity deep-research HTTP ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`Perplexity deep-research unexpected response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log("[deep-research] Step 1 complete");
  return data.choices[0].message.content as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2a: Apify Instagram scraper
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeInstagramHandles(apify: ApifyClient, handles: string[]): Promise<SocialPost[]> {
  if (!handles.length || !APIFY_API_TOKEN) return [];
  console.log(`[deep-research] Instagram scraping: ${handles.join(", ")}`);

  try {
    const usernames = handles.map(h => h.replace(/^@/, ""));
    const run = await apify.actor("apify/instagram-scraper").call(
      { usernames, resultsLimit: 50, resultsType: "posts", searchType: "user", addParentData: false },
      { timeout: 90, memory: 1024 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    console.log(`[deep-research] Instagram: ${items.length} posts`);

    return (items as Record<string, unknown>[]).map(p => ({
      platform:        "instagram" as const,
      handle:          (p.username as string) || handles[0],
      caption:         (p.caption as string)  || "",
      likes:           (p.likesCount as number)    || 0,
      comments:        (p.commentsCount as number) || 0,
      shares:          0,
      views:           0,
      postedAt:        p.timestamp ? new Date(p.timestamp as string).toISOString() : null,
      engagementTotal: ((p.likesCount as number) || 0) + ((p.commentsCount as number) || 0),
    }));
  } catch (err) {
    console.warn(`[deep-research] Instagram scrape failed: ${(err as Error).message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2b: Apify TikTok scraper
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeTikTokHandles(apify: ApifyClient, handles: string[]): Promise<SocialPost[]> {
  if (!handles.length || !APIFY_API_TOKEN) return [];
  console.log(`[deep-research] TikTok scraping: ${handles.join(", ")}`);

  try {
    const profiles = handles.map(h => h.replace(/^@/, ""));
    const run = await apify.actor("apify/tiktok-scraper").call(
      { profiles, resultsPerPage: 50, shouldDownloadVideos: false, shouldDownloadCovers: false },
      { timeout: 90, memory: 1024 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    console.log(`[deep-research] TikTok: ${items.length} posts`);

    return (items as Record<string, unknown>[]).map(p => {
      const likes    = (p.diggCount    as number) || 0;
      const comments = (p.commentCount as number) || 0;
      const shares   = (p.shareCount   as number) || 0;
      const views    = (p.playCount    as number) || 0;
      return {
        platform:        "tiktok" as const,
        handle:          (p.authorMeta as Record<string, string>)?.name || handles[0],
        caption:         (p.text as string) || "",
        likes,
        comments,
        shares,
        views,
        postedAt:        p.createTime ? new Date((p.createTime as number) * 1000).toISOString() : null,
        engagementTotal: likes + comments + shares,
      };
    });
  } catch (err) {
    console.warn(`[deep-research] TikTok scrape failed: ${(err as Error).message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2c: Late API — connected brand social analytics
// ─────────────────────────────────────────────────────────────────────────────

async function fetchLateAnalytics(brandId: string): Promise<LateAccount[]> {
  if (!LATE_API_KEY) return [];
  console.log(`[deep-research] Late API: fetching connected accounts for brand ${brandId}`);

  try {
    // Resolve late_profile_id from gv_brands
    const { data: brand } = await supabase
      .from("gv_brands")
      .select("late_profile_id")
      .eq("id", brandId)
      .single();

    const profileId = brand?.late_profile_id;
    if (!profileId) {
      console.log("[deep-research] Late API: no late_profile_id on brand, skipping");
      return [];
    }

    const res = await fetch(`${LATE_API_BASE}/accounts?profileId=${profileId}`, {
      headers: { "Authorization": `Bearer ${LATE_API_KEY}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Late API HTTP ${res.status}`);

    const data = await res.json();
    const accounts: LateAccount[] = Array.isArray(data) ? data : (data.accounts || data.data || []);
    console.log(`[deep-research] Late API: ${accounts.length} accounts`);
    return accounts;
  } catch (err) {
    console.warn(`[deep-research] Late API failed: ${(err as Error).message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2d: Firecrawl — competitor website scraping
// ─────────────────────────────────────────────────────────────────────────────

async function scrapeCompetitorSites(
  competitors: string[],
  surfaceData: Step1Output
): Promise<FirecrawlPage[]> {
  if (!FIRECRAWL_API_KEY) return [];
  console.log(`[deep-research] Firecrawl: scraping competitor sites`);

  // Build URLs from competitor brand names (best-effort heuristic)
  const competitorUrls = competitors.slice(0, 3).map(c => {
    const slug = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `https://www.${slug}.com`;
  });

  // Also include brand's own website
  if (surfaceData.official_website && surfaceData.official_website !== "Not Found") {
    competitorUrls.unshift(surfaceData.official_website);
  }

  const urlsToScrape = [...new Set(competitorUrls)].slice(0, 4);

  const scrapeOne = async (url: string): Promise<FirecrawlPage> => {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 12000 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);

    const data = await res.json();
    if (!data.success) throw new Error(`Firecrawl error: ${data.error}`);

    return {
      url,
      markdown: (data.data?.markdown || "").slice(0, 6000),
      title:    data.data?.metadata?.title || null,
    };
  };

  const settled = await Promise.allSettled(urlsToScrape.map(u => scrapeOne(u)));
  const pages: FirecrawlPage[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      pages.push(outcome.value);
      console.log(`[deep-research] Firecrawl OK: ${urlsToScrape[i]}`);
    } else {
      console.warn(`[deep-research] Firecrawl FAILED: ${urlsToScrape[i]} — ${(outcome as PromiseRejectedResult).reason?.message}`);
    }
  }

  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Gemini 2.0 Flash — competitive intelligence matrix
// ─────────────────────────────────────────────────────────────────────────────

function summarisePosts(posts: SocialPost[], platform: string): string {
  if (!posts.length) return `${platform}: no data`;
  const top10     = [...posts].sort((a, b) => b.engagementTotal - a.engagementTotal).slice(0, 10);
  const totalEng  = posts.reduce((s, p) => s + p.engagementTotal, 0);
  const avgEng    = Math.round(totalEng / posts.length);
  const captions  = top10.map((p, i) => `${i + 1}. [${p.handle}] (${p.engagementTotal} eng) "${p.caption.slice(0, 120)}"`).join("\n");
  return `${platform}: ${posts.length} posts, avg engagement ${avgEng}\nTop 10:\n${captions}`;
}

async function synthesizeWithGemini(
  brandName: string,
  country: string,
  perplexityDeepResearch: string,
  igPosts: SocialPost[],
  ttPosts: SocialPost[],
  lateAccounts: LateAccount[],
  competitorPages: FirecrawlPage[]
): Promise<CompetitiveMatrix> {
  console.log("[deep-research] Step 3: Gemini competitive intelligence synthesis...");

  const lateStr = lateAccounts.length
    ? `Connected accounts via Late API:\n${JSON.stringify(lateAccounts.slice(0, 5), null, 2)}`
    : "Late API: no connected accounts data";

  const competitorPagesStr = competitorPages.length
    ? competitorPages.map(p => `== ${p.url} ==\n${p.markdown.slice(0, 2000)}`).join("\n\n")
    : "No competitor pages scraped";

  const prompt = `You are a competitive intelligence analyst. Build a structured competitive matrix for ${brandName} (${country}).

=== PERPLEXITY DEEP RESEARCH ===
${perplexityDeepResearch.slice(0, 4000)}

=== INSTAGRAM DATA (${igPosts.length} posts) ===
${summarisePosts(igPosts, "instagram")}

=== TIKTOK DATA (${ttPosts.length} posts) ===
${summarisePosts(ttPosts, "tiktok")}

=== CONNECTED SOCIAL ANALYTICS (Late API) ===
${lateStr}

=== COMPETITOR WEBSITE CONTENT ===
${competitorPagesStr}

Synthesise all data into this exact JSON (no markdown):
{
  "brand_vs_competitors": [
    {
      "brand": "<brand name>",
      "social_presence": "<strong/moderate/weak with 1-sentence rationale>",
      "content_velocity": "<posts per week estimate>",
      "engagement_rate": "<% estimate or N/A>",
      "top_content_themes": ["<theme1>", "<theme2>", "<theme3>"],
      "estimated_followers": "<range or N/A>"
    }
  ],
  "market_trends": ["<trend 1>", "<trend 2>", "<trend 3>"],
  "seo_gaps": ["<specific keyword/topic gap>"],
  "ai_citation_patterns": ["<pattern observed>"],
  "platform_insights": {
    "instagram": "<2-sentence insight on what works in this category on IG>",
    "tiktok": "<2-sentence insight on what works in this category on TikTok>"
  },
  "summary": "<3-sentence executive summary of the competitive landscape>"
}

Include ${brandName} as the first entry in brand_vs_competitors.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 3000 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

    const data  = await res.json();
    const raw   = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("Empty Gemini response");

    const matrix: CompetitiveMatrix = JSON.parse(raw);
    console.log("[deep-research] Step 3 complete");
    return matrix;

  } catch (err) {
    console.warn(`[deep-research] Gemini synthesis failed: ${(err as Error).message} — using fallback`);
    return {
      brand_vs_competitors: [{
        brand: brandName, social_presence: "unknown", content_velocity: "N/A",
        engagement_rate: "N/A", top_content_themes: [], estimated_followers: "N/A",
      }],
      market_trends: [], seo_gaps: [], ai_citation_patterns: [],
      platform_insights: { instagram: "", tiktok: "" },
      summary: "Competitive matrix could not be generated.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4: Claude — deep strategic analysis
// ─────────────────────────────────────────────────────────────────────────────

async function claudeDeepAnalysis(
  brandName: string,
  country: string,
  surfaceData: Step1Output,
  perplexityDeepResearch: string,
  competitiveMatrix: CompetitiveMatrix,
  igPosts: SocialPost[],
  ttPosts: SocialPost[],
  lateAccounts: LateAccount[]
): Promise<DeepResearchOutput> {
  console.log("[deep-research] Step 4: Claude deep strategic analysis...");

  const socialSnippet = [
    igPosts.length ? `Instagram: ${igPosts.length} posts` : null,
    ttPosts.length ? `TikTok: ${ttPosts.length} posts`    : null,
    lateAccounts.length ? `Late API: ${lateAccounts.length} connected accounts` : null,
  ].filter(Boolean).join("; ") || "no social data";

  const igAvg = igPosts.length
    ? `${(igPosts.reduce((s, p) => s + p.engagementTotal, 0) / igPosts.length).toFixed(0)} avg eng`
    : "N/A";
  const ttAvg = ttPosts.length
    ? `${(ttPosts.reduce((s, p) => s + p.engagementTotal, 0) / ttPosts.length).toFixed(0)} avg eng`
    : "N/A";

  const prompt = `You are a senior brand strategist performing a deep competitive analysis for ${brandName} (${country}).

Brand Profile:
${JSON.stringify(surfaceData, null, 2)}

Deep Research (Perplexity sonar-deep-research):
${perplexityDeepResearch.slice(0, 5000)}

Competitive Intelligence Matrix (Gemini synthesis):
${JSON.stringify(competitiveMatrix, null, 2)}

Social Data: ${socialSnippet}
Instagram benchmark: ${igAvg}
TikTok benchmark: ${ttAvg}

Return ONLY valid JSON (no markdown):

{
  "strategic_insights": ["<specific non-obvious insight 1>", "<insight 2>", "<insight 3>", "<insight 4>", "<insight 5>"],
  "opportunities": ["<specific market opportunity>", "<opportunity 2>", "<opportunity 3>"],
  "threats": ["<competitive or market threat with evidence>", "<threat 2>", "<threat 3>"],
  "recommended_actions": [
    {
      "priority": "high",
      "action": "<specific, concrete action step>",
      "rationale": "<why, grounded in the research>",
      "timeline": "30 days",
      "expected_impact": "<measurable outcome>"
    }
  ],
  "competitive_intelligence": ${JSON.stringify(competitiveMatrix)},
  "social_benchmarks": {
    "instagram_avg_engagement": "${igAvg}",
    "tiktok_avg_engagement": "${ttAvg}",
    "top_performing_content_type": "<Reels|Carousel|Short|Story>",
    "competitor_content_gaps": ["<gap brand could exploit>", "<gap 2>"]
  },
  "geo_recommendations": {
    "queries_to_own": ["<AI query brand should rank for>", "<query 2>", "<query 3>"],
    "citation_strategy": "<2-sentence strategy for getting cited by AI engines>",
    "content_to_publish": ["<specific content piece: title + format + why>", "<content 2>", "<content 3>"]
  },
  "seo_priority_gaps": ["<specific keyword gap>", "<gap 2>", "<gap 3>", "<gap 4>", "<gap 5>"],
  "executive_summary": "<4-5 sentence CMO brief: current position, biggest opportunity, most urgent threat>",
  "generated_at": "${new Date().toISOString()}"
}

Requirements: recommended_actions must have 5-7 items ordered by priority. All insights must be grounded in the research data.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:       "claude-sonnet-4-20250514",
      max_tokens:  6000,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Claude API HTTP ${response.status}: ${err.slice(0, 300)}`);
  }

  const data = await response.json();
  if (!data.content?.[0]?.text) throw new Error(`Claude API unexpected shape: ${JSON.stringify(data).slice(0, 300)}`);

  const text     = data.content[0].text as string;
  const jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const result   = JSON.parse(jsonText) as DeepResearchOutput;

  console.log("[deep-research] Step 4 complete");
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5: Save to Supabase
// ─────────────────────────────────────────────────────────────────────────────

async function saveToSupabase(reportId: string, deepOutput: DeepResearchOutput): Promise<void> {
  console.log(`[deep-research] Step 5: Saving to gv_reports (id=${reportId})...`);

  const { error } = await supabase
    .from("gv_reports")
    .update({
      deep_research_data:   deepOutput,
      deep_research_status: "completed",
      deep_research_at:     new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
  console.log("[deep-research] Step 5 complete");
}

async function markFailed(reportId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("gv_reports")
    .update({ deep_research_status: "failed", deep_research_error: errorMessage })
    .eq("id", reportId)
    .then(({ error }) => {
      if (error) console.error(`[deep-research] Failed to mark report as failed: ${error.message}`);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  let body: DeepResearchRequest;
  try {
    body = await req.json() as DeepResearchRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { report_id, brand_name, country, brand_id, surface_data, competitor_list, social_handles } = body;

  if (!report_id)    return json({ error: "report_id is required" }, 400);
  if (!brand_name)   return json({ error: "brand_name is required" }, 400);
  if (!country)      return json({ error: "country is required" }, 400);
  if (!brand_id)     return json({ error: "brand_id is required" }, 400);
  if (!surface_data) return json({ error: "surface_data is required" }, 400);

  // Mark report as processing
  await supabase.from("gv_reports")
    .update({ deep_research_status: "processing" })
    .eq("id", report_id);

  console.log(`\n[deep-research] START: ${brand_name} (${country}), report_id=${report_id}\n`);

  const competitors = (competitor_list ?? surface_data.competitors ?? []).slice(0, 5);
  const igHandle    = social_handles?.instagram || surface_data.social_media?.instagram || null;
  const ttHandle    = social_handles?.tiktok    || surface_data.social_media?.tiktok    || null;

  const igHandles = [igHandle, ...competitors.slice(0, 2).map(c => c.toLowerCase().replace(/\s+/g, ""))].filter(Boolean) as string[];
  const ttHandles = [ttHandle, ...competitors.slice(0, 2).map(c => c.toLowerCase().replace(/\s+/g, ""))].filter(Boolean) as string[];

  try {
    // Step 1: Perplexity sonar-deep-research (sequential)
    const perplexityDeepResearch = await deepResearchPerplexity(brand_name, country, surface_data, competitors);

    // Step 2: Parallel data collection
    console.log("[deep-research] Step 2: Parallel data collection (Apify IG+TT + Late API + Firecrawl)...");

    const apify = new ApifyClient({ token: APIFY_API_TOKEN });

    const [igResult, ttResult, lateResult, firecrawlResult] = await Promise.allSettled([
      scrapeInstagramHandles(apify, igHandles),
      scrapeTikTokHandles(apify, ttHandles),
      fetchLateAnalytics(brand_id),
      scrapeCompetitorSites(competitors, surface_data),
    ]);

    const igPosts:         SocialPost[]    = igResult.status        === "fulfilled" ? igResult.value        : [];
    const ttPosts:         SocialPost[]    = ttResult.status        === "fulfilled" ? ttResult.value        : [];
    const lateAccounts:    LateAccount[]   = lateResult.status      === "fulfilled" ? lateResult.value      : [];
    const competitorPages: FirecrawlPage[] = firecrawlResult.status === "fulfilled" ? firecrawlResult.value : [];

    if (igResult.status        === "rejected") console.warn(`[deep-research] Instagram failed: ${(igResult as PromiseRejectedResult).reason?.message}`);
    if (ttResult.status        === "rejected") console.warn(`[deep-research] TikTok failed: ${(ttResult as PromiseRejectedResult).reason?.message}`);
    if (lateResult.status      === "rejected") console.warn(`[deep-research] Late API failed: ${(lateResult as PromiseRejectedResult).reason?.message}`);
    if (firecrawlResult.status === "rejected") console.warn(`[deep-research] Firecrawl failed: ${(firecrawlResult as PromiseRejectedResult).reason?.message}`);

    console.log(`[deep-research] Step 2 complete — IG:${igPosts.length} TT:${ttPosts.length} Late:${lateAccounts.length} Firecrawl:${competitorPages.length}`);

    // Step 3: Gemini competitive matrix
    const competitiveMatrix = await synthesizeWithGemini(
      brand_name, country, perplexityDeepResearch,
      igPosts, ttPosts, lateAccounts, competitorPages
    );

    // Step 4: Claude deep analysis
    const deepOutput = await claudeDeepAnalysis(
      brand_name, country, surface_data,
      perplexityDeepResearch, competitiveMatrix,
      igPosts, ttPosts, lateAccounts
    );

    // Step 5: Save
    await saveToSupabase(report_id, deepOutput);

    return json({
      success:    true,
      report_id,
      brand_name,
      stats: {
        ig_posts:         igPosts.length,
        tt_posts:         ttPosts.length,
        late_accounts:    lateAccounts.length,
        competitor_pages: competitorPages.length,
        insights:         deepOutput.strategic_insights.length,
        recommendations:  deepOutput.recommended_actions.length,
      },
      message: "Deep research complete. Results saved to gv_reports.deep_research_data.",
    });

  } catch (err) {
    console.error(`[deep-research] FATAL: ${(err as Error).message}`, err);
    await markFailed(report_id, (err as Error).message || String(err));
    return json({ success: false, error: (err as Error).message, report_id }, 500);
  }
});
