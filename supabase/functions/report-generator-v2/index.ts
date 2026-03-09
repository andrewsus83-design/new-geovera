import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Step1Output {
  brand_name: string;
  parent_company: string;
  official_website: string;
  social_media: {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
    youtube?: string;
  };
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

interface Step3Output {
  brand_dna: {
    core_values: string[];
    personality_traits: string[];
    brand_voice: string;
    visual_identity: string;
  };
  competitive_analysis: {
    market_position: string;
    competitive_advantages: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  content_strategy: {
    key_themes: string[];
    content_pillars: string[];
    messaging_framework: string;
  };
  strategic_framework: {
    short_term_priorities: string[];
    long_term_vision: string;
    success_metrics: string[];
  };
}

// ─── Step 2a/2b: Firecrawl + Gemini enrichment types ─────────────────────────

interface FirecrawlResult {
  url: string;
  markdown: string;
  title: string | null;
  description: string | null;
}

interface FirecrawlContext {
  results: FirecrawlResult[];
  combinedMarkdown: string;
  urlsScraped: string[];
  urlsFailed: string[];
}

interface GeminiEnrichedSummary {
  brand_overview: string;
  key_claims: string[];
  product_details: string;
  visual_identity_signals: string;
  consumer_sentiment: string;
  competitive_signals: string;
  credibility_indicators: string[];
  content_gaps: string[];
  raw_enriched_text: string;
}

// Parse up to 3 scrapeable URLs from Step 0 Perplexity output
function parseUrlsFromPerplexityOutput(
  perplexityText: string,
  step1Data: Step1Output
): string[] {
  const urls: Set<string> = new Set();
  const SKIP_DOMAINS = ["instagram.com","tiktok.com","facebook.com","twitter.com","x.com","youtube.com"];

  // 1. Brand website from Step 1 (highest confidence)
  if (step1Data.official_website && step1Data.official_website !== "Not Found") {
    try { new URL(step1Data.official_website); urls.add(step1Data.official_website); } catch { /* skip */ }
  }

  // 2. Backlinks in Step 0 output — "1. [Title] - [Source] - [URL]"
  const backlinkPattern = /\d+\.\s+.+?-\s+.+?-\s+(https?:\/\/[^\s\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = backlinkPattern.exec(perplexityText)) !== null) {
    try { new URL(m[1]); urls.add(m[1]); } catch { /* skip */ }
  }

  // 3. Bare https:// URLs in the text (fallback)
  const bareUrlPattern = /https?:\/\/[^\s\n\]"')>]+/g;
  while ((m = bareUrlPattern.exec(perplexityText)) !== null) {
    const cleaned = m[0].replace(/[.,;:!?]+$/, "");
    try {
      const parsed = new URL(cleaned);
      if (!SKIP_DOMAINS.includes(parsed.hostname.replace("www.", ""))) {
        urls.add(cleaned);
      }
    } catch { /* skip */ }
  }

  // Prioritise brand website first, then others
  const ordered = Array.from(urls);
  const website = ordered.find(u => step1Data.official_website && u.startsWith(step1Data.official_website.replace(/\/$/, "")));
  const rest = ordered.filter(u => u !== website);
  return [website, ...rest].filter(Boolean).slice(0, 3) as string[];
}

// Step 2a: Firecrawl — scrape up to 3 URLs in parallel (15s timeout each)
async function step2_firecrawl_scrape(urls: string[]): Promise<FirecrawlContext> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const FIRECRAWL_BASE    = "https://api.firecrawl.dev/v1";

  if (!FIRECRAWL_API_KEY || urls.length === 0) {
    console.log("[step2a_firecrawl] Skipping — no API key or no URLs");
    return { results: [], combinedMarkdown: "", urlsScraped: [], urlsFailed: [] };
  }

  console.log(`[step2a_firecrawl] Scraping ${urls.length} URL(s): ${urls.join(", ")}`);

  const scrapeOne = async (url: string): Promise<FirecrawlResult> => {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 12000 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Firecrawl HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(`Firecrawl error: ${data.error || JSON.stringify(data)}`);

    return {
      url,
      markdown:    (data.data?.markdown || "").slice(0, 8000),
      title:       data.data?.metadata?.title       || null,
      description: data.data?.metadata?.description || null,
    };
  };

  const settled = await Promise.allSettled(urls.map(u => scrapeOne(u)));
  const results: FirecrawlResult[] = [];
  const urlsScraped: string[] = [];
  const urlsFailed:  string[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
      urlsScraped.push(urls[i]);
      console.log(`[step2a_firecrawl] OK: ${urls[i]} (${outcome.value.markdown.length} chars)`);
    } else {
      urlsFailed.push(urls[i]);
      console.warn(`[step2a_firecrawl] FAILED: ${urls[i]} — ${(outcome as PromiseRejectedResult).reason?.message}`);
    }
  }

  const combinedMarkdown = results
    .map(r => `## SOURCE: ${r.url}\n${r.title ? `Title: ${r.title}\n` : ""}${r.markdown}`)
    .join("\n\n---\n\n");

  return { results, combinedMarkdown, urlsScraped, urlsFailed };
}

// Step 2b: Gemini — index combined Perplexity + Firecrawl into structured summary
async function step2b_gemini_index(
  brandName: string,
  country: string,
  perplexityResearch: string,
  firecrawlContext: FirecrawlContext
): Promise<GeminiEnrichedSummary> {
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

  if (!GOOGLE_AI_API_KEY || firecrawlContext.results.length === 0) {
    console.log("[step2b_gemini] Skipping enrichment — no API key or no Firecrawl data");
    return {
      brand_overview: "", key_claims: [], product_details: "",
      visual_identity_signals: "", consumer_sentiment: "", competitive_signals: "",
      credibility_indicators: [], content_gaps: [], raw_enriched_text: perplexityResearch,
    };
  }

  const prompt = `You are a brand intelligence indexer. Synthesize two data sources for ${brandName} (${country}) into a structured JSON summary.

=== SOURCE 1: PERPLEXITY SURFACE RESEARCH ===
${perplexityResearch.slice(0, 4000)}

=== SOURCE 2: FIRECRAWL WEB SCRAPE (${firecrawlContext.urlsScraped.length} pages) ===
${firecrawlContext.combinedMarkdown.slice(0, 6000)}

Return ONLY valid JSON:
{
  "brand_overview": "<2-3 sentence synthesized overview>",
  "key_claims": ["<verified claim from scraped content>"],
  "product_details": "<specific product names, SKUs, pricing tiers, packaging details>",
  "visual_identity_signals": "<colors, fonts, imagery style, logo description>",
  "consumer_sentiment": "<aggregated sentiment from reviews, testimonials, social mentions>",
  "competitive_signals": "<competitors mentioned, positioning vs competitors>",
  "credibility_indicators": ["<cert/award/trust signal>"],
  "content_gaps": ["<topic the brand website lacks that competitors likely cover>"],
  "raw_enriched_text": "<300-word narrative combining the best insights from both sources>"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);

    const data   = await res.json();
    const raw    = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("Empty Gemini response");

    const parsed: GeminiEnrichedSummary = JSON.parse(raw);
    console.log(`[step2b_gemini] Indexed ${firecrawlContext.urlsScraped.length} pages into enriched summary`);
    return parsed;

  } catch (err) {
    console.warn(`[step2b_gemini] Error: ${(err as Error).message} — falling back to raw Perplexity text`);
    return {
      brand_overview: "", key_claims: [], product_details: "",
      visual_identity_signals: "", consumer_sentiment: "", competitive_signals: "",
      credibility_indicators: [], content_gaps: [], raw_enriched_text: perplexityResearch,
    };
  }
}

// NEW STEP 0: Perplexity Deep Research FIRST
async function step0_perplexity_discovery(brandName: string, country: string): Promise<string> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!;

  const countryContext = `The brand is from ${country}. Focus ONLY on ${brandName} ${country}, NOT brands from other countries.`;

  const prompt = `CRITICAL DISCOVERY TASK: ${brandName} (${country})

${countryContext}

You MUST find and verify these CRITICAL FIELDS:

**1. COMPANY IDENTITY** (3 fields):
   a) Parent Company/Manufacturer: Who makes/owns this brand?
   b) Official Website: Brand or parent company website
   c) Launch Year: When was this brand launched? (Year only)

**2. SOCIAL MEDIA ACCOUNTS** (find all available):
   a) Instagram: Official handle (e.g., @brand_official)
   b) Facebook: Official page URL or name
   c) TikTok: Official account (if exists)
   d) YouTube: Official channel (if exists)

**3. PRODUCT DETAILS** (2 fields):
   a) Product Category: Main category (Snacks, Beverages, etc.)
   b) Product Type: Specific product type

**4. HIGH-QUALITY BACKLINKS** (up to 5 authoritative sources):
   Find articles from reputable media, industry publications, press releases:
   - News sites (Kompas, Detik, CNN Indonesia, etc.)
   - Business/trade publications
   - Official company press releases
   Format: [Title] - [Source] - [URL]

