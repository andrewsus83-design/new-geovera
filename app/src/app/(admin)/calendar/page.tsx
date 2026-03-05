"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import MiniCalendar from "@/components/calendar/MiniCalendar";
import PrioritySection from "@/components/calendar/PrioritySection";
import TaskDetailPanel from "@/components/calendar/TaskDetailPanel";
import type { Task, ReplyComment } from "@/components/calendar/TaskCard";
import CycleBanner from "@/components/calendar/CycleBanner";
import { supabase } from "@/lib/supabase";
import { UserIcon, AiIcon, BoltIcon, CheckLineIcon, CheckCircleIcon, PaperPlaneIcon, PencilIcon, CloseLineIcon } from "@/icons";

const DEMO_BRAND_ID = process.env.NEXT_PUBLIC_DEMO_BRAND_ID || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

// ── TikTok config ─────────────────────────────────────────────────────────────
const TIKTOK_CLIENT_KEY = process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY || "";
const TIKTOK_REDIRECT_URI =
  process.env.NEXT_PUBLIC_TIKTOK_REDIRECT_URI ||
  "https://report.geovera.xyz/api/tiktok/callback";

// ── TikTok types ──────────────────────────────────────────────────────────────
type PostStatus = "draft" | "scheduled" | "published" | "failed";
type TikTokPost = {
  id: string; date: string; time: string; title: string;
  caption: string; hashtags: string[]; status: PostStatus;
  duration: string; videoUrl?: string; accentColor: string;
  views?: string; likes?: string;
};

