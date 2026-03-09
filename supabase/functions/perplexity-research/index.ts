import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * perplexity-research — 2-Level Brand Visibility & GEO Research
 *
 * Level 1 ("brief") — Initial research (~15 queries, ~45s):
 *   Step 1: Perplexity sonar — 15 brand visibility queries (batches of 5)
 *   Step 2: Gemini Flash — brand positioning + content authority analysis
 *   Step 3: Firecrawl — scrape top 3 citation sources found
 *   Step 4: Save aggregated results to gv_ai_articles
 *
 * Level 2 ("deep") — Monthly deep research (~30 queries, ~90s):
 *   Step 1: Perplexity sonar-deep — 30 comprehensive queries (batches of 5)
 *   Step 2: Gemini Flash — comprehensive market analysis
 *   Step 3: Firecrawl — scrape top 6 citation sources
 *   Step 4: Apify Google Search — organic SERP data for key terms
 *   Step 4b: SerpAPI — brand SERP position + knowledge panel analysis
 *   Step 5: Claude Sonnet — synthesis + generates suggested topics/prompts
 *            (basic=200 topics, premium=300, partner=500 — split SEO/GEO/Social)
 *   Step 6: Save suggested topics to gv_keywords (source="research_suggested")
 *   Step 7: Save results with smart hash (delta caching — skip unchanged)
 *
 * 30-day cache guard: Level 2 runs at most once per 30 days per brand.
 * Bypass with force_refresh=true.
 *
 * Smart hash delta caching: SHA-256 of (brand_id + result_summary) prevents
 * duplicate saves when data hasn't changed since last run.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-service-call",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResearchRequest {
  brand_id: string;
  research_type: "brief" | "deep";
  focus_channel?: "seo" | "geo" | "social" | "all";
  force_refresh?: boolean;
}

interface BrandData {
  id: string;
  brand_name: string;
  brand_category?: string;
  industry?: string;
  brand_country?: string;
  country?: string;
  brand_website?: string;
  website?: string;
  brand_description?: string;
  target_market?: string;
  competitors?: string[];
  subscription_tier?: string;
}

interface QueryResult {
  question: string;
  answer: string;
  citations: Array<{ title: string; url: string; snippet: string }>;
  brand_mentioned: boolean;
  brand_position: number | null;
  sentiment: "positive" | "neutral" | "negative" | "not_mentioned";
  key_insights: string[];
}

interface ScrapeResult {
  url: string;
  title: string | null;
  markdown: string;
}

interface ApifyResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