**5. AUTHORITY & TRUST SIGNALS**:
   a) Google Business Profile: Find GBP listing
   b) User Reviews/Testimonials from:
      • Google Reviews (rating + sample quote)
      • E-commerce (Tokopedia, Shopee, Lazada - rating + quote)
      • Social media testimonials
   c) Trust Indicators:
      • Certifications (BPOM, Halal, ISO)
      • Awards/recognition
      • Years in business

SEARCH QUERIES TO USE:
- "${brandName} ${country} produsen"
- "${brandName} parent company"
- "${brandName} review testimoni"
- "${brandName} Google Business Profile"
- "${brandName} berita artikel"
- "${brandName} certification BPOM halal"

OUTPUT FORMAT:
=== COMPANY IDENTITY ===
Parent Company: [Name] OR "Not Found"
Website: [URL] OR "Not Found"
Launch Year: [YYYY] OR "Not Found"

=== SOCIAL MEDIA ===
Instagram: [@handle] OR "Not Found"
Facebook: [URL] OR "Not Found"
TikTok: [@handle] OR "Not Found"
YouTube: [Channel] OR "Not Found"

=== PRODUCT ===
Category: [Category]
Type: [Specific Type]

=== BACKLINKS (Authoritative Sources) ===
1. [Title] - [Source] - [URL]
2. [Title] - [Source] - [URL]
(list up to 5)

=== AUTHORITY & TRUST ===
Google Business: [URL or name] OR "Not Found"
Reviews:
  • Google: [X.X] stars ([N] reviews) - "[sample quote]"
  • E-commerce: [Platform] [X.X] stars - "[quote]"
  • Social: "[testimonial]"
Certifications: [list or "Not Found"]
Awards: [if any or "None"]
Established: [years, e.g., "Since 1980"]

ONLY include verified facts. Mark "Not Found" if unavailable.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a professional brand researcher specializing in discovering and verifying official brand information. Provide accurate, source-backed data.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Lower temperature for factual accuracy
      max_tokens: 3000 // Increased for comprehensive discovery
    })
  });

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error('Perplexity API error response:', JSON.stringify(data));
    throw new Error(`Perplexity API error: ${JSON.stringify(data.error || data)}`);
  }

  return data.choices[0].message.content;
}

async function step1_gemini(brandName: string, country: string, perplexityDiscovery?: string): Promise<Step1Output> {
  const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')!;

  const countryContext = `CRITICAL CONTEXT: ${brandName} is a ${country} brand. ONLY search for information about ${brandName} ${country}, NOT any brands from other countries. Use ${country} language sources (Indonesian/Bahasa Indonesia if Indonesia), ${country} market data, and ${country} business news. Ignore any ${brandName} brands from USA, Canada, or other countries.`;

  const verifiedDataContext = perplexityDiscovery ? `\n\nVERIFIED DATA FROM PERPLEXITY RESEARCH:\n${perplexityDiscovery}\n\nUse this verified data as the foundation for indexing. DO NOT contradict this research.` : '';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Brand Indexing Request for: ${brandName}${country ? ` ${country}` : ''}

${countryContext}${verifiedDataContext}

Task: Perform comprehensive brand indexing to gather:
1. Official website and web presence (social media profiles, official channels)
2. Company ownership and parent company information
3. Launch date and market entry timeline
4. Product category and sub-category
5. Key product features and unique selling propositions
6. Target demographic and market positioning
7. Primary competitors in the same category
8. Geographic market presence
9. Recent news, announcements, or campaigns
10. Brand tagline, mission statement if available

Provide structured data output in JSON format with these exact fields:
{
  "brand_name": "${brandName}",
  "parent_company": "string",
  "official_website": "string",
  "social_media": {"instagram": "string", "tiktok": "string", "facebook": "string", "youtube": "string"},
  "launch_date": "string",
  "category": "string",
  "sub_category": "string",
  "key_features": ["string"],
  "target_demographic": "string",
  "market_positioning": "string",
  "competitors": ["string"],
  "geographic_presence": ["string"],
  "recent_news": ["string"],
  "tagline": "string",
  "unique_selling_proposition": "string"
}

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no explanations.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      })
    }
  );

  const data = await response.json();

  // Check for errors in response
  if (!data.candidates || !data.candidates[0]) {
    console.error('Gemini API error response:', JSON.stringify(data));
    throw new Error(`Gemini API error: ${JSON.stringify(data.error || data)}`);
  }

  const text = data.candidates[0].content.parts[0].text;

  // Clean up markdown code blocks if present
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonText);
}

async function step2_perplexity(
  brandName: string,
  geminiData: Step1Output,
  firecrawlContext?: FirecrawlContext
): Promise<string> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')!;

  // Inject Firecrawl scraped content to enrich Perplexity's search context
  const firecrawlEnrichment = (firecrawlContext && firecrawlContext.results.length > 0)
    ? `\n\nADDITIONAL CONTEXT FROM SCRAPED BRAND PAGES (${firecrawlContext.urlsScraped.length} URLs scraped):\n${firecrawlContext.combinedMarkdown.slice(0, 3000)}\n\nUse the above first-hand scraped content to enrich your research with accurate data from the brand's own website. Cross-reference with your live search findings.`
    : "";

  const prompt = `Conduct comprehensive deep research on ${brandName} brand. Use the following indexed data as starting point:

${JSON.stringify(geminiData, null, 2)}${firecrawlEnrichment}

Perform deep research covering:

**CRITICAL: VISUAL BRAND IDENTITY ANALYSIS** (For DALL-E image generation):
1. **Brand Colors**:
   - Primary colors (with hex codes if available from logo/packaging/website)
   - Secondary colors
   - Color psychology and meaning
   - Example: "Primary: Orange #FF8C42 (warmth, nostalgia), Secondary: Cream #FFF5E1 (tradition)"

2. **Design Style & Aesthetic**:
   - Visual language: Traditional/Modern/Minimalist/Playful/Premium/Rustic
   - Design elements: Typography style, shapes, patterns used
   - Photography style in marketing: Documentary/Lifestyle/Commercial/Artistic
   - Overall vibe: Heritage/Contemporary/Luxury/Accessible
   - Example: "Traditional heritage aesthetic with warm nostalgic tones, vintage typography, rustic wood textures"

3. **Logo & Packaging Analysis** (Check website metadata & social profiles):
   - Analyze website meta tags, Open Graph images, favicons
   - Logo design elements from profile pictures (shapes, symbols, illustrations)
   - Packaging style from product photos and ads
   - Visual consistency across website, social media, ads
   - Brand guidelines if publicly available
   - Color scheme from website header/footer
   - Typography choices from website and ads
   - Example: "Logo features grandmother illustration in orange, package uses kraft paper with traditional batik patterns, website uses Orange #FF8C42 primary color throughout, Georgia serif font for headlines"

4. **Brand Photography Style** (Analyze actual social media PAID ADS):
   - **PRIORITY**: Find and analyze PAID ADS/SPONSORED posts on Instagram/Facebook/TikTok
   - Ads have "Sponsored" or "Paid partnership" labels - these have BEST professional graphics
   - Visit ${geminiData.social_media?.instagram || 'brand Instagram'} and identify ad posts
   - Extract visual patterns from ADS: subjects, angles, compositions
   - Lighting style in ads (natural/studio/warm/bright/golden hour)
   - Filter or editing style in ads (vintage/modern/saturated/muted)
   - Professional backgrounds and settings in ads
   - Props and styling elements in ads
   - Cultural elements in ads
   - Color grading and post-processing style
   - Photography quality (always professional in ads)
   - Example: "Paid ads show: Warm golden hour lighting with slight vintage Instagram filter, Indonesian family of 4 in modern kitchen, product prominently displayed at eye level, traditional wooden table with batik table runner, shot from 45-degree angle, professional food styling with fresh ingredients visible, consistent orange #FF8C42 color grading"

5. **Visual Mood & Atmosphere**:
   - Emotional tone of visuals
   - Settings and environments typically shown
   - Props and styling elements
   - Example: "Nostalgic family warmth, traditional Indonesian home settings, vintage kitchenware props"

6. **Brand Tone & Voice Analysis** (For NLP & content matching):
   - **CRITICAL**: Analyze website copy, social media captions, ad copy, and brand communications
   - Identify communication tone: Formal/Casual, Professional/Playful, Traditional/Modern, Authoritative/Friendly
   - Extract vocabulary patterns: Technical jargon, local slang, industry terms, cultural phrases
   - Sentence structure preferences: Short punchy vs long flowing, active vs passive voice, simple vs complex
   - Emotional appeals used: Nostalgia, aspiration, trust, innovation, tradition, family, heritage
   - Value messaging themes: Quality, affordability, authenticity, innovation, sustainability, community
   - Target audience communication style: How they speak to customers (empathetic/direct/inspirational)
   - Language sophistication level: Elementary/Conversational/Professional/Academic
   - Brand personality traits: Warm/Cold, Serious/Humorous, Conservative/Bold, Expert/Peer
   - Example: "Tone: Warm, nostalgic, family-oriented. Uses casual Indonesian ('kita bersama', 'keluarga kita'), short punchy sentences (avg 12 words), active voice dominates (85%), focuses on tradition and authenticity values, emotional appeals to family bonding and heritage, speaks as a peer/friend not expert, conversational sophistication level, personality: warm grandmother figure telling stories"

**STANDARD RESEARCH**:
8. **Competitive Landscape**: Detailed competitor analysis, market share, positioning strategies
9. **Brand History**: Complete timeline, key milestones, evolution, pivots
10. **Product Innovation**: R&D efforts, technology, patents, unique processes
11. **Marketing Strategy**: Campaign analysis, influencer partnerships, media presence
12. **Consumer Perception**: Reviews, sentiment analysis, brand reputation
13. **Distribution Channels**: Retail presence, e-commerce, partnerships
14. **Financial Performance**: Revenue estimates, growth trajectory, funding (if available)
15. **Crisis Management**: Past controversies, responses, reputation risks
16. **Future Outlook**: Industry trends, growth opportunities, emerging threats

**CONSUMER VOICE MINING** (Critical for article writing):
7. **Real Consumer Language**:
   - Find actual QUOTES from Indonesian consumers about this brand (Google reviews, Tokopedia/Shopee reviews, Twitter/X mentions, Reddit, forums, YouTube comments)
   - Identify the EXACT phrases and slang consumers use: what words/emotions do they use when describing this brand?
   - Find what consumers LOVE most (top recurring positive themes)
   - Find what consumers CRITICIZE (top complaints or unmet needs)
   - Identify cultural moments, occasions, or contexts where this brand is most relevant
   - Example: "Consumers say: 'Rasanya kayak masakan nenek dulu' (tastes like grandma's cooking), 'Harganya worth it banget', 'Beli di Alfamart ada promo lagi', 'Packaging cute buat gift'. Key love: nostalgia. Key complaint: limited flavors."

**OUTPUT FORMAT**:
Start with a dedicated "VISUAL BRAND IDENTITY" section with specific details about colors (hex codes), design style, photography style, visual mood, brand tone/voice, AND real consumer language/quotes. Then continue with standard market research.

Provide comprehensive research with specific data points, real consumer quotes, and DETAILED visual identity analysis. This data will be used for both DALL-E image generation AND writing authentic brand articles.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a professional brand research analyst. Provide comprehensive, data-driven research reports with specific insights and statistics.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  });

  const data = await response.json();

  // Check for errors in response
  if (!data.choices || !data.choices[0]) {
    console.error('Perplexity API error response:', JSON.stringify(data));
    throw new Error(`Perplexity API error: ${JSON.stringify(data.error || data)}`);
  }

  return data.choices[0].message.content;
}

async function step3_claude(
  brandName: string,
  perplexityResearch: string,
  enrichedSummary?: GeminiEnrichedSummary
): Promise<Step3Output> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

  // Inject Gemini-indexed enrichment when available
  const enrichmentBlock = (enrichedSummary && enrichedSummary.raw_enriched_text !== perplexityResearch && enrichedSummary.brand_overview)
    ? `\n\n**ENRICHED INTELLIGENCE (Gemini-indexed from scraped brand pages)**:\nOverview: ${enrichedSummary.brand_overview}\nProduct details: ${enrichedSummary.product_details}\nVisual identity: ${enrichedSummary.visual_identity_signals}\nConsumer sentiment: ${enrichedSummary.consumer_sentiment}\nCompetitor signals: ${enrichedSummary.competitive_signals}\nCredibility: ${enrichedSummary.credibility_indicators.join(", ")}\nContent gaps: ${enrichedSummary.content_gaps.join(", ")}`
    : "";

  const prompt = `You are a strategic brand analyst using reverse engineering methodology to extract deep insights.