// ── TikTok demo posts ─────────────────────────────────────────────────────────
const DEMO_TIKTOK_POSTS: TikTokPost[] = [
  {
    id: "tt1",
    date: "2026-02-18",
    time: "09:00",
    title: "Rahasia Brand Lokal Tembus 1 Juta Followers",
    caption: "Tahukah kamu? Brand lokal Indonesia ini berhasil menembus 1 juta TikTok followers dalam 6 bulan — tanpa budget iklan besar. Rahasianya ada di strategi konten yang tepat! 🔥💡\n\nGeoVera AI menganalisis ribuan konten viral untuk membantumu menemukan formula yang sama.",
    hashtags: ["#BrandIndonesia", "#TikTokMarketing", "#ViralStrategy", "#GeoVera", "#UMKM", "#ContentCreator"],
    status: "published",
    duration: "45s",
    accentColor: "#FE2C55",
    views: "284K",
    likes: "31.2K",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt2",
    date: "2026-02-20",
    time: "11:00",
    title: "AI vs Human: Siapa yang Lebih Paham Konsumen?",
    caption: "Banyak yang takut AI akan gantikan marketer. Tapi kenyataannya? AI + Human = kombinasi yang tak terkalahkan. 🤖🤝\n\nGeoVera tidak menggantikan timmu — kami memperkuat mereka dengan data dan analisis real-time.",
    hashtags: ["#AIMarketing", "#DigitalMarketing", "#MarketingIndonesia", "#GeoVera", "#TechStartup"],
    status: "published",
    duration: "38s",
    accentColor: "#25F4EE",
    views: "156K",
    likes: "18.7K",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt3",
    date: "2026-02-23",
    time: "14:00",
    title: "3 Kesalahan Fatal Brand di TikTok (dan Cara Hindarinya)",
    caption: "95% brand baru melakukan 3 kesalahan ini di TikTok dan akhirnya menyerah. Apakah brandmu juga melakukannya? ❌\n\n1. Posting tanpa strategi\n2. Mengabaikan analytics\n3. Tidak konsisten\n\nGeoVera hadir untuk memastikan kamu tidak melakukan kesalahan yang sama! ✅",
    hashtags: ["#TikTokTips", "#BrandMistakes", "#ContentStrategy", "#GeoVera", "#MarketingTips"],
    status: "published",
    duration: "52s",
    accentColor: "#FF6B6B",
    views: "412K",
    likes: "47.3K",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt4",
    date: "2026-02-25",
    time: "10:00",
    title: "Behind the Scenes: Cara GeoVera Generate Konten",
    caption: "Dari riset tren → AI analysis → konten siap publish — semua dalam hitungan menit! ⚡\n\nIni dia proses di balik layar bagaimana GeoVera membantu brand Indonesia menciptakan konten TikTok yang relevan, engaging, dan konsisten setiap hari.",
    hashtags: ["#BehindTheScenes", "#AIContent", "#ContentCreation", "#GeoVera", "#ProductDemo", "#TechIndonesia"],
    status: "scheduled",
    duration: "60s",
    accentColor: "#6C63FF",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt5",
    date: "2026-02-26",
    time: "16:00",
    title: "Tren Konten TikTok Indonesia Maret 2026",
    caption: "GeoVera AI sudah analisis 50.000+ konten TikTok Indonesia untuk Maret 2026. Hasilnya? Ada 5 format konten yang akan MELEDAK bulan depan! 📊🚀\n\nBrand mana yang paling siap memanfaatkan tren ini?",
    hashtags: ["#TrendAnalysis", "#TikTokTrends", "#MarketingIntelligence", "#GeoVera", "#Indonesia2026"],
    status: "scheduled",
    duration: "47s",
    accentColor: "#F7B731",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt6",
    date: "2026-02-27",
    time: "09:00",
    title: "Case Study: Brand F&B Jakarta +340% Engagement",
    caption: "Dalam 30 hari menggunakan GeoVera, brand F&B ini berhasil:\n✅ Engagement naik 340%\n✅ Followers baru: +12.400\n✅ 3 konten masuk FYP organik\n\nApa yang berbeda? Strategi konten berbasis data, bukan feeling. 📈",
    hashtags: ["#CaseStudy", "#FoodBeverage", "#TikTokSuccess", "#GeoVera", "#DataDriven", "#UMKM"],
    status: "scheduled",
    duration: "55s",
    accentColor: "#FF9A3C",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
  {
    id: "tt7",
    date: "2026-02-28",
    time: "13:00",
    title: "GeoVera x TikTok: Publish Langsung dari Dashboard",
    caption: "Bayangkan: buat konten, preview di TikTok mockup, edit caption & hashtag, lalu publish — semua dari satu dashboard tanpa berpindah aplikasi. 🎯\n\nItulah yang bisa kamu lakukan di GeoVera. Coba gratis sekarang!",
    hashtags: ["#GeoVera", "#TikTokPublish", "#SocialMediaManagement", "#ProductFeature", "#DigitalMarketing"],
    status: "draft",
    duration: "42s",
    accentColor: "#1DB954",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
  },
];

// Premium plan daily tasks:
//   2 long articles (Medium, Quora/Reddit) + 2 short articles (LinkedIn, X)
//   + 2 Instagram posts + 1 Reels/TikTok/Shorts + 2 CEO tasks
const demoTasks: Task[] = [

  // ══════════════════════════════════════════════════════
  // FEB 23 — PREMIUM DAILY (7 tasks + 2 CEO)
  // ══════════════════════════════════════════════════════

  // Long articles (2)
  {
    id: "feb23-medium",
    title: "Medium Article: Why AI Marketing Is the Future of Brand Growth",
    description: "Write a 800–1200 word thought-leadership article for Medium. Cover how AI agents are reshaping brand marketing, with real examples and a clear CTA to try GeoVera. SEO keywords: AI marketing, brand growth, marketing automation.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
    platform: "Blog",
    content: {
      caption: "AI isn't replacing marketers — it's giving them superpowers. Here's how GeoVera's AI agents are helping brands grow 3× faster without growing their team.",
      hashtags: ["#AIMarketing", "#BrandGrowth", "#MarketingAutomation", "#GeoVera"],
    },
  },
  {
    id: "feb23-quora",
    title: "Quora/Reddit Article: Answering 'How do I scale my brand without a big team?'",
    description: "Write a detailed, high-value Quora answer and Reddit post (r/Entrepreneur, r/marketing) addressing the top-voted question about scaling brand presence with limited resources. Answer naturally — weave in GeoVera as one of several solutions. 600–900 words.",
    agent: "CMO",
    priority: "high",
    impact: 2,
    dueDate: "2026-02-23",
    platform: "Blog",
    content: {
      caption: "The real answer to scaling your brand without a full team: systems + AI. Here's exactly what works in 2026.",
      hashtags: ["#Quora", "#Reddit", "#MarketingAdvice", "#BrandScaling"],
    },
  },

  // Short articles (2)
  {
    id: "feb23-linkedin",
    title: "LinkedIn Post: Brand Intelligence Insight — AI Marketing Trend",
    description: "Write a professional LinkedIn post (150–300 words) sharing one data-backed marketing insight from today's AI analysis. Format: strong hook → insight → 3 bullet takeaways → CTA question. Target: CMOs, founders, marketing managers.",
    agent: "CMO",
    priority: "high",
    impact: 2,
    dueDate: "2026-02-23",
    platform: "Blog",
    content: {
      caption: "AI is now analyzing your competitors' content faster than any human team. Here's what that means for your brand strategy in 2026...",
      hashtags: ["#LinkedInMarketing", "#AIMarketing", "#BrandStrategy", "#B2BMarketing"],
    },
  },
  {
    id: "feb23-x",
    title: "X Post: AI Agent Daily Insight — Brand Voice Tip",
    description: "Craft a punchy, high-engagement X post (max 280 chars) sharing a brand voice insight from today's market analysis. Include a hook, insight, and soft CTA. Short, sharp, shareable.",
    agent: "CMO",
    priority: "high",
    impact: 2,
    dueDate: "2026-02-23",
    platform: "X (Twitter)",
    content: {
      caption: "Your brand voice is your unfair advantage. Stop sounding like everyone else. 3 ways to stand out in 2026 → [link]",
      hashtags: ["#BrandVoice", "#MarketingTips", "#BuildInPublic"],
    },
  },

  // Instagram posts (2)
  {
    id: "feb23-ig1",
    title: "Instagram Post: GeoVera Platform Feature Spotlight",
    description: "Create a single-image or carousel post showcasing one GeoVera feature (AI report generation). Use clean brand visuals, bold headline, and 3–5 benefit bullet points in the caption. Target: founders & CMOs.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
    platform: "Instagram",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    content: {
      caption: "One report. Every insight your brand needs. GeoVera generates full market intelligence reports in minutes — powered by AI, built for modern brands.",
      hashtags: ["#GeoVera", "#AIMarketing", "#BrandIntelligence", "#MarketingTools", "#StartupIndonesia"],
      imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    },
  },
  {
    id: "feb23-ig2",
    title: "Instagram Post #2: Tip of the Day — 60-Second Brand Audit",
    description: "Create a simple, highly shareable tip post. Format: bold question as headline → 3-step mini audit anyone can do in 60 seconds → invite DMs for a free report. Use clean, minimal design with brand colors. Very save-worthy.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-23",
    platform: "Instagram",
    imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=400&fit=crop",
    content: {
      caption: "Do a 60-second brand audit right now: 1️⃣ Is your bio crystal clear? 2️⃣ Does your last post match your brand colors? 3️⃣ When did you last reply to a comment? DM us 'AUDIT' for a free AI brand report 👇",
      hashtags: ["#BrandAudit", "#MarketingTips", "#InstagramGrowth", "#GeoVera"],
      imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=400&fit=crop",
    },
  },

  // Reels/TikTok/Shorts (1)
  {
    id: "feb23-reels",
    title: "Reels + TikTok + Shorts: '3 Things AI Does for Your Brand While You Sleep'",
    description: "Create a 30–45 sec vertical video for Instagram Reels, TikTok, and YouTube Shorts. Script: hook (0–3s) → 3 quick value points with on-screen text → CTA to follow/visit GeoVera. Use trending audio. Repurpose same video across all 3 platforms with platform-specific captions.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
    platform: "Instagram",
    imageUrl: "https://images.unsplash.com/photo-1616469829581-73993eb86b6b?w=600&h=400&fit=crop",
    content: {
      caption: "POV: Your AI marketing team is working at 3am while you sleep 😴 → 1. Analyzing competitors 2. Drafting tomorrow's posts 3. Scoring your top leads Follow for daily AI marketing insights 👆",
      hashtags: ["#AIMarketing", "#MarketingHacks", "#GeoVera", "#ContentCreator", "#ReelsViral", "#TikTokMarketing"],
      imageUrl: "https://images.unsplash.com/photo-1616469829581-73993eb86b6b?w=600&h=400&fit=crop",
    },
  },

  // CEO tasks (2)
  {
    id: "feb23-ceo1",
    title: "CEO Daily #1: Review Market Intelligence Report & Set Today's Priorities",
    description: "Review the AI-generated market intelligence report for Feb 23. Identify top 3 opportunities and threats. Allocate agent tasks for the day. Update sprint priorities based on latest competitor moves and engagement data from yesterday.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
  },
  {
    id: "feb23-ceo2",
    title: "CEO Daily #2: Budget Check & Growth Lever Review",
    description: "Review current CAC vs LTV ratio. Assess which content channels are producing the best ROI this week. Decide if budget should be shifted toward paid amplification of today's top-performing organic content. Brief team on decision.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
  },

  // ══════════════════════════════════════════════════════
  // FEB 24 — PREMIUM DAILY
  // ══════════════════════════════════════════════════════
  {
    id: "feb24-medium",
    title: "Medium Article: 5 Signs Your Brand Is Ready for AI Automation",
    description: "Write a 800–1200 word checklist-style article for Medium. Help founders identify when it's the right time to adopt AI marketing tools. Practical, actionable, and shareable. Include GeoVera mention naturally.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-24",
    platform: "Blog",
    content: {
      caption: "Not sure if AI marketing is right for you? Here are 5 signs your brand is ready — and what to do next.",
      hashtags: ["#AIMarketing", "#StartupTips", "#BrandStrategy", "#MarketingAutomation"],
    },
  },
  {
    id: "feb24-reddit",
    title: "Reddit Post: r/marketing — 'What content formats are actually working in 2026?'",
    description: "Write a genuine, insight-rich Reddit thread starter for r/marketing. Share data-backed observations about content format performance (short video, newsletters, thought leadership). Include a question to spark discussion. No overt promotion — pure value.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-24",
    platform: "Blog",
    content: {
      caption: "We analyzed 500+ brand accounts for 3 months. Here's what content formats are actually driving engagement in 2026 (data inside) — what are you seeing?",
      hashtags: ["#Reddit", "#ContentMarketing", "#MarketingData"],
    },
  },
  {
    id: "feb24-linkedin",
    title: "LinkedIn Post: Weekly Insight — Competitor Landscape Snapshot",
    description: "Share an anonymized, data-driven LinkedIn post about the current competitor landscape in digital marketing. Frame as 'what we're seeing this week' from GeoVera's intelligence layer. 200–300 words, professional tone, ends with a question.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-24",
    platform: "Blog",
    content: {
      caption: "This week's competitor intelligence snapshot: brands investing in short-form video are seeing 2.3× higher reach than those relying only on static posts. Is your brand keeping up?",
      hashtags: ["#LinkedInMarketing", "#CompetitorAnalysis", "#DigitalMarketing"],
    },
  },
  {
    id: "feb24-x",
    title: "X Thread: 'What Top Brands Are Doing This Week That You're Not'",
    description: "Write a 3–4 tweet thread sharing anonymized insights from GeoVera's competitor analysis. Frame as educational intel. End with a question to drive replies. Each tweet should stand alone as shareable.",
    agent: "CMO",
    priority: "high",
    impact: 2,
    dueDate: "2026-02-24",
    platform: "X (Twitter)",
    content: {
      caption: "🧵 What top brands are doing this week that most aren't (yet): Thread →",
      hashtags: ["#MarketingThread", "#BrandStrategy", "#CompetitorIntel"],
    },
  },
  {
    id: "feb24-ig1",
    title: "Instagram Post: Customer Story — Brand Before & After",
    description: "Create a before/after Instagram post highlighting a brand transformation story. Results-focused copy. Include social proof numbers. Carousel format: slide 1 = problem, slides 2–4 = solution steps, slide 5 = results.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-24",
    platform: "Instagram",
    imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=400&fit=crop",
    content: {
      caption: "From inconsistent posting to 3× engagement in 30 days. This is what happens when your brand gets a dedicated AI team.",
      hashtags: ["#BrandTransformation", "#AIMarketing", "#GeoVera", "#Results"],
      imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=400&fit=crop",
    },
  },
  {
    id: "feb24-ig2",
    title: "Instagram Post #2: Trending Audio — Relatable Brand Moment",
    description: "Create a fun, relatable Instagram post using a trending audio/meme format. Brand-appropriate humor about the struggles of marketing without AI. High save + share potential. Keep text minimal, visual-first.",
    agent: "CMO",
    priority: "low",
    impact: 1,
    dueDate: "2026-02-24",
    platform: "Instagram",
    content: {
      caption: "Me trying to manage 8 social platforms, write 3 articles, AND analyze competitors manually 🫠 vs me with GeoVera 😎✨",
      hashtags: ["#RelatablaMarketing", "#AITools", "#MarketingLife", "#GeoVera"],
    },
  },
  {
    id: "feb24-reels",
    title: "Reels + TikTok + Shorts: 'How We Generate a Market Report in 5 Minutes'",
    description: "Create a 30–45 sec screen-capture + voiceover video showing GeoVera generating a market report. Fast-paced edit, on-screen text highlights, satisfying to watch. Add a 'POV: your competitors are still doing this manually' hook.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-24",
    platform: "Instagram",
    content: {
      caption: "POV: 5 minutes to get a full market intelligence report 🤯 Your competitors are spending 5 hours doing this manually. GeoVera link in bio.",
      hashtags: ["#ProductDemo", "#AIMarketing", "#GeoVera", "#MarketResearch", "#TikTokBusiness"],
    },
  },
  {
    id: "feb24-ceo1",
    title: "CEO Daily #1: Evaluate Partnership Proposal & Review KPIs",
    description: "Review the incoming partnership proposal. Score on brand fit, audience overlap, and revenue potential. Review this week's KPI dashboard — flag metrics below target and reassign agent focus where needed.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-24",
  },
  {
    id: "feb24-ceo2",
    title: "CEO Daily #2: Content Performance Analysis — Approve/Pause Campaigns",
    description: "Review performance data on all content published in the last 48 hours. Identify top performers to amplify with paid boost. Identify underperformers to pause or revise. Approve next 24-hour content queue.",
    agent: "CEO",
    priority: "high",
    impact: 2,
    dueDate: "2026-02-24",
  },

  // ══════════════════════════════════════════════════════
  // FEB 25 — PREMIUM DAILY
  // ══════════════════════════════════════════════════════
  {
    id: "feb25-medium",
    title: "Medium Article: The CMO's Guide to AI Content Calendars",
    description: "Practical 900-word guide for CMOs on building AI-assisted content calendars. Cover: setting strategy, letting AI handle execution, reviewing outputs. Position GeoVera as the tool that makes this seamless.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-25",
    platform: "Blog",
    content: {
      caption: "Your content calendar shouldn't live in a spreadsheet. Here's how CMOs are using AI to plan, create, and publish — on autopilot.",
      hashtags: ["#ContentCalendar", "#CMOLife", "#AITools", "#ContentMarketing"],
    },
  },
  {
    id: "feb25-quora",
    title: "Quora Answer: 'What's the best way to grow a brand on social media in 2026?'",
    description: "Write a comprehensive, high-upvote-potential Quora answer to one of the most-searched brand marketing questions. Structure: empathy → framework → specific steps → tool mention (GeoVera, naturally). 700–1000 words.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-25",
    platform: "Blog",
    content: {
      caption: "The brands winning on social in 2026 are doing 3 things differently. Here's the exact framework — no fluff.",
      hashtags: ["#Quora", "#SocialMediaGrowth", "#BrandMarketing"],
    },
  },
  {
    id: "feb25-linkedin",
    title: "LinkedIn Post: Thought Leadership — 'The Death of Manual Marketing'",
    description: "Write a bold, opinion-driven LinkedIn post about how manual marketing processes are becoming obsolete. Take a clear stance, back it with data, invite debate. Goal: comments and reshares from marketing professionals.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-25",
    platform: "Blog",
    content: {
      caption: "Manual marketing is dying. Not slowly — fast. Here's what's replacing it and what that means for your team.",
      hashtags: ["#MarketingFuture", "#AIMarketing", "#ThoughtLeadership", "#LinkedInCreator"],
    },
  },
  {
    id: "feb25-x",
    title: "X Post: Brand Engagement Tip of the Day",
    description: "Post one highly actionable brand engagement tip under 280 chars. Format: bold hook → 1 specific tip → expected result. Feel like advice from a smart CMO friend, not a brand account.",
    agent: "CMO",
    priority: "medium",
    impact: 1,
    dueDate: "2026-02-25",
    platform: "X (Twitter)",
    content: {
      caption: "Stop asking followers to 'like and share'. Instead: ask a question they actually want to answer. Watch engagement jump 40%.",
      hashtags: ["#EngagementTips", "#SocialMediaMarketing", "#GrowthHacks"],
    },
  },
  {
    id: "feb25-ig1",
    title: "Instagram Post: Behind the Brand — GeoVera Vision",
    description: "Post a behind-the-scenes look at the GeoVera vision. Humanize the brand. Show the 'why'. Use authentic imagery, warm caption, and invite followers to share their own brand story.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-25",
    platform: "Instagram",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
    content: {
      caption: "Every great brand starts with a belief. Ours: every founder deserves a world-class marketing team — even if it's powered by AI. 🌿",
      hashtags: ["#BehindTheBrand", "#StartupLife", "#GeoVera", "#BuildingInPublic"],
      imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
    },
  },
  {
    id: "feb25-ig2",
    title: "Instagram Post #2: Data Visual — This Week's Brand Growth Stats",
    description: "Create a clean data visualization post showing sample brand growth metrics (reach, engagement, saves). Format as a simple infographic with GeoVera brand colors. Caption: share the story behind the numbers.",
    agent: "CMO",
    priority: "low",
    impact: 1,
    dueDate: "2026-02-25",
    platform: "Instagram",
    content: {
      caption: "📊 This week in brand growth (GeoVera dashboard preview): +28% reach, +41% saves, +19% profile visits. Every metric tells a story — what's yours saying?",
      hashtags: ["#BrandGrowth", "#MarketingMetrics", "#DataDriven", "#GeoVera"],
    },
  },
  {
    id: "feb25-tiktok",
    title: "TikTok: Behind the Scenes – Cara GeoVera Generate Konten Viral",
    description: "Buat video TikTok 45–60 detik yang menampilkan proses di balik layar GeoVera: dari riset tren → AI analysis → konten siap publish. Gunakan screen recording + voiceover. Hook kuat di 3 detik pertama. Target: founders & CMO Indonesia.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-25",
    platform: "TikTok",
    imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=400&fit=crop",
    content: {
      caption: "Dari riset tren → AI analysis → konten siap publish — semua dalam hitungan menit! ⚡\n\nIni dia proses di balik layar bagaimana GeoVera membantu brand Indonesia menciptakan konten TikTok yang relevan, engaging, dan konsisten setiap hari. 🤖🇮🇩",
      hashtags: ["#BehindTheScenes", "#AIContent", "#GeoVera", "#ContentCreation", "#TikTokMarketing", "#BrandIndonesia"],
    },
  },
  {
    id: "feb25-ceo1",
    title: "CEO Daily #1: Set March OKRs & Approve Content Calendar",
    description: "Define March Objectives and Key Results across growth, retention, and brand awareness. Review and sign off on the AI-generated content calendar for the next 2 weeks. Confirm budget allocation for paid amplification.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-25",
  },
  {
    id: "feb25-ceo2",
    title: "CEO Daily #2: Competitor Intelligence Brief — Strategy Adjustment",
    description: "Review today's competitor intelligence brief generated by GeoVera. Identify any strategic moves by key competitors that require a response. Adjust CMO agent priorities for the next 48 hours based on findings.",
    agent: "CEO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-25",
  },

  // ══════════════════════════════════════════════════════
  // FEB 26 — PREMIUM DAILY
  // ══════════════════════════════════════════════════════
  {
    id: "feb26-medium",
    title: "Medium Article: How to Build a Brand Voice Your Audience Remembers",
    description: "1000-word guide on defining and maintaining a consistent brand voice across all channels. Include a simple framework: Personality → Tone → Language rules. Use GeoVera's brand DNA storytelling as a case example.",
    agent: "CMO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-26",
    platform: "Blog",
    content: {
      caption: "Your brand voice is the one thing AI can replicate from you — but only if you define it first. Here's a simple 3-step framework.",
      hashtags: ["#BrandVoice", "#ContentStrategy", "#BrandBuilding", "#MarketingFramework"],
    },
  },
  {
    id: "feb26-reddit",
    title: "Reddit: r/Entrepreneur — 'Share your biggest marketing win this month'",
    description: "Post an engaging community thread starter in r/Entrepreneur. Share a genuine marketing win (e.g., a campaign insight from GeoVera's AI), invite others to share theirs. Community-building post, not promotional. Drive upvotes and comments.",
    agent: "CMO",
    priority: "low",
    impact: 1,
    dueDate: "2026-02-26",
    platform: "Blog",
    content: {
      caption: "Our biggest marketing win this month: switching from manual competitor research to AI analysis cut our research time by 80%. What's yours?",
      hashtags: ["#Reddit", "#Entrepreneur", "#MarketingWin"],
    },
  },
  {
    id: "feb26-linkedin",
    title: "LinkedIn Post: Friday Wrap — Weekly Marketing Insights",
    description: "Post a Friday wrap-up LinkedIn update with 3 marketing insights from the week. Data-driven, professional tone. End with 'What was your biggest marketing insight this week?' to drive comments from marketing professionals.",
    agent: "CMO",
    priority: "medium",
    impact: 1,
    dueDate: "2026-02-26",
    platform: "Blog",
    content: {
      caption: "3 marketing insights from this week: 1. Short-form video reach is up 34% YoY. 2. Thought leadership posts drive 5× more inbound than promotional posts. 3. Brands replying to comments within 1hr see +22% follower growth.",
      hashtags: ["#FridayInsights", "#MarketingTips", "#LinkedInCreator"],
    },
  },
  {
    id: "feb26-x",
    title: "X Post: Friday — What Worked This Week",
    description: "Post a short 'week in review' X post sharing 1 marketing insight, 1 result, and 1 thing to try next week. Transparent and data-driven. Format as a quick list.",
    agent: "CMO",
    priority: "medium",
    impact: 1,
    dueDate: "2026-02-26",
    platform: "X (Twitter)",
    content: {
      caption: "This week:\n✅ Instagram reach +28%\n✅ Medium article: 4.2K reads\n✅ Reels: 12K views\n⚡ Next week: testing long-form X threads\nWhat worked for you?",
      hashtags: ["#MarketingReview", "#WeeklyWins", "#GrowthMarketing"],
    },
  },
  {
    id: "feb26-ig1",
    title: "Instagram Post: Weekend Inspiration — Brand Quote Card",
    description: "Create a beautifully designed quote card using GeoVera brand colors. Feature a compelling brand-building or marketing quote. High save potential. Use minimal design, bold typography. Caption: 1–2 lines + CTA to save.",
    agent: "CMO",
    priority: "low",
    impact: 1,
    dueDate: "2026-02-26",
    platform: "Instagram",
    content: {
      caption: "\"The best marketing doesn't feel like marketing.\" — Save this for Monday motivation 💚",
      hashtags: ["#MarketingQuotes", "#BrandBuilding", "#WeekendVibes", "#GeoVera"],
    },
  },
  {
    id: "feb26-ig2",
    title: "Instagram Post #2: Community Question — Weekend Engagement",
    description: "Post an interactive Instagram feed post for the weekend. Use an open question to drive comment engagement when organic reach peaks on weekends. Topic: brand challenges or goals for next week.",
    agent: "CMO",
    priority: "low",
    impact: 1,
    dueDate: "2026-02-26",
    platform: "Instagram",
    content: {
      caption: "What's your #1 brand goal for next week? Drop it below 👇 We'll give you a personalized tip for each one.",
      hashtags: ["#BrandGoals", "#CommunityFirst", "#MarketingChat", "#GeoVera"],
    },
  },
  {
    id: "feb26-tiktok",
    title: "TikTok: Tren Konten Indonesia Maret 2026 — Analisis AI GeoVera",
    description: "Buat TikTok 45–55 detik tentang tren konten Indonesia bulan Maret 2026 berdasarkan analisis AI GeoVera. Format: 3 tren utama dengan data visual, on-screen text, hook 'brand kamu sudah siap?'. Gunakan trending audio yang relevan.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-26",
    platform: "TikTok",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop",
    content: {
      caption: "GeoVera AI sudah analisis 50.000+ konten TikTok Indonesia untuk Maret 2026. Hasilnya? Ada 5 format konten yang akan MELEDAK bulan depan! 📊🚀\n\nBrand kamu sudah siap memanfaatkan tren ini?",
      hashtags: ["#TrendAnalysis", "#TikTokTrends", "#MarketingIntelligence", "#GeoVera", "#Indonesia2026", "#ContentMarketing"],
    },
  },
  {
    id: "feb26-ceo1",
    title: "CEO Daily #1: Weekly Performance Review & Agent Briefing",
    description: "Review all agent outputs from this week. Score quality, engagement results, and strategic alignment. Brief the CMO agent on next week's content themes based on market intelligence. Approve the 5-day plan for Mar 2–6.",
    agent: "CEO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-26",
  },
  {
    id: "feb26-ceo2",
    title: "CEO Daily #2: Monthly Closing — Revenue & Growth Summary",
    description: "Compile end-of-week growth summary: follower growth, content reach, lead pipeline, and brand mention volume. Identify the top 3 growth drivers this week. Prepare a brief for the monthly review on Feb 28.",
    agent: "CEO",
    priority: "medium",
    impact: 2,
    dueDate: "2026-02-26",
  },

  // ══════════════════════════════════════════════════════
  // FEB 28 — END OF MONTH (YouTube Video — Enterprise)
  // ══════════════════════════════════════════════════════
  {
    id: "feb28-youtube",
    title: "YouTube Video: 'How GeoVera Builds a Full Brand Strategy in 24 Hours' (Monthly Special)",
    description: "Produce the monthly flagship YouTube video (8–15 min). Deep-dive walkthrough of GeoVera's AI pipeline: from brand onboarding → market analysis → content generation → publishing. Include real screen recordings, voiceover, and B-roll. This is the highest-production piece of the month — plan, script, record, edit, and publish.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-28",
    platform: "YouTube",
    imageUrl: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?w=600&h=400&fit=crop",
    content: {
      caption: "Every month, we document how GeoVera builds a complete brand marketing strategy from scratch — in 24 hours. February edition: watch the full AI pipeline in action.",
      hashtags: ["#YouTube", "#GeoVera", "#AIMarketing", "#BrandStrategy", "#MonthlyContent", "#LongFormContent"],
      imageUrl: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?w=600&h=400&fit=crop",
    },
  },
  {
    id: "feb28-ceo1",
    title: "CEO Monthly: Full Performance Report — February Recap",
    description: "Generate and review the full February performance report across all channels: Instagram, TikTok, Reels, Shorts, Medium, LinkedIn, X, Quora, Reddit. Summarize total reach, engagement rate, top content, and growth vs January. Share insights with stakeholders.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-28",
  },
  {
    id: "feb28-ceo2",
    title: "CEO Monthly: March Strategy & Budget Planning",
    description: "Based on February performance data, define the full March content and growth strategy. Set budget allocation across organic, paid, and influencer channels. Define March OKRs and share with all agents. This is the most important strategic task of the month.",
    agent: "CEO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-28",
  },

  // ══════════════════════════════════════════════════════
  // LATE — Daily Reply Queue (per day)
  // Premium: top 100 comments, mix Instagram + TikTok + X
  // Replies drafted by Late, adapted by OpenAI
  // User reviews drafts → approve/edit/reject → publish
  // ══════════════════════════════════════════════════════
  {
    id: "feb23-late-reply",
    title: "Late: Review & Publish Top 100 Reply Queue",
    description: "Late has pulled today's top 100 priority comments from Instagram, TikTok, and X — ranked by author influence score, comment sentiment, and engagement potential. Each reply has been drafted by Late and adapted by OpenAI to sound natural and on-brand. Review drafts, edit if needed, approve, and publish in one click.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-23",
    taskType: "reply",
    platform: "Multi-platform",
    replyQueue: [
      { id: "r1", platform: "Instagram", platformIcon: "📸", author: "brandlover.id", authorScore: 96, comment: "This is exactly what I've been looking for! How do I get started with GeoVera?", draftReply: "So glad to hear that! Getting started is super easy — just head to geovera.xyz and you can be up and running in minutes. We'd love to have you 🌿 Feel free to DM us if you have any questions!", status: "pending" },
      { id: "r2", platform: "TikTok", platformIcon: "🎵", author: "marketingwithria", authorScore: 91, comment: "I've been manually doing all of this for years and it takes so much time 😭 game changer fr", draftReply: "We hear you — hours every week just gone 😩 That's exactly why we built GeoVera. Your time is better spent on strategy, not execution. Give it a try and let us know what you think! 💪", status: "pending" },
      { id: "r3", platform: "Instagram", platformIcon: "📸", author: "cmo.jakarta", authorScore: 89, comment: "What's the difference between Basic and Premium? Worth upgrading?", draftReply: "Great question! Premium unlocks your full AI team — CMO, CEO, Reels generation, LinkedIn posts, and multi-platform reply automation. If you're serious about growing your brand, Premium is absolutely worth it. DM us for a quick walkthrough! 😊", status: "pending" },
      { id: "r4", platform: "X (Twitter)", platformIcon: "𝕏", author: "startupfounder_id", authorScore: 87, comment: "Genuinely curious — does the AI actually sound like my brand or is it generic?", draftReply: "That's the most important question! GeoVera trains on your brand DNA — your voice, tone, story, and style. Every output is adapted through OpenAI to sound like you, not like a robot. We'd love to show you a demo 🎯", status: "pending" },
      { id: "r5", platform: "Instagram", platformIcon: "📸", author: "digitalmarketer.sg", authorScore: 85, comment: "This is fire 🔥 sharing with my whole team right now", draftReply: "You're amazing, thank you so much! 🙌 Hope your team loves it as much as you do. Tag us when you share — we'd love to see the reaction! 🌿", status: "pending" },
      { id: "r6", platform: "TikTok", platformIcon: "🎵", author: "contentcreator.bali", authorScore: 82, comment: "Can GeoVera handle multiple brands at once or just one?", draftReply: "Currently GeoVera is optimized for one brand per account, so each brand gets the full focused attention it deserves. Multi-brand support is on our roadmap though! 🗺️ Stay tuned and keep an eye on our updates.", status: "pending" },
      { id: "r7", platform: "Instagram", platformIcon: "📸", author: "umkmjakarta", authorScore: 80, comment: "Apakah ada versi Bahasa Indonesia? Kami UMKM lokal nih 🙏", draftReply: "Halo! Senang sekali ada UMKM lokal yang tertarik 🇮🇩 GeoVera sudah mendukung konten dalam Bahasa Indonesia. Brand DNA dan semua output bisa disesuaikan dengan bahasa dan tone yang paling cocok untuk bisnismu. Coba dulu gratis ya! 🌿", status: "pending" },
      { id: "r8", platform: "X (Twitter)", platformIcon: "𝕏", author: "techblogger.asia", authorScore: 77, comment: "How is this different from just using ChatGPT with a prompt?", draftReply: "Great question — ChatGPT is a tool, GeoVera is a full marketing system. We combine Perplexity research, Gemini indexing, Claude analysis, and GPT-4o editorial into one automated pipeline. Plus your brand DNA, competitor intelligence, and a content calendar. Very different! 🔧", status: "pending" },
    ],
  },
  {
    id: "feb24-late-reply",
    title: "Late: Review & Publish Top 100 Reply Queue",
    description: "Today's top 100 priority comments pulled from Instagram, TikTok, and X. Ranked by: author influence score (1–100), positive sentiment weight, and engagement velocity. Replies drafted by Late + adapted by OpenAI for natural brand voice. Review, approve, and publish.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-24",
    taskType: "reply",
    platform: "Multi-platform",
    replyQueue: [
      { id: "r24-1", platform: "Instagram", platformIcon: "📸", author: "founderstory.id", authorScore: 94, comment: "Just signed up after watching your Reels. Love the concept!", draftReply: "Welcome to the GeoVera family! 🎉 You're going to love what your brand can do with an AI team by its side. Don't hesitate to reach out if you need any help getting set up — we're here for you! 🌿", status: "pending" },
      { id: "r24-2", platform: "TikTok", platformIcon: "🎵", author: "agencyowner.sg", authorScore: 90, comment: "Do you have an agency plan? I manage 10+ clients", draftReply: "We love hearing from agency owners! Agency/multi-client plans are on the roadmap 🚀 In the meantime, DM us — we'd love to explore how we can support your workflow right now. Let's chat! 💼", status: "pending" },
      { id: "r24-3", platform: "Instagram", platformIcon: "📸", author: "ecommerceid", authorScore: 88, comment: "Can this help with product launches specifically?", draftReply: "100% yes! Product launches are one of GeoVera's strongest use cases. Your AI CMO can plan the full launch content calendar, create the posts, write articles, and even auto-reply to comments on launch day. Game-changing for e-commerce 🚀", status: "pending" },
      { id: "r24-4", platform: "X (Twitter)", platformIcon: "𝕏", author: "martech.analyst", authorScore: 84, comment: "Interesting stack — what models are under the hood?", draftReply: "We love a good tech question 🤓 GeoVera runs a multi-model pipeline: Perplexity for discovery, Gemini for indexing, Claude for analysis, and GPT-4o for editorial + reply adaptation. Each step is optimized for what that model does best. Happy to go deeper if interested!", status: "pending" },
      { id: "r24-5", platform: "Instagram", platformIcon: "📸", author: "brandstrategy.co", authorScore: 81, comment: "The Brand DNA concept is brilliant. How does onboarding work?", draftReply: "Thank you so much! 🙏 Onboarding takes about 10 minutes — you fill in your brand story, values, tone, and upload your assets. From there, GeoVera trains everything into your Brand DNA and all outputs are personalized to your unique voice. Clean and simple!", status: "pending" },
      { id: "r24-6", platform: "TikTok", platformIcon: "🎵", author: "influencer.market", authorScore: 78, comment: "Does it work for personal brands too or just businesses?", draftReply: "Perfect for personal brands! 🌟 Whether you're a creator, coach, consultant, or founder — GeoVera helps you build a consistent, powerful personal brand across every platform. Your story, amplified by AI. Give it a try!", status: "pending" },
    ],
  },
  {
    id: "feb25-late-reply",
    title: "Late: Review & Publish Top 100 Reply Queue",
    description: "Today's top 100 priority comments across connected platforms. Late ranks by: verified/high-follower accounts first, then sentiment score, then comment quality. Each draft reply adapted by OpenAI to match your brand DNA and sound naturally human. Review queue and publish approved replies.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-25",
    taskType: "reply",
    platform: "Multi-platform",
    replyQueue: [
      { id: "r25-1", platform: "Instagram", platformIcon: "📸", author: "startup.jakarta", authorScore: 93, comment: "We've been using GeoVera for 2 weeks and our engagement doubled. Not kidding.", draftReply: "This made our whole team smile 😊 Two weeks and 2× engagement — you're proof that the system works! Would love to feature your story (with permission of course). DM us? 🌿", status: "pending" },
      { id: "r25-2", platform: "TikTok", platformIcon: "🎵", author: "growthhacker.id", authorScore: 91, comment: "Is there a free trial or do I have to commit immediately?", draftReply: "We have a free onboarding experience so you can see GeoVera in action before committing! Head to geovera.xyz to get started — no credit card required for the initial setup. Try it out and see for yourself 🎯", status: "pending" },
      { id: "r25-3", platform: "Instagram", platformIcon: "📸", author: "fashionbrand.bali", authorScore: 86, comment: "Will GeoVera work for fashion/lifestyle brands specifically?", draftReply: "Fashion and lifestyle is one of our best fits! 👗 GeoVera's visual content planning, aesthetic-aware captions, and trend monitoring are made for brands like yours. Your LoRA-trained models even let us generate images that match your actual products. Perfect combo!", status: "pending" },
      { id: "r25-4", platform: "X (Twitter)", platformIcon: "𝕏", author: "saas.builder", authorScore: 83, comment: "Building something similar. Curious about your approach to brand voice consistency.", draftReply: "Love that you're building! Brand voice consistency is our core obsession 🎯 We solve it with Brand DNA — a persistent profile of your tone, personality, language patterns, and storytelling style. Every AI output passes through that filter before it reaches you. Happy to compare notes!", status: "pending" },
      { id: "r25-5", platform: "Instagram", platformIcon: "📸", author: "marketingdirector", authorScore: 80, comment: "How many posts can the AI generate per day?", draftReply: "On Premium, your AI team generates 7+ pieces of content daily — 2 long articles, 2 short posts, 2 Instagram posts, and 1 Reels/TikTok/Shorts. Plus your CEO handles 2 strategic tasks. All reviewed by you before publishing. Volume without the chaos! 📅", status: "pending" },
    ],
  },
  {
    id: "feb26-late-reply",
    title: "Late: Review & Publish Top 100 Reply Queue",
    description: "End-of-week reply queue — today's top 100 priority comments from all connected platforms. Weekend comments tend to come from highly engaged followers and casual browsers. Late has prioritized warm, community-building tones. OpenAI has adapted each reply to feel conversational and genuine. Review and publish before EOD.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-26",
    taskType: "reply",
    platform: "Multi-platform",
    replyQueue: [
      { id: "r26-1", platform: "Instagram", platformIcon: "📸", author: "weekendfounder", authorScore: 88, comment: "Just discovered GeoVera through a friend. Is this real or too good to be true? 😅", draftReply: "Haha we get this a lot! 😄 It's very real — and the best way to see for yourself is to try it. Head to geovera.xyz for a free look. We think you'll be impressed. Your friend has good taste! 🌿", status: "pending" },
      { id: "r26-2", platform: "TikTok", platformIcon: "🎵", author: "fridaymktg", authorScore: 85, comment: "What's your biggest differentiator vs Hootsuite, Buffer, etc?", draftReply: "Great question! Hootsuite and Buffer help you schedule content you've already created. GeoVera actually creates the content for you — articles, captions, visuals, replies — using AI trained on your brand. It's the difference between a tool and a team. 🤝", status: "pending" },
      { id: "r26-3", platform: "Instagram", platformIcon: "📸", author: "brandcoach.asia", authorScore: 82, comment: "I recommend this to all my clients now. Keep it up! 💚", draftReply: "This is the best kind of comment to end the week with 💚 Thank you so much — your support and recommendations genuinely mean the world to us. If there's ever anything we can do for you or your clients, we're always here!", status: "pending" },
      { id: "r26-4", platform: "X (Twitter)", platformIcon: "𝕏", author: "digitalstrategy.io", authorScore: 79, comment: "How do you handle brand safety and off-brand content?", draftReply: "Brand safety is built into every layer of GeoVera 🛡️ Your Brand DNA acts as a guardrail — no output goes live without passing through your voice and value filters. Plus you review and approve every piece before it publishes. You're always in control.", status: "pending" },
      { id: "r26-5", platform: "Instagram", platformIcon: "📸", author: "smm.freelancer", authorScore: 75, comment: "Will this replace my job as a social media manager? 😬", draftReply: "Not at all — it changes your job for the better! 🙌 Instead of spending 80% of your time on execution (writing, scheduling, replying), GeoVera handles that so you can focus on strategy, client relationships, and the creative work that actually moves the needle. You become the director, not the doer.", status: "pending" },
    ],
  },
  {
    id: "feb28-late-reply",
    title: "Late: End-of-Month Review — Top 150 Reply Queue",
    description: "End-of-month special: top 150 priority comments pulled from all platforms including the YouTube Video published today. February's most important community interactions — including comments on the monthly video, high-value DM mentions, and verified account replies. Late + OpenAI adapted replies for warm, brand-authentic tone. This queue has the highest potential impact of the month.",
    agent: "CMO",
    priority: "high",
    impact: 3,
    dueDate: "2026-02-28",
    taskType: "reply",
    platform: "Multi-platform",
    replyQueue: [
      { id: "r28-1", platform: "Instagram", platformIcon: "📸", author: "verified.brand.id", authorScore: 99, comment: "We've been watching GeoVera grow all month. Incredible journey — let's collab!", draftReply: "Wow, this means a lot coming from you 🙏 We've been huge fans of your work too. Absolutely open to exploring a collaboration — this could be something really special. DM us directly and let's make it happen! 💚", status: "pending" },
      { id: "r28-2", platform: "TikTok", platformIcon: "🎵", author: "viralcreator.id", authorScore: 95, comment: "Your YouTube video was insane. The AI pipeline walkthrough blew my mind.", draftReply: "Thank you so much! 🤯 We wanted to pull back the curtain and show exactly how the intelligence layer works. So glad it landed! More deep-dives coming next month — make sure you're subscribed so you don't miss them 🎬", status: "pending" },
      { id: "r28-3", platform: "Instagram", platformIcon: "📸", author: "marketing.kol", authorScore: 92, comment: "Just signed up for Premium after seeing the February results. You earned it.", draftReply: "Welcome to Premium! 🎉 You're in for a completely different experience. Your full AI team — CEO + CMO + Late — is now active. Reach out anytime if you need help setting things up. So excited to see your brand grow! 🌿", status: "pending" },
      { id: "r28-4", platform: "X (Twitter)", platformIcon: "𝕏", author: "vc.analyst.sea", authorScore: 90, comment: "Interesting product. What's your moat long term?", draftReply: "Great question for end of month 😄 Our moat is Brand DNA — the deeper a brand uses GeoVera, the more personalized and accurate the AI becomes. It's a compounding advantage. Plus our multi-model pipeline is continuously upgraded. The product gets smarter as you use it.", status: "pending" },
      { id: "r28-5", platform: "Instagram", platformIcon: "📸", author: "startup.mentor.id", authorScore: 87, comment: "February was clearly a big month for you. What's March looking like?", draftReply: "March is going to be even bigger! 🚀 We're rolling out some major new features and expanding platform integrations. Follow along — you won't want to miss what's coming. February was just the beginning 💪", status: "pending" },
      { id: "r28-6", platform: "TikTok", platformIcon: "🎵", author: "contentfarm.creator", authorScore: 83, comment: "How do I know the AI replies won't sound robotic?", draftReply: "That's the most important question and we take it very seriously 🎯 Every reply goes through two layers: Late drafts it based on your brand DNA, then OpenAI adapts it to sound natural, warm, and genuinely human. You also review everything before it posts. Zero robot vibes, guaranteed.", status: "pending" },
    ],
  },
];

// ── TikTok helpers ────────────────────────────────────────────────────────────
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return { verifier, challenge };
}

const TikTokIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.74a4.85 4.85 0 0 1-1.01-.05z" />
  </svg>
);

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, { cls: string; label: string }> = {
    published: { cls: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400", label: "✓ Published" },
    scheduled: { cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",   label: "⏰ Scheduled" },
    draft:     { cls: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400", label: "Draft" },
    failed:    { cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",       label: "⚠ Failed" },
  };
  const { cls, label } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function TikTokPhoneMockup({ post, caption, hashtags }: {
  post: TikTokPost; caption: string; hashtags: string[];
}) {
  return (
    <div className="flex justify-center py-3">
      <div className="relative w-[160px] h-[284px] rounded-[20px] overflow-hidden shadow-2xl border-[3px] border-gray-800" style={{ background: "#000" }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${post.accentColor}bb 0%, #111 65%)` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <span className="text-white/60 text-lg ml-0.5">▶</span>
          </div>
        </div>
        <div className="absolute top-0 inset-x-0 flex justify-between items-start px-2 pt-2">
          <span className="text-white/70 text-[7px] font-medium">Following &nbsp;|&nbsp; For You</span>
          <span className="text-white/70 text-[9px]">🔍</span>
        </div>
        <div className="absolute top-7 right-2 bg-black/50 rounded px-1 py-0.5">
          <span className="text-white text-[7px]">{post.duration}</span>
        </div>
        <div className="absolute bottom-0 inset-x-0 px-2 pb-8">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-4 h-4 rounded-full bg-gray-500 border border-gray-400 flex-shrink-0" />
            <span className="text-white text-[8px] font-bold">@geovera.id</span>
          </div>
          <p className="text-white text-[7px] leading-tight line-clamp-3 mb-1">{caption}</p>
          <p className="text-[#25F4EE] text-[7px] leading-tight truncate">{hashtags.slice(0,3).join(" ")}</p>
        </div>
        <div className="absolute right-1.5 bottom-10 flex flex-col items-center gap-2.5">
          {[
            { icon: "♥", val: post.likes || "24.1K" },
            { icon: "💬", val: "1.8K" },
            { icon: "↗",  val: "Share" },
          ].map(({ icon, val }) => (
            <div key={val} className="flex flex-col items-center">
              <span className="text-white text-[11px]">{icon}</span>
              <span className="text-white/70 text-[6px] mt-0.5">{val}</span>
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 inset-x-0 h-7 bg-black/70 flex items-center justify-around px-3">
          {["🏠","🔍","＋","📬","👤"].map((ic, i) => (
            <span key={i} className={`text-[10px] ${i === 2 ? "text-white" : "text-white/50"}`}>{ic}</span>
          ))}
        </div>
        {post.views && (
          <div className="absolute top-7 left-2 bg-black/50 rounded px-1 py-0.5 flex items-center gap-0.5">
            <span className="text-white/80 text-[6px]">▶</span>
            <span className="text-white text-[7px] font-medium">{post.views}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type TaskFilter = "inprogress" | "done" | "rejected";
type SubTab = "content" | "comments" | "others";

// 7D window: 3 days back + today + 3 days ahead
const getMaxDateStr = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
};
const getMinDateStr = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
};

export default function CalendarPage() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().slice(0, 10) // default to today
  );
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [rejectedTaskIds, setRejectedTaskIds] = useState<Set<string>>(new Set());
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("inprogress");
  const [subTab, setSubTab] = useState<SubTab>("content");
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

  // Connected platforms from localStorage (set by Home page toggles)
  const [lsConnectedIds, setLsConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      try {
        const ids: string[] = JSON.parse(localStorage.getItem("gv_connections") || "[]");
        setLsConnectedIds(new Set(ids));
      } catch { setLsConnectedIds(new Set()); }
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  // Non-OAuth platforms never need a social connection
  const OAUTH_PLATFORMS = new Set(["tiktok", "instagram", "facebook", "youtube", "linkedin", "x", "threads"]);
  const isPlatformConnected = (platform: string) => {
    const key = platform.toLowerCase().replace(/\s.*/, ""); // "X (Twitter)" → "x"
    if (!OAUTH_PLATFORMS.has(key)) return true; // Blog, Quora, Reddit etc. always OK
    return lsConnectedIds.has(key);
  };

  // TikTok post state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [posts, setPosts] = useState<TikTokPost[]>(DEMO_TIKTOK_POSTS);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<"idle"|"connecting"|"uploading"|"success">("idle");
  const [postToast, setPostToast] = useState<{ type: "success"|"error"; msg: string }|null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHashtags, setEditHashtags] = useState("");

  // Connected platforms from Supabase
  const [connectedPlatforms, setConnectedPlatforms] = useState<{ platform: string; handle?: string; auto_reply_enabled: boolean }[]>([]);
  const [autoReplyCount, setAutoReplyCount] = useState(0);

  // Auto-open right panel when on comments tab (shows comment groups)
  useEffect(() => {
    if (subTab === "comments") setMobileRightOpen(true);
  }, [subTab]);

  // Auto-reply section UI state
  const [arEditId, setArEditId] = useState<string | null>(null);
  const [arEditText, setArEditText] = useState("");
  const [arApprovedIds, setArApprovedIds] = useState<Set<string>>(new Set());
  const [arSentIds, setArSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("social_connections")
      .select("platform, platform_username, auto_reply_enabled")
      .eq("brand_id", DEMO_BRAND_ID)
      .eq("status", "active")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setConnectedPlatforms(data.map((c) => ({
            platform: c.platform,
            handle: c.platform_username || undefined,
            auto_reply_enabled: c.auto_reply_enabled ?? false,
          })));
          setAutoReplyCount(data.filter((c) => c.auto_reply_enabled).length);
        }
      });
  }, []);

  // Save approved replies to reply_queue table
  const handlePublishReplies = useCallback(async (taskId: string, replies: ReplyComment[]): Promise<{ queued: number }> => {
    const rows = replies.map((r) => ({
      brand_id: DEMO_BRAND_ID,
      task_id: taskId,
      platform: r.platform,
      platform_icon: r.platformIcon,
      author: r.author,
      author_score: r.authorScore,
      original_comment: r.comment,
      draft_reply: r.draftReply,
      status: "queued",
    }));

    const { error, data } = await supabase.from("reply_queue").insert(rows).select("id");
    if (error) throw new Error(error.message);
    return { queued: data?.length ?? rows.length };
  }, []);

  // Mobile: open right panel when task selected
  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
    setSelectedPostId(null);
    setMobileRightOpen(true);
  };
  const handleMobileBack = () => {
    setMobileRightOpen(false);
    setSelectedTask(null);
    setSelectedPostId(null);
  };

  const maxDateStr = useMemo(() => getMaxDateStr(), []);
  const minDateStr = useMemo(() => getMinDateStr(), []);

  const taskDates = useMemo(() => demoTasks.map((t) => t.dueDate), []);

  // Base filter: selected date, or full 7D window (3 back + today + 3 forward)
  const baseTasks = useMemo(() => {
    if (selectedDate) {
      return demoTasks.filter((t) => t.dueDate === selectedDate);
    }
    const minDate = new Date(minDateStr + "T00:00:00");
    const maxDate = new Date(maxDateStr + "T23:59:59");
    return demoTasks.filter((t) => {
      const taskDate = new Date(t.dueDate + "T00:00:00");
      return taskDate >= minDate && taskDate <= maxDate;
    });
  }, [selectedDate, minDateStr, maxDateStr]);

  // Split by sub-tab type
  const contentTasks = useMemo(() =>
    baseTasks.filter((t) => t.taskType !== "reply" && t.agent !== "CEO"),
  [baseTasks]);
  const commentTasks = useMemo(() =>
    baseTasks.filter((t) => t.taskType === "reply"),
  [baseTasks]);
  const othersTasks = useMemo(() =>
    baseTasks.filter((t) => t.agent === "CEO"),
  [baseTasks]);

  // Aggregate replyQueue items from commentTasks for auto-reply sections
  const allReplyItems = useMemo(
    () => commentTasks.flatMap((t) => t.replyQueue || []),
    [commentTasks]
  );
  const humanReplies = useMemo(
    () => allReplyItems.filter((r) => r.authorScore >= 80),
    [allReplyItems]
  );
  const aiReplies = useMemo(
    () => allReplyItems.filter((r) => r.authorScore < 80),
    [allReplyItems]
  );

  // Active sub-tab tasks (for filter pill counts)
  const activeBucket = subTab === "content" ? contentTasks : subTab === "comments" ? commentTasks : othersTasks;
  const activeTasks   = activeBucket.filter((t) => !doneTaskIds.has(t.id) && !rejectedTaskIds.has(t.id));
  const doneTasks     = activeBucket.filter((t) => doneTaskIds.has(t.id));
  const rejectedTasks = activeBucket.filter((t) => rejectedTaskIds.has(t.id));

  const highTasks   = activeTasks.filter((t) => t.priority === "high");
  const mediumTasks = activeTasks.filter((t) => t.priority === "medium");
  const lowTasks    = activeTasks.filter((t) => t.priority === "low");

  const handleDateSelect = (date: string) => {
    setSelectedDate(selectedDate === date ? null : date);
    setSelectedTask(null);
    setSelectedPostId(null);
  };

  const handlePublish = useCallback(async (
    taskId: string,
    options?: { publishNow?: boolean; scheduledFor?: string }
  ) => {
    const task = demoTasks.find((t) => t.id === taskId);
    const platform = (task?.platform || "instagram").toLowerCase();
    const caption = task?.content?.caption || task?.description || "";
    const hashtags = task?.content?.hashtags || [];

    try {
      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: DEMO_BRAND_ID,
          platform,
          content: caption,
          hashtags,
          publish_now: options?.publishNow ?? true,
          scheduled_for: options?.scheduledFor,
        }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) {
        throw new Error(data.error || "Publish failed");
      }
    } catch (err) {
      // Re-throw so TaskDetailPanel can show the error
      throw err;
    }

    // Mark done in UI only after successful publish
    setDoneTaskIds((prev) => new Set([...prev, taskId]));
  }, []);

  const handleReject = (taskId: string, reason: string) => {
    setRejectedTaskIds((prev) => new Set([...prev, taskId]));
    setRejectionReasons((prev) => ({ ...prev, [taskId]: reason }));
    setSelectedTask(null);
    // In production: POST to Supabase training_data table with task + reason
    console.log("[GeoVera] Rejected task:", taskId, "reason:", reason, "→ training data");
  };

  // ── TikTok post handlers ─────────────────────────────────────────────────
  const selectedPost = posts.find(p => p.id === selectedPostId) ?? null;

  useEffect(() => {
    if (selectedPost) {
      setEditCaption(selectedPost.caption);
      setEditHashtags(selectedPost.hashtags.join(" "));
    }
  }, [selectedPostId]); // eslint-disable-line

  // Check OAuth callback on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("tiktok_connected");
    if (tk === "true") {
      setTiktokConnected(true);
      setPostToast({ type: "success", msg: "TikTok account connected! Ready to publish." });
      setTimeout(() => setPostToast(null), 4500);
      window.history.replaceState({}, "", "/calendar");
    }
  }, []);

  const showPostToast = (type: "success"|"error", msg: string) => {
    setPostToast({ type, msg });
    setTimeout(() => setPostToast(null), 4500);
  };

  const redirectToTikTokLogin = useCallback(async () => {
    const { verifier, challenge } = await generatePKCE();
    const params = new URLSearchParams({
      client_key:            TIKTOK_CLIENT_KEY || "aw_demo_key",
      response_type:         "code",
      scope:                 "user.info.basic,video.publish,video.upload",
      redirect_uri:          TIKTOK_REDIRECT_URI,
      state:                 `${DEMO_BRAND_ID}:calendar:${verifier}`,
      code_challenge:        challenge,
      code_challenge_method: "S256",
    });
    window.location.href = `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }, []);

  const runDemoPublish = useCallback(async () => {
    if (!selectedPost) return;
    setPublishing(true);
    setPublishStep("connecting");
    await new Promise(r => setTimeout(r, 900));
    setPublishStep("uploading");
    await new Promise(r => setTimeout(r, 1400));
    setPublishStep("success");
    await new Promise(r => setTimeout(r, 800));
    setPosts(prev => prev.map(p =>
      p.id === selectedPost.id ? { ...p, status: "published" as PostStatus } : p
    ));
    showPostToast("success", "✅ Post berhasil dikirim ke TikTok!");
    setPublishing(false);
    setPublishStep("idle");
  }, [selectedPost]); // eslint-disable-line

  const handlePostPublish = useCallback(async () => {
    if (!selectedPost) return;
    runDemoPublish();
  }, [selectedPost, runDemoPublish]);

  const publishBtnLabel = () => {
    if (publishStep === "connecting") return <>🔗 Connecting to TikTok…</>;
    if (publishStep === "uploading")  return <>⬆ Uploading video…</>;
    if (publishStep === "success")    return <>✅ Published!</>;
    if (selectedPost?.status === "published") return <>✓ Published to TikTok</>;
    return <><TikTokIcon size={16} /> Publish to TikTok</>;
  };

  const handlePostSelect = (post: TikTokPost) => {
    setSelectedPostId(post.id);
    setSelectedTask(null);
    setMobileRightOpen(true);
  };

  const left = (
    <NavColumn>
      {/* Calendar widget — desktop only (mobile uses floating FAB) */}
      <div className="hidden lg:block">
        <h3
          className="text-sm font-semibold px-1"
          style={{ fontFamily: "var(--gv-font-heading)", color: "var(--gv-color-neutral-900)" }}
        >
          Calendar
        </h3>

        {/* Show selected date info below heading */}
        {selectedDate ? (
          <div className="px-1 mt-1 mb-3">
            <p className="text-xs font-medium" style={{ color: "var(--gv-color-primary-600)" }}>
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
              {baseTasks.length} task{baseTasks.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => { setSelectedDate(null); setSelectedTask(null); }}
              className="text-[10px] mt-1 underline transition-colors"
              style={{ color: "var(--gv-color-neutral-400)" }}
            >
              Clear selection
            </button>
          </div>
        ) : (
          <p className="text-xs px-1 mt-1 mb-3" style={{ color: "var(--gv-color-neutral-400)" }}>
            Showing today + 2 days ahead. Tap a date to see history.
          </p>
        )}

        <MiniCalendar
          taskDates={taskDates}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          maxDate={maxDateStr}
          minDate={minDateStr}
        />
      </div>
    </NavColumn>
  );

  // 7-day window: today + 6 days
  const sevenDays = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);
  const todayStr = new Date().toISOString().slice(0, 10);

  const center = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header: title + 7D date window ── */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{
          background: "var(--gv-color-bg-surface)",
          borderBottom: "1px solid var(--gv-color-neutral-200)",
        }}
      >
        {/* Title row + 7D date strip — side by side */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)" }}>
              Tasks
            </h2>
            <span
              className="gv-badge"
              style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-700)" }}
            >
              {activeTasks.length}/{activeBucket.length}
            </span>
          </div>

          {/* 7D gv-date mini calendar strip */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {sevenDays.map((dateStr) => {
              const d = new Date(dateStr + "T00:00:00");
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayName = d.toLocaleDateString("en", { weekday: "short" });
              const dayNum = d.getDate();
              const monthShort = d.toLocaleDateString("en", { month: "short" }).toUpperCase();
              const hasTasks = taskDates.some((td) => td === dateStr);

              /* Variant styles matching gv-date-component.html */
              const headerBg = isSelected
                ? "linear-gradient(135deg, #3D6562 0%, #5F8F8B 100%)"
                : isToday
                ? "var(--gv-gradient-primary)"
                : "var(--gv-color-neutral-200)";
              const monthColor = isSelected
                ? "rgba(255,255,255,0.95)"
                : isToday
                ? "rgba(255,255,255,0.95)"
                : "var(--gv-color-neutral-500)";
              const bodyBg = isSelected
                ? "var(--gv-color-primary-100)"
                : isToday
                ? "var(--gv-color-primary-50)"
                : "var(--gv-color-bg-surface)";
              const dayColor = isSelected
                ? "var(--gv-color-primary-900)"
                : isToday
                ? "var(--gv-color-primary-700)"
                : "var(--gv-color-neutral-400)";
              const cardShadow = "none";

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateSelect(dateStr)}
                  className="flex-shrink-0 flex flex-col items-center gap-0.5 transition-all duration-200"
                  style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
                >
                  {/* Mini gv-date card */}
                  <div
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: cardShadow,
                      width: 52,
                      userSelect: "none",
                    }}
                  >
                    {/* Header — month */}
                    <div
                      style={{
                        background: headerBg,
                        padding: "5px 6px 4px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{
                        fontFamily: "var(--gv-font-heading)",
                        fontWeight: 700,
                        fontSize: 8,
                        color: monthColor,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                      }}>
                        {monthShort}
                      </span>
                    </div>

                    {/* Body — day number + weekday */}
                    <div
                      style={{
                        background: bodyBg,
                        padding: "4px 6px 5px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <span style={{
                        fontFamily: "var(--gv-font-heading)",
                        fontWeight: 800,
                        fontSize: 22,
                        lineHeight: 1,
                        color: dayColor,
                        letterSpacing: "-0.03em",
                      }}>
                        {dayNum}
                      </span>
                      <span style={{
                        fontFamily: "var(--gv-font-body)",
                        fontWeight: 500,
                        fontSize: 8,
                        color: "var(--gv-color-neutral-400)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                      }}>
                        {dayName}
                      </span>
                    </div>
                  </div>

                  {/* Task indicator dot */}
                  {hasTasks && (
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: isSelected
                          ? "var(--gv-color-primary-600)"
                          : isToday
                          ? "var(--gv-color-primary-500)"
                          : "var(--gv-color-neutral-300)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable tasks body ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 pb-3">
        <CycleBanner brandId={DEMO_BRAND_ID} />
        {/* Status Tabs (Segmented) — task-filter-tabs-refined token */}
        <div
          className="flex items-center pt-3 pb-2"
          style={{
            background: "#F3F4F6",
            borderRadius: "var(--gv-radius-full)",
            padding: 4,
            gap: 4,
            height: 44,
          }}
        >
          {(["inprogress", "done", "rejected"] as TaskFilter[]).map((f) => {
            const isActive = taskFilter === f;
            const count =
              f === "inprogress"
                ? activeTasks.length
                : f === "done"
                ? doneTasks.length
                : rejectedTasks.length;
            const label =
              f === "inprogress"
                ? "On Progress"
                : f === "done"
                ? "Done"
                : "Rejected";
            return (
              <button
                key={f}
                onClick={() => setTaskFilter(f)}
                className="flex-1 text-center text-[13px] font-semibold transition-all duration-200"
                style={{
                  borderRadius: "var(--gv-radius-full)",
                  padding: "8px 16px",
                  background: isActive ? "var(--gv-color-bg-surface)" : "transparent",
                  color: isActive ? "var(--gv-color-neutral-900)" : "var(--gv-color-neutral-400)",
                  boxShadow: "none",
                  fontFamily: "var(--gv-font-body)",
                  cursor: "pointer",
                }}
              >
                {label}
                {isActive && <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 4 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Comments tab — Settings (Left Column) */}
        {subTab === "comments" && (
          <div className="py-3 flex flex-col gap-4">

            {/* Heading */}
            <div>
              <p className="text-[15px] font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>Auto Reply Settings</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>
                Configure how comments are classified and replied to
              </p>
            </div>

            {/* Day 1 — Claude analysis trigger */}
            <div
              className="rounded-[var(--gv-radius-md)] p-4"
              style={{ background: "var(--gv-color-primary-50)", border: "1px solid var(--gv-color-primary-200)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AiIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--gv-color-primary-500)" }} />
                <p className="text-[13px] font-semibold" style={{ color: "var(--gv-color-primary-700)" }}>Day 1 — Comment Analysis</p>
              </div>
              <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--gv-color-primary-600)" }}>
                Claude fetches last 300 comments across connected platforms, then classifies into Group 1 (needs human reply) and Group 2 (AI universal reply). Must run before automation starts next day.
              </p>
              <button
                className="w-full py-2.5 text-[13px] font-semibold text-white flex items-center justify-center gap-2"
                style={{ borderRadius: "var(--gv-radius-md)", background: "var(--gv-color-primary-500)" }}
              >
                <AiIcon className="w-4 h-4" /> Analyze Last 300 Comments
              </button>
            </div>

            {/* Connected Platforms & toggles */}
            <div>
              <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--gv-color-neutral-700)" }}>
                Platforms
              </p>
              {connectedPlatforms.length === 0 ? (
                <div
                  className="rounded-[var(--gv-radius-md)] p-3 text-center"
                  style={{ border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}
                >
                  <p className="text-[12px]" style={{ color: "var(--gv-color-neutral-400)" }}>
                    No platforms connected
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedPlatforms.map((p) => (
                    <div
                      key={p.platform}
                      className="flex items-center justify-between rounded-[var(--gv-radius-md)] p-3"
                      style={{ border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}
                    >
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: "var(--gv-color-neutral-800)" }}>
                          {p.handle ? `@${p.handle}` : p.platform}
                        </p>
                        <p className="text-[11px]" style={{ color: p.auto_reply_enabled ? "var(--gv-color-primary-600)" : "var(--gv-color-neutral-400)" }}>
                          {p.auto_reply_enabled ? "Auto-reply ON" : "Manual only"}
                        </p>
                      </div>
                      {/* Toggle switch */}
                      <div
                        className="relative flex-shrink-0"
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: "var(--gv-radius-full)",
                          background: p.auto_reply_enabled ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-200)",
                          transition: "background 0.2s",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: p.auto_reply_enabled ? 18 : 2,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "white",
                            boxShadow: "var(--gv-shadow-card)",
                            transition: "left 0.2s",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Rate Limits */}
            <div
              className="rounded-[var(--gv-radius-md)] p-4"
              style={{ border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-neutral-50)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <BoltIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gv-color-neutral-500)" }} />
                <p className="text-[12px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>AI Reply Rate — Group 2</p>
              </div>
              {[
                { plan: "Partner", rate: "1 reply / 3 min" },
                { plan: "Premium", rate: "1 reply / 5 min" },
                { plan: "Basic",   rate: "1 reply / 10 min" },
              ].map(({ plan, rate }) => (
                <div key={plan} className="flex items-center justify-between mt-2">
                  <p className="text-[12px] font-medium" style={{ color: "var(--gv-color-neutral-700)" }}>{plan}</p>
                  <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-500)" }}>{rate}</p>
                </div>
              ))}
            </div>

          </div>
        )}
        {/* Others tab — CEO tasks */}
        {subTab === "others" && (
          <div className="py-3 space-y-2">
            {othersTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p
                  className="text-[14px] font-medium"
                  style={{ color: "var(--gv-color-neutral-500)" }}
                >
                  No strategy tasks for this date
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {othersTasks
                  .filter(t => taskFilter === "inprogress" ? !doneTaskIds.has(t.id) && !rejectedTaskIds.has(t.id)
                              : taskFilter === "done" ? doneTaskIds.has(t.id)
                              : rejectedTaskIds.has(t.id))
                  .map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskSelect(task)}
                      className="w-full text-left transition-all duration-200"
                      style={{
                        borderRadius: "var(--gv-radius-md)",
                        padding: "12px",
                        border: `1px solid ${selectedTask?.id === task.id ? "var(--gv-color-primary-200)" : "var(--gv-color-neutral-200)"}`,
                        background: selectedTask?.id === task.id ? "var(--gv-color-primary-50)" : "var(--gv-color-bg-surface)",
                        boxShadow: selectedTask?.id === task.id ? "var(--gv-shadow-focus)" : "var(--gv-shadow-card)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="gv-badge"
                          style={{ background: "var(--gv-color-info-50)", color: "var(--gv-color-info-700)" }}
                        >
                          CEO
                        </span>
                        {doneTaskIds.has(task.id) && (
                          <span className="gv-badge gv-badge-success">✓ Done</span>
                        )}
                      </div>
                      <p
                        className="text-[14px] font-semibold leading-snug"
                        style={{ color: "var(--gv-color-neutral-900)" }}
                      >
                        {task.title}
                      </p>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Content tab */}
        {subTab === "content" && (
          <>
            {/* ── ON PROGRESS view ── */}
            {taskFilter === "inprogress" && (
              activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--gv-color-success-50)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--gv-color-success-700)" }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>All tasks completed!</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Switch to Done to review published tasks</p>
                  <button
                    onClick={() => setTaskFilter("done")}
                    className="mt-2 text-[12px] font-medium"
                    style={{ color: "var(--gv-color-primary-500)" }}
                  >
                    View Done →
                  </button>
                </div>
              ) : (
                <>
                  <PrioritySection priority="high" tasks={highTasks} selectedTaskId={selectedTask?.id || null} onTaskSelect={handleTaskSelect} />
                  <PrioritySection priority="medium" tasks={mediumTasks} selectedTaskId={selectedTask?.id || null} onTaskSelect={handleTaskSelect} />
                  <PrioritySection priority="low" tasks={lowTasks} selectedTaskId={selectedTask?.id || null} onTaskSelect={handleTaskSelect} />
                  {/* TikTok posts section */}
                  {(() => {
                    const tikPosts = posts.filter(p =>
                      (!selectedDate || p.date === selectedDate) && p.status !== "published"
                    );
                    if (tikPosts.length === 0) return null;
                    return (
                      <div className="mt-4 first:mt-0">
                        <div className="flex items-center gap-2 mb-1 px-0.5">
                          <TikTokIcon size={10} className="text-[#FE2C55]" />
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#FE2C55" }}>TikTok Posts</h3>
                          <span className="text-[11px] ml-auto tabular-nums" style={{ color: "var(--gv-color-neutral-400)" }}>{tikPosts.length}</span>
                        </div>
                        <div className="space-y-1">
                          {tikPosts.map(post => (
                            <button
                              key={post.id}
                              onClick={() => handlePostSelect(post)}
                              className="w-full text-left transition-all duration-200"
                              style={{
                                borderRadius: "var(--gv-radius-md)",
                                padding: "10px 12px",
                                border: `1px solid ${selectedPostId === post.id ? "#FE2C55" : "var(--gv-color-neutral-200)"}`,
                                background: selectedPostId === post.id ? "rgba(254,44,85,0.04)" : "var(--gv-color-bg-surface)",
                                boxShadow: selectedPostId === post.id ? "0 0 0 3px rgba(254,44,85,0.10)" : "var(--gv-shadow-card)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span
                                      className="gv-badge"
                                      style={{ background: "rgba(254,44,85,0.08)", color: "#FE2C55", fontSize: "10px", height: "20px", padding: "0 6px" }}
                                    >
                                      <TikTokIcon size={8} />
                                      TikTok
                                    </span>
                                    <StatusBadge status={post.status} />
                                  </div>
                                  <h4 className="text-sm font-medium leading-tight" style={{ color: "var(--gv-color-neutral-900)" }}>{post.title}</h4>
                                </div>
                                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1.5" style={{ background: post.accentColor }} />
                              </div>
                              <p className="text-xs line-clamp-2" style={{ color: "var(--gv-color-neutral-500)" }}>{post.caption}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )
            )}

            {/* ── DONE view ── */}
            {taskFilter === "done" && (
              doneTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--gv-color-neutral-100)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--gv-color-neutral-400)" }}>
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--gv-color-neutral-500)" }}>No published tasks yet</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Publish tasks to see them here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {doneTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskSelect(task)}
                      className="w-full text-left transition-all duration-200"
                      style={{
                        opacity: selectedTask?.id === task.id ? 1 : 0.7,
                        borderRadius: "var(--gv-radius-md)",
                        padding: "12px",
                        border: `1px solid ${selectedTask?.id === task.id ? "var(--gv-color-success-500)" : "var(--gv-color-neutral-200)"}`,
                        background: selectedTask?.id === task.id ? "var(--gv-color-success-50)" : "var(--gv-color-bg-surface-sunken)",
                        boxShadow: "var(--gv-shadow-card)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="gv-badge gv-badge-success" style={{ gap: 4 }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                          Published
                        </span>
                        {task.platform && (
                          <span
                            className="gv-badge"
                            style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-500)" }}
                          >
                            {task.platform}
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-[14px] font-medium leading-snug line-through"
                        style={{ color: "var(--gv-color-neutral-400)" }}
                      >
                        {task.title}
                      </h4>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* ── REJECTED view ── */}
            {taskFilter === "rejected" && (
              rejectedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--gv-color-neutral-100)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--gv-color-neutral-400)" }}>
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--gv-color-neutral-500)" }}>No rejected content</p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Rejected tasks are used as AI training data</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Training data notice */}
                  <div
                    className="px-3 py-2 mb-1"
                    style={{
                      borderRadius: "var(--gv-radius-sm)",
                      border: "1px solid var(--gv-color-warning-500)",
                      background: "var(--gv-color-warning-50)",
                    }}
                  >
                    <p className="text-[11px]" style={{ color: "var(--gv-color-warning-700)" }}>
                      🧠 {rejectedTasks.length} rejected task{rejectedTasks.length !== 1 ? "s" : ""} added to AI training data to improve future content generation.
                    </p>
                  </div>
                  {rejectedTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskSelect(task)}
                      className="w-full text-left transition-all duration-200"
                      style={{
                        opacity: selectedTask?.id === task.id ? 1 : 0.7,
                        borderRadius: "var(--gv-radius-md)",
                        padding: "12px",
                        border: `1px solid ${selectedTask?.id === task.id ? "var(--gv-color-danger-500)" : "var(--gv-color-neutral-200)"}`,
                        background: selectedTask?.id === task.id ? "var(--gv-color-danger-50)" : "var(--gv-color-bg-surface-sunken)",
                        boxShadow: "var(--gv-shadow-card)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="gv-badge gv-badge-danger">✕ Rejected</span>
                        {rejectionReasons[task.id] && (
                          <span
                            className="gv-badge"
                            style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-500)", textTransform: "capitalize" }}
                          >
                            {rejectionReasons[task.id]}
                          </span>
                        )}
                        {task.platform && (
                          <span
                            className="gv-badge"
                            style={{ background: "var(--gv-color-neutral-100)", color: "var(--gv-color-neutral-400)" }}
                          >
                            {task.platform}
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-[14px] font-medium leading-snug line-through"
                        style={{ color: "var(--gv-color-neutral-400)" }}
                      >
                        {task.title}
                      </h4>
                    </button>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* ── Mobile: Floating calendar button (bottom-right, above tab bar) ── */}
      <div className="lg:hidden">
        {/* Floating button */}
        <button
          onClick={() => setMobileCalendarOpen(true)}
          className="fixed bottom-[80px] right-4 z-[35] h-12 w-12 flex items-center justify-center rounded-full text-white border-2 border-white transition-transform active:scale-95"
          style={{ background: "var(--gv-color-primary-500)", boxShadow: "var(--gv-shadow-card)" }}
          aria-label="Open calendar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {selectedDate && (
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-white text-[9px] font-bold border" style={{ color: "var(--gv-color-primary-500)", borderColor: "var(--gv-color-primary-500)" }}>
              {new Date(selectedDate + "T00:00:00").getDate()}
            </span>
          )}
        </button>

        {/* Calendar popup overlay */}
        {mobileCalendarOpen && (
          <div className="fixed inset-0 z-[55]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileCalendarOpen(false)} />
            <div className="absolute bottom-[144px] right-4 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden" style={{ background: "var(--gv-color-bg-surface)", borderRadius: "var(--gv-radius-lg)", boxShadow: "var(--gv-shadow-modal)", border: "1px solid var(--gv-color-neutral-200)" }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--gv-color-neutral-100)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--gv-color-neutral-900)" }}>
                  {selectedDate
                    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "long", day: "numeric" })
                    : "Select a date"}
                </p>
                <button
                  onClick={() => setMobileCalendarOpen(false)}
                  className="h-6 w-6 flex items-center justify-center"
                  style={{ borderRadius: "var(--gv-radius-xs)", color: "var(--gv-color-neutral-400)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <MiniCalendar
                taskDates={taskDates}
                onDateSelect={(date) => { handleDateSelect(date); setMobileCalendarOpen(false); }}
                selectedDate={selectedDate}
                maxDate={maxDateStr}
                minDate={minDateStr}
              />
              {selectedDate && (
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid var(--gv-color-neutral-100)" }}>
                  <p className="text-[11px]" style={{ color: "var(--gv-color-neutral-400)" }}>{baseTasks.length} task{baseTasks.length !== 1 ? "s" : ""} this day</p>
                  <button
                    onClick={() => { setSelectedDate(null); setSelectedTask(null); setMobileCalendarOpen(false); }}
                    className="text-[11px] font-medium"
                    style={{ color: "var(--gv-color-primary-500)" }}
                  >
                    Show all →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Derived: all replied item IDs (sent by human or approved by AI)
  const allDoneIds = new Set([...arSentIds, ...arApprovedIds]);

  const right = subTab === "comments" ? (
    /* ── Right Column: 3-Group Comment Display ── */
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}
      >
        <p className="text-[14px] font-bold" style={{ color: "var(--gv-color-neutral-900)" }}>
          Comments
          {selectedDate && (
            <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--gv-color-neutral-400)" }}>
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="gv-badge" style={{ background: "var(--gv-color-warning-50)", color: "var(--gv-color-warning-700)", border: "1px solid var(--gv-color-warning-200)" }}>
            {humanReplies.filter(r => !allDoneIds.has(r.id)).length} needs attention
          </span>
          <span className="gv-badge gv-badge-primary">
            {aiReplies.filter(r => !allDoneIds.has(r.id)).length} AI queue
          </span>
          <span className="gv-badge" style={{ background: "var(--gv-color-success-50)", color: "var(--gv-color-success-700)", border: "1px solid var(--gv-color-success-200)" }}>
            {allDoneIds.size} done
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">

        {allReplyItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[14px] font-medium" style={{ color: "var(--gv-color-neutral-500)" }}>No comments for this date</p>
            <p className="text-[12px] mt-1" style={{ color: "var(--gv-color-neutral-400)" }}>Run Comment Analysis to populate groups</p>
          </div>
        ) : (
          <>
            {/* ── Group 1: Needs Attention (Human Reply) ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <UserIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gv-color-warning-500)" }} />
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--gv-color-warning-600)" }}>
                  Group 1 — Needs Attention
                </p>
                <span className="gv-badge ml-auto" style={{ background: "var(--gv-color-warning-50)", color: "var(--gv-color-warning-700)", border: "1px solid var(--gv-color-warning-200)", fontSize: "11px" }}>
                  {humanReplies.filter(r => !allDoneIds.has(r.id)).length}
                </span>
              </div>
              {humanReplies.length === 0 ? (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--gv-color-neutral-400)" }}>No priority comments</p>
              ) : (
                <div className="space-y-2">
                  {humanReplies.filter(r => !allDoneIds.has(r.id)).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--gv-radius-md)] p-3"
                      style={{ border: "1px solid var(--gv-color-warning-200)", background: "var(--gv-color-bg-surface)" }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[13px]">{item.platformIcon}</span>
                        <span className="text-[12px] font-semibold" style={{ color: "var(--gv-color-neutral-800)" }}>{item.author}</span>
                        <span className="gv-badge ml-auto" style={{ background: "var(--gv-color-warning-50)", color: "var(--gv-color-warning-700)", border: "1px solid var(--gv-color-warning-100)", fontSize: "10px" }}>
                          Score {item.authorScore}
                        </span>
                      </div>
                      <p className="text-[12px] leading-relaxed mb-2" style={{ color: "var(--gv-color-neutral-600)" }}>
                        &ldquo;{item.comment}&rdquo;
                      </p>
                      {arEditId === item.id ? (
                        <div>
                          <textarea
                            value={arEditText}
                            onChange={(e) => setArEditText(e.target.value)}
                            rows={3}
                            className="w-full text-[12px] p-2 resize-none"
                            style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-300)", background: "var(--gv-color-bg-base)", color: "var(--gv-color-neutral-800)", outline: "none" }}
                          />
                          <div className="flex gap-2 mt-1.5">
                            <button
                              onClick={() => { setArSentIds((p) => new Set([...p, item.id])); setArEditId(null); }}
                              className="flex-1 py-1.5 text-[12px] font-semibold text-white flex items-center justify-center gap-1"
                              style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-primary-500)" }}
                            >
                              <PaperPlaneIcon className="w-3 h-3" /> Send
                            </button>
                            <button
                              onClick={() => setArEditId(null)}
                              className="px-3 py-1.5 text-[12px]"
                              style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", color: "var(--gv-color-neutral-600)" }}
                            >
                              <CloseLineIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] italic mb-2" style={{ color: "var(--gv-color-neutral-500)" }}>
                            Draft: {item.draftReply.length > 70 ? item.draftReply.slice(0, 70) + "…" : item.draftReply}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setArSentIds((p) => new Set([...p, item.id]))}
                              className="flex-1 py-1.5 text-[12px] font-semibold text-white flex items-center justify-center gap-1"
                              style={{ borderRadius: "var(--gv-radius-sm)", background: "var(--gv-color-primary-500)" }}
                            >
                              <PaperPlaneIcon className="w-3 h-3" /> Send Draft
                            </button>
                            <button
                              onClick={() => { setArEditId(item.id); setArEditText(item.draftReply); }}
                              className="px-3 py-1.5 text-[12px]"
                              style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-neutral-200)", color: "var(--gv-color-neutral-600)" }}
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: "1px", background: "var(--gv-color-neutral-100)" }} />

            {/* ── Group 2: Automated by AI ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AiIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gv-color-primary-500)" }} />
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--gv-color-primary-600)" }}>
                  Group 2 — Automated by AI
                </p>
                <span className="gv-badge gv-badge-primary ml-auto" style={{ fontSize: "11px" }}>
                  {aiReplies.filter(r => !allDoneIds.has(r.id)).length}
                </span>
              </div>
              {aiReplies.filter(r => !allDoneIds.has(r.id)).length > 0 && (
                <button
                  onClick={() => setArApprovedIds(new Set(aiReplies.map(r => r.id)))}
                  className="w-full py-2 mb-2 text-[12px] font-semibold text-white flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "var(--gv-radius-md)", background: "var(--gv-color-primary-500)" }}
                >
                  <BoltIcon className="w-3.5 h-3.5" /> Approve All ({aiReplies.filter(r => !allDoneIds.has(r.id)).length})
                </button>
              )}
              {aiReplies.length === 0 ? (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--gv-color-neutral-400)" }}>No AI auto-reply items</p>
              ) : (
                <div className="space-y-2">
                  {aiReplies.filter(r => !allDoneIds.has(r.id)).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--gv-radius-md)] p-3"
                      style={{ border: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px]">{item.platformIcon}</span>
                        <span className="text-[12px] font-medium" style={{ color: "var(--gv-color-neutral-700)" }}>{item.author}</span>
                        <span className="text-[10px] ml-1" style={{ color: "var(--gv-color-neutral-400)" }}>Score {item.authorScore}</span>
                        <button
                          onClick={() => setArApprovedIds((p) => new Set([...p, item.id]))}
                          className="ml-auto p-1 flex items-center"
                          style={{ borderRadius: "var(--gv-radius-sm)", border: "1px solid var(--gv-color-primary-200)", color: "var(--gv-color-primary-500)" }}
                          title="Approve"
                        >
                          <CheckLineIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] mt-1.5" style={{ color: "var(--gv-color-neutral-500)" }}>
                        {item.comment.length > 80 ? item.comment.slice(0, 80) + "…" : item.comment}
                      </p>
                      <p className="text-[11px] italic mt-1" style={{ color: "var(--gv-color-primary-500)" }}>
                        → {item.draftReply.length > 70 ? item.draftReply.slice(0, 70) + "…" : item.draftReply}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: "1px", background: "var(--gv-color-neutral-100)" }} />

            {/* ── Group 3: Done / Replied ── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--gv-color-success-500)" }} />
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--gv-color-success-600)" }}>
                  Group 3 — Done Replied
                </p>
                <span className="gv-badge ml-auto" style={{ background: "var(--gv-color-success-50)", color: "var(--gv-color-success-700)", border: "1px solid var(--gv-color-success-200)", fontSize: "11px" }}>
                  {allDoneIds.size}
                </span>
              </div>
              {allDoneIds.size === 0 ? (
                <p className="text-[12px] text-center py-3" style={{ color: "var(--gv-color-neutral-400)" }}>No replies sent yet</p>
              ) : (
                <div className="space-y-2">
                  {allReplyItems.filter(r => allDoneIds.has(r.id)).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--gv-radius-md)] p-3"
                      style={{ border: "1px solid var(--gv-color-success-200)", background: "var(--gv-color-success-50)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px]">{item.platformIcon}</span>
                        <span className="text-[12px] font-medium" style={{ color: "var(--gv-color-neutral-700)" }}>{item.author}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <CheckLineIcon className="w-3.5 h-3.5" style={{ color: "var(--gv-color-success-500)" }} />
                          <span className="text-[11px] font-medium" style={{ color: "var(--gv-color-success-700)" }}>
                            {arSentIds.has(item.id) ? "Replied" : "Auto-sent"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] mt-1.5" style={{ color: "var(--gv-color-neutral-500)" }}>
                        {item.comment.length > 80 ? item.comment.slice(0, 80) + "…" : item.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  ) : selectedPost ? (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--gv-color-neutral-200)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <StatusBadge status={selectedPost.status} />
            <h2 className="mt-1.5 text-base font-semibold leading-snug" style={{ color: "var(--gv-color-neutral-900)", fontFamily: "var(--gv-font-heading)" }}>{selectedPost.title}</h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--gv-color-neutral-400)" }}>{selectedPost.date} · {selectedPost.time} WIB · {selectedPost.duration}</p>
            {selectedPost.views && (
              <p className="text-sm mt-0.5" style={{ color: "var(--gv-color-neutral-500)" }}>
                <span className="font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{selectedPost.views}</span> views ·{" "}
                <span className="font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{selectedPost.likes}</span> likes
              </p>
            )}
          </div>
          <span className="flex-shrink-0 w-3 h-3 rounded-full mt-1.5" style={{ background: selectedPost.accentColor }} />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {/* Phone preview */}
        <TikTokPhoneMockup post={selectedPost} caption={editCaption} hashtags={editHashtags.split(/\s+/)} />

        {/* Fields */}
        <div className="px-4 pb-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1.5" style={{ color: "var(--gv-color-neutral-400)" }}>Caption</h4>
            <p className="text-sm leading-relaxed" style={{ color: "var(--gv-color-neutral-700)" }}>{selectedPost.caption}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-1.5" style={{ color: "var(--gv-color-neutral-400)" }}>Hashtags</h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedPost.hashtags.map((tag, i) => (
                <span key={i} className="gv-badge gv-badge-primary" style={{ fontSize: "12px" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <span className="text-sm">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--gv-color-neutral-700)" }}>{selectedPost.date}</p>
              <p className="text-xs" style={{ color: "var(--gv-color-neutral-400)" }}>at {selectedPost.time} WIB</p>
            </div>
            <button className="text-sm font-medium hover:underline" style={{ color: "var(--gv-color-primary-500)" }}>Edit</button>
          </div>
        </div>
      </div>

      {/* Action buttons — sticky bottom */}
      <div className="flex-shrink-0 p-4 space-y-2" style={{ borderTop: "1px solid var(--gv-color-neutral-200)", background: "var(--gv-color-bg-surface)" }}>
        {!lsConnectedIds.has("tiktok") ? (
          <div className="p-4 text-center" style={{ borderRadius: "var(--gv-radius-md)", border: "1px solid var(--gv-color-neutral-200)" }}>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--gv-color-neutral-700)" }}>TikTok belum terhubung</p>
            <p className="text-xs mb-3" style={{ color: "var(--gv-color-neutral-400)" }}>Hubungkan TikTok di halaman Home terlebih dahulu</p>
            <a href="/" className="gv-btn-sm" style={{ display: "inline-flex" }}>
              → Ke Halaman Home
            </a>
          </div>
        ) : (
          <>
            <button
              onClick={handlePostPublish}
              disabled={publishing || selectedPost.status === "published"}
              className="w-full font-semibold py-3 text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                borderRadius: "var(--gv-radius-md)",
                background: selectedPost.status === "published"
                  ? "var(--gv-color-success-50)"
                  : publishing ? "rgba(254,44,85,0.7)" : "#FE2C55",
                color: selectedPost.status === "published"
                  ? "var(--gv-color-success-700)"
                  : "#ffffff",
                cursor: selectedPost.status === "published" ? "default" : publishing ? "wait" : "pointer",
                boxShadow: selectedPost.status !== "published" && !publishing ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                opacity: (publishing || selectedPost.status === "published") ? undefined : 1,
              }}
            >
              {publishBtnLabel()}
            </button>

            {publishing && (
              <div className="w-full h-1 overflow-hidden" style={{ background: "var(--gv-color-neutral-100)", borderRadius: "var(--gv-radius-full)" }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ background: "#FE2C55", borderRadius: "var(--gv-radius-full)", width: publishStep === "connecting" ? "35%" : publishStep === "uploading" ? "75%" : "100%" }}
                />
              </div>
            )}

            {selectedPost.status !== "published" && (
              <button
                className="w-full font-medium py-2.5 text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  borderRadius: "var(--gv-radius-md)",
                  border: "1px solid var(--gv-color-neutral-200)",
                  color: "var(--gv-color-neutral-700)",
                  background: "var(--gv-color-bg-surface)",
                }}
              >
                📅 Schedule · {selectedPost.date} {selectedPost.time}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  ) : (
    <TaskDetailPanel
      task={selectedTask}
      isConnected={selectedTask ? isPlatformConnected(selectedTask.platform || "") : true}
      onPublish={handlePublish}
      onReject={handleReject}
      isRejected={selectedTask ? rejectedTaskIds.has(selectedTask.id) : false}
      onPublishReplies={handlePublishReplies}
    />
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Three-column layout — shrinks to fit above nav ── */}
      <div className="flex-1 min-h-0">
        <ThreeColumnLayout
          left={left}
          center={center}
          right={right}
          mobileRightOpen={mobileRightOpen}
          onMobileBack={handleMobileBack}
          mobileBackLabel="Tasks"
        />
      </div>

      {/* ── Bottom tab bar — outside columns, fixed at bottom ── */}
      <nav
        className="flex-shrink-0 flex justify-center pt-0 pb-4"
        style={{ background: "var(--gv-color-bg-base)" }}
      >
        <div
          className="overflow-hidden"
          style={{
            borderRadius: "var(--gv-radius-2xl)",
            border: "1px solid var(--gv-color-glass-border)",
            background: "var(--gv-color-glass-bg)",
            backdropFilter: "blur(var(--gv-blur-lg))",
            WebkitBackdropFilter: "blur(var(--gv-blur-lg))",
            boxShadow: "var(--gv-shadow-card)",
          }}
        >
        <div className="flex items-center px-3 py-2 gap-1">
          {([
            {
              key: "content" as SubTab,
              label: "Content",
              icon: (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              ),
            },
            {
              key: "comments" as SubTab,
              label: "Comments",
              icon: (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              ),
            },
            {
              key: "others" as SubTab,
              label: "Others",
              icon: (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
              ),
            },
          ]).map(({ key, icon, label }) => {
            const isActive = subTab === key;
            return (
              <button
                key={key}
                onClick={() => { setSubTab(key); setSelectedTask(null); setSelectedPostId(null); }}
                className="flex items-center gap-2 h-10 px-4 transition-all duration-200"
                style={{
                  borderRadius: "var(--gv-radius-full)",
                  background: isActive ? "var(--gv-color-primary-50)" : "transparent",
                  color: isActive ? "var(--gv-color-primary-500)" : "var(--gv-color-neutral-500)",
                  border: isActive ? "1px solid rgba(95,143,139,0.3)" : "1px solid transparent",
                  boxShadow: "none",
                }}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
                <span className="text-[13px] font-[550] whitespace-nowrap leading-none">{label}</span>
              </button>
            );
          })}
          </div>
        </div>
      </nav>

      {postToast && (
        <div
          className="fixed bottom-20 right-6 z-50 px-4 py-3 text-sm font-medium flex items-center gap-2 max-w-sm text-white"
          style={{
            borderRadius: "var(--gv-radius-md)",
            background: postToast.type === "success" ? "var(--gv-color-primary-700)" : "var(--gv-color-danger-700)",
            boxShadow: "var(--gv-shadow-card)",
          }}
        >
          {postToast.msg}
        </div>
      )}
    </div>
  );
}