interface SerpApiOrganic {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

interface SerpApiResult {
  query: string;
  organic_results: SerpApiOrganic[];
  brand_in_results: boolean;
  brand_position: number | null;
  knowledge_panel?: { title: string; description: string };
}

interface SuggestedTopics {
  seo:    string[];
  geo:    string[];
  social: string[];
}

interface SynthesisResult {
  synthesis:        string;
  suggested_topics: SuggestedTopics;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function brandName(brand: BrandData): string {
  return brand.brand_name;
}
function brandCountry(brand: BrandData): string {
  return brand.brand_country ?? brand.country ?? "Indonesia";
}
function brandWebsite(brand: BrandData): string {
  return brand.brand_website ?? brand.website ?? "";
}
function brandIndustry(brand: BrandData): string {
  return brand.brand_category ?? brand.industry ?? "brand";
}

async function smartHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer  = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function tierTopicCount(tier: string): { total: number; seo: number; geo: number; social: number } {
  if (tier === "partner") return { total: 500, seo: 170, geo: 170, social: 160 };
  if (tier === "premium") return { total: 300, seo: 110, geo: 100, social: 90 };
  return { total: 200, seo: 80, geo: 70, social: 50 }; // basic / default
}

// ─── Step 1: Perplexity — concurrent batched queries ─────────────────────────

function buildResearchQuestions(
  brand: BrandData,
  focusChannel: string,
  type: "brief" | "deep"
): string[] {
  const name     = brandName(brand);
  const country  = brandCountry(brand);
  const industry = brandIndustry(brand);
  const website  = brandWebsite(brand);

  const baseQuestions = [
    // GEO / AI visibility
    `When someone asks an AI assistant "best ${industry} brand in ${country}", is ${name} mentioned?`,
    `What are the top ${industry} brands mentioned on Wikipedia, Reddit, and YouTube in ${country}?`,
    `Which ${industry} brands are most cited by AI models like ChatGPT and Gemini in ${country}?`,
    `What structured data and schema markup do leading ${industry} brands use?`,
    `What FAQs do consumers have about ${industry} products in ${country}?`,

    // SEO visibility
    `Who ranks #1 on Google for "${industry} ${country}" and what makes their content rank?`,
    `What long-tail keywords around ${industry} have low competition in ${country}?`,
    `What content types (video, blog, infographic) rank best for ${industry} searches in ${country}?`,
    `Is ${name}${website ? ` (${website})` : ""} mentioned as a recommended ${industry} brand online?`,
    `What are the top 5 competitor domains for ${industry} in ${country} by organic traffic?`,

    // Social media visibility
    `Which ${industry} brands have the most engaging content on TikTok in ${country}?`,
    `What ${industry} content formats drive the most shares on Instagram in ${country}?`,
    `Who are the top ${industry} influencers in ${country} by engagement rate?`,
    `What viral ${industry} content trends appeared in the last 30 days in ${country}?`,
    `How does ${name} compare to competitors on social media engagement?`,
  ];

  const deepExtras = [
    `What are the top backlink sources for ${industry} brands ranking on Google in ${country}?`,
    `What technical SEO issues are common among ${industry} brand websites?`,
    `What featured snippets are available for ${industry} queries in ${country}?`,
    `Which ${industry} brands have the best E-E-A-T signals according to Google guidelines?`,
    `What user intent do consumers have when searching for ${industry} products online?`,
    `What are the most-shared ${industry} articles on social media in the last 90 days?`,
    `Which YouTube channels cover ${industry} in ${country} and what topics do they focus on?`,
    `What Reddit communities discuss ${industry} in ${country}?`,
    `What questions about ${industry} appear in Google's "People Also Ask" box in ${country}?`,
    `What is the brand awareness of ${name} compared to its top 3 competitors?`,
    `What pricing strategies do leading ${industry} brands use in ${country}?`,
    `What are the key differentiators consumers mention when reviewing ${industry} brands?`,
    `How do consumers describe ${name} in reviews and social media posts?`,
    `What customer pain points are underserved by existing ${industry} brands in ${country}?`,
    `What partnerships or collaborations have top ${industry} brands done recently?`,
  ];

  let questions = type === "deep" ? [...baseQuestions, ...deepExtras] : baseQuestions;

  // Filter by focus channel if specified
  if (focusChannel === "seo") {
    questions = questions.filter((_, i) => (i >= 5 && i <= 9) || (i >= 15 && i <= 19));
  } else if (focusChannel === "geo") {
    questions = questions.filter((_, i) => i <= 4 || i === 18 || i === 19);
  } else if (focusChannel === "social") {
    questions = questions.filter((_, i) => (i >= 10 && i <= 14) || (i >= 20 && i <= 24));
  }

  return questions;
}

async function runPerplexityBatch(
  questions: string[],
  apiKey: string,
  model: string,
  batchSize = 5
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];

  // Process in concurrent batches to respect rate limits + stay within timeout
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (question): Promise<QueryResult | null> => {
        try {
          const res = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content: "You are a precise market research assistant. Give factual, data-backed answers with citations. Include specific brand names, domain names, and statistics.",
                },
                { role: "user", content: question },
              ],
              max_tokens:       1500,
              temperature:      0.2,
              return_citations: true,
              return_images:    false,
            }),
            signal: AbortSignal.timeout(20_000),
          });

          if (!res.ok) return null;
          const data = await res.json();
          const answer = data.choices?.[0]?.message?.content ?? "";
          const citations = (data.citations ?? []).map((c: Record<string, string>) => ({
            title:   c.title   ?? "",
            url:     c.url     ?? "",
            snippet: c.snippet ?? c.text ?? "",
          }));

          return {
            question,
            answer,
            citations: citations.slice(0, 5),
            brand_mentioned: false, // filled in by buildAggregates
            brand_position:  null,
            sentiment:       "neutral",
            key_insights:    [],
          };
        } catch {
          return null;
        }
      })
    );

    batchResults.forEach(r => {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    });

    // Small delay between batches to respect rate limits
    if (i + batchSize < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

// ─── Step 2: Gemini brand analysis ───────────────────────────────────────────

async function runGeminiAnalysis(
  brand: BrandData,
  researchSummary: string,
  type: "brief" | "deep"
): Promise<string | null> {
  const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!geminiKey) return null;

  const prompt = type === "deep"
    ? `Comprehensive competitive intelligence analysis for ${brandName(brand)} (${brandIndustry(brand)}, ${brandCountry(brand)}):

Research data from Perplexity:
${researchSummary.slice(0, 4000)}

Provide detailed analysis:
1. **AI Visibility Score** (0-100): How likely is this brand to appear in AI search results?
2. **Content Authority Gaps**: 5 specific topics where the brand has low authority but competitors dominate
3. **GEO Readiness Assessment**: What structured data, FAQ content, and citation-worthy claims are missing?
4. **Competitive Moats**: What advantages do top 3 competitors have that are hard to replicate?
5. **High-ROI Content Opportunities**: 7 specific article/video topics that could drive AI citations within 60 days
6. **Social Proof Gaps**: Where does the brand lack reviews, case studies, or social proof vs competitors?
7. **Monthly Priority Actions**: Top 5 actions for this month ranked by expected impact

Be specific, reference actual competitors and domains from the research. Under 1000 words.`
    : `Quick competitive positioning analysis for ${brandName(brand)} (${brandIndustry(brand)}, ${brandCountry(brand)}):

Research context:
${researchSummary.slice(0, 2000)}

Provide focused analysis:
1. **AI Citation Readiness** (score + 2 key gaps)
2. **Top 3 Content Opportunities** for quick visibility wins
3. **Main Competitor Advantage** — what are they doing better?
4. **Immediate Recommendations** — 3 specific actions

Be concise and actionable. Under 400 words.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.3,
            maxOutputTokens: type === "deep" ? 2048 : 1024,
          },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ─── Step 3: Firecrawl citation sources ──────────────────────────────────────

async function scrapeCitationSources(
  urls: string[],
  maxPages: number
): Promise<ScrapeResult[]> {
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!firecrawlKey || urls.length === 0) return [];

  const targets = [...new Set(urls)].slice(0, maxPages);
  console.log(`[PR] Firecrawl: scraping ${targets.length} citation sources`);

  const results = await Promise.allSettled(
    targets.map(async (url): Promise<ScrapeResult | null> => {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firecrawlKey}`,
          },
          body: JSON.stringify({
            url:             url.startsWith("http") ? url : `https://${url}`,
            formats:         ["markdown"],
            onlyMainContent: true,
          }),
          signal: AbortSignal.timeout(12_000),
        });

        if (!res.ok) return null;
        const data = await res.json();
        const markdown: string = data.data?.markdown ?? "";
        if (!markdown) return null;

        return {
          url,
          title:    data.data?.metadata?.title ?? null,
          markdown: markdown.slice(0, 3000),
        };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ScrapeResult | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((p): p is ScrapeResult => p !== null);
}