**Brand**: ${brandName}

**Deep Research Data**:
${perplexityResearch}${enrichmentBlock}

**Your Task**: Perform reverse engineering analysis to extract:

1. **BRAND DNA** - Core identity elements:
   - Core values (3-5 fundamental principles)
   - Personality traits (brand character)
   - Brand voice (communication style)
   - Visual identity (design language description)

2. **COMPETITIVE ANALYSIS** - Strategic positioning:
   - Current market position (where brand stands)
   - Competitive advantages (what makes them win)
   - Weaknesses (vulnerabilities)
   - Opportunities (growth potential)
   - Threats (external risks)

3. **CONTENT STRATEGY** - Communication framework:
   - Key themes (recurring topics)
   - Content pillars (3-4 main content categories)
   - Messaging framework (core message structure)

4. **STRATEGIC FRAMEWORK** - Action roadmap:
   - Short-term priorities (next 3-6 months)
   - Long-term vision (1-3 years)
   - Success metrics (KPIs to track)

**Output Format**: Provide ONLY valid JSON with this exact structure (no markdown, no explanations):
{
  "brand_dna": {
    "core_values": ["value1", "value2"],
    "personality_traits": ["trait1", "trait2"],
    "brand_voice": "description",
    "visual_identity": "description"
  },
  "competitive_analysis": {
    "market_position": "description",
    "competitive_advantages": ["advantage1", "advantage2"],
    "weaknesses": ["weakness1", "weakness2"],
    "opportunities": ["opp1", "opp2"],
    "threats": ["threat1", "threat2"]
  },
  "content_strategy": {
    "key_themes": ["theme1", "theme2"],
    "content_pillars": ["pillar1", "pillar2", "pillar3"],
    "messaging_framework": "description"
  },
  "strategic_framework": {
    "short_term_priorities": ["priority1", "priority2"],
    "long_term_vision": "description",
    "success_metrics": ["metric1", "metric2"]
  }
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  const data = await response.json();

  // Check for errors in response
  if (!data.content || !data.content[0]) {
    console.error('Claude API error response:', JSON.stringify(data));
    throw new Error(`Claude API error: ${JSON.stringify(data.error || data)}`);
  }

  const text = data.content[0].text;

  // Clean up markdown code blocks if present
  const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonText);
}