// ─── Step 4: Apify SERP scraper (deep only) ──────────────────────────────────

async function runApifySerpScrape(
  brand: BrandData,
  keywords: string[]
): Promise<ApifyResult[]> {
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  if (!apifyToken || keywords.length === 0) return [];

  const brandKeywords = [
    brandName(brand),
    `${brandName(brand)} review`,
    `${brandIndustry(brand)} ${brandCountry(brand)}`,
    ...keywords.slice(0, 2),
  ].slice(0, 5);

  console.log(`[PR] Apify SERP: ${brandKeywords.length} queries`);

  try {
    const countryCode = brandCountry(brand).toLowerCase() === "indonesia" ? "ID" : "US";
    const langCode    = brandCountry(brand).toLowerCase() === "indonesia" ? "id" : "en";

    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=45&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries:          brandKeywords.join("\n"),
          resultsPerPage:   5,
          maxPagesPerQuery: 1,
          languageCode:     langCode,
          countryCode,
          mobileResults:    false,
        }),
        signal: AbortSignal.timeout(50_000),
      }
    );

    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    return items
      .filter((item: Record<string, unknown>) => item.url)
      .map((item: Record<string, unknown>) => ({
        title:       (item.title as string)       || "",
        url:         (item.url as string)         || "",
        description: (item.description as string) || "",
        position:    (item.position as number)    || 0,
      }))
      .slice(0, 20);
  } catch (err) {
    console.warn("[PR] Apify failed:", err);
    return [];
  }
}

// ─── Step 4b: SerpAPI brand SERP analysis (deep only) ────────────────────────

async function runSerpApiResearch(
  brand: BrandData,
  topCompetitorDomains: string[]
): Promise<SerpApiResult[]> {
  const serpApiKey = Deno.env.get("SERPAPI_API_KEY");
  if (!serpApiKey) return [];

  const name       = brandName(brand);
  const industry   = brandIndustry(brand);
  const country    = brandCountry(brand);
  const isIndonesia = country.toLowerCase() === "indonesia";
  const countryCode = isIndonesia ? "id" : "us";
  const langCode    = isIndonesia ? "id" : "en";

  const queries = [
    name,
    `${name} ${industry}`,
    isIndonesia ? `${industry} terbaik ${country}` : `best ${industry} ${country}`,
    ...topCompetitorDomains.slice(0, 2).map(d => `site:${d} ${industry}`),
  ].slice(0, 5);

  console.log(`[PR] SerpAPI: ${queries.length} queries`);

  const results = await Promise.allSettled(
    queries.map(async (query): Promise<SerpApiResult | null> => {
      try {
        const params = new URLSearchParams({
          api_key: serpApiKey,
          engine:  "google",
          q:       query,
          gl:      countryCode,
          hl:      langCode,
          num:     "10",
        });

        const res = await fetch(`https://serpapi.com/search.json?${params}`, {
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) return null;
        const data = await res.json();

        const organic: SerpApiOrganic[] = (data.organic_results ?? [])
          .slice(0, 10)
          .map((r: Record<string, unknown>) => ({
            title:    (r.title    as string) || "",
            url:      (r.link     as string) || "",
            snippet:  (r.snippet  as string) || "",
            position: (r.position as number) || 0,
          }));

        const nameLower = name.toLowerCase();
        const brandResult = organic.find(r =>
          r.title.toLowerCase().includes(nameLower) ||
          r.url.toLowerCase().includes(nameLower.replace(/\s+/g, ""))
        );

        const kg = data.knowledge_graph;
        return {
          query,
          organic_results:  organic,
          brand_in_results: !!brandResult,
          brand_position:   brandResult?.position ?? null,
          knowledge_panel:  kg ? {
            title:       (kg.title       as string) || "",
            description: ((kg.description as string) || "").slice(0, 200),
          } : undefined,
        };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SerpApiResult | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((r): r is SerpApiResult => r !== null);
}

// ─── Step 5: Claude Sonnet synthesis + suggested topic generation ─────────────

async function runClaudeSynthesis(
  brand: BrandData,
  queryResults: QueryResult[],
  geminiAnalysis: string | null,
  scrapeResults: ScrapeResult[],
  apifyResults: ApifyResult[],
  serpApiResults: SerpApiResult[],
  tier: string
): Promise<SynthesisResult> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const counts = tierTopicCount(tier);

  const mentions   = queryResults.filter(r => r.brand_mentioned).length;
  const mentionPct = queryResults.length > 0
    ? ((mentions / queryResults.length) * 100).toFixed(1)
    : "0";

  const questionSummary = queryResults
    .slice(0, 15)
    .map(r => `Q: ${r.question}\nA (excerpt): ${r.answer.slice(0, 300)}`)
    .join("\n\n");

  const scrapeContext = scrapeResults.length > 0
    ? `\n\nCitation Sources Scraped:\n` +
      scrapeResults.map(s => `[${s.url}]: ${s.markdown.slice(0, 1000)}`).join("\n\n")
    : "";

  const apifyContext = apifyResults.length > 0
    ? `\n\nSERP Data — Apify (${apifyResults.length} results):\n` +
      apifyResults.slice(0, 10)
        .map(r => `#${r.position} ${r.title} | ${r.url}\n${r.description}`)
        .join("\n\n")
    : "";

  const serpContext = serpApiResults.length > 0
    ? `\n\nSerpAPI SERP Analysis (${serpApiResults.length} queries):\n` +
      serpApiResults.map(r => {
        const top5 = r.organic_results.slice(0, 5)
          .map(o => `  #${o.position} ${o.title} | ${o.url}`)
          .join("\n");
        const kp = r.knowledge_panel
          ? `\n  Knowledge Panel: "${r.knowledge_panel.title}" — ${r.knowledge_panel.description}`
          : "";
        return `Query: "${r.query}"\n` +
          `Brand in results: ${r.brand_in_results ? `YES (position #${r.brand_position})` : "NO"}\n` +
          `Top results:\n${top5}${kp}`;
      }).join("\n\n")
    : "";

  const geminiContext = geminiAnalysis
    ? `\n\nGemini Market Analysis:\n${geminiAnalysis}`
    : "";

  const prompt = `You are GeoVera's brand intelligence analyst. Perform a comprehensive 30-day research synthesis for ${brandName(brand)}.

Brand Profile:
- Name: ${brandName(brand)}
- Industry: ${brandIndustry(brand)}
- Country: ${brandCountry(brand)}
- Website: ${brandWebsite(brand)}
- Subscription Tier: ${tier}

Research Stats:
- Perplexity queries run: ${queryResults.length}
- Brand mentioned in AI results: ${mentions}/${queryResults.length} (${mentionPct}%)
${geminiContext}

Perplexity Research Findings:
${questionSummary}
${scrapeContext}
${apifyContext}
${serpContext}

---

PART 1 — STRATEGIC SYNTHESIS

Write a comprehensive strategic synthesis covering (under 1200 words):

## 1. AI Visibility Assessment
- Current visibility score (0-100) with reasoning
- Which AI platforms mention the brand and in what context
- Key gaps in AI citation coverage vs top competitors

## 2. SEO Intelligence
- Current SERP performance for key terms (based on SerpAPI data)
- Top 3 competitors dominating organic results
- Specific content gaps and ranking opportunities

## 3. GEO / AI Optimization (Generative Engine Optimization)
- 5 specific article/FAQ topics that would most improve AI citation chances
- Recommended structured data schemas (FAQ, HowTo, Article, etc.)
- Citation-worthy claims and statistics to publish

## 4. Social Platform Intelligence
- Platform-specific content formats performing best for competitors
- Influencer + community opportunities
- Trending content types to adopt in the next 30 days

## 5. Competitive Threat Analysis
- Top 3 competitors dominating AI/search/social results
- Specific moats and advantages they have

## 6. Priority Action Plan (next 30 days)
1. [Highest ROI action]
2. [Second priority]
3. [Third priority]
4. [Quick win — can do this week]
5. [Foundation building action]

## 7. Tracking Metrics
- 5 key queries to re-run in 30 days to track progress
- Specific targets and benchmarks

---

PART 2 — SUGGESTED TOPICS & PROMPTS FOR NEXT 30 DAYS

Based on the research findings above, generate ${counts.total} specific suggested research topics, article prompts, and strategic questions for ${brandName(brand)} to address over the next 30 days.

These should be:
- Specific, actionable, and directly relevant to the research findings
- Mix of content creation topics, SEO opportunities, GEO citation opportunities, and social media ideas
- Based on real gaps, competitor strengths, and market opportunities identified in the research

Output ONLY a JSON block at the very end of your response, starting exactly with the line "###JSON###":

###JSON###
{"seo":["topic1","topic2",...],"geo":["topic1","topic2",...],"social":["topic1","topic2",...]}

Distribution:
- SEO topics: ${counts.seo} (article ideas, keyword angles, content to outrank competitors)
- GEO topics: ${counts.geo} (FAQ content, citation claims, AI-optimized topics, schema opportunities)
- Social Platform topics: ${counts.social} (content formats, trending angles, platform-specific ideas)

Reference real competitor domains and brand names from the research data.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages:   [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude synthesis error: ${err}`);
  }

  const data     = await res.json();
  const fullText: string = data.content?.[0]?.text ?? "";

  // Split synthesis from the JSON block
  const jsonMarker = "###JSON###";
  const markerIdx  = fullText.indexOf(jsonMarker);

  let synthesis        = fullText.trim();
  let suggested_topics: SuggestedTopics = { seo: [], geo: [], social: [] };

  if (markerIdx !== -1) {
    synthesis        = fullText.slice(0, markerIdx).trim();
    const jsonStr    = fullText.slice(markerIdx + jsonMarker.length).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      suggested_topics = {
        seo:    Array.isArray(parsed.seo)    ? (parsed.seo    as string[]) : [],
        geo:    Array.isArray(parsed.geo)    ? (parsed.geo    as string[]) : [],
        social: Array.isArray(parsed.social) ? (parsed.social as string[]) : [],
      };
    } catch (e) {
      console.warn("[PR] Failed to parse suggested topics JSON:", e);
    }
  }

  const totalTopics = suggested_topics.seo.length + suggested_topics.geo.length + suggested_topics.social.length;
  console.log(`[PR] Claude Sonnet done — ${totalTopics} suggested topics (SEO:${suggested_topics.seo.length} GEO:${suggested_topics.geo.length} Social:${suggested_topics.social.length})`);

  return { synthesis, suggested_topics };
}

// ─── Save suggested topics to gv_keywords ────────────────────────────────────

async function saveSuggestedTopics(
  supabase: ReturnType<typeof createClient>,
  brand_id: string,
  topics: SuggestedTopics
): Promise<void> {
  const totalCount = topics.seo.length + topics.geo.length + topics.social.length;
  if (totalCount === 0) return;

  // Replace old research_suggested topics for this brand
  const { error: deleteError } = await supabase
    .from("gv_keywords")
    .delete()
    .eq("brand_id", brand_id)
    .eq("source", "research_suggested");

  if (deleteError) console.warn("[PR] Could not clear old suggested topics:", deleteError.message);

  const toInsert = [
    ...topics.seo.map(keyword => ({
      brand_id,
      keyword,
      keyword_type: "seo",
      source:       "research_suggested",
      active:       true,
    })),
    ...topics.geo.map(keyword => ({
      brand_id,
      keyword,
      keyword_type: "geo",
      source:       "research_suggested",
      active:       true,
    })),
    ...topics.social.map(keyword => ({
      brand_id,
      keyword,
      keyword_type: "social",
      source:       "research_suggested",
      active:       true,
    })),
  ];

  const { error: insertError } = await supabase
    .from("gv_keywords")
    .insert(toInsert);

  if (insertError) console.error("[PR] Failed to save suggested topics:", insertError.message);
  else console.log(`[PR] Saved ${toInsert.length} suggested topics to gv_keywords`);
}

// ─── Extract citation URLs from results ──────────────────────────────────────

function extractCitationUrls(results: QueryResult[]): string[] {
  const urls: string[] = [];
  for (const r of results) {
    for (const c of r.citations) {
      if (c.url && c.url.startsWith("http") && !urls.includes(c.url)) {
        urls.push(c.url);
      }
    }
  }
  return urls;
}

// ─── Aggregate analytics ──────────────────────────────────────────────────────

function buildAggregates(results: QueryResult[], brandNameStr: string) {
  const nameLower = brandNameStr.toLowerCase();

  for (const r of results) {
    const textLower = r.answer.toLowerCase();
    r.brand_mentioned = textLower.includes(nameLower);

    if (r.brand_mentioned) {
      const lines = r.answer.split(/\n|[0-9]+\./);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(nameLower)) {
          r.brand_position = i + 1;
          break;
        }
      }
      // Simple sentiment
      const positiveWords = ["best", "top", "recommended", "excellent", "popular", "terbaik", "bagus"];
      const negativeWords = ["avoid", "worst", "bad", "ineffective", "buruk", "jelek"];
      const pos = positiveWords.filter(w => textLower.includes(w)).length;
      const neg = negativeWords.filter(w => textLower.includes(w)).length;
      r.sentiment = pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
    } else {
      r.sentiment = "not_mentioned";
    }

    // Extract key insights from bullet points
    const bullets = r.answer.match(/(?:•|-|\*|[0-9]+\.)\s*([^\n]+)/g);
    if (bullets) {
      r.key_insights = bullets.slice(0, 3).map(b => b.replace(/^(?:•|-|\*|[0-9]+\.)\s*/, "").trim());
    }
  }

  const mentionCount = results.filter(r => r.brand_mentioned).length;
  const positions    = results.filter(r => r.brand_position !== null).map(r => r.brand_position!);
  const avgPos       = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

  const competitorMap: Record<string, number> = {};
  for (const r of results) {
    const domainPattern = /\b([a-z0-9-]+\.(com|co\.id|id|net|org|io))\b/gi;
    const domains = r.answer.match(domainPattern) ?? [];
    for (const d of domains) {
      if (!d.toLowerCase().includes(nameLower)) {
        competitorMap[d] = (competitorMap[d] ?? 0) + 1;
      }
    }
  }
  const topCompetitors = Object.entries(competitorMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, mentions: count }));

  return {
    mention_count:  mentionCount,
    mention_rate:   results.length > 0 ? mentionCount / results.length : 0,
    avg_position:   avgPos,
    top_competitors: topCompetitors,
    sentiment_breakdown: {
      positive:      results.filter(r => r.sentiment === "positive").length,
      neutral:       results.filter(r => r.sentiment === "neutral").length,
      negative:      results.filter(r => r.sentiment === "negative").length,
      not_mentioned: results.filter(r => r.sentiment === "not_mentioned").length,
    },
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return jsonResp({ error: "Method not allowed" }, 405);

  try {
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityKey) return jsonResp({ success: false, error: "PERPLEXITY_API_KEY not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Auth ─────────────────────────────────────────────────────────────────
    const isServiceCall = req.headers.get("X-Service-Call") === "true";
    if (!isServiceCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return jsonResp({ success: false, error: "Missing Authorization header" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return jsonResp({ success: false, error: "Unauthorized" }, 401);
    }

    const { brand_id, research_type, focus_channel = "all", force_refresh = false }: ResearchRequest =
      await req.json();

    if (!brand_id) return jsonResp({ success: false, error: "brand_id is required" }, 400);

    console.log(`[PR] ${research_type} research — brand=${brand_id} focus=${focus_channel}`);

    // ── Brand data ────────────────────────────────────────────────────────────
    const { data: brand, error: brandError } = await supabase
      .from("gv_brands")
      .select("*")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) return jsonResp({ error: "Brand not found" }, 404);

    const tier = (brand as BrandData).subscription_tier ?? "basic";

    // ══════════════════════════════════════════════════════════════════════════
    // 30-day cache guard — Level 2 deep research only
    // ══════════════════════════════════════════════════════════════════════════
    if (research_type === "deep" && !force_refresh) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString().split("T")[0];

      const { data: cachedRecord } = await supabase
        .from("gv_ai_articles")
        .select("id, created_at, article_date")
        .eq("brand_id", brand_id)
        .eq("article_type", "deep_research")
        .gte("article_date", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedRecord) {
        console.log(`[PR] 30-day cache hit — deep research already ran on ${cachedRecord.article_date}`);
        return jsonResp({
          success:       true,
          brand_id,
          research_type,
          cached:        true,
          cache_message: "Deep research already completed within the last 30 days. Use force_refresh=true to override.",
          last_run:      cachedRecord.created_at,
          last_date:     cachedRecord.article_date,
        });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 1: Perplexity — concurrent batched queries
    // ══════════════════════════════════════════════════════════════════════════
    const questions = buildResearchQuestions(brand as BrandData, focus_channel, research_type);
    const model     = "sonar"; // both levels use sonar; deep gets 30 questions vs 15
    console.log(`[PR] Step 1: Perplexity — ${questions.length} queries (model: ${model})`);

    const queryResults = await runPerplexityBatch(questions, perplexityKey, model);
    console.log(`[PR] Perplexity done — ${queryResults.length}/${questions.length} successful`);

    // Build aggregates + enrich results
    const aggregates = buildAggregates(queryResults, brandName(brand as BrandData));

    // Collect citation URLs for Firecrawl
    const citationUrls    = extractCitationUrls(queryResults);
    const maxFirecrawlPages = research_type === "deep" ? 6 : 3;

    // Summary for Gemini context
    const researchSummary = queryResults
      .slice(0, 8)
      .map(r => `Q: ${r.question}\n${r.answer.slice(0, 300)}`)
      .join("\n\n");

    // ══════════════════════════════════════════════════════════════════════════
    // Steps 2 + 3: Gemini analysis + Firecrawl (parallel)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("[PR] Step 2+3: Gemini + Firecrawl (parallel)...");
    const [geminiAnalysis, scrapeResults] = await Promise.all([
      runGeminiAnalysis(brand as BrandData, researchSummary, research_type),
      scrapeCitationSources(citationUrls, maxFirecrawlPages),
    ]);
    console.log(`[PR] Gemini: ${geminiAnalysis ? "✓" : "✗"} | Firecrawl: ${scrapeResults.length} pages`);

    // ══════════════════════════════════════════════════════════════════════════
    // Steps 4 + 4b: Apify + SerpAPI (deep only, parallel)
    // ══════════════════════════════════════════════════════════════════════════
    let apifyResults:   ApifyResult[]   = [];
    let serpApiResults: SerpApiResult[] = [];

    if (research_type === "deep") {
      console.log("[PR] Step 4+4b: Apify + SerpAPI (parallel, deep only)...");
      const topCompetitorDomains = aggregates.top_competitors.slice(0, 3).map(c => c.domain);
      [apifyResults, serpApiResults] = await Promise.all([
        runApifySerpScrape(brand as BrandData, topCompetitorDomains),
        runSerpApiResearch(brand as BrandData, topCompetitorDomains),
      ]);
      console.log(`[PR] Apify: ${apifyResults.length} results | SerpAPI: ${serpApiResults.length} queries done`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 5: Claude Sonnet synthesis + suggested topic generation (deep only)
    // ══════════════════════════════════════════════════════════════════════════
    let claudeSynthesis:  string | null = null;
    let suggestedTopics:  SuggestedTopics = { seo: [], geo: [], social: [] };

    if (research_type === "deep") {
      console.log("[PR] Step 5: Claude Sonnet synthesis + topic generation...");
      const synthResult = await runClaudeSynthesis(
        brand as BrandData,
        queryResults,
        geminiAnalysis,
        scrapeResults,
        apifyResults,
        serpApiResults,
        tier
      );
      claudeSynthesis = synthResult.synthesis;
      suggestedTopics = synthResult.suggested_topics;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 6: Save suggested topics to gv_keywords (deep only)
    // ══════════════════════════════════════════════════════════════════════════
    if (research_type === "deep") {
      console.log("[PR] Step 6: Saving suggested topics to gv_keywords...");
      await saveSuggestedTopics(supabase, brand_id, suggestedTopics);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Step 7: Save with smart hash (delta cache — skip if unchanged)
    // ══════════════════════════════════════════════════════════════════════════
    const resultHash = await smartHash(
      `${brand_id}:${research_type}:${aggregates.mention_count}:${aggregates.top_competitors.slice(0, 3).map(c => c.domain).join(",")}`
    );

    // Check if result hash already exists (unchanged data = skip insert)
    const { data: existingRecord } = await supabase
      .from("gv_ai_articles")
      .select("id")
      .eq("brand_id", brand_id)
      .eq("article_type", `${research_type}_research`)
      .contains("content_markdown", resultHash)
      .maybeSingle();

    if (existingRecord && !force_refresh) {
      console.log("[PR] Delta cache hit — data unchanged, skipping save");
    } else {
      const sourcesUsed = [
        "perplexity",
        geminiAnalysis                                          ? "gemini"   : null,
        scrapeResults.length > 0                               ? "firecrawl" : null,
        apifyResults.length > 0                                ? "apify"     : null,
        serpApiResults.length > 0                              ? "serpapi"   : null,
        claudeSynthesis                                        ? "claude"    : null,
      ].filter(Boolean).join("+");

      const topicCount = suggestedTopics.seo.length + suggestedTopics.geo.length + suggestedTopics.social.length;

      const contentMarkdown = [
        `# ${research_type === "deep" ? "Deep" : "Brief"} Research Report — ${new Date().toLocaleDateString()}`,
        `**Hash**: ${resultHash}`,
        `**Sources**: ${sourcesUsed}`,
        research_type === "deep" ? `**Tier**: ${tier} | **Suggested Topics Generated**: ${topicCount} (SEO:${suggestedTopics.seo.length} GEO:${suggestedTopics.geo.length} Social:${suggestedTopics.social.length})` : "",
        `\n## Brand Visibility`,
        `- Mention rate: ${aggregates.mention_count}/${queryResults.length} (${(aggregates.mention_rate * 100).toFixed(1)}%)`,
        `- Average position when mentioned: ${aggregates.avg_position ? `#${aggregates.avg_position.toFixed(1)}` : "Not ranked"}`,
        `\n## Top Competitors Found`,
        aggregates.top_competitors.slice(0, 8).map((c, i) => `${i + 1}. **${c.domain}** — ${c.mentions} mentions`).join("\n"),
        `\n## Sentiment Breakdown`,
        `- Positive: ${aggregates.sentiment_breakdown.positive}`,
        `- Neutral: ${aggregates.sentiment_breakdown.neutral}`,
        `- Negative: ${aggregates.sentiment_breakdown.negative}`,
        `- Not mentioned: ${aggregates.sentiment_breakdown.not_mentioned}`,
        geminiAnalysis   ? `\n## Gemini Analysis\n${geminiAnalysis}` : "",
        claudeSynthesis  ? `\n## Claude Sonnet Strategic Synthesis\n${claudeSynthesis}` : "",
        serpApiResults.length > 0
          ? `\n## SerpAPI SERP Results\n` +
            serpApiResults.map(r =>
              `- Query: "${r.query}" — Brand in results: ${r.brand_in_results ? `YES (#${r.brand_position})` : "NO"}`
            ).join("\n")
          : "",
        scrapeResults.length > 0
          ? `\n## Citation Sources Scraped\n${scrapeResults.map(s => `- [${s.title ?? s.url}](${s.url})`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n");

      const { error: saveError } = await supabase.from("gv_ai_articles").insert({
        brand_id,
        title:               `${research_type === "deep" ? "Deep" : "Brief"} Research — ${new Date().toLocaleDateString()}`,
        article_type:        `${research_type}_research`,
        content_markdown:    contentMarkdown,
        summary:             `Perplexity ${research_type}: ${aggregates.mention_count}/${queryResults.length} mentions. ${topicCount > 0 ? `${topicCount} suggested topics generated.` : ""}`,
        ai_provider:         sourcesUsed,
        model_used:          research_type === "deep" ? "claude-sonnet-4-20250514" : model,
        generation_cost_usd: queryResults.length * 0.005,
        published:           false,
        article_date:        new Date().toISOString().split("T")[0],
      });

      if (saveError) console.error("[PR] Save failed:", saveError.message);
      else console.log("[PR] Results saved to gv_ai_articles");
    }

    const topicCount = suggestedTopics.seo.length + suggestedTopics.geo.length + suggestedTopics.social.length;

    return jsonResp({
      success:       true,
      brand_id,
      research_type,
      focus_channel,
      level:         research_type === "deep" ? 2 : 1,
      tier,
      sources_used: [
        "perplexity",
        geminiAnalysis          ? "gemini"    : null,
        scrapeResults.length > 0 ? "firecrawl" : null,
        apifyResults.length > 0  ? "apify"     : null,
        serpApiResults.length > 0 ? "serpapi"   : null,
        claudeSynthesis         ? "claude"    : null,
      ].filter(Boolean),
      stats: {
        queries_processed:       queryResults.length,
        brand_mentions:          aggregates.mention_count,
        mention_rate_pct:        parseFloat((aggregates.mention_rate * 100).toFixed(1)),
        avg_position:            aggregates.avg_position ? parseFloat(aggregates.avg_position.toFixed(1)) : null,
        citation_sources_scraped: scrapeResults.length,
        apify_serp_results:      apifyResults.length,
        serpapi_queries:         serpApiResults.length,
        top_competitors:         aggregates.top_competitors.slice(0, 5),
        sentiment:               aggregates.sentiment_breakdown,
      },
      has_gemini_analysis:   !!geminiAnalysis,
      has_claude_synthesis:  !!claudeSynthesis,
      suggested_topics_count: topicCount > 0 ? {
        total:  topicCount,
        seo:    suggestedTopics.seo.length,
        geo:    suggestedTopics.geo.length,
        social: suggestedTopics.social.length,
      } : null,
      cost_usd: parseFloat((queryResults.length * 0.005).toFixed(2)),
    });

  } catch (error) {
    console.error("[PR] Error:", error);
    return jsonResp({
      success: false,
      error:   (error as Error).message,
    }, 500);
  }
});