async function step4_openai(
  brandName: string,
  geminiData: Step1Output,
  perplexityResearch: string,
  claudeAnalysis: Step3Output,
  country: string
): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

  const prompt = `You are a senior editorial writer at a premium intelligence publication, creating a brand intelligence feature story.

**Brand**: ${brandName}
**Country**: ${country || 'Indonesia'}

**Research Data**:
${JSON.stringify(geminiData, null, 2)}

**Deep Research**:
${perplexityResearch}

**Strategic Analysis**:
${JSON.stringify(claudeAnalysis, null, 2)}

**LANGUAGE**:
- Write narrative/storytelling paragraphs and quotes in LOCAL LANGUAGE of ${country || 'Indonesia'} (Bahasa Indonesia if Indonesia, Thai if Thailand, etc.)
- Keep section headers, labels, tags, and data tables in ENGLISH
- This creates an authentic, locally-grounded editorial feel

**YOUR MISSION**: Write this report as a **premium editorial news feature** — like The Verge, Bloomberg, or Wired would cover a brand. Use journalistic structure: headlines, subheadlines, pull quotes, section tags, narrative storytelling, and data callouts.

**STRUCTURE** — Follow this editorial format EXACTLY:

# ${brandName}: [Write a compelling editorial headline — declarative, bold, newsworthy]

*[Write a one-line deck/subtitle that adds context to the headline]*

---

## The Brief
**TAG: OVERVIEW**

> "[Write a powerful pull quote — a key insight about ${brandName} in 1-2 sentences, in local language]"

[Write 2-3 paragraphs as an editorial lede: introduce ${brandName} like a journalist breaking a story. What is this brand, why does it matter right now, what's the narrative hook? Be specific with facts from research.]

### At a Glance

• **Founded**: [Year] | **HQ**: [Location]
• **Parent Company**: [Name]
• **Category**: [Category] → [Sub-Category]
• **Market**: [Geographic presence]
• **Tagline**: "${geminiData.tagline}"

---

## The Numbers
**TAG: PERFORMANCE**

| Metric | Score | Verdict |
|--------|-------|---------|
| Visibility | [65-85]/100 | [Strong/Growing/Weak] |
| Discovery | [55-75]/100 | [Strong/Growing/Weak] |
| Authority | [60-80]/100 | [Strong/Growing/Weak] |
| Trust | [70-90]/100 | [Strong/Growing/Weak] |

**Brand Health Score: [67]/100**

[Write 2 sentences interpreting what the score means for ${brandName}'s current position.]

---

## Origin Story
**TAG: CHRONICLE**

> "[Write a nostalgic or emotional pull quote about the brand's beginning, in local language]"

[Write 3-4 paragraphs telling the founding story as narrative journalism — who started it, why, what problem they saw. Include specific dates, names, places from research. Write this like a feature story, not a report.]

### Key Milestones

• **[Year]** — [Event and significance]
• **[Year]** — [Event and significance]
• **[Year]** — [Event and significance]
• **[Year]** — [Event and significance]
• **[Year]** — [Event and significance]

[Write 1 paragraph on where the brand is today — current momentum, recent moves.]

---

## What Makes ${brandName} Tick
**TAG: BRAND DNA**

### Core Values
${claudeAnalysis.brand_dna.core_values.map(v => `• **${v}**`).join('\n')}

### The Character
[Write 2 paragraphs describing brand personality as a journalist would profile a person — using traits: ${claudeAnalysis.brand_dna.personality_traits.join(', ')}. What does this brand "feel" like?]

> "[Write a quote that captures the brand voice — could be from founders, marketing copy, or brand manifesto, in local language]"

### Visual Identity
${claudeAnalysis.brand_dna.visual_identity}

---

## The Competition
**TAG: MARKET LANDSCAPE**

[Write 2 paragraphs as editorial analysis — like a market analyst explaining the competitive dynamics. Who are the players, what's the landscape?]

| Rank | Player | Strategy | Strength | Gap |
|------|--------|----------|----------|-----|
| #1 | [Competitor] | [What they're doing now] | [Key edge] | [Weakness] |
| #2 | [Competitor] | [Current play] | [Key edge] | [Weakness] |
| #3 | [Competitor] | [Current play] | [Key edge] | [Weakness] |
| — | **${brandName}** | [Current strategy] | [Key edge] | [Area to improve] |

### SWOT Snapshot

**Strengths**: ${claudeAnalysis.competitive_analysis.competitive_advantages.join(' · ')}

**Weaknesses**: ${claudeAnalysis.competitive_analysis.weaknesses.join(' · ')}

**Opportunities**: ${claudeAnalysis.competitive_analysis.opportunities.join(' · ')}

**Threats**: ${claudeAnalysis.competitive_analysis.threats.join(' · ')}

> "[Write a sharp analyst-style pull quote summarizing the competitive position, in local language]"

---

## Where the Market is Heading
**TAG: TRENDS & INSIGHTS**

[Write 3-4 paragraphs of editorial analysis on market trends affecting ${brandName}. What's changing in the industry? What consumer behaviors are shifting? Use data from Perplexity research. Write this like a trends column.]

### Content Pillars
${claudeAnalysis.content_strategy.content_pillars.map(p => `• **${p}**`).join('\n')}

### Strategic Priorities

**Near-term (3-6 months)**:
${claudeAnalysis.strategic_framework.short_term_priorities.map(p => `→ ${p}`).join('\n')}

**Long game**: ${claudeAnalysis.strategic_framework.long_term_vision}

---

## Red Flags
**TAG: ALERTS**

[Write 1 paragraph editorial intro — what should ${brandName} watch out for in the digital landscape?]

### Alert: [Digital Risk Name]
• **Level**: HIGH / MEDIUM / LOW
• **Area**: Visibility / Discovery / Authority / Trust
• **What's happening**: [Describe the issue]
• **Why it matters**: [Impact on brand]
• **Fix**: [Actionable mitigation]

[Repeat for 2-3 more digital alerts. Focus ONLY on digital reputation/visibility issues — not supply chain or operations.]

---

## Five Big Opportunities
**TAG: GROWTH**

> "[Write an ambitious pull quote about the brand's potential, in local language]"

### 1. [Opportunity Name]
[Write 2-3 sentences about this opportunity — what it is, why now, estimated impact]

### 2. [Opportunity Name]
[2-3 sentences]

### 3. [Opportunity Name]
[2-3 sentences]

### 4. [Opportunity Name]
[2-3 sentences]

### 5. [Opportunity Name]
[2-3 sentences]

---

## The Playbook
**TAG: RECOMMENDATIONS**

[Write 1 paragraph editorial intro — what should ${brandName} do next?]

### Immediate (30 Days)
→ [Action with expected outcome]
→ [Action with expected outcome]
→ [Action with expected outcome]

### Strategic (90 Days)
→ [Initiative with rationale]
→ [Initiative with rationale]
→ [Initiative with rationale]

### Metrics to Watch
${claudeAnalysis.strategic_framework.success_metrics.map(m => `• ${m}`).join('\n')}

---

## Search & Discovery Strategy
**TAG: VISIBILITY**

[Write 1 paragraph editorial intro: explain that in 2025, brand discovery happens across three layers — AI engines, traditional search, and social platforms — and ${brandName} needs to win all three.]

### AI Search (GEO) — Generative Engine Optimization

**What is GEO?** AI tools like ChatGPT, Perplexity, Google SGE, and Claude now answer questions directly. When someone asks "What is the best [category] in ${country}?", the AI gives one answer. GEO is about ensuring ${brandName} is that answer.

**Why it matters**: [Write 2 sentences on what happens if ${brandName} is invisible to AI engines vs. what happens if it's the #1 recommended brand.]

**The queries ${brandName} must own right now**:
→ "[Specific AI query 1 relevant to ${brandName} in local language]"
→ "[Specific AI query 2 in English — comparison query]"
→ "[Specific AI query 3 — problem-based query a customer would ask]"

**What to do**: [Write 3 concrete GEO actions — e.g., publish structured FAQ pages, submit brand profile to AI training datasets, build authoritative backlinks from ${country} media.]

**Current GEO Score**: [X]/10 → **Target**: 9/10 in 90 days

---

### SEO — Search Engine Optimization

**What is SEO?** When someone searches on Google, they see 10 blue links. SEO is the work of making ${brandName}'s pages rank in the top 3 for the keywords customers actually use.

**Why it matters**: [Write 2 sentences on the traffic and trust that comes from ranking #1 vs. page 2 for ${brandName}'s category.]

**Priority keywords ${brandName} should target**:

| Keyword | Monthly Searches | Current Rank | Target | Action |
|---------|-----------------|--------------|--------|--------|
| [Primary keyword in local language] | [volume] | [est. rank or Unranked] | Top 3 | [Specific action] |
| [Secondary keyword] | [volume] | [rank] | Top 5 | [Specific action] |
| [Brand keyword] | [volume] | [rank] | #1 | [Specific action] |
| [Long-tail keyword] | [volume] | [rank] | Top 3 | [Specific action] |
| [Competitor comparison keyword] | [volume] | [rank] | Top 5 | [Specific action] |

**What to do**: [Write 3 concrete SEO actions specific to ${brandName} — e.g., create product landing pages for top keywords, build backlinks from ${country} food/lifestyle media, optimize Google Business Profile.]

---

### Social Search (SSO) — Social Search Optimization

**What is SSO?** Instagram, TikTok, and YouTube are now search engines. Gen Z and Millennials search for products directly on these platforms — "rekomendasi [category] ${country}" gets millions of views on TikTok. SSO is about owning those searches.

**Why it matters**: [Write 2 sentences on how social search drives purchase decisions for ${brandName}'s target demographic.]

**Hashtags & search terms ${brandName} must dominate**:

| Platform | Search Term | Monthly Views | Strategy |
|----------|-------------|---------------|----------|
| TikTok | #[relevant hashtag] | [volume] | [Action] |
| TikTok | [search phrase in local language] | [volume] | [Action] |
| Instagram | #[hashtag] | [posts] | [Action] |
| YouTube | "[search query]" | [monthly searches] | [Action] |

**What to do**: [Write 3 concrete SSO actions — e.g., brief 10 micro-creators to post with specific hashtags, create a TikTok search optimization strategy for top 3 queries, launch YouTube shorts targeting product review searches.]

---

## The 30-Day Sprint
**TAG: ACTION PLAN**

### Week 1: Foundation
- [ ] Set up GeoVera platform + connect social accounts
- [ ] Import brand assets and competitor tracking
- [ ] Generate first batch of 5 blog articles
- [ ] Create 20 social media posts

### Week 2: Visibility
- [ ] Submit to 6 AI platforms for GEO
- [ ] Publish 5 SEO-optimized articles
- [ ] Launch Instagram with 10 optimized posts
- [ ] Start TikTok with 3 videos

### Week 3: Community
- [ ] Contact 20 micro-influencers
- [ ] Launch UGC campaign: #${brandName.replace(/\s+/g, '')}
- [ ] Send product samples to 10 creators
- [ ] Repost and feature community content

### Week 4: Optimize
- [ ] Review analytics dashboard
- [ ] Double down on top-performing content
- [ ] Test paid social ($500 budget)
- [ ] Plan Month 2 strategy

---

## What's Next with GeoVera
**TAG: PLATFORM**

> "This report is the starting line, not the finish."

GeoVera gives ${brandName} the tools to act on every insight here:

**AI Strategic Assistant** — Ask questions, get answers from your brand data
**Insights Dashboard** — Track SSO, SEO, and GEO in real-time
**Competitor Radar** — Monitor ${geminiData.competitors.slice(0, 3).join(', ')} across 450+ sources
**Content Studio** — Generate brand-aligned content for every platform
**Smart To-Dos** — Auto-generated tasks from market movements

---

*This intelligence report was generated by GeoVera's AI pipeline: Perplexity Discovery → Gemini Indexing → Perplexity Research → Claude Analysis → GPT-4o Editorial*

---

## Content in Action
**TAG: CONTENT PREVIEW**

> "[Write a pull quote about the power of brand storytelling for ${brandName}, in local language]"

GeoVera's Content Studio generates ready-to-publish articles for ${brandName}. Here are 3 samples — short-form and editorial — written in local language.

### Short: [Write a catchy social-media headline for ${brandName}]
**Format: Social Post / Brand Story** | **≤240 characters**

[Write a punchy brand story caption of max 240 characters in local language. Read the brand's actual tone and consumer language from the Deep Research data above — mirror how their real customers TALK about this brand online (specific slang, emotional triggers, cultural references). Single flowing text, no line breaks, ends with a hashtag or CTA. Do NOT write generic marketing copy — write it the way a loyal customer would post about this brand on their personal Instagram.]

### Medium: [Write an editorial blog headline 1 for ${brandName}]
**Format: Blog Post** | **~600 kata**

[Write a 600-word blog post in local language. Use the Perplexity research data above — pull in real facts: actual product names, real prices, specific locations, real competitor names, dates, verified stats. Write from the perspective of someone who genuinely knows this brand deeply. 4-5 paragraphs, conversational but intelligent tone. Avoid generic phrases like "di era digital ini" or "semakin berkembang" — be specific and grounded. Include a subheading mid-article. End with a forward-looking sentence that feels earned, not clichéd.]

### Medium: [Write an editorial blog headline 2 for ${brandName}]
**Format: Blog Post** | **~700 kata**

[Write a 700-word blog post in local language. Take a storytelling angle — start with a scene or a specific moment, not a definition. Use real cultural context from the research: real trends, real behaviors, real tensions in the market. Write the way a sharp local journalist would — opinionated, narrative, with a human voice. 4-5 paragraphs, include one pull quote mid-article using > format. End with a clear call to action that feels personal, not corporate.]

---

## Top Creators to Watch
**TAG: CREATOR INTEL**

> "[Write a pull quote about the creator economy in ${country || 'Indonesia'}, in local language]"

[Write 1 paragraph editorial intro on the creator landscape in ${country || 'Indonesia'} relevant to ${brandName}'s category. Who is winning the content game right now?]

| Creator | Platform | Followers | Engagement | Niche | Why Relevant to ${brandName} |
|---------|----------|-----------|------------|-------|------------------------------|
| [@handle] | Instagram / TikTok / YouTube | [e.g. 1.2M] | [e.g. 4.8%] | [Niche] | [1 sentence why they matter] |
| [@handle] | [Platform] | [Followers] | [Engagement] | [Niche] | [1 sentence] |
| [@handle] | [Platform] | [Followers] | [Engagement] | [Niche] | [1 sentence] |
| [@handle] | [Platform] | [Followers] | [Engagement] | [Niche] | [1 sentence] |
| [@handle] | [Platform] | [Followers] | [Engagement] | [Niche] | [1 sentence] |
| [@handle] | [Platform] | [Followers] | [Engagement] | [Niche] | [1 sentence] |

Use verified creators from Perplexity research data. Write real handles/names. Estimate followers and engagement from research context.

**→ Track all these creators in real-time on your GeoVera dashboard**

---

**QUALITY REQUIREMENTS**:
1. Write like a journalist, not a consultant — use narrative storytelling, pull quotes, editorial analysis
2. Use ACTUAL data from research — no generic placeholders. Every claim must be traceable to something in the research data.
3. Include specific competitor names, numbers, dates, percentages
4. Every section must have a TAG label (e.g., TAG: OVERVIEW, TAG: PERFORMANCE)
5. Include 6-8 pull quotes throughout (use > "quote" format), written in local language
6. Narrative sections in LOCAL LANGUAGE (${country || 'Indonesia'})
7. Tables should be clean and minimal — no emoji in tables
8. Section headers should read like editorial headlines
9. The report should feel like reading a premium magazine feature, not a PowerPoint deck
10. DO NOT include any image markdown (![...](...)) — images are generated separately
11. Section 10 (Search & Discovery): For each channel (GEO, SEO, SSO) explain WHAT it means, WHY it matters, and give CONCRETE examples of queries/keywords/hashtags specific to ${brandName}. Not just scores — show the actual work.
12. Section 13 (Content in Action): CRITICAL — write REAL articles, not AI templates. The short post (≤240 chars) must read like a real person wrote it for their Instagram, using the brand's actual vocabulary and cultural language. The medium articles must avoid ALL clichéd AI phrases ("di era digital ini", "semakin berkembang", "tidak dapat dipungkiri") — use specific names, places, prices, stories from the research. These articles must feel like they were written by a real Indonesian journalist or brand lover, not a language model.
13. Section 14 (Top Creators): Use real creator handles found in Perplexity research. If specific handles aren't found, use the most relevant known creators in ${country || 'Indonesia'} for this category.
14. ANTI-AI LANGUAGE: Never use these phrases (they expose AI writing): "tidak dapat dipungkiri", "di era digital ini", "semakin berkembang pesat", "tak pelak", "seiring berjalannya waktu", "dalam lanskap yang terus berubah", "tentunya", "sudah tidak asing lagi". Write with specificity and attitude instead.

**OUTPUT**: Complete markdown report only. No meta-commentary.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior editorial writer at a premium intelligence publication — a hybrid of The Verge, Bloomberg Businessweek, and Wired. You write about brands the way great journalists cover technology: with narrative flair, sharp analysis, and editorial authority.

YOUR STYLE:
- Bold, declarative headlines that make people want to read
- Pull quotes that capture the essence of a story
- Section tags (like "TAG: OVERVIEW") that organize content like a digital magazine
- Narrative storytelling — not bullet-point consulting decks
- Data woven into prose, not dumped in lists
- Cultural context of ${country || 'Indonesia'} deeply embedded in the writing
- Local language for narrative sections, English for structure and data
- Sharp, opinionated analysis — take a stance, don't hedge everything

BRAND VOICE FOR CONTENT SECTIONS: When writing the "Content in Action" articles (Section 13), you MUST mine the Deep Research data for:
- The actual language patterns real consumers use when talking about this brand (comments, reviews, forum posts)
- The brand's real vocabulary: their taglines, campaign slogans, product naming conventions
- Cultural references, local events, seasonal moments relevant to this category in ${country || 'Indonesia'}
- Real competitive tensions — use these to create contrast and narrative energy
- Authentic emotional triggers specific to this brand's community

The articles should read like they were written by someone who has been following this brand for years, not someone who just read a Wikipedia summary.

DO NOT include any image markdown (![...](...)) in the report. Images are generated separately.
Write the report, not commentary about the report.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 12000
    })
  });

  const data = await response.json();

  // Check for errors in response
  if (!data.choices || !data.choices[0]) {
    console.error('OpenAI API error response:', JSON.stringify(data));
    throw new Error(`OpenAI API error: ${JSON.stringify(data.error || data)}`);
  }

  return data.choices[0].message.content;
}

// Upload HTML report to Supabase Storage
async function uploadReportToStorage(slug: string, htmlContent: string): Promise<string> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  console.log(`[Storage] SUPABASE_URL present: ${!!SUPABASE_URL}, SERVICE_KEY present: ${!!SUPABASE_SERVICE_KEY} (len=${SUPABASE_SERVICE_KEY.length})`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  const storagePath = `report-html/${slug}.html`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/reports/${storagePath}`;
  console.log(`[Storage] Uploading to: ${uploadUrl} (${htmlContent.length} bytes)`);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'text/html',
      'x-upsert': 'true',
    },
    body: htmlContent,
  });

  console.log(`[Storage] Upload response: ${uploadResponse.status} ${uploadResponse.statusText}`);

  if (!uploadResponse.ok) {
    const err = await uploadResponse.text();
    console.error('[Storage] Upload error body:', err);
    throw new Error(`Failed to upload report to storage: ${uploadResponse.status} - ${err}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/reports/report-html/${slug}.html`;
  console.log(`[Storage] Success! Public URL: ${publicUrl}`);
  return publicUrl;
}

// Generate static HTML file
interface StaticReportData {
  brand_name: string;
  parent_company: string;
  category: string;
  country: string;
  generated_at: string;
  report_markdown: string;
}

// Helper: Extract brand colors from report markdown (from Perplexity visual research)
function extractBrandColors(markdown: string): { primary: string; secondary: string; accent: string } {
  // Look for color patterns in Perplexity visual research section
  const hexPattern = /#[0-9A-Fa-f]{6}/g;
  const colors = markdown.match(hexPattern) || [];

  return {
    primary: colors[0] || '#16a34a',      // Fallback to GeoVera green
    secondary: colors[1] || '#d1fae5',    // Fallback to light green
    accent: colors[2] || '#10b981'        // Fallback to accent green
  };
}

// Helper: Lighten/darken hex color
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#',''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 +
    (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255))
    .toString(16).slice(1).toUpperCase();
}

function generateStaticHTML(data: StaticReportData): string {
  // Split markdown into sections for editorial layout
  const sections: { level: number; title: string; body: string }[] = [];
  const lines = data.report_markdown.split('\n');
  let currentSection: { level: number; title: string; body: string } | null = null;

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    if (h1Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 1, title: h1Match[1], body: '' };
    } else if (h2Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 2, title: h2Match[1], body: '' };
    } else if (h3Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { level: 3, title: h3Match[1], body: '' };
    } else if (currentSection) {
      currentSection.body += line + '\n';
    }
  }
  if (currentSection) sections.push(currentSection);

  // Convert markdown body to HTML
  function mdToHtml(md: string): string {
    return md
      .replace(/!\[(.*?)\]\((.*?)\)/gim, '<figure class="fig"><img src="$2" alt="$1" loading="lazy" onerror="this.parentElement.style.display=\'none\'"><figcaption>$1</figcaption></figure>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^→ (.*$)/gim, '<li class="arr">$1</li>')
      .replace(/^• (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^- \[ \] (.*$)/gim, '<li class="chk">$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/<br>---<br>/g, '<hr>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p>\s*<\/p>/g, '');
  }

  // Build sections HTML — first h1 becomes hero, rest become content blocks
  const heroSection = sections.find(s => s.level === 1);
  const contentSections = sections.filter(s => s !== heroSection);

  // Group h2 sections, with their h3 children
  const topSections: { title: string; body: string; subs: { title: string; body: string }[] }[] = [];
  for (const sec of contentSections) {
    if (sec.level === 2) {
      topSections.push({ title: sec.title, body: sec.body, subs: [] });
    } else if (sec.level === 3 && topSections.length > 0) {
      topSections[topSections.length - 1].subs.push({ title: sec.title, body: sec.body });
    } else if (sec.level === 1) {
      topSections.push({ title: sec.title, body: sec.body, subs: [] });
    }
  }

  // Generate story cards — 2-column grid for subsections
  let storiesHTML = '';
  const sectionNums = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14'];
  // TAG map: matches TAG: XXXX in section body and shows as label
  const tagLabels: Record<string, string> = {
    OVERVIEW:'Overview', PERFORMANCE:'Performance', CHRONICLE:'Origin',
    'BRAND DNA':'Brand DNA', 'MARKET LANDSCAPE':'Market', 'TRENDS & INSIGHTS':'Trends',
    ALERTS:'Alerts', GROWTH:'Growth', RECOMMENDATIONS:'Playbook',
    VISIBILITY:'Search', 'ACTION PLAN':'Sprint', PLATFORM:'Platform',
    'CONTENT PREVIEW':'Content', 'CREATOR INTEL':'Creators',
  };

  for (let i = 0; i < topSections.length; i++) {
    const sec = topSections[i];
    const num = sectionNums[i] || String(i + 1).padStart(2, '0');
    const rawBody = sec.body.trim();

    // Extract TAG label if present
    const tagMatch = rawBody.match(/\*\*TAG:\s*([^\*]+)\*\*/);
    const tagKey = tagMatch ? tagMatch[1].trim() : '';
    const tagDisplay = tagLabels[tagKey] || tagKey;
    // Remove TAG line from body before rendering
    const cleanBody = rawBody.replace(/\*\*TAG:[^\n]+\*\*\n?/, '');
    const bodyHtml = mdToHtml(cleanBody);

    // Detect article format badges for Content Preview section
    const isContentSection = tagKey === 'CONTENT PREVIEW';
    const isCreatorSection = tagKey === 'CREATOR INTEL';

    const tagLabelHtml = tagDisplay
      ? `<span class="section-num">${num}</span><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--g400);margin-left:2px">${tagDisplay}</span>`
      : `<span class="section-num">${num}</span>`;

    if (sec.subs.length > 0) {
      // Section with sub-items → 2-column grid
      let subsHtml = '';
      for (const sub of sec.subs) {
        // Detect article format from sub-title for Content Preview
        let formatBadge = '';
        if (isContentSection) {
          const isShort = /short:/i.test(sub.title);
          const isMedium = /medium:/i.test(sub.title);
          const cleanTitle = sub.title.replace(/^(Short|Medium):\s*/i, '');
          const subBodyRaw = sub.body.trim();
          const formatMatch = subBodyRaw.match(/\*\*Format:\s*([^\|]+)\|[^\*]*~?(\d+)\s*(kata|words|characters|chars?)\*\*/i);
          const formatLabel = formatMatch ? formatMatch[1].trim() : (isShort ? 'Social Post' : 'Blog Post');
          const wordCount = formatMatch ? `~${formatMatch[2]} ${formatMatch[3]}` : '';
          const cleanSubBody = subBodyRaw.replace(/\*\*Format:[^\n]+\*\*\n?/, '');
          formatBadge = `<span class="article-format ${isShort ? 'short' : 'medium'}">${formatLabel}</span>
${wordCount ? `<div class="article-wordcount">${wordCount}</div>` : ''}`;
          subsHtml += `<div class="card">
${formatBadge}
<h4>${cleanTitle}</h4>
<div class="card-body">${mdToHtml(cleanSubBody)}</div>
<a class="article-cta" href="https://geovera.xyz/content-studio">Generate more in Content Studio</a>
</div>`;
        } else {
          subsHtml += `<div class="card">
<h4>${sub.title}</h4>
<div class="card-body">${mdToHtml(sub.body.trim())}</div>
</div>`;
        }
      }

      storiesHTML += `
<section class="story-section">
<div class="section-label">${tagLabelHtml}</div>
<h2>${sec.title}</h2>
${bodyHtml ? '<div class="section-lead">' + bodyHtml + '</div>' : ''}
<div class="card-grid">${subsHtml}</div>
</section>`;
    } else {
      // Single section — full width
      // For Creator Intel section, add tracking CTA after table
      const creatorCta = isCreatorSection
        ? `<div style="margin-top:20px;padding:16px 20px;background:var(--gv-50);border:1px solid var(--gv-light);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
<span style="font-size:15px;color:var(--g700);font-weight:500">Track all these creators in real-time on your GeoVera dashboard</span>
<a href="https://geovera.xyz/creators" style="display:inline-flex;align-items:center;gap:6px;background:var(--gv);color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">View Creators \u2192</a>
</div>` : '';
      storiesHTML += `
<section class="story-section">
<div class="section-label">${tagLabelHtml}</div>
<h2>${sec.title}</h2>
<div class="section-body">${bodyHtml}${creatorCta}</div>
</section>`;
    }
  }

  const formattedDate = new Date(data.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const heroBody = heroSection ? mdToHtml(heroSection.body.trim()) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.brand_name} Intelligence Report | GeoVera</title>
<meta name="description" content="Brand intelligence report for ${data.brand_name} - powered by GeoVera AI">
<meta property="og:title" content="${data.brand_name} Intelligence Report | GeoVera">
<meta property="og:description" content="AI-powered brand analysis for ${data.brand_name}">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
:root{
  --g900:#101828;--g800:#1d2939;--g700:#344054;--g600:#475467;--g500:#667085;
  --g400:#98a2b3;--g300:#d0d5dd;--g200:#e4e7ec;--g100:#f2f4f7;--g50:#f9fafb;--g25:#fcfcfd;
  --gv:#16a34a;--gv-light:#dcfce7;--gv-dark:#15803d;--gv-50:#f0fdf4;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --serif:'Playfair Display',Georgia,serif;
}
*{margin:0;padding:0;box-sizing:border-box}
::selection{background:var(--gv-light);color:var(--gv-dark)}
html{scroll-behavior:smooth}
body{font-family:var(--sans);color:var(--g600);background:#fff;-webkit-font-smoothing:antialiased;font-size:17px;line-height:1.7}

/* === MASTHEAD === */
.masthead{border-bottom:3px solid var(--g900);padding:0}
.masthead-inner{max-width:1200px;margin:0 auto;padding:16px 32px;display:flex;align-items:center;justify-content:space-between}
.mast-left{display:flex;align-items:center;gap:16px}
.mast-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.mast-mark{width:32px;height:32px;background:var(--gv);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;letter-spacing:-0.5px}
.mast-wordmark{font-weight:700;font-size:18px;color:var(--g900);letter-spacing:-0.3px}
.mast-divider{width:1px;height:20px;background:var(--g300)}
.mast-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gv)}
.mast-right{display:flex;align-items:center;gap:10px}
.mast-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;transition:all 0.15s;text-decoration:none;border:1px solid var(--g200);background:#fff;color:var(--g700)}
.mast-btn:hover{background:var(--g50);border-color:var(--g300)}
.mast-btn.green{background:var(--gv);color:#fff;border-color:var(--gv)}
.mast-btn.green:hover{background:var(--gv-dark)}
.mast-btn svg{width:14px;height:14px}
.mast-ticker{border-top:1px solid var(--g200);background:var(--g50)}
.mast-ticker-inner{max-width:1200px;margin:0 auto;padding:9px 32px;display:flex;align-items:center;gap:24px;font-size:13px;color:var(--g500);overflow-x:auto}
.ticker-item{display:flex;align-items:center;gap:6px;white-space:nowrap;font-weight:500}
.ticker-item strong{color:var(--g700)}
.ticker-dot{width:4px;height:4px;border-radius:50%;background:var(--g300);flex-shrink:0}

/* === HERO === */
.hero{max-width:1200px;margin:0 auto;padding:56px 32px 44px}
.hero-eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.hero-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fff;background:var(--gv);padding:5px 11px;border-radius:3px}
.hero-date{font-size:14px;color:var(--g400);font-weight:500}
.hero h1{font-family:var(--serif);font-size:clamp(2.8rem,6vw,4.5rem);font-weight:900;color:var(--g900);letter-spacing:-0.03em;line-height:1.06;margin-bottom:18px;max-width:920px}
.hero-deck{font-size:20px;color:var(--g500);line-height:1.55;max-width:740px;margin-bottom:32px;font-weight:400}
.hero-meta{display:flex;align-items:center;gap:24px;padding-top:24px;border-top:1px solid var(--g200)}
.hero-meta-item{display:flex;align-items:center;gap:6px;font-size:14px}
.hero-meta-item .label{color:var(--g400);font-weight:500}
.hero-meta-item .value{color:var(--g800);font-weight:700}
.hero-meta-sep{width:4px;height:4px;border-radius:50%;background:var(--g300)}

/* === CONTENT LAYOUT === */
.content-wrap{max-width:1200px;margin:0 auto;padding:0 32px 72px}
.story-section{padding:48px 0;border-top:1px solid var(--g200)}
.story-section:first-child{border-top:3px solid var(--g900)}
.section-label{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.section-num{font-size:11px;font-weight:800;color:var(--gv);letter-spacing:0.12em;font-family:var(--sans);background:var(--gv-50);padding:3px 8px;border-radius:3px;border:1px solid var(--gv-light)}
.story-section h2{font-family:var(--serif);font-size:clamp(1.75rem,3.5vw,2.4rem);font-weight:800;color:var(--g900);letter-spacing:-0.025em;line-height:1.12;margin-bottom:20px}
.section-lead{font-size:17px;color:var(--g500);line-height:1.75;margin-bottom:28px;max-width:740px}
.section-lead p{margin-bottom:14px}
.section-body{font-size:16px;line-height:1.8;color:var(--g700);max-width:780px}
.section-body p{margin-bottom:16px}
.section-body strong{color:var(--g900);font-weight:700}
.section-body em{color:var(--g500);font-style:italic}
.section-body ul,.section-body ol{margin:14px 0;padding-left:24px}
.section-body li{margin-bottom:10px;line-height:1.75;font-size:16px}
.section-body li::marker{color:var(--gv)}
.section-body li.arr{list-style:none;position:relative;padding-left:22px;margin-left:-24px}
.section-body li.arr::before{content:'\u2192';position:absolute;left:0;color:var(--gv);font-weight:700;font-size:15px}
.section-body li.chk{list-style:none;padding:12px 16px;background:var(--g50);border:1px solid var(--g200);border-radius:7px;margin:10px 0;font-weight:500;color:var(--g900);margin-left:-24px;display:flex;align-items:center;gap:10px;font-size:15px}
.section-body li.chk::before{content:'';width:18px;height:18px;min-width:18px;border:2px solid var(--gv);border-radius:4px;flex-shrink:0}
.section-body hr{border:none;height:2px;background:linear-gradient(90deg,var(--gv-light),transparent);margin:28px 0}

/* === PULL QUOTES (blockquote) === */
.section-body blockquote,.section-lead blockquote{
  margin:28px 0;padding:24px 28px 24px 32px;
  border-left:4px solid var(--gv);
  background:var(--gv-50);
  border-radius:0 8px 8px 0;
  font-family:var(--serif);font-size:1.2rem;font-style:italic;
  color:var(--g800);line-height:1.6;
  position:relative;
}
.section-body blockquote::before{
  content:'\u201C';
  font-size:4rem;line-height:1;color:var(--gv-light);
  position:absolute;top:-8px;left:12px;font-family:var(--serif);
}

/* === SECTION DIVIDER ACCENT === */
.story-section::before{
  content:'';display:block;width:48px;height:3px;
  background:var(--gv);border-radius:2px;
  margin-bottom:20px;
}
.story-section:first-child::before{display:none}

/* === CARD GRID === */
.card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px}
.card{background:#fff;border:1px solid var(--g200);border-radius:10px;padding:26px;transition:box-shadow 0.2s,border-color 0.2s;position:relative;overflow:hidden}
.card::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--gv),var(--gv-light));opacity:0;transition:opacity 0.2s}
.card:hover{border-color:var(--g300);box-shadow:0 6px 20px rgba(16,24,40,0.08)}
.card:hover::after{opacity:1}
.card h4{font-size:16px;font-weight:700;color:var(--g900);margin-bottom:12px;letter-spacing:-0.01em;line-height:1.3}
.card-body{font-size:15px;color:var(--g600);line-height:1.75}
.card-body p{margin-bottom:10px}
.card-body strong{color:var(--g800);font-weight:700}
.card-body ul,.card-body ol{margin:10px 0;padding-left:20px}
.card-body li{margin-bottom:6px;line-height:1.65;font-size:14px}
.card-body li::marker{color:var(--gv)}

/* === SCORE / METRIC HIGHLIGHT === */
.metric-score{display:inline-flex;align-items:baseline;gap:4px;font-family:var(--serif);font-size:2.5rem;font-weight:900;color:var(--gv);line-height:1}
.metric-label{font-size:13px;color:var(--g400);font-weight:500;margin-top:4px}

/* === FIGURES === */
.fig{margin:24px 0;border-radius:10px;overflow:hidden;border:1px solid var(--g200);box-shadow:0 2px 8px rgba(16,24,40,0.04)}
.fig img{width:100%;height:auto;display:block;object-fit:cover;max-height:520px}
.fig figcaption{padding:11px 18px;font-size:13px;color:var(--g500);border-top:1px solid var(--g100);background:var(--g25);font-weight:500;letter-spacing:0.01em}

/* === TABLES === */
table{width:100%;border-collapse:collapse;margin:20px 0 28px;font-size:15px;border:1px solid var(--g200);border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(16,24,40,0.04)}
thead{background:var(--g900)}
th{padding:12px 18px;text-align:left;font-weight:700;color:#fff;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid var(--g800)}
td{padding:12px 18px;border-bottom:1px solid var(--g100);color:var(--g700);font-size:15px}
tbody tr:last-child td{border-bottom:none}
tbody tr:nth-child(even){background:var(--g25)}
tbody tr:hover{background:var(--gv-50)}
td:first-child{font-weight:600;color:var(--g900)}

/* === PLATFORM BADGES === */
.badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.03em}
.badge-ig{background:#fce7f3;color:#9d174d}
.badge-tt{background:#f3f4f6;color:#111827;border:1px solid #e5e7eb}
.badge-yt{background:#fee2e2;color:#991b1b}
.badge-tw{background:#eff6ff;color:#1d4ed8}

/* === ARTICLE CARDS (Content Preview) === */
.article-format{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;padding:3px 9px;border-radius:3px;margin-bottom:10px}
.article-format.short{background:var(--gv-50);color:var(--gv-dark);border:1px solid var(--gv-light)}
.article-format.medium{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.article-cta{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:var(--gv);text-decoration:none;margin-top:14px;border-top:1px solid var(--g100);padding-top:12px;width:100%}
.article-cta::after{content:'\u2192';font-size:14px}
.article-wordcount{font-size:12px;color:var(--g400);font-weight:500;margin-bottom:8px}

/* === CTA BANNER === */
.cta-banner{background:linear-gradient(135deg,var(--g900) 0%,#1a2f1e 100%);padding:64px 32px;text-align:center;position:relative;overflow:hidden}
.cta-banner::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(22,163,74,0.15) 0%,transparent 70%);pointer-events:none}
.cta-banner-inner{max-width:600px;margin:0 auto;position:relative}
.cta-banner h3{font-family:var(--serif);font-size:2.1rem;font-weight:800;color:#fff;margin-bottom:10px;letter-spacing:-0.025em;line-height:1.15}
.cta-banner p{color:var(--g400);font-size:16px;margin-bottom:28px;line-height:1.6}
.cta-link{display:inline-flex;align-items:center;gap:8px;background:var(--gv);color:#fff;padding:14px 32px;border-radius:7px;text-decoration:none;font-weight:700;font-size:16px;transition:all 0.15s;border:none;cursor:pointer;letter-spacing:-0.01em}
.cta-link:hover{background:var(--gv-dark);transform:translateY(-2px);box-shadow:0 6px 24px rgba(22,163,74,0.4)}
.cta-link svg{width:16px;height:16px}

/* === FOOTER === */
.site-footer{border-top:3px solid var(--g900);background:#fff}
.footer-inner{max-width:1200px;margin:0 auto;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
.footer-left{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--g500)}
.footer-left strong{color:var(--g700);font-weight:600}
.footer-links{display:flex;align-items:center;gap:16px}
.footer-links a{font-size:14px;color:var(--gv);text-decoration:none;font-weight:600}
.footer-links a:hover{color:var(--gv-dark)}
.footer-credits{width:100%;text-align:center;font-size:12px;color:var(--g400);padding-top:14px;border-top:1px solid var(--g100)}

/* === PRINT === */
@media print{
  .masthead,.mast-ticker,.cta-banner{display:none}
  body{font-size:13px}
  .hero{padding:24px 0}
  .hero h1{font-size:2.2rem}
  .content-wrap{padding:0}
  .story-section{padding:20px 0}
  .card-grid{grid-template-columns:1fr 1fr}
  .card{break-inside:avoid;border:1px solid #ddd;box-shadow:none}
  .site-footer{border:none}
  .footer-inner{padding:12px 0}
  .footer-credits{display:none}
  .story-section::before{display:none}
}

/* === MOBILE === */
@media(max-width:768px){
  .masthead-inner{padding:12px 16px}
  .mast-divider,.mast-label{display:none}
  .mast-ticker-inner{padding:8px 16px;font-size:12px}
  .hero{padding:32px 16px 28px}
  .hero h1{font-size:2.2rem}
  .hero-deck{font-size:17px}
  .hero-meta{flex-wrap:wrap;gap:12px}
  .content-wrap{padding:0 16px 48px}
  .story-section{padding:32px 0}
  .card-grid{grid-template-columns:1fr}
  .section-body{font-size:15px}
  .cta-banner{padding:44px 16px}
  .cta-banner h3{font-size:1.7rem}
  .footer-inner{padding:20px 16px;flex-direction:column;text-align:center}
  table{font-size:13px}
  th,td{padding:10px 12px}
}
@media(max-width:480px){
  .hero h1{font-size:1.8rem}
  .mast-right{display:none}
  .card{padding:18px}
  .story-section h2{font-size:1.6rem}
}
</style>
</head>
<body>

<!-- MASTHEAD -->
<header class="masthead">
<div class="masthead-inner">
<div class="mast-left">
<a href="https://geovera.xyz" class="mast-logo">
<div class="mast-mark">G</div>
<span class="mast-wordmark">GeoVera</span>
</a>
<div class="mast-divider"></div>
<span class="mast-label">Intelligence</span>
</div>
<div class="mast-right">
<button class="mast-btn" onclick="window.print()">
<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
PDF
</button>
<button class="mast-btn green" onclick="navigator.share?.({title:'${data.brand_name} Report',url:location.href}).catch(()=>{navigator.clipboard.writeText(location.href);this.textContent='Copied!'})">
<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
Share
</button>
</div>
</div>
<div class="mast-ticker">
<div class="mast-ticker-inner">
<div class="ticker-item"><strong>Company</strong> ${data.parent_company}</div>
<div class="ticker-dot"></div>
<div class="ticker-item"><strong>Category</strong> ${data.category}</div>
<div class="ticker-dot"></div>
<div class="ticker-item"><strong>Market</strong> ${data.country}</div>
<div class="ticker-dot"></div>
<div class="ticker-item"><strong>Generated</strong> ${formattedDate}</div>
</div>
</div>
</header>

<!-- HERO -->
<div class="hero">
<div class="hero-eyebrow">
<span class="hero-tag">AI Intelligence Report</span>
<span class="hero-date">${formattedDate}</span>
</div>
<h1>${data.brand_name}</h1>
<p class="hero-deck">${heroSection ? heroSection.title : 'Brand Intelligence Report'}</p>
${heroBody ? '<div class="section-body" style="max-width:720px;margin-bottom:0">' + heroBody + '</div>' : ''}
<div class="hero-meta">
<div class="hero-meta-item">
<span class="label">Company</span>
<span class="value">${data.parent_company}</span>
</div>
<div class="hero-meta-sep"></div>
<div class="hero-meta-item">
<span class="label">Category</span>
<span class="value">${data.category}</span>
</div>
<div class="hero-meta-sep"></div>
<div class="hero-meta-item">
<span class="label">Market</span>
<span class="value">${data.country}</span>
</div>
</div>
</div>

<!-- STORIES -->
<div class="content-wrap">
${storiesHTML}
</div>

<!-- CTA -->
<div class="cta-banner">
<div class="cta-banner-inner">
<h3>Get your own brand intelligence report</h3>
<p>AI-powered insights for any brand, in minutes.</p>
<a href="https://geovera.xyz/onboarding" class="cta-link">
Get Started
<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
</a>
</div>
</div>

<!-- FOOTER -->
<footer class="site-footer">
<div class="footer-inner">
<div class="footer-left">
<div class="mast-mark" style="width:24px;height:24px;font-size:11px;border-radius:5px">G</div>
<span><strong>GeoVera</strong> &copy; 2026</span>
</div>
<div class="footer-links">
<a href="https://geovera.xyz">geovera.xyz</a>
</div>
<div class="footer-credits">Powered by Perplexity AI &middot; Gemini &middot; Claude &middot; GPT-4o &middot; DALL-E 3</div>
</div>
</footer>

</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { brand_name, country } = await req.json();

    if (!brand_name) {
      throw new Error('brand_name is required');
    }

    if (!country) {
      throw new Error('country is required');
    }

    const brandWithCountry = `${brand_name} (${country})`;
    console.log(`\n🚀 Starting PERPLEXITY-FIRST 5-step workflow for: ${brandWithCountry}\n`);

    // Step 0: Perplexity Discovery (NEW - Find verified data first)
    console.log('🔍 Step 0: Perplexity Deep Discovery...');
    const step0Data = await step0_perplexity_discovery(brand_name, country);
    console.log('✅ Step 0 Complete - Verified data discovered\n');

    // Step 1: Gemini Indexing (Using verified Perplexity data)
    console.log('📍 Step 1: Gemini Brand Indexing (with verified data)...');
    const step1Data = await step1_gemini(brand_name, country, step0Data);
    console.log('✅ Step 1 Complete\n');

    // Step 2a: Firecrawl — scrape brand website + top backlinks in parallel
    console.log('🕷️ Step 2a: Firecrawl URL scraping...');
    const urlsToScrape = parseUrlsFromPerplexityOutput(step0Data, step1Data);
    const firecrawlCtx = await step2_firecrawl_scrape(urlsToScrape);
    console.log(`✅ Step 2a Complete — scraped: ${firecrawlCtx.urlsScraped.length}, failed: ${firecrawlCtx.urlsFailed.length}\n`);

    // Step 2: Perplexity Surface Research (now Firecrawl-enriched)
    console.log('🔍 Step 2: Perplexity Deep Market Research (Firecrawl-enriched)...');
    const step2Data = await step2_perplexity(brand_name, step1Data, firecrawlCtx);
    console.log('✅ Step 2 Complete\n');

    // Step 2b: Gemini index combined Perplexity + Firecrawl into structured summary
    console.log('🧬 Step 2b: Gemini Enrichment Indexing...');
    const enrichedSummary = await step2b_gemini_index(brand_name, country, step2Data, firecrawlCtx);
    console.log('✅ Step 2b Complete\n');

    // Step 3: Claude Reverse Engineering (enrichment-aware)
    console.log('🧠 Step 3: Claude Strategic Analysis...');
    const step3Data = await step3_claude(brand_name, step2Data, enrichedSummary);
    console.log('✅ Step 3 Complete\n');

    // Step 4: OpenAI Compelling Report
    console.log('✍️ Step 4: OpenAI Report Generation...');
    const finalReport = await step4_openai(brand_name, step1Data, step2Data, step3Data, country);
    console.log('✅ Step 4 Complete\n');

    console.log('🎉 AI analysis complete!\n');

    // Generate slug for static file
    const slug = brand_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Clean non-URL image refs from markdown (DALL-E prompts) — images generated separately
    const cleanedReport = finalReport.replace(/!\[([^\]]*)\]\((?!http)([^)]+)\)/g, '');

    // Generate static HTML file
    console.log('📄 Generating static HTML file...');
    const staticHTML = generateStaticHTML({
      brand_name,
      parent_company: step1Data.parent_company,
      category: step1Data.category,
      country: country || 'N/A',
      generated_at: new Date().toISOString(),
      report_markdown: cleanedReport
    });

    console.log(`✅ Static HTML generated: ${slug}.html (${staticHTML.length} bytes)\n`);

    // Upload to Supabase Storage
    console.log('☁️ Uploading report to Supabase Storage...');
    let storageUrl = '';
    try {
      storageUrl = await uploadReportToStorage(slug, staticHTML);
      console.log(`✅ Report uploaded: ${storageUrl}\n`);
    } catch (uploadError) {
      console.error('⚠️ Storage upload failed:', uploadError);
    }

    const reportUrl = `https://report.geovera.xyz/report/${slug}`;
    console.log(`🎉 All steps completed! Report URL: ${reportUrl}\n`);

    // Extract visual brand data from step2 research for the image generator
    // Per our Perplexity prompt, the output ALWAYS starts with VISUAL BRAND IDENTITY
    // followed by colors, photography style, brand tone, and consumer voice data.
    // We grab the first 4000 chars which reliably covers all visual identity content.
    // If the section exists explicitly, we find it; otherwise first 4000 chars as fallback.
    const visualIdxMatch = step2Data.search(/VISUAL BRAND IDENTITY/i);
    const visualStart = visualIdxMatch >= 0 ? visualIdxMatch : 0;
    // Find end: look for the standard research section marker (numbered list item 8 or "STANDARD RESEARCH")
    const standardResearchIdx = step2Data.search(/\n(?:#{1,3}\s*)?(?:STANDARD RESEARCH|\*{2}STANDARD|8\.\s|\*{1,2}8\.)/i);
    const visualEnd = standardResearchIdx > visualStart + 100
      ? Math.min(standardResearchIdx, visualStart + 4000)
      : visualStart + 4000;
    const visualResearch = step2Data.substring(visualStart, visualEnd).trim();
    console.log(`🎨 Visual research extracted: ${visualResearch.length} chars (start: ${visualStart}, end: ${visualEnd})`);

    return new Response(
      JSON.stringify({
        success: true,
        brand_name,
        slug,
        report_url: reportUrl,
        storage_url: storageUrl,
        report_markdown: finalReport,
        visual_research: visualResearch,
        static_html: staticHTML,
        metadata: {
          step1_indexed_data: step1Data,
          step3_analysis: step3Data,
          research_length: step2Data.length,
          report_length: finalReport.length,
          html_length: staticHTML.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
