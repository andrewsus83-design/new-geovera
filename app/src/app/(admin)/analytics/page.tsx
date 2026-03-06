"use client";
import React, { useState, useEffect, useCallback } from "react";
import ThreeColumnLayout from "@/components/shared/ThreeColumnLayout";
import NavColumn from "@/components/shared/NavColumn";
import { supabase } from "@/lib/supabase";

const FALLBACK_BRAND_ID = process.env.NEXT_PUBLIC_brandId || "a37dee82-5ed5-4ba4-991a-4d93dde9ff7a";

// ── Tier gating ───────────────────────────────────────────────────
const ANALYTICS_REQUIRES_TIER = "partner";
const TIER_ORDER: Record<string, number> = { basic: 0, premium: 1, partner: 2 };

// ── Types ────────────────────────────────────────────────────────
type AnalyticsSection = "seo" | "geo" | "social";

// SEO — content performance items
interface ContentItem {
  id: string;
  title: string;
  platform: string;
  platformIcon: string;
  type: "post" | "article" | "video" | "reel";
  publishedDate: string;
  reach: number;
  engagement: number;
  saves: number;
  comments: number;
  trend: "up" | "down" | "flat";
  trendPct: number;
}

// GEO — AI platform visibility
interface GeoItem {
  id: string;
  engine: string;
  engineIcon: string;
  visibilityScore: number;
  queriesMentioned: number;
  totalQueries: number;
  avgPosition: number;
  topQuery: string;
  trend: "up" | "down" | "flat";
  trendPct: number;
  lastChecked: string;
  status: "active" | "improving" | "declining";
}

// Social — social media posts
interface SocialItem {
  id: string;
  title: string;
  caption: string;       // post caption/description
  hashtags: string[];    // e.g. ["#AIMarketing", "#GeoVera"]
  platform: string;
  platformIcon: string;
  type: "post" | "reel" | "story" | "tweet";
  publishedDate: string;
  timestamp: string;     // e.g. "Feb 23, 2026 · 19:14"
  imageBg: string;       // tailwind bg gradient class for placeholder image
  imageEmoji: string;    // large emoji shown in placeholder
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watchRetention: number; // % watch time retention (0-100)
  ctr: number;            // click-through rate %
  trend: "up" | "down" | "flat";
  trendPct: number;
  factorScores: number[]; // scores[0..9] = score for each of 10 social factors
}

// Social — top 10 algorithm factors
interface PostScore {
  postId: string;
  score: number;
  note: string;
}
interface SocialFactor {
  rank: number;
  label: string;
  score: number;              // channel-level aggregate score
  status: "good" | "warn" | "low";
  icon: string;
  tip: string;                // short channel summary
  detail: string;             // explanation of the factor
  actions: string[];
  postScores: PostScore[];    // per-post evaluation on this factor
  consistencyNote: string;    // assessment based on publish frequency
}

// ── Demo Data ────────────────────────────────────────────────────
const contentItems: ContentItem[] = [
  { id: "c1", title: "Why AI Marketing Is the Future of Brand Growth", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 23", reach: 12400, engagement: 8.4, saves: 342, comments: 87, trend: "up", trendPct: 34 },
  { id: "c2", title: "5 Signs Your Brand Is Ready for AI Automation", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 24", reach: 15800, engagement: 9.7, saves: 483, comments: 122, trend: "up", trendPct: 41 },
  { id: "c3", title: "The CMO's Guide to AI Content Calendars", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 25", reach: 18900, engagement: 10.2, saves: 621, comments: 97, trend: "up", trendPct: 55 },
  { id: "c4", title: "How to Build a Brand Voice Your Audience Remembers", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 26", reach: 8900, engagement: 7.4, saves: 267, comments: 71, trend: "flat", trendPct: 3 },
  { id: "c5", title: "Brand Intelligence Insight — AI Marketing Trend", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 23", reach: 4200, engagement: 5.1, saves: 89, comments: 31, trend: "flat", trendPct: 2 },
  { id: "c6", title: "How We Generate a Market Report in 5 Minutes", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 24", reach: 9400, engagement: 7.8, saves: 298, comments: 84, trend: "up", trendPct: 22 },
  { id: "c7", title: "AI Marketing Automation: The Complete 2025 Guide", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 21", reach: 21200, engagement: 11.1, saves: 712, comments: 134, trend: "up", trendPct: 67 },
  { id: "c8", title: "What Is GeoVera? Platform Overview for Marketers", platform: "Blog", platformIcon: "✍️", type: "article", publishedDate: "Feb 20", reach: 6800, engagement: 6.3, saves: 178, comments: 45, trend: "up", trendPct: 18 },
];

const geoItems: GeoItem[] = [
  { id: "g1", engine: "ChatGPT", engineIcon: "🤖", visibilityScore: 72, queriesMentioned: 18, totalQueries: 25, avgPosition: 2.4, topQuery: "best AI marketing platform for startups", trend: "up", trendPct: 28, lastChecked: "2h ago", status: "improving" },
  { id: "g2", engine: "Perplexity", engineIcon: "🔍", visibilityScore: 84, queriesMentioned: 21, totalQueries: 25, avgPosition: 1.8, topQuery: "AI brand management tools 2025", trend: "up", trendPct: 41, lastChecked: "2h ago", status: "active" },
  { id: "g3", engine: "Gemini", engineIcon: "✨", visibilityScore: 58, queriesMentioned: 14, totalQueries: 24, avgPosition: 3.7, topQuery: "automated content publishing for brands", trend: "up", trendPct: 15, lastChecked: "3h ago", status: "improving" },
  { id: "g4", engine: "Claude", engineIcon: "🧠", visibilityScore: 63, queriesMentioned: 15, totalQueries: 24, avgPosition: 3.1, topQuery: "AI agent for social media marketing", trend: "flat", trendPct: 4, lastChecked: "3h ago", status: "active" },
  { id: "g5", engine: "Copilot", engineIcon: "💡", visibilityScore: 41, queriesMentioned: 10, totalQueries: 24, avgPosition: 5.2, topQuery: "marketing intelligence platform comparison", trend: "down", trendPct: 9, lastChecked: "4h ago", status: "declining" },
  { id: "g6", engine: "Grok", engineIcon: "⚡", visibilityScore: 34, queriesMentioned: 8, totalQueries: 23, avgPosition: 6.1, topQuery: "AI tools for brand growth", trend: "up", trendPct: 22, lastChecked: "5h ago", status: "improving" },
];

const socialItems: SocialItem[] = [
  {
    id: "s1", title: "3 Things AI Does for Your Brand While You Sleep",
    caption: "Bayangkan: brand kamu tetap aktif, menjawab, dan berkembang — bahkan saat kamu tidur. Ini bukan mimpi. Ini AI Marketing. 🤖✨",
    hashtags: ["#AIMarketing", "#BrandAutomation", "#GeoVera", "#MarketingAI", "#DigitalMarketing"],
    platform: "Instagram", platformIcon: "📸", type: "reel", publishedDate: "Feb 23", timestamp: "Feb 23, 2026 · 19:14",
    imageBg: "from-purple-500 to-indigo-600", imageEmoji: "🤖",
    reach: 28600, likes: 2140, comments: 204, shares: 312, saves: 891, watchRetention: 78, ctr: 6.2, trend: "up", trendPct: 67,
    factorScores: [82, 79, 71, 80, 74, 76, 85, 72, 90, 68],
  },
  {
    id: "s2", title: "How We Generate a Market Report in 5 Minutes",
    caption: "5 menit. Satu klik. Laporan market intelligence lengkap yang biasanya butuh 2 hari kerja. Inilah kekuatan GeoVera AI. 📊⚡",
    hashtags: ["#MarketIntelligence", "#AIReport", "#GeoVera", "#ProductivityHack", "#StartupTips"],
    platform: "Instagram", platformIcon: "📸", type: "reel", publishedDate: "Feb 24", timestamp: "Feb 24, 2026 · 18:30",
    imageBg: "from-brand-500 to-cyan-500", imageEmoji: "📊",
    reach: 34200, likes: 3180, comments: 318, shares: 489, saves: 1240, watchRetention: 84, ctr: 7.8, trend: "up", trendPct: 89,
    factorScores: [89, 85, 82, 86, 79, 83, 91, 80, 88, 76],
  },
  {
    id: "s3", title: "Day in the Life of an AI Marketing Agent",
    caption: "Jam 07.00 — Agent mulai analisis. Jam 08.00 — Konten sudah terjadwal. Jam 09.00 — Report siap. Kamu baru bangun, tapi brand kamu sudah bekerja keras 💪",
    hashtags: ["#AIAgent", "#MarketingAutomation", "#BehindTheScenes", "#GeoVera", "#FutureOfMarketing"],
    platform: "Instagram", platformIcon: "📸", type: "reel", publishedDate: "Feb 25", timestamp: "Feb 25, 2026 · 20:00",
    imageBg: "from-green-500 to-emerald-600", imageEmoji: "🌅",
    reach: 41800, likes: 4120, comments: 427, shares: 623, saves: 1680, watchRetention: 91, ctr: 9.4, trend: "up", trendPct: 112,
    factorScores: [94, 91, 88, 90, 84, 89, 95, 86, 92, 82],
  },
  {
    id: "s4", title: "Friday Tip — 1 Marketing Hack That Changes Everything",
    caption: "Friday tip 🔥 Satu perubahan kecil di strategi kontenmu yang bisa meningkatkan organic reach hingga 3x. Thread di bawah 👇",
    hashtags: ["#FridayTip", "#MarketingHack", "#ContentStrategy", "#GrowthHacking", "#AIMarketing"],
    platform: "Instagram", platformIcon: "📸", type: "reel", publishedDate: "Feb 26", timestamp: "Feb 26, 2026 · 17:45",
    imageBg: "from-orange-400 to-red-500", imageEmoji: "💡",
    reach: 22400, likes: 1890, comments: 189, shares: 241, saves: 720, watchRetention: 72, ctr: 5.1, trend: "up", trendPct: 28,
    factorScores: [74, 72, 64, 73, 68, 71, 78, 65, 82, 61],
  },
  {
    id: "s5", title: "GeoVera Platform Feature Spotlight",
    caption: "Meet GeoVera's newest feature: real-time brand intelligence dashboard. Track your visibility across 6 AI engines — all in one place. 🎯",
    hashtags: ["#ProductUpdate", "#GeoVera", "#BrandIntelligence", "#GEO", "#AITools"],
    platform: "Instagram", platformIcon: "📸", type: "post", publishedDate: "Feb 23", timestamp: "Feb 23, 2026 · 12:00",
    imageBg: "from-slate-600 to-gray-800", imageEmoji: "✨",
    reach: 9800, likes: 728, comments: 63, shares: 94, saves: 284, watchRetention: 0, ctr: 3.4, trend: "up", trendPct: 18,
    factorScores: [0, 68, 52, 72, 65, 70, 62, 58, 75, 44],
  },
  {
    id: "s6", title: "Customer Story — Brand Before & After",
    caption: "Sebelum GeoVera: 12 hours/minggu untuk riset manual. Setelah GeoVera: 45 menit. ROI +340% dalam 3 bulan pertama. Ini bukan klaim — ini data nyata klien kami 📈",
    hashtags: ["#CustomerSuccess", "#CaseStudy", "#ROI", "#AIMarketing", "#GeoVera"],
    platform: "Instagram", platformIcon: "📸", type: "post", publishedDate: "Feb 24", timestamp: "Feb 24, 2026 · 10:15",
    imageBg: "from-teal-500 to-cyan-600", imageEmoji: "📈",
    reach: 7600, likes: 541, comments: 54, shares: 67, saves: 198, watchRetention: 0, ctr: 2.8, trend: "up", trendPct: 22,
    factorScores: [0, 65, 49, 74, 62, 80, 58, 55, 78, 40],
  },
  {
    id: "s7", title: "What Top Brands Are Doing This Week That You're Not",
    caption: "3 hal yang dilakukan brand terbaik minggu ini yang hampir pasti tidak kamu lakukan. Thread 🧵",
    hashtags: ["#BrandStrategy", "#MarketingInsights", "#CompetitiveIntel", "#AIMarketing"],
    platform: "X (Twitter)", platformIcon: "𝕏", type: "tweet", publishedDate: "Feb 24", timestamp: "Feb 24, 2026 · 08:30",
    imageBg: "from-gray-800 to-gray-900", imageEmoji: "🔍",
    reach: 11200, likes: 342, comments: 148, shares: 287, saves: 94, watchRetention: 0, ctr: 4.1, trend: "down", trendPct: 8,
    factorScores: [0, 71, 58, 68, 72, 62, 54, 60, 80, 38],
  },
  {
    id: "s8", title: "AI Marketing Thread: 10 Things Brands Get Wrong",
    caption: "10 kesalahan AI marketing yang masih dilakukan 90% brand di Indonesia. Thread panjang tapi worth it 🧵👇",
    hashtags: ["#AIMarketing", "#MarketingMistakes", "#BrandStrategy", "#Thread", "#GeoVera"],
    platform: "X (Twitter)", platformIcon: "𝕏", type: "tweet", publishedDate: "Feb 22", timestamp: "Feb 22, 2026 · 21:00",
    imageBg: "from-violet-600 to-purple-700", imageEmoji: "🧵",
    reach: 18400, likes: 892, comments: 231, shares: 564, saves: 312, watchRetention: 0, ctr: 5.6, trend: "up", trendPct: 45,
    factorScores: [0, 82, 68, 78, 76, 74, 66, 70, 85, 52],
  },
  {
    id: "s9", title: "Why Your Content Strategy Needs an AI Agent",
    caption: "Content strategy tanpa AI agent di 2026 = navigasi tanpa GPS. Artikel mendalam tentang mengapa ini bukan lagi pilihan tapi keharusan.",
    hashtags: ["#ContentStrategy", "#AIAgent", "#B2BMarketing", "#DigitalTransformation", "#GeoVera"],
    platform: "LinkedIn", platformIcon: "💼", type: "post", publishedDate: "Feb 25", timestamp: "Feb 25, 2026 · 09:00",
    imageBg: "from-blue-600 to-blue-800", imageEmoji: "📝",
    reach: 6200, likes: 412, comments: 67, shares: 138, saves: 156, watchRetention: 0, ctr: 3.9, trend: "up", trendPct: 33,
    factorScores: [0, 74, 61, 76, 70, 77, 60, 64, 82, 46],
  },
];

// ── Social Factor data ────────────────────────────────────────────
const socialFactors: SocialFactor[] = [
  {
    rank: 1, label: "Watch Time Retention", score: 84, status: "good", icon: "▶️",
    tip: "Avg retention 81% · 4 reels melampaui 80% threshold",
    detail: "Watch time retention adalah sinyal terkuat algoritma platform video. Semakin tinggi persentase video yang ditonton, semakin sering konten didistribusikan ke audiens baru. Threshold 'aman' adalah 70%+; di atas 85% biasanya masuk viral loop.",
    actions: ["Hook 3 detik pertama harus langsung ke inti masalah", "Gunakan pattern interrupt setiap 7-10 detik", "Akhiri dengan cliffhanger atau CTA yang memotivasi rewatch", "Hindari intro logo / bumper panjang"],
    consistencyNote: "4 dari 4 Reel yang dipublish mencapai retention baik. Konsistensi format 'hook langsung' di semua reel terbukti efektif.",
    postScores: [
      { postId: "s1", score: 82, note: "Retention 78% — kuat, hook 'saat tidur' memancing rasa penasaran" },
      { postId: "s2", score: 89, note: "Retention 84% — demo produk visual sangat efektif di 15 detik pertama" },
      { postId: "s3", score: 94, note: "Retention 91% — terbaik bulan ini, narasi alur 'hari kerja AI' intuitif" },
      { postId: "s4", score: 74, note: "Retention 72% — drop di detik ke-18, transisi terlalu cepat" },
      { postId: "s5", score: 0, note: "N/A — format post statis, tidak ada watch time" },
      { postId: "s6", score: 0, note: "N/A — format post statis" },
      { postId: "s7", score: 0, note: "N/A — format tweet, tidak berlaku" },
      { postId: "s8", score: 0, note: "N/A — format thread teks" },
      { postId: "s9", score: 0, note: "N/A — format artikel LinkedIn" },
    ],
  },
  {
    rank: 2, label: "Engagement Aktif (Like, Comment, Share, Save/DM)", score: 78, status: "good", icon: "💬",
    tip: "Avg engagement rate 9.1% · Save rate tertinggi di Reel",
    detail: "Algoritma membobot engagement secara berbeda: Save dan Share paling kuat (distribusi organik), Comment menunjukkan percakapan, Like adalah sinyal dasar. DM dari konten adalah sinyal sangat kuat yang sering diabaikan brand.",
    actions: ["Akhiri setiap konten dengan pertanyaan spesifik untuk memancing comment", "Buat konten 'save-worthy': tips list, template, checklist", "Balas semua comment dalam 1 jam pertama untuk boost distribusi", "Gunakan 'tag teman yang perlu ini' untuk mendorong share organik"],
    consistencyNote: "9 konten dipublish dengan gap posting rata-rata 1.5 hari — frekuensi baik untuk mempertahankan engagement channel.",
    postScores: [
      { postId: "s1", score: 79, note: "2,140 likes · 204 comments · 891 saves — rasio save/reach 3.1% sangat baik" },
      { postId: "s2", score: 85, note: "3,180 likes · 318 comments · 1,240 saves — terbaik kedua, high DM signal" },
      { postId: "s3", score: 91, note: "4,120 likes · 427 comments · 1,680 saves — viral engagement loop aktif" },
      { postId: "s4", score: 72, note: "1,890 likes · 189 comments — engagement oke tapi saves relatif rendah" },
      { postId: "s5", score: 68, note: "728 likes · 63 comments · 284 saves — engagement rate 9.9% solid untuk post statis" },
      { postId: "s6", score: 65, note: "541 likes · 54 comments — engagement rate 9.0%, saves rendah untuk story format" },
      { postId: "s7", score: 71, note: "342 likes · 148 comments · 287 RT — comment rate tinggi untuk thread debat" },
      { postId: "s8", score: 82, note: "892 likes · 231 comments · 564 RT — engagement tertinggi di X bulan ini" },
      { postId: "s9", score: 74, note: "412 likes · 67 comments · 138 shares — LinkedIn engagement rate 9.9% di atas rata-rata" },
    ],
  },
  {
    rank: 3, label: "CTR & Hook Awal", score: 65, status: "warn", icon: "🎣",
    tip: "Avg CTR 5.4% · Hook terbaik: 'How We' format",
    detail: "CTR (thumbnail + judul) menentukan apakah konten mendapat kesempatan ditonton. Di video, 3 detik pertama adalah hook yang menentukan apakah penonton lanjut atau scroll. Hook yang baik memancing rasa penasaran, FOMO, atau insight instan.",
    actions: ["A/B test thumbnail: wajah ekspresif vs text overlay vs product close-up", "Mulai dengan pertanyaan yang relevan atau statemen mengejutkan", "Gunakan angka spesifik di judul (misal '5 Menit' bukan 'Cepat')", "Hindari judul clickbait yang tidak sesuai isi — meningkatkan drop rate"],
    consistencyNote: "CTR bervariasi signifikan (2.8%–9.4%) menunjukkan inkonsistensi hook strategy. Perlu standarisasi template hook antar format.",
    postScores: [
      { postId: "s1", score: 71, note: "CTR 6.2% — 'Saat Tidur' hook efektif menciptakan FOMO" },
      { postId: "s2", score: 82, note: "CTR 7.8% — '5 Menit' angka spesifik + demo visual = kombinasi terkuat" },
      { postId: "s3", score: 88, note: "CTR 9.4% — hook 'Day in the Life' universally relatable, CTR terbaik" },
      { postId: "s4", score: 64, note: "CTR 5.1% — 'Friday Tip' terlalu generic, kurang urgency" },
      { postId: "s5", score: 52, note: "CTR 3.4% — feature spotlight kurang hook emosional, terlalu product-centric" },
      { postId: "s6", score: 49, note: "CTR 2.8% — 'Before & After' seharusnya lebih kuat, thumbnail perlu dioptimasi" },
      { postId: "s7", score: 58, note: "CTR 4.1% — judul provocative tapi tidak didukung visual kuat" },
      { postId: "s8", score: 68, note: "CTR 5.6% — '10 Things' list format selalu perform, tapi bisa lebih spesifik" },
      { postId: "s9", score: 61, note: "CTR 3.9% — LinkedIn artikel, CTR cukup untuk platform B2B" },
    ],
  },
  {
    rank: 4, label: "Relevansi Konten", score: 80, status: "good", icon: "🎯",
    tip: "Niche AI marketing sangat relevan · Topik trending dimanfaatkan",
    detail: "Algoritma mendistribusikan konten berdasarkan kecocokan dengan interest audiens. Konten yang relevan dengan niche spesifik lebih konsisten mendapat distribusi ke audiens yang tepat dibanding konten yang terlalu broad.",
    actions: ["Gunakan keyword niche di caption dan hashtag secara konsisten", "Pantau trending topics di niche AI marketing setiap minggu", "Buat content pillars yang jelas: Edukasi, Behind-the-scenes, Produk, Case Study", "Analisis konten kompetitor yang viral untuk gap topik"],
    consistencyNote: "Semua 9 konten konsisten dalam niche AI marketing — channel memiliki identitas topik yang kuat dan tidak melenceng.",
    postScores: [
      { postId: "s1", score: 80, note: "Relevan: AI benefit untuk brand — topik broad tapi tetap on-niche" },
      { postId: "s2", score: 86, note: "Sangat relevan: demo fitur produk — audiens target langsung melihat value" },
      { postId: "s3", score: 90, note: "Sangat relevan: behind-the-scenes AI agent — curiosity + edukasi" },
      { postId: "s4", score: 73, note: "Relevan tapi generic — 'marketing hack' kurang spesifik ke AI niche" },
      { postId: "s5", score: 72, note: "Relevan: product feature — cukup spesifik tapi kurang storytelling" },
      { postId: "s6", score: 74, note: "Relevan: customer story — social proof kuat untuk konversi" },
      { postId: "s7", score: 68, note: "Relevan tapi terlalu broad — 'top brands' tidak spesifik ke AI marketing" },
      { postId: "s8", score: 78, note: "Relevan: specific pain points di AI marketing yang banyak dialami target" },
      { postId: "s9", score: 76, note: "Relevan untuk LinkedIn audience B2B — positioning tepat" },
    ],
  },
  {
    rank: 5, label: "Personalisasi & Behaviour User", score: 72, status: "good", icon: "🧠",
    tip: "Profil audiens stabil · High return viewer rate di Reel",
    detail: "Algoritma mempelajari behaviour individu pengguna. Konten yang sering mendapat 'second watch', di-save, atau membuat pengguna mengunjungi profil setelah menonton adalah sinyal personal affinity yang kuat — konten tersebut akan diprioritaskan untuk user tersebut.",
    actions: ["Buat seri konten bersambung untuk mendorong return visit", "Gunakan call-to-action 'follow untuk bagian selanjutnya'", "Pin konten terbaik di profil untuk first-impression yang kuat", "Analisis 'audience insight' untuk memahami demografi yang paling engaged"],
    consistencyNote: "Pola posting konsisten di rentang waktu yang sama menciptakan 'habitual viewing'. 5 dari 9 konten tayang antara Feb 23-25 — clustering ini optimal.",
    postScores: [
      { postId: "s1", score: 74, note: "Return viewer rate 34% — audiens mengenal format dan kembali untuk konten serupa" },
      { postId: "s2", score: 79, note: "Profile visit setelah tonton 8.2% — sangat kuat, indikator high-intent viewer" },
      { postId: "s3", score: 84, note: "Highest profile visit rate 11.4% — konten ini membuat orang ingin tahu lebih" },
      { postId: "s4", score: 68, note: "Return viewer 28% — sedikit lebih rendah, konten kurang memorable" },
      { postId: "s5", score: 65, note: "Profile visit 4.1% — wajar untuk product post, bukan konten discovery" },
      { postId: "s6", score: 62, note: "Profile visit 3.8% — customer story kurang mendorong profile exploration" },
      { postId: "s7", score: 72, note: "Retweet dari follower lama 62% — base audience sangat loyal di X" },
      { postId: "s8", score: 76, note: "Thread dibaca sampai selesai 71% — strong completion signal untuk X algo" },
      { postId: "s9", score: 70, note: "Connection request setelah post 18 baru — strong B2B affinity signal" },
    ],
  },
  {
    rank: 6, label: "Quality Content (Satisfaction)", score: 76, status: "good", icon: "⭐",
    tip: "Survey satisfaction 4.2/5 · Low skip rate di 3 reel terbaik",
    detail: "Platform mengukur 'satisfaction signal' melalui: rewatch, shares ke Story/Chat pribadi, komentar positif vs negatif, dan low skip rate. Konten berkualitas tinggi yang benar-benar memberi nilai mendapatkan distribusi jangka panjang (evergreen).",
    actions: ["Investasi di produksi: pencahayaan, audio jernih, editing clean", "Tambahkan nilai nyata di setiap konten — 1 insight yang bisa langsung diaplikasikan", "Minta feedback eksplisit: 'Apakah ini membantu? Comment di bawah'", "Buat konten evergreen yang masih relevan 6 bulan ke depan"],
    consistencyNote: "Kualitas konten konsisten dan meningkat — 3 konten terbaru memiliki skor tertinggi, menunjukkan iterasi dan improvement yang konsisten.",
    postScores: [
      { postId: "s1", score: 76, note: "Produksi baik, nilai edukasi tinggi, komentar positif dominan" },
      { postId: "s2", score: 83, note: "Demo produk yang clear dan clean — langsung dipahami audience" },
      { postId: "s3", score: 89, note: "Tertinggi: cerita yang relatable + nilai praktis + produksi premium" },
      { postId: "s4", score: 71, note: "Nilai cukup tapi terasa 'terburu-buru' — bisa lebih dalam di tip-nya" },
      { postId: "s5", score: 70, note: "Visual bersih, informatif, tapi kurang storytelling element" },
      { postId: "s6", score: 80, note: "Customer story sangat convincing — data before/after jelas dan believable" },
      { postId: "s7", score: 62, note: "Konten opinionated, memancing diskusi — quality dinilai subjektif" },
      { postId: "s8", score: 74, note: "Thread informatif dengan struktur baik — setiap poin bernilai" },
      { postId: "s9", score: 77, note: "Artikel LinkedIn paling polished — format B2B yang professional" },
    ],
  },
  {
    rank: 7, label: "Timing & Early Velocity", score: 81, status: "good", icon: "⚡",
    tip: "Avg early velocity tinggi · 3 konten viral dalam 2 jam pertama",
    detail: "Algoritma mengevaluasi 'early velocity' — seberapa cepat sebuah konten mendapat engagement dalam 15-60 menit pertama setelah publish. Konten yang cepat mendapat likes, comments, dan shares langsung mendapat push distribusi masif.",
    actions: ["Post saat audiens paling aktif: Selasa-Kamis pukul 18.00-21.00", "Minta tim atau komunitas loyal untuk engage dalam 15 menit pertama", "Gunakan Instagram Close Friends untuk first-wave engagement", "Reply comment sendiri segera setelah post untuk trigger notification"],
    consistencyNote: "Pola posting Feb 23-26 mengindikasikan waktu publish yang terencana baik. Konten yang tayang di jam prime (18-21.00) konsisten mendapat early velocity lebih tinggi.",
    postScores: [
      { postId: "s1", score: 85, note: "1.2K likes dalam 1 jam pertama — launch timing Senin sore optimal" },
      { postId: "s2", score: 91, note: "2.1K likes dalam 45 menit — best early velocity bulan ini" },
      { postId: "s3", score: 95, note: "2.8K likes dalam 30 menit — konten langsung masuk Explore page" },
      { postId: "s4", score: 78, note: "1.1K likes dalam 1 jam — Jumat sore lebih rendah dari ekspektasi" },
      { postId: "s5", score: 62, note: "380 likes dalam 1 jam — post statis lebih lambat, wajar" },
      { postId: "s6", score: 58, note: "280 likes dalam 1 jam — timing kurang optimal, tengah hari kerja" },
      { postId: "s7", score: 60, note: "Retweet lambat dalam 1 jam pertama — topik kontroversial butuh 'trigger' awal" },
      { postId: "s8", score: 70, note: "Thread viral setelah 2 jam — mulai lambat tapi snowball effect kuat" },
      { postId: "s9", score: 64, note: "LinkedIn post peak engagement di hari ke-2 — normal untuk platform B2B" },
    ],
  },
  {
    rank: 8, label: "Konsistensi Posting & Sinyal Channel", score: 68, status: "warn", icon: "📅",
    tip: "9 konten in 5 hari · Gap posting 1-2 hari — perlu lebih konsisten",
    detail: "Algoritma 'memberi reward' pada channel yang posting secara konsisten dan terjadwal. Channel aktif mendapat 'account health score' lebih tinggi yang berpengaruh pada distribusi baseline semua konten, bukan hanya konten terbaru.",
    actions: ["Buat content calendar 4 minggu ke depan dan jadwalkan via Meta Business Suite", "Target minimum 5 konten per minggu di Instagram, 3 tweet per hari di X", "Jangan pernah ada gap posting lebih dari 3 hari berturut-turut", "Gunakan Reels + Story + Carousel untuk variasi format dalam 1 hari"],
    consistencyNote: "9 konten dipublish dalam rentang Feb 22-26 (5 hari) — frekuensi baik namun semua terkonsentrasi dalam periode pendek. Diperlukan distribusi yang lebih merata sepanjang bulan.",
    postScores: [
      { postId: "s1", score: 72, note: "Feb 23 — slot pertama di periode aktif, channel signal baik" },
      { postId: "s2", score: 80, note: "Feb 24 — posting berturut-turut memperkuat sinyal channel aktif" },
      { postId: "s3", score: 86, note: "Feb 25 — konsistensi 3 hari berturut-turut dibalas distribusi lebih luas" },
      { postId: "s4", score: 65, note: "Feb 26 — masih konsisten tapi frekuensi mulai terasa dipaksakan" },
      { postId: "s5", score: 70, note: "Feb 23 — double posting di 1 hari: bisa saling kanibalisasi" },
      { postId: "s6", score: 68, note: "Feb 24 — double posting day: reach terbagi antar konten" },
      { postId: "s7", score: 60, note: "Feb 24 (X) — aktif di multi-platform di hari sama: efisien tapi perlu monitoring" },
      { postId: "s8", score: 55, note: "Feb 22 — paling awal, gap 2 hari sebelumnya menurunkan channel warmth" },
      { postId: "s9", score: 64, note: "Feb 25 (LinkedIn) — konsisten cross-platform, bagus untuk brand authority" },
    ],
  },
  {
    rank: 9, label: "Originalitas & Kepatuhan Aturan", score: 88, status: "good", icon: "✅",
    tip: "0 copyright strike · Semua konten original · No shadowban signal",
    detail: "Platform secara otomatis mendeteksi konten yang melanggar hak cipta (musik, video, gambar), menggunakan template terlalu umum, atau berulang (repost). Konten original yang unik mendapat distribusi prioritas vs konten yang direcycle atau menyerupai konten lain.",
    actions: ["Gunakan hanya musik dari Instagram/TikTok music library atau royalty-free", "Ciptakan visual style unik yang tidak menyerupai kompetitor langsung", "Hindari repost konten lama — edit signifikan sebelum reupload", "Pantau Community Guidelines update setiap kuartal"],
    consistencyNote: "Track record originalitas sempurna — 0 strike, 0 konten dihapus platform. Sinyal kesehatan akun sangat kuat untuk distribusi jangka panjang.",
    postScores: [
      { postId: "s1", score: 90, note: "Original concept, musik licensed — sinyal bersih dari platform" },
      { postId: "s2", score: 88, note: "Demo screen recording original — tidak ada konten third-party" },
      { postId: "s3", score: 92, note: "Fully original narrative, zero compliance issue" },
      { postId: "s4", score: 82, note: "Original tapi format 'tip' sering digunakan — perlu lebih diferensiasi" },
      { postId: "s5", score: 88, note: "Product screenshot original, branding konsisten" },
      { postId: "s6", score: 90, note: "Customer testimony dengan izin — compliance sempurna" },
      { postId: "s7", score: 85, note: "Tweet opini original — perlu hati-hati dengan klaim yang bisa dipermasalahkan" },
      { postId: "s8", score: 88, note: "Thread informatif tanpa sumber yang perlu di-cite — safe" },
      { postId: "s9", score: 82, note: "Artikel LinkedIn original, tidak ada plagiarism signal" },
    ],
  },
  {
    rank: 10, label: "Kemampuan Membangun Session & Binge Watching", score: 54, status: "warn", icon: "🔄",
    tip: "Avg session depth 1.4 konten · Belum ada seri konten bersambung",
    detail: "Algoritma sangat menghargai channel yang membuat penonton menonton beberapa konten secara berturut-turut dalam satu session. Ini terjadi ketika ada seri konten, ending yang memotivasi lanjut ke konten berikutnya, atau profil yang sangat terkurasi sehingga penonton terus scroll.",
    actions: ["Buat seri konten eksplisit: 'Part 1/5', 'Part 2/5' dll", "Akhiri setiap reel dengan 'Lanjut di video berikutnya...'", "Pin konten terbaik secara strategis agar urutan profil terasa seperti playlist", "Gunakan fitur Instagram Guide atau LinkedIn Newsletter untuk bundling konten"],
    consistencyNote: "Belum ada strategi seri konten yang terstruktur. Konten saat ini berdiri sendiri — oportunitas besar untuk meningkatkan session depth dan binge signal.",
    postScores: [
      { postId: "s1", score: 68, note: "Tidak ada CTA ke konten lanjutan — penonton berhenti setelah menonton" },
      { postId: "s2", score: 76, note: "Penonton 34% lanjut ke profil — cukup baik tapi belum ada seri eksplisit" },
      { postId: "s3", score: 82, note: "Terbaik: 41% profil visit, banyak yang menonton konten lama juga" },
      { postId: "s4", score: 61, note: "Rendah — konten berdiri sendiri, tidak ada link ke konten lain" },
      { postId: "s5", score: 44, note: "Feature spotlight harusnya bagian dari seri, tapi tidak ada CTA ke seri" },
      { postId: "s6", score: 40, note: "Customer story isolated — tidak ada referensi ke konten terkait lainnya" },
      { postId: "s7", score: 38, note: "Tweet tidak mendorong exploration profil — low session contribution" },
      { postId: "s8", score: 52, note: "Thread mendorong follow tapi tidak ada deep link ke profil/konten lain" },
      { postId: "s9", score: 46, note: "LinkedIn artikel terisolasi dari content series — missed opportunity" },
    ],
  },
];

// ── Score data (biweekly) ─────────────────────────────────────────
const scores = {
  seo: { score: 74, prev: 68, updatedAt: "Feb 16, 2026", nextUpdate: "Mar 2, 2026" },
  geo: { score: 59, prev: 54, updatedAt: "Feb 16, 2026", nextUpdate: "Mar 2, 2026" },
  social: { score: 82, prev: 79, updatedAt: "Feb 16, 2026", nextUpdate: "Mar 2, 2026" },
};

// ── Helpers ──────────────────────────────────────────────────────
function TrendBadge({ trend, pct }: { trend: "up" | "down" | "flat"; pct: number }) {
  if (trend === "up") return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">↑ {pct}%</span>;
  if (trend === "down") return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500 dark:text-red-400">↓ {pct}%</span>;
  return <span className="text-[10px] font-medium text-gray-400">→ {pct}%</span>;
}

function formatNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-2 px-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

// ── SEO Factor type ───────────────────────────────────────────────
interface KeywordData {
  keyword: string;
  position: number;
  volume: number;
  status: "monitored" | "optimized" | "suggested";
}

interface TechIssue {
  label: string;
  severity: "ok" | "warn" | "error";
  detail: string;
}

interface BacklinkData {
  domain: string;
  da: number; // Domain Authority 0-100
  type: "editorial" | "guest" | "directory" | "mention";
  anchorText: string;
  doFollow: boolean;
}

interface SeoFactor {
  rank: number;
  label: string;
  score: number;
  status: "good" | "warn" | "low";
  icon: string;
  tip: string;
  detail: string;
  actions: string[];
  keywords?: KeywordData[];
  techIssues?: TechIssue[];
  backlinks?: BacklinkData[];
}

// ── GEO Factor type ───────────────────────────────────────────────
interface PlatformScore {
  engine: "ChatGPT" | "Perplexity" | "Gemini" | "Claude" | "Grok";
  icon: string;
  score: number;
  analysis: string;
  suggestion: string;
}

interface GeoFactor {
  rank: number;
  label: string;
  score: number;
  status: "good" | "warn" | "low";
  icon: string;
  tip: string;
  detail: string;
  actions: string[];
  platforms: PlatformScore[];
}

const geoFactors: GeoFactor[] = [
  {
    rank: 1, label: "E-E-A-T (Kredibilitas Brand)", score: 62, status: "warn", icon: "🏛️",
    tip: "Brand mentions tumbuh 34% · Belum ada Wikipedia page",
    detail: "AI engines memprioritaskan brand yang menunjukkan Experience, Expertise, Authoritativeness, dan Trustworthiness nyata — diukur dari brand mentions di media terpercaya, profil founder terverifikasi, dan konsistensi klaim di seluruh web.",
    actions: ["Buat halaman Wikipedia atau Wikidata entry untuk GeoVera", "Dapatkan wawancara di media DA > 70", "Pastikan profil LinkedIn CEO/Founder lengkap & aktif", "Publish case study dengan data nyata"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 68, analysis: "GeoVera dikenali sebagai platform AI marketing, namun kredibilitas masih lemah karena tidak ada Wikipedia entry dan media coverage terbatas.", suggestion: "Dapatkan coverage di TechCrunch atau Entrepreneur untuk meningkatkan sinyal E-E-A-T di ChatGPT." },
      { engine: "Perplexity", icon: "🔍", score: 74, analysis: "Perplexity mendeteksi ProductHunt listing dan beberapa review G2. Brand authority masih di bawah kompetitor seperti HubSpot atau Sprout Social.", suggestion: "Tingkatkan review di G2 dan Capterra — Perplexity sering mensitasi platform review ini." },
      { engine: "Gemini", icon: "✨", score: 58, analysis: "Gemini kesulitan memverifikasi klaim expertise GeoVera karena kurangnya referensi dari sumber Google-trusted seperti Wikipedia dan media nasional.", suggestion: "Buat Google Business Profile yang lengkap dan dapatkan feature di media yang terindeks Google News." },
      { engine: "Claude", icon: "🧠", score: 61, analysis: "Claude mengenali GeoVera dari konteks konten blog, namun tidak menemukan cukup sinyal otoritas eksternal untuk mengutipnya sebagai sumber terpercaya.", suggestion: "Publish original research atau whitepaper yang bisa direferensikan oleh situs lain." },
      { engine: "Grok", icon: "⚡", score: 51, analysis: "Grok (berbasis X/Twitter) mendeteksi aktivitas brand di X namun engagement masih rendah. Follower count dan interaksi tidak cukup untuk sinyal authority.", suggestion: "Bangun kehadiran X yang kuat — retweet dari akun berpengaruh di industri AI marketing sangat membantu." },
    ],
  },
  {
    rank: 2, label: "Struktur Konten (Answer-Ready)", score: 71, status: "good", icon: "📋",
    tip: "68% artikel menggunakan format FAQ · H2 deskriptif",
    detail: "Konten 'answer-ready' menggunakan format pertanyaan-jawaban, heading deskriptif, bullet points ringkas, dan definisi yang jelas — memudahkan AI untuk mengutip dan mensintesis informasi dari brand.",
    actions: ["Tambah blok FAQ schema di setiap artikel pillar", "Gunakan heading berbentuk pertanyaan", "Tulis definisi singkat untuk setiap konsep kunci", "Gunakan tabel perbandingan dan bullet points terstruktur"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 76, analysis: "ChatGPT berhasil mengekstrak jawaban langsung dari artikel GeoVera di 4 dari 6 query yang diuji. Format FAQ di blog berkontribusi signifikan.", suggestion: "Perluas FAQ section di artikel utama dengan pertanyaan long-tail yang sering dicari user." },
      { engine: "Perplexity", icon: "🔍", score: 79, analysis: "Perplexity mengutip konten GeoVera 21 kali dalam 25 query. Struktur heading H2 yang deskriptif memudahkan Perplexity mengekstrak jawaban spesifik.", suggestion: "Tambah TL;DR box di awal setiap artikel — Perplexity sangat sering mengutip ringkasan singkat." },
      { engine: "Gemini", icon: "✨", score: 65, analysis: "Gemini berhasil mensintesis konten GeoVera namun sering memilih sumber lain untuk jawaban definitif. Konten kurang 'opinionated' untuk selera Gemini.", suggestion: "Buat konten dengan stance yang jelas dan berbeda — Gemini lebih suka kutip sumber dengan sudut pandang unik." },
      { engine: "Claude", icon: "🧠", score: 72, analysis: "Claude mengevaluasi struktur konten GeoVera sebagai baik — definisi konsep jelas dan flow logis. Namun depth analisis di beberapa artikel masih dangkal.", suggestion: "Perkuat section 'Analisis Mendalam' di setiap artikel dengan data dan reasoning yang lebih detail." },
      { engine: "Grok", icon: "⚡", score: 63, analysis: "Grok menemukan konten GeoVera kurang relevan untuk query real-time. Format konten sudah baik namun kurang membahas tren dan berita terkini.", suggestion: "Tambah 'What's New' atau 'Update Terkini' di artikel evergreen untuk boost freshness signal di Grok." },
    ],
  },
  {
    rank: 3, label: "Kedalaman Topik & Topical Authority", score: 58, status: "warn", icon: "🎯",
    tip: "Cluster AI Marketing kuat · GEO & Brand Intelligence perlu diperdalam",
    detail: "AI engines menilai seberapa dalam brand membahas topik tertentu. Topical authority dibangun ketika satu brand konsisten menjadi sumber terpercaya untuk subtopik tertentu dengan nuansa dan insight unik.",
    actions: ["Buat 3 pillar artikel 3000+ kata untuk topik utama", "Cover setiap subtopik: GEO, AI Marketing, Brand Automation", "Lakukan original research: survey, data analysis, benchmark", "Bangun internal link cluster yang kuat"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 63, analysis: "ChatGPT mengakui GeoVera sebagai pemain di AI marketing namun belum memposisikannya sebagai authority definitif. Topik GEO dan Brand Intelligence hampir tidak terdeteksi.", suggestion: "Buat seri artikel 'The Definitive Guide to GEO' yang komprehensif — ChatGPT akan mulai mengutipnya sebagai referensi utama." },
      { engine: "Perplexity", icon: "🔍", score: 67, analysis: "Perplexity mensitasi GeoVera untuk query spesifik tentang AI marketing automation, namun untuk query tentang GEO masih mengutip kompetitor lebih sering.", suggestion: "Publish artikel riset mendalam tentang GEO dengan data original — ini akan menjadi 'go-to source' Perplexity." },
      { engine: "Gemini", icon: "✨", score: 52, analysis: "Gemini jarang mengutip GeoVera untuk topik mendalam. Konten yang ada terlalu surface-level dibanding sumber seperti HubSpot Academy atau Content Marketing Institute.", suggestion: "Buat konten setara HubSpot Academy dalam niche GEO — panjang, terstruktur, dan data-driven." },
      { engine: "Claude", icon: "🧠", score: 55, analysis: "Claude menemukan celah topical authority GeoVera: kuatnya di AI marketing surface, lemah di GEO strategy dan brand intelligence mendalam.", suggestion: "Tulis 5 artikel cluster tentang Brand Intelligence dengan subtopik yang sangat spesifik dan teknis." },
      { engine: "Grok", icon: "⚡", score: 54, analysis: "Grok mengutip GeoVera hanya sekali dari 23 query yang relevan. Konten kurang membahas tren industri terkini yang menjadi fokus Grok.", suggestion: "Buat konten reaktif terhadap tren AI yang viral — Grok sangat menyukai konten yang relevan dengan diskusi terkini." },
    ],
  },
  {
    rank: 4, label: "Freshness & Relevansi Terkini", score: 54, status: "warn", icon: "🔄",
    tip: "Avg konten usia 3.2 bulan · Update frequency perlu ditingkatkan",
    detail: "Brand yang konsisten memproduksi konten segar tentang perkembangan industri lebih sering muncul dalam jawaban AI — terutama untuk query time-sensitive seperti 'best tools 2026'.",
    actions: ["Update artikel populer dengan data terbaru setiap 60 hari", "Buat weekly digest untuk freshness sinyal", "Publish konten reaktif dalam 24-48 jam setelah tren baru", "Tambah tanggal 'last updated' yang jelas"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 55, analysis: "ChatGPT training data memiliki cutoff tetap, namun Browsing mode mendeteksi artikel GeoVera terakhir dipublish 3 bulan lalu. Skor freshness rendah untuk query 'terbaik 2026'.", suggestion: "Publish minimal 2 artikel per minggu dan update artikel lama dengan tag 'Updated [bulan ini]'." },
      { engine: "Perplexity", icon: "🔍", score: 61, analysis: "Perplexity (real-time web) mendeteksi GeoVera memiliki gap konten di Januari-Februari 2026. Kompetitor lebih aktif publikasi di periode ini.", suggestion: "Jadwalkan konten secara konsisten — setidaknya 3x per minggu untuk sinyal freshness Perplexity yang kuat." },
      { engine: "Gemini", icon: "✨", score: 49, analysis: "Gemini lebih memprioritaskan sumber yang konsisten update. GeoVera kalah dari sumber yang publish konten harian atau mingguan tentang AI marketing.", suggestion: "Buat 'AI Marketing Weekly' newsletter yang juga dipublish sebagai halaman web untuk boost freshness." },
      { engine: "Claude", icon: "🧠", score: 52, analysis: "Claude mengevaluasi relevansi konten berdasarkan kecocokan dengan perkembangan terbaru. Beberapa artikel GeoVera tidak mencerminkan perkembangan AI Q1 2026.", suggestion: "Review dan update 5 artikel terpopuler dengan perkembangan AI terbaru — tambahkan section 'Update 2026'." },
      { engine: "Grok", icon: "⚡", score: 54, analysis: "Grok sangat memprioritaskan konten real-time. GeoVera hampir tidak muncul di query Grok karena kurangnya aktivitas publikasi di 6 minggu terakhir.", suggestion: "Post thread X harian tentang tren AI marketing dan link ke artikel GeoVera — Grok mengindeks X secara real-time." },
    ],
  },
  {
    rank: 5, label: "Sinyal Teknis (GEO-Optimized)", score: 66, status: "warn", icon: "⚙️",
    tip: "Sitemap OK · Structured data 60% coverage · LLM.txt belum ada",
    detail: "GEO memerlukan optimasi teknis khusus di luar SEO standar: LLM.txt untuk AI crawlers, structured data yang kaya, dan meta descriptions yang ditulis sebagai AI-digestible summary.",
    actions: ["Buat file LLM.txt dan robots.txt untuk AI crawlers", "Implementasi Article, Organization, FAQPage schema", "Tulis meta descriptions sebagai AI-digestible summary", "Pastikan konten accessible tanpa JavaScript"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 70, analysis: "ChatGPT Browsing dapat mengakses halaman GeoVera dengan baik. Namun tidak ada LLM.txt yang memberi instruksi khusus tentang konten apa yang boleh dikutip.", suggestion: "Buat robots.txt dengan GPTBot directive dan LLM.txt yang mengarahkan ke konten pillar terbaik." },
      { engine: "Perplexity", icon: "🔍", score: 73, analysis: "Perplexity berhasil mengindeks sebagian besar konten GeoVera. Article schema di 60% halaman membantu, namun 40% sisanya kehilangan konteks penting.", suggestion: "Implementasi Article schema 100% coverage — prioritaskan halaman dengan traffic tertinggi lebih dulu." },
      { engine: "Gemini", icon: "✨", score: 62, analysis: "Gemini kesulitan mengekstrak informasi terstruktur dari beberapa halaman karena rendering JavaScript yang berat. Structured data tidak konsisten.", suggestion: "Pastikan semua konten ter-render sebagai static HTML — gunakan SSR atau pre-rendering untuk semua halaman." },
      { engine: "Claude", icon: "🧠", score: 65, analysis: "Claude dapat mengakses dan memahami konten GeoVera, namun Organization schema yang tidak lengkap menyebabkan ambiguitas tentang identitas dan scope bisnis.", suggestion: "Deploy Organization schema lengkap dengan sameAs links ke LinkedIn, Crunchbase, dan ProductHunt." },
      { engine: "Grok", icon: "⚡", score: 60, analysis: "Grok mengandalkan X/web untuk real-time indexing. Sinyal teknis GeoVera cukup untuk Grok, namun meta descriptions tidak dioptimasi untuk ekstraksi AI.", suggestion: "Tulis meta description sebagai 1 kalimat ringkasan yang langsung menjawab 'Apa itu GeoVera dan untuk siapa?'" },
    ],
  },
  {
    rank: 6, label: "Schema & Structured Data", score: 49, status: "low", icon: "🗂️",
    tip: "Article schema 60% · Organization schema belum lengkap · No HowTo schema",
    detail: "Schema markup memberi konteks eksplisit kepada AI engines. Organization schema dengan sameAs links ke Wikipedia dan LinkedIn membantu AI memverifikasi identitas brand. FAQ dan HowTo schema langsung meningkatkan kemungkinan dikutip.",
    actions: ["Deploy Organization schema lengkap dengan sameAs", "Tambah FAQPage schema ke 20 artikel tertinggi", "Implementasi HowTo schema untuk semua tutorial", "Gunakan BreadcrumbList schema"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 48, analysis: "ChatGPT tidak menemukan Organization schema lengkap di geovera.xyz. Akibatnya, informasi dasar tentang GeoVera (lokasi, founder, produk) sering tidak akurat dalam jawaban.", suggestion: "Deploy Organization schema dengan name, url, logo, foundingDate, dan sameAs ke semua profil publik — ini paling kritis." },
      { engine: "Perplexity", icon: "🔍", score: 55, analysis: "Perplexity memanfaatkan Article schema yang ada (60% coverage) dengan baik, namun sering kehilangan konteks di 40% halaman tanpa schema.", suggestion: "Implementasi schema di semua halaman dalam 1 sprint — gunakan JSON-LD di head document untuk kemudahan." },
      { engine: "Gemini", icon: "✨", score: 44, analysis: "Gemini sangat bergantung pada structured data untuk verifikasi entitas. Tanpa schema lengkap, GeoVera sering dikategorikan sebagai 'unverified entity'.", suggestion: "Prioritas: deploy SoftwareApplication schema dengan applicationCategory, operatingSystem, dan offers — ini format yang disukai Gemini." },
      { engine: "Claude", icon: "🧠", score: 50, analysis: "Claude mengevaluasi schema GeoVera sebagai 'minimal' — ada tapi tidak komprehensif. HowTo schema untuk tutorial sangat dibutuhkan untuk meningkatkan citability.", suggestion: "Tambah HowTo schema ke 5 artikel tutorial terpopuler — ini akan langsung meningkatkan kutipan Claude untuk query instruksional." },
      { engine: "Grok", icon: "⚡", score: 47, analysis: "Grok kurang bergantung pada structured data dibanding engine lain, namun FAQPage schema yang hilang menyebabkan Grok sering melewatkan konten FAQ GeoVera.", suggestion: "Implementasi FAQPage schema — meski Grok tidak bergantung penuh, ini meningkatkan visibilitas di semua engine sekaligus." },
    ],
  },
  {
    rank: 7, label: "Kehadiran di Sumber Training Penting", score: 41, status: "low", icon: "📚",
    tip: "ProductHunt ✓ · Wikipedia ✗ · Crunchbase ✓ · GitHub ✗",
    detail: "Data training AI berasal dari sumber berpengaruh: Wikipedia, GitHub, Reddit, Hacker News, Medium, dan direktori bisnis terpercaya. Brand yang hadir di sumber-sumber ini jauh lebih sering dikutip AI.",
    actions: ["Buat halaman Wikipedia GeoVera dengan referensi terverifikasi", "Publish artikel teknis di Medium dan Dev.to", "Aktif di Hacker News: Show HN dan komentar relevan", "Buat GitHub repo publik dengan tools AI marketing"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 38, analysis: "ChatGPT training data tidak mencakup GeoVera secara signifikan — tidak ada Wikipedia entry, minimal Reddit mention, dan tidak ada GitHub presence. Brand hampir tidak dikenal dalam model base.", suggestion: "Wikipedia adalah prioritas absolut untuk ChatGPT. Buat entry dengan referensi dari minimal 3 media terpercaya sebagai syarat verifikasi." },
      { engine: "Perplexity", icon: "🔍", score: 52, analysis: "Perplexity (real-time) dapat mengakses ProductHunt dan Crunchbase GeoVera. Namun sumber web authoritative seperti Wikipedia dan media besar masih kosong.", suggestion: "Targetkan 'Show HN' di Hacker News — satu thread yang populer di HN bisa langsung meningkatkan Perplexity visibility 3x." },
      { engine: "Gemini", icon: "✨", score: 38, analysis: "Gemini sangat bergantung pada Wikipedia dan Google Knowledge Graph. Tanpa Wikipedia entry, GeoVera tidak ada di Knowledge Graph dan hampir tidak visible di Gemini.", suggestion: "Buat Wikipedia draft dan submit ke Wikipedia:Articles for Creation — ini adalah single highest-impact action untuk Gemini." },
      { engine: "Claude", icon: "🧠", score: 43, analysis: "Claude training mencakup web data luas, namun GeoVera hampir tidak muncul karena kurangnya presence di sumber-sumber yang heavily crawled seperti GitHub dan arXiv.", suggestion: "Publish technical content di GitHub (tools, datasets, atau open-source utilities) — GitHub presence sangat mempengaruhi Claude training data." },
      { engine: "Grok", icon: "⚡", score: 31, analysis: "Grok berbasis X data. GeoVera memiliki kehadiran X yang minimal — follower rendah, engagement rendah, dan hampir tidak ada mention dari akun berpengaruh di tech/AI.", suggestion: "Invest 3 bulan membangun X presence secara serius: daily post, engage dengan AI influencer, dan dapatkan RT dari akun tech besar." },
    ],
  },
  {
    rank: 8, label: "Kejelasan Fakta & Data Terverifikasi", score: 55, status: "warn", icon: "✅",
    tip: "67% klaim didukung data · Sumber eksternal terbatas",
    detail: "AI engines memprioritaskan konten dengan klaim yang dapat diverifikasi. Original data (survei, studi kasus) adalah aset GEO terkuat karena AI engines sering mensitasi primary sources.",
    actions: ["Setiap klaim statistik harus link ke sumber primer", "Lakukan survei tahunan 'State of AI Marketing'", "Buat halaman data publik dengan benchmark industri", "Gunakan format yang mudah dikutip AI"],
    platforms: [
      { engine: "ChatGPT", icon: "🤖", score: 58, analysis: "ChatGPT menemukan beberapa klaim di artikel GeoVera tidak didukung sumber eksternal. 33% klaim statistik tidak ada referensinya, menurunkan kepercayaan model.", suggestion: "Audit semua artikel dan tambahkan footnote/link untuk setiap statistik — format '[Sumber: nama]' sangat membantu ChatGPT memverifikasi." },
      { engine: "Perplexity", icon: "🔍", score: 63, analysis: "Perplexity memberikan citation credit ke GeoVera hanya saat konten memiliki data yang jelas dengan sumber. Artikel tanpa data spesifik tidak pernah dikutip.", suggestion: "Buat '2026 AI Marketing Benchmark Report' dengan data survei original — Perplexity akan mengutipnya ratusan kali." },
      { engine: "Gemini", icon: "✨", score: 51, analysis: "Gemini menganggap banyak klaim GeoVera sebagai 'unverified assertions'. Tanpa backlink dari sumber terpercaya yang mengonfirmasi klaim tersebut, Gemini memilih sumber lain.", suggestion: "Dapatkan endorsement klaim dari sumber seperti Forrester, Gartner, atau laporan McKinsey — Gemini sangat menghormati analyst report citations." },
      { engine: "Claude", icon: "🧠", score: 57, analysis: "Claude menilai factual accuracy GeoVera sebagai 'good but not great' — fakta utama benar namun kurang presisi dan kurang primary source citations.", suggestion: "Tambah methodology section di setiap artikel yang mengklaim data — jelaskan bagaimana data dikumpulkan dan apa sampelnya." },
      { engine: "Grok", icon: "⚡", score: 45, analysis: "Grok tidak dapat memverifikasi banyak klaim GeoVera karena tidak ada diskusi tentang data tersebut di X. Klaim yang tidak dibicarakan di media sosial dianggap less credible.", suggestion: "Share data dan statistik GeoVera di X dengan visualisasi menarik — diskusi dan RT dari komunitas akan meningkatkan kredibilitas di Grok." },
    ],
  },
];

// ── Right Detail Panel ───────────────────────────────────────────
type SelectedItem =
  | { type: "content"; item: ContentItem }
  | { type: "geo"; item: GeoItem }
  | { type: "social"; item: SocialItem }
  | { type: "seo-factor"; item: SeoFactor }
  | { type: "geo-factor"; item: GeoFactor }
  | { type: "social-factor"; item: SocialFactor }
  | null;

interface PageSpeedResult {
  url: string;
  strategy: "mobile" | "desktop";
  scores: { performance?: number };
  metrics: Record<string, { title: string; displayValue: string; score: number | null }>;
  fetchTime: string | null;
}

function DetailPanel({ selected, section }: { selected: SelectedItem; section: AnalyticsSection }) {
  const [psData, setPsData] = React.useState<{ mobile: PageSpeedResult | null; desktop: PageSpeedResult | null }>({ mobile: null, desktop: null });
  const [psLoading, setPsLoading] = React.useState(false);

  const isPageSpeedFactor = selected?.type === "seo-factor" && selected.item.rank === 5;

  React.useEffect(() => {
    if (!isPageSpeedFactor || psData.mobile) return;
    setPsLoading(true);
    const base = "https://vozjwptzutolvkvfpknk.supabase.co/functions/v1/pagespeed-check";
    Promise.all([
      fetch(`${base}?url=https://geovera.xyz&strategy=mobile`).then((r) => r.json()),
      fetch(`${base}?url=https://geovera.xyz&strategy=desktop`).then((r) => r.json()),
    ])
      .then(([mobile, desktop]) => setPsData({ mobile, desktop }))
      .finally(() => setPsLoading(false));
  }, [isPageSpeedFactor]);
  if (!selected) {
    // GEO empty state — show tracked AI platforms
    if (section === "geo") {
      const trackedPlatforms = [
        { name: "ChatGPT", icon: "🤖", desc: "OpenAI · GPT-4o" },
        { name: "Perplexity", icon: "🔍", desc: "Real-time web search" },
        { name: "Gemini", icon: "✨", desc: "Google DeepMind" },
        { name: "Claude", icon: "🧠", desc: "Anthropic" },
        { name: "Grok", icon: "⚡", desc: "xAI · X Platform" },
        { name: "Copilot", icon: "💡", desc: "Microsoft · Bing" },
      ];
      return (
        <div className="flex flex-col h-full p-4">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">AI Platforms Tracked</p>
            <p className="text-xs text-gray-400">Pilih faktor GEO untuk melihat detail analisa</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {trackedPlatforms.map((p) => (
              <div key={p.name} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{p.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{p.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    const sectionLabel = section === "seo" ? "a factor to see details" : "a post to see score";
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Select {sectionLabel}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Click any item in the center panel</p>
        </div>
      </div>
    );
  }

  // SEO Factor detail
  if (selected.type === "seo-factor") {
    const f = selected.item;
    const barColor = f.status === "good" ? "bg-green-500" : f.status === "warn" ? "bg-orange-400" : "bg-red-400";
    const scoreColor = f.status === "good" ? "text-green-600 dark:text-green-400" : f.status === "warn" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
    const badgeColor = f.status === "good" ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : f.status === "warn" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    const badgeLabel = f.status === "good" ? "Good" : f.status === "warn" ? "Needs Work" : "Low — Prioritas";
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Faktor #{f.rank}</p>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug" style={{ fontFamily: "Georgia, serif" }}>{f.label}</h3>
            </div>
            <span className={`text-2xl font-bold ${scoreColor}`}>{f.score}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${f.score}%` }} />
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badgeLabel}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* NOW */}
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">Kondisi Saat Ini</h4>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed mb-1">{f.tip}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.detail}</p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* SUGGESTED */}
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Suggested Actions</h4>
            <div className="space-y-2">
              {f.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{i + 1}</span>
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KEYWORDS — only for keyword factor */}
          {f.keywords && f.keywords.length > 0 && (() => {
            const optimized = f.keywords.filter((k) => k.status === "optimized");
            const monitored = f.keywords.filter((k) => k.status === "monitored");
            const suggested = f.keywords.filter((k) => k.status === "suggested");
            return (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800" />
                <div className="space-y-3">
                  {optimized.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                        Keywords Optimized
                        <span className="ml-auto normal-case font-normal text-green-600 dark:text-green-400">{optimized.length} keywords</span>
                      </h4>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {optimized.map((k, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{k.keyword}</p>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm font-semibold text-green-600 dark:text-green-400">#{k.position}</span>
                              <span className="text-xs text-gray-400">{k.volume >= 1000 ? `${(k.volume / 1000).toFixed(1)}K` : k.volume}/mo</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {monitored.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" />
                        Keywords Monitored
                        <span className="ml-auto normal-case font-normal text-orange-500 dark:text-orange-400">{monitored.length} keywords</span>
                      </h4>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {monitored.map((k, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{k.keyword}</p>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm font-semibold text-orange-500 dark:text-orange-400">#{k.position}</span>
                              <span className="text-xs text-gray-400">{k.volume >= 1000 ? `${(k.volume / 1000).toFixed(1)}K` : k.volume}/mo</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggested.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                        Suggested Keywords
                        <span className="ml-auto normal-case font-normal text-blue-500 dark:text-blue-400">{suggested.length} keywords</span>
                      </h4>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {suggested.map((k, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                            <p className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{k.keyword}</p>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-400">{k.volume >= 1000 ? `${(k.volume / 1000).toFixed(1)}K` : k.volume}/mo</span>
                              <span className="text-[10px] font-medium text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full">Belum ranking</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* BACKLINKS — only for backlinks factor */}
          {f.backlinks && f.backlinks.length > 0 && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <div>
                <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5 flex items-center gap-2">
                  Top 10 Highest Authority Backlinks
                  <span className="ml-auto normal-case text-[10px] font-normal text-gray-400">{f.backlinks.length} domains</span>
                </h4>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {f.backlinks
                    .slice()
                    .sort((a, b) => b.da - a.da)
                    .map((bl, i) => {
                      const typeColor = bl.type === "editorial"
                        ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : bl.type === "guest"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        : bl.type === "directory"
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
                      const daColor = bl.da >= 85 ? "text-green-600 dark:text-green-400" : bl.da >= 70 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
                      return (
                        <div key={i} className="flex items-center gap-2 py-2">
                          <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 text-right">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{bl.domain}</p>
                            <p className="text-xs text-gray-400 truncate">{bl.anchorText}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColor}`}>{bl.type}</span>
                            <span className={`text-sm font-bold ${daColor}`}>DA{bl.da}</span>
                            {!bl.doFollow && <span className="text-[9px] text-gray-400 font-medium">nofollow</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}

          {/* LIVE PAGESPEED — only for Page Speed factor (rank 5) */}
          {isPageSpeedFactor && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <div>
                <h4 className="text-xs font-medium uppercase text-gray-400 mb-3 flex items-center gap-2">
                  Live Core Web Vitals
                  <span className="ml-auto flex items-center gap-1 normal-case">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Real-time</span>
                  </span>
                </h4>
                {psLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                    <span className="text-sm text-gray-400">Mengambil data live...</span>
                  </div>
                ) : psData.mobile ? (
                  <div className="space-y-4">
                    {/* Mobile vs Desktop score cards */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Mobile", icon: "📱", score: psData.mobile.scores.performance ?? 0 },
                        { label: "Desktop", icon: "🖥️", score: psData.desktop?.scores.performance ?? 0 },
                      ].map(({ label, icon, score }) => {
                        const sc = score >= 90 ? "text-green-600 dark:text-green-400" : score >= 50 ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
                        const bc = score >= 90 ? "bg-green-500" : score >= 50 ? "bg-orange-400" : "bg-red-400";
                        return (
                          <div key={label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center">
                            <p className="text-sm mb-1">{icon}</p>
                            <p className={`text-2xl font-bold ${sc}`}>{score}</p>
                            <p className="text-[10px] text-gray-400 mb-2">{label}</p>
                            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                              <div className={`h-1.5 rounded-full ${bc}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Mobile CWV metrics */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Core Web Vitals — Mobile</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {Object.entries(psData.mobile.metrics).map(([key, m]) => {
                          const s = m.score ?? 0;
                          const dot = s >= 0.9 ? "bg-green-500" : s >= 0.5 ? "bg-orange-400" : "bg-red-400";
                          return (
                            <div key={key} className="flex items-center justify-between py-2 gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                                <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{m.title}</p>
                              </div>
                              <p className="text-xs font-semibold text-gray-900 dark:text-white flex-shrink-0">{m.displayValue}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {psData.mobile.fetchTime && (
                      <p className="text-[10px] text-gray-400 text-right">
                        Diambil: {new Date(psData.mobile.fetchTime).toLocaleTimeString("id-ID")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">Gagal mengambil data. Coba lagi nanti.</p>
                )}
              </div>
            </>
          )}

          {/* TECH ISSUES — only for struktur teknis factor */}
          {f.techIssues && f.techIssues.length > 0 && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <div>
                <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5 flex items-center gap-2">
                  Technical Checks
                  <div className="ml-auto flex items-center gap-1.5 normal-case">
                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400">✓ {f.techIssues.filter((t) => t.severity === "ok").length}</span>
                    {f.techIssues.filter((t) => t.severity === "warn").length > 0 && <span className="text-[10px] font-medium text-orange-500 dark:text-orange-400">⚠ {f.techIssues.filter((t) => t.severity === "warn").length}</span>}
                    {f.techIssues.filter((t) => t.severity === "error").length > 0 && <span className="text-[10px] font-medium text-red-500 dark:text-red-400">✕ {f.techIssues.filter((t) => t.severity === "error").length}</span>}
                  </div>
                </h4>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {f.techIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-3 py-2">
                      <span className={`flex-shrink-0 mt-0.5 font-semibold ${issue.severity === "ok" ? "text-green-500" : issue.severity === "warn" ? "text-orange-400" : "text-red-500"}`}>
                        {issue.severity === "ok" ? "✓" : issue.severity === "warn" ? "⚠" : "✕"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium leading-tight mb-0.5 ${issue.severity === "ok" ? "text-green-700 dark:text-green-300" : issue.severity === "warn" ? "text-orange-600 dark:text-orange-300" : "text-red-600 dark:text-red-300"}`}>
                          {issue.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{issue.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // GEO Factor detail
  if (selected.type === "geo-factor") {
    const f = selected.item;
    const barColor = f.status === "good" ? "bg-green-500" : f.status === "warn" ? "bg-orange-400" : "bg-red-400";
    const scoreColor = f.status === "good" ? "text-green-600 dark:text-green-400" : f.status === "warn" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
    const badgeColor = f.status === "good" ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : f.status === "warn" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    const badgeLabel = f.status === "good" ? "Good" : f.status === "warn" ? "Needs Work" : "Low — Prioritas";
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">GEO Faktor #{f.rank}</p>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug" style={{ fontFamily: "Georgia, serif" }}>{f.label}</h3>
            </div>
            <span className={`text-2xl font-bold ${scoreColor}`}>{f.score}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${f.score}%` }} />
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badgeLabel}</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">Kondisi Saat Ini</h4>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed mb-1">{f.tip}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.detail}</p>
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-800" />
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Suggested Actions</h4>
            <div className="space-y-2">
              {f.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{i + 1}</span>
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* PLATFORM SCORES — per AI engine */}
          {f.platforms && f.platforms.length > 0 && (
            <>
              <div className="h-px bg-gray-100 dark:bg-gray-800" />
              <div>
                <h4 className="text-xs font-medium uppercase text-gray-400 mb-3">Score per AI Platform</h4>
                <div className="space-y-4">
                  {f.platforms.map((p) => {
                    const pBarColor = p.score >= 70 ? "bg-green-500" : p.score >= 50 ? "bg-brand-500" : "bg-orange-400";
                    const pScoreColor = p.score >= 70 ? "text-green-600 dark:text-green-400" : p.score >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
                    return (
                      <div key={p.engine} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                        {/* Engine header + score */}
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{p.icon}</span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">{p.engine}</span>
                          <span className={`text-lg font-bold ${pScoreColor}`}>{p.score}</span>
                        </div>
                        {/* Score bar */}
                        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className={`h-1.5 rounded-full transition-all ${pBarColor}`} style={{ width: `${p.score}%` }} />
                        </div>
                        {/* Analysis */}
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{p.analysis}</p>
                        {/* Suggestion */}
                        <div className="flex items-start gap-1.5 bg-brand-50 dark:bg-brand-500/5 rounded-lg px-2.5 py-2">
                          <span className="text-brand-500 flex-shrink-0 mt-0.5 text-xs">💡</span>
                          <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">{p.suggestion}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // SEO content detail
  if (selected.type === "content") {
    const c = selected.item;
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{c.platformIcon}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{c.platform}</span>
            <span className="text-[10px] text-gray-400">·</span>
            <span className="text-xs text-gray-400">{c.publishedDate}</span>
            <TrendBadge trend={c.trend} pct={c.trendPct} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug" style={{ fontFamily: "Georgia, serif" }}>
            {c.title}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Performance</h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { label: "Organic Reach", value: formatNum(c.reach) },
                { label: "Avg Engagement", value: `${c.engagement}%` },
                { label: "Saves / Bookmarks", value: formatNum(c.saves) },
                { label: "Comments", value: formatNum(c.comments) },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-400">Engagement Rate</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{c.engagement}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(c.engagement * 5, 100)}%` }} />
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">SEO Insight</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {c.trend === "up"
                ? `This article is performing ${c.trendPct}% above average in organic reach. Consider adding internal links and updating the publish date to maintain search ranking.`
                : c.trend === "down"
                ? `Organic reach dropped ${c.trendPct}%. Refresh the content with updated statistics and stronger keyword density to recover rankings.`
                : "SEO performance is stable. A/B test meta descriptions to improve click-through rate from search results."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // GEO platform detail
  if (selected.type === "geo") {
    const g = selected.item;
    const coveragePct = Math.round((g.queriesMentioned / g.totalQueries) * 100);
    const statusColor = g.status === "active"
      ? "text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400"
      : g.status === "improving"
      ? "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400"
      : "text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400";
    const statusLabel = g.status === "active" ? "Active" : g.status === "improving" ? "Improving" : "Declining";
    const visColor = g.visibilityScore >= 70 ? "text-green-600 dark:text-green-400" : g.visibilityScore >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
    const visBar = g.visibilityScore >= 70 ? "bg-green-500" : g.visibilityScore >= 50 ? "bg-brand-500" : "bg-orange-400";

    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{g.engineIcon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white" style={{ fontFamily: "Georgia, serif" }}>{g.engine}</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last checked {g.lastChecked}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{statusLabel}</span>
              <TrendBadge trend={g.trend} pct={g.trendPct} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="text-center py-2">
            <p className="text-xs font-medium uppercase text-gray-400 mb-1">Visibility Score</p>
            <p className={`text-5xl font-bold ${visColor}`}>{g.visibilityScore}</p>
            <p className="text-xs text-gray-400 mt-1">out of 100</p>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
              <div className={`h-2 rounded-full transition-all ${visBar}`} style={{ width: `${g.visibilityScore}%` }} />
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Stats</h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { label: "Queries Mentioned", value: `${g.queriesMentioned}/${g.totalQueries}` },
                { label: "Query Coverage", value: `${coveragePct}%` },
                { label: "Avg. Position", value: `#${g.avgPosition}` },
                { label: "Trend (30d)", value: `${g.trend === "up" ? "+" : g.trend === "down" ? "-" : ""}${g.trendPct}%` },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">Top Query</h4>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">&ldquo;{g.topQuery}&rdquo;</p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">GEO Insight</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {g.visibilityScore >= 70
                ? `GeoVera has strong visibility on ${g.engine} (${g.visibilityScore}/100). Maintain content freshness and authoritative citations to sustain this ranking.`
                : g.visibilityScore >= 50
                ? `Visibility on ${g.engine} is growing (${g.visibilityScore}/100). Publishing structured FAQs and brand mention content will help AI engines surface GeoVera more often.`
                : `Visibility on ${g.engine} needs work (${g.visibilityScore}/100). Create content that directly answers queries where competitors are mentioned and increase brand co-citations.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Social Factor detail
  if (selected.type === "social-factor") {
    const f = selected.item;
    const barColor = f.status === "good" ? "bg-green-500" : f.status === "warn" ? "bg-orange-400" : "bg-red-400";
    const scoreColor = f.status === "good" ? "text-green-600 dark:text-green-400" : f.status === "warn" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
    const badgeColor = f.status === "good" ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : f.status === "warn" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    const badgeLabel = f.status === "good" ? "Good" : f.status === "warn" ? "Needs Work" : "Low — Prioritas";

    // Posts with valid scores for this factor (score > 0)
    const validScores = f.postScores.filter((ps) => ps.score > 0);
    // Week buckets — 7 posts per page (28D = 4 weeks, but we have 9 posts total, show all in max 2 pages)
    const PAGE_SIZE = 7;
    const totalPages = Math.ceil(validScores.length / PAGE_SIZE);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Social Faktor #{f.rank}</p>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug" style={{ fontFamily: "Georgia, serif" }}>{f.label}</h3>
            </div>
            <span className={`text-2xl font-bold ${scoreColor}`}>{f.score}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 mb-2">
            <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${f.score}%` }} />
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badgeLabel}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Kondisi Saat Ini */}
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-1.5">Kondisi Saat Ini</h4>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed mb-1">{f.tip}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.detail}</p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Konsistensi Channel */}
          <div className="rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/20 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-500 mb-1">Konsistensi Channel</p>
            <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">{f.consistencyNote}</p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Suggested Actions */}
          <div>
            <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Suggested Actions</h4>
            <div className="space-y-2">
              {f.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">{i + 1}</span>
                  </span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Per-post scores — 7D batches, scroll to 28D */}
          {validScores.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-xs font-medium uppercase text-gray-400 flex-1">Score per Konten</h4>
                <span className="text-[10px] text-gray-400">{validScores.length} konten · 7D/batch</span>
              </div>
              <div className="space-y-3">
                {Array.from({ length: totalPages }, (_, pageIdx) => {
                  const batch = validScores.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
                  return (
                    <div key={pageIdx}>
                      {/* Week label */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {pageIdx === 0 ? "7D — Feb 23–26" : pageIdx === 1 ? "7D — Feb 16–22" : `7D — Week ${pageIdx + 1}`}
                        </span>
                        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      </div>
                      {/* Post rows */}
                      <div className="space-y-1.5">
                        {batch.map((ps) => {
                          const post = socialItems.find((si) => si.id === ps.postId);
                          if (!post) return null;
                          const pBar = ps.score >= 70 ? "bg-green-500" : ps.score >= 50 ? "bg-brand-500" : "bg-orange-400";
                          const pScore = ps.score >= 70 ? "text-green-600 dark:text-green-400" : ps.score >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
                          return (
                            <div key={ps.postId} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2.5">
                              {/* Post title row */}
                              <div className="flex items-start gap-2 mb-1.5">
                                <span className="text-sm flex-shrink-0">{post.platformIcon}</span>
                                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug flex-1 line-clamp-1">{post.title}</p>
                                <span className={`text-sm font-bold flex-shrink-0 ${pScore}`}>{ps.score}</span>
                              </div>
                              {/* Mini score bar */}
                              <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800 mb-1.5">
                                <div className={`h-1 rounded-full transition-all ${pBar}`} style={{ width: `${ps.score}%` }} />
                              </div>
                              {/* Note */}
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{ps.note}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Beyond 28D note */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  <span className="text-[10px] text-gray-400">Data &gt; 28D tersedia by request</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Social post detail — Score Card (Tasks-style flat list)
  const s = selected.item;
  const engRate = (((s.likes + s.comments + s.shares) / s.reach) * 100).toFixed(1);
  const validScores = s.factorScores.filter(x => x > 0);
  const socialScore = Math.round(validScores.reduce((a, b) => a + b, 0) / (validScores.length || 1));
  const socialScoreColor = socialScore >= 70 ? "text-green-600 dark:text-green-400" : socialScore >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
  const socialBar = socialScore >= 70 ? "bg-green-500" : socialScore >= 50 ? "bg-brand-500" : "bg-orange-400";
  return (
    <div className="flex flex-col h-full">
      {/* Image header */}
      <div className={`relative h-40 bg-gradient-to-br ${s.imageBg} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        <span className="text-7xl opacity-70 select-none">{s.imageEmoji}</span>
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="text-white text-lg drop-shadow">{s.platformIcon}</span>
          <span className="bg-black/40 text-white text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full capitalize backdrop-blur-sm">{s.type}</span>
        </div>
        <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 rounded-xl px-3 py-1.5 text-center backdrop-blur-sm">
          <p className={`text-2xl font-bold leading-none ${socialScoreColor}`}>{socialScore}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">social score</p>
        </div>
        <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1">
          <p className="text-white text-xs font-medium">{s.timestamp}</p>
        </div>
        <div className="absolute bottom-3 right-3">
          <TrendBadge trend={s.trend} pct={s.trendPct} />
        </div>
      </div>

      {/* Header — title, caption, hashtags */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug mb-2" style={{ fontFamily: "Georgia, serif" }}>{s.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{s.caption}</p>
        <div className="flex flex-wrap gap-1.5">
          {s.hashtags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-400 font-medium">{tag}</span>
          ))}
        </div>
      </div>

      {/* Scrollable body — flat list, Tasks style */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">

        {/* Overall score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium uppercase text-gray-400">Overall Social Score</h4>
            <span className={`text-base font-bold ${socialScoreColor}`}>{socialScore} / 100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={`h-2 rounded-full transition-all ${socialBar}`} style={{ width: `${socialScore}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{validScores.length} faktor aktif untuk format {s.type}</p>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Stats */}
        <div>
          <h4 className="text-xs font-medium uppercase text-gray-400 mb-2">Performance</h4>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
            {[
              { label: "Reach", value: formatNum(s.reach) },
              { label: "Engagement", value: `${engRate}%` },
              { label: "Likes", value: formatNum(s.likes) },
              { label: "Comments", value: s.comments },
              { label: "Shares / RT", value: formatNum(s.shares) },
              { label: "Saves / DM", value: formatNum(s.saves) },
              ...(s.watchRetention > 0 ? [{ label: "Watch Retention", value: `${s.watchRetention}%` }] : []),
              { label: "CTR", value: `${s.ctr}%` },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-xs text-gray-400">{m.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Score per faktor — flat divider list */}
        <div>
          <h4 className="text-xs font-medium uppercase text-gray-400 mb-3">Score per Faktor</h4>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {socialFactors.map((f, idx) => {
              const score = s.factorScores[idx] ?? 0;
              const ps = f.postScores.find(p => p.postId === s.id);
              const fBar = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-brand-500" : "bg-orange-400";
              const fScore = score >= 70 ? "text-green-600 dark:text-green-400" : score >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
              return (
                <div key={f.rank} className={`py-3 ${score === 0 ? "opacity-40" : ""}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base leading-none flex-shrink-0">{f.icon}</span>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 leading-snug">{f.label}</p>
                    <span className={`text-base font-bold flex-shrink-0 ${score === 0 ? "text-gray-400" : fScore}`}>
                      {score === 0 ? "—" : score}
                    </span>
                  </div>
                  {score > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 mb-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${fBar}`} style={{ width: `${score}%` }} />
                    </div>
                  )}
                  {ps && score > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{ps.note}</p>
                  )}
                  {score === 0 && (
                    <p className="text-xs text-gray-400 leading-relaxed">Tidak berlaku untuk format {s.type}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Score Card Component (compact) ───────────────────────────────
function ScoreCard({
  label,
  icon,
  score,
  prev,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  score: number;
  prev: number;
  active: boolean;
  onClick: () => void;
}) {
  const delta = score - prev;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const barColor = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-brand-500" : "bg-orange-400";
  const scoreColor = score >= 70 ? "text-green-600 dark:text-green-400" : score >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
        active
          ? "border-brand-500 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-500/5"
          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${scoreColor}`}>{score}</span>
          {isUp && <span className="text-[10px] font-medium text-green-600 dark:text-green-400">↑+{delta}</span>}
          {isDown && <span className="text-[10px] font-medium text-red-500 dark:text-red-400">↓{delta}</span>}
          {!isUp && !isDown && <span className="text-[10px] text-gray-400">→</span>}
        </div>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-1 rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────
// ── DB row type (from gv_social_analytics) ───────────────────────────────────
interface DbAnalyticsRow {
  id: string;
  late_post_id: string | null;
  platform: string;
  platform_icon: string | null;
  post_type: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  post_url: string | null;
  image_url: string | null;
  published_at: string | null;
  timestamp_label: string | null;
  image_bg: string | null;
  image_emoji: string | null;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  watch_retention: number;
  ctr: number;
  trend: "up" | "down" | "flat";
  trend_pct: number;
  factor_scores: number[];
  overall_score: number | null;
  synced_at: string | null;
}

function dbRowToSocialItem(row: DbAnalyticsRow): SocialItem {
  const pubDate = row.published_at ? new Date(row.published_at) : new Date();
  const pubLabel = row.timestamp_label ||
    `${pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${pubDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const publishedDate = pubDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    id:             row.id,
    title:          row.title || row.caption?.slice(0, 80) || "Post",
    caption:        row.caption || "",
    hashtags:       row.hashtags || [],
    platform:       row.platform.charAt(0).toUpperCase() + row.platform.slice(1),
    platformIcon:   row.platform_icon || "📱",
    type:           (row.post_type as SocialItem["type"]) || "post",
    publishedDate,
    timestamp:      pubLabel,
    imageBg:        row.image_bg || "from-gray-500 to-gray-700",
    imageEmoji:     row.image_emoji || "📱",
    reach:          row.reach,
    likes:          row.likes,
    comments:       row.comments,
    shares:         row.shares,
    saves:          row.saves,
    watchRetention: row.watch_retention,
    ctr:            Number(row.ctr),
    trend:          row.trend || "flat",
    trendPct:       row.trend_pct || 0,
    factorScores:   row.factor_scores?.length === 10 ? row.factor_scores : [0, 70, 65, 72, 68, 71, 75, 65, 67, 70],
  };
}

export default function AnalyticsPage() {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("seo");
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // ── Auth & subscription ──────────────────────────────────────────
  const [brandId, setBrandId] = useState(FALLBACK_BRAND_ID);
  const [currentTier, setCurrentTier] = useState<"basic" | "premium" | "partner">("basic");
  const hasAccess = TIER_ORDER[currentTier] >= TIER_ORDER[ANALYTICS_REQUIRES_TIER];

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: ub } = await supabase
          .from("user_brands")
          .select("brand_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        if (ub?.brand_id) {
          setBrandId(ub.brand_id);
          const res = await fetch("/api/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_subscription", brand_id: ub.brand_id }),
          });
          const sub = await res.json();
          if (sub.success) {
            const tier = sub.brand_payment?.subscription_tier as string | undefined;
            const mapped = tier === "partner" ? "partner" : tier === "premium" ? "premium" : "basic";
            setCurrentTier(mapped as "basic" | "premium" | "partner");
          }
        }
      } catch { /* keep defaults */ }
    };
    loadAuth();
  }, []);

  // ── Live analytics from Late API + Claude ──────────────────────────────────
  const [liveSocialItems, setLiveSocialItems] = useState<SocialItem[] | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Load from Supabase on mount
  useEffect(() => {
    fetch(`/api/analytics/sync?brand_id=${brandId}`)
      .then((r) => r.json())
      .then((res: { success: boolean; data?: DbAnalyticsRow[] }) => {
        if (res.success && res.data && res.data.length > 0) {
          setLiveSocialItems(res.data.map(dbRowToSocialItem));
          setLastSyncAt(res.data[0].synced_at || null);
        }
      })
      .catch(() => {/* fall back to demo data */});
  }, []);

  // Trigger sync from Late API
  const handleSyncAnalytics = useCallback(async () => {
    setSyncLoading(true);
    setSyncStatus("idle");
    try {
      const res = await fetch("/api/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await res.json() as { success: boolean; synced?: number; error?: string };
      if (data.success) {
        setSyncStatus("success");
        // Reload from DB
        const getRes = await fetch(`/api/analytics/sync?brand_id=${brandId}`);
        const getData = await getRes.json() as { success: boolean; data?: DbAnalyticsRow[] };
        if (getData.success && getData.data && getData.data.length > 0) {
          setLiveSocialItems(getData.data.map(dbRowToSocialItem));
          setLastSyncAt(new Date().toISOString());
        }
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    } finally {
      setSyncLoading(false);
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }, []);

  // Mobile: open right panel when item selected
  const handleSelect = (item: SelectedItem) => {
    setSelected(item);
    setMobileRightOpen(true);
  };
  const handleMobileBack = () => {
    setMobileRightOpen(false);
    setSelected(null);
  };

  // ── Tier gate ─────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="flex h-screen gap-[9px] p-[9px]">
        {/* Left nav — identical to ThreeColumnLayout */}
        <div className="w-[18%] flex-shrink-0 h-full overflow-y-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-hidden">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <NavColumn />
          </div>
        </div>

        {/* Center + Right merged — full remaining width */}
        <div className="flex-1 h-full overflow-y-auto custom-scrollbar rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 flex items-center justify-center px-8">
          <div className="w-full max-w-xl">
            {/* Lock card */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 overflow-hidden shadow-sm">

              {/* Top gradient strip */}
              <div className="h-1.5 w-full bg-gradient-to-r from-brand-400 via-brand-500 to-cyan-500" />

              <div className="px-10 py-12 text-center">
                {/* Lock icon */}
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </div>

                {/* Badge */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 mb-4">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Partner Tier Required
                </span>

                {/* Title */}
                <h2 className="text-[22px] font-bold mb-2" style={{ color: "var(--gv-color-neutral-900)", fontFamily: "Georgia, serif" }}>
                  Analytics Dashboard
                </h2>
                <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--gv-color-neutral-500)" }}>
                  Unlock deep performance insights across SEO, GEO visibility, and Social Algorithm — available exclusively for Partner tier members.
                </p>

                {/* Feature list — 3 columns side by side in wider space */}
                <div className="mb-8 grid grid-cols-3 gap-3 text-left">
                  {[
                    { icon: "📈", title: "SEO Performance", desc: "Track content reach, engagement rate, and growth trends across all published articles and posts" },
                    { icon: "🌐", title: "GEO Visibility", desc: "Monitor how AI engines like ChatGPT, Perplexity, Gemini, and Claude mention your brand" },
                    { icon: "📊", title: "Social Algorithm Score", desc: "Analyze your top 10 social algorithm factors with per-post scoring and improvement tips" },
                  ].map((f) => (
                    <div key={f.title} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                      <span className="text-2xl">{f.icon}</span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <a
                  href="/pricing-tables"
                  className="inline-block w-full max-w-xs rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white text-center hover:bg-brand-600 transition-colors"
                >
                  Upgrade to Partner
                </a>
                <p className="mt-3 text-[11px] text-gray-400">
                  Already a Partner?{" "}
                  <a href="mailto:hello@geovera.xyz" className="text-brand-500 hover:underline">
                    Contact support
                  </a>{" "}
                  to activate your access.
                </p>
              </div>
            </div>

            {/* Current plan note */}
            <p className="mt-4 text-center text-xs text-gray-400">
              Current plan: <span className="font-medium text-gray-600 dark:text-gray-300 capitalize">{currentTier}</span> ·{" "}
              Analytics requires <span className="font-medium text-amber-600 dark:text-amber-400 capitalize">{ANALYTICS_REQUIRES_TIER}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filteredContent = contentItems;
  const filteredSocial = liveSocialItems && liveSocialItems.length > 0 ? liveSocialItems : socialItems;
  const filteredGeo = geoItems;
  const isLiveData = liveSocialItems !== null && liveSocialItems.length > 0;

  const handleSectionChange = (s: AnalyticsSection) => {
    setActiveSection(s);
    setSelected(null);
  };

  const left = (
    <NavColumn>
      <h3
        className="text-sm font-semibold text-gray-900 dark:text-white px-1"
        style={{ fontFamily: "Georgia, serif" }}
      >
        Report & Analytics
      </h3>
      <p className="text-xs text-gray-400 px-1 mt-1">
        Scores updated biweekly.
      </p>
    </NavColumn>
  );

  // Active score data
  const activeScore = scores[activeSection];
  const activeDelta = activeScore.score - activeScore.prev;

  const center = (
    <div className="flex flex-col h-full">
      {/* ── Sticky top header — title + scores ── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-xl font-semibold text-gray-900 dark:text-white flex-shrink-0 px-2"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {activeSection === "seo" ? "SEO" : activeSection === "geo" ? "GEO · AI Platform" : "Social Search"}
          </h2>
          {/* Sync button — Social section only */}
          {activeSection === "social" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {isLiveData && (
                <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  Live
                </span>
              )}
              {lastSyncAt && (
                <span className="text-[10px] text-gray-400 hidden sm:block">
                  {new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={handleSyncAnalytics}
                disabled={syncLoading}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  syncStatus === "success"
                    ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                    : syncStatus === "error"
                    ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                    : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                } disabled:opacity-50`}
              >
                {syncLoading ? (
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25"/>
                    <path d="M21 12a9 9 0 00-9-9" strokeLinecap="round"/>
                  </svg>
                ) : syncStatus === "success" ? (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
                {syncLoading ? "Syncing…" : syncStatus === "success" ? "Synced!" : syncStatus === "error" ? "Failed" : "Sync Late"}
              </button>
            </div>
          )}
          </div>
      </div>

      {/* ── Scrollable content body ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-2 px-2">

      {/* ── SEO — Articles & Blog content ── */}
      {activeSection === "seo" && (
        <div>
          {/* ── Top 9 SEO Factors ── */}
          <SectionHeader label="Top Faktor SEO" />
          <div className="space-y-1 mb-4">
            {([
              { rank: 1, label: "Topical Authority & Relevansi Niche", score: 58, status: "warn" as const, icon: "🎯", tip: "Cluster konten AI Marketing sedang tumbuh", detail: "Google mengevaluasi apakah situs adalah otoritas di topik tertentu. Topical authority dibangun dengan content cluster — satu pillar page komprehensif didukung banyak artikel pendukung yang saling terhubung dalam satu niche.", actions: ["Buat pillar page untuk topik utama: 'AI Marketing'", "Tulis 5-10 artikel cluster yang link ke pillar page", "Hindari topik di luar niche inti", "Update artikel lama dengan konten terbaru secara berkala"] },
              { rank: 2, label: "Quality Content & E-E-A-T", score: 76, status: "good" as const, icon: "✍️", tip: "Avg word count 1.240 · Readability A-", detail: "Konten berkualitas adalah pondasi SEO jangka panjang. Google E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) mengevaluasi apakah konten benar-benar memberikan nilai nyata kepada pembaca.", actions: ["Target artikel pillar 2.000+ kata dengan struktur jelas", "Tambah data, statistik, dan kutipan dari sumber terpercaya", "Perbarui konten lama setiap 6 bulan", "Tambah author bio dengan kredensial yang jelas"] },
              { rank: 3, label: "Keywords & Search Intent", score: 74, status: "good" as const, icon: "🔑", tip: "18 keywords ranking Top 10 · 6 fully optimized", detail: "Riset dan penempatan keyword yang tepat memastikan konten ditemukan oleh audiens yang relevan. Fokus pada long-tail keywords dengan intent yang jelas untuk traffic berkualitas tinggi.", actions: ["Targetkan 3-5 keyword cluster per artikel", "Gunakan keyword di judul, H2, dan 100 kata pertama", "Tambah LSI keywords untuk konteks semantik", "Audit keyword yang hampir ranking (posisi 11-20)"], keywords: [
                { keyword: "AI marketing platform", position: 3, volume: 8100, status: "optimized" as const },
                { keyword: "brand automation tool", position: 5, volume: 5400, status: "optimized" as const },
                { keyword: "AI content marketing", position: 7, volume: 12000, status: "optimized" as const },
                { keyword: "marketing AI agent", position: 8, volume: 4400, status: "optimized" as const },
                { keyword: "generative engine optimization", position: 9, volume: 2900, status: "optimized" as const },
                { keyword: "AI brand management", position: 10, volume: 3600, status: "optimized" as const },
                { keyword: "automated social media marketing", position: 14, volume: 9900, status: "monitored" as const },
                { keyword: "content calendar AI", position: 16, volume: 6600, status: "monitored" as const },
                { keyword: "AI marketing tools 2026", position: 18, volume: 14800, status: "monitored" as const },
                { keyword: "brand visibility AI", position: 22, volume: 3200, status: "monitored" as const },
                { keyword: "marketing intelligence platform", position: 24, volume: 5500, status: "monitored" as const },
                { keyword: "GEO marketing strategy", position: 31, volume: 2100, status: "monitored" as const },
                { keyword: "best AI tools for startups 2026", position: 0, volume: 18500, status: "suggested" as const },
                { keyword: "how to automate brand content", position: 0, volume: 7200, status: "suggested" as const },
                { keyword: "AI SEO optimization tool", position: 0, volume: 11000, status: "suggested" as const },
                { keyword: "social media AI scheduler", position: 0, volume: 8800, status: "suggested" as const },
              ] },
              { rank: 4, label: "Struktur On-Page", score: 71, status: "good" as const, icon: "📄", tip: "H1/H2 terstruktur · Meta lengkap 85%", detail: "Struktur on-page yang benar membantu Google memahami hierarki dan topik konten. Satu H1 per halaman, H2/H3 yang deskriptif, meta title & description yang dioptimasi, dan URL yang clean adalah standar minimum.", actions: ["Pastikan setiap halaman punya meta description unik (150-160 char)", "Gunakan keyword utama di H1 dan H2 pertama", "Tambah schema markup (Article, FAQ, BreadcrumbList)", "Optimasi URL: pendek, deskriptif, pakai tanda hubung"] },
              { rank: 5, label: "Page Speed & Core Web Vitals", score: 82, status: "good" as const, icon: "⚡", tip: "Load time 1.8s · Mobile score 91/100", detail: "Kecepatan halaman dan performa mobile adalah sinyal ranking langsung Google. Core Web Vitals (LCP, FID, CLS) mengukur pengalaman nyata pengguna. Skor mobile yang baik memastikan 60%+ traffic dari smartphone mendapat pengalaman optimal.", actions: ["Aktifkan lazy loading untuk gambar & video", "Minify CSS/JS dan aktifkan Gzip compression", "Gunakan CDN untuk aset statis", "Target LCP < 2.5s dan CLS < 0.1"] },
              { rank: 6, label: "Backlinks & Link Authority", score: 38, status: "low" as const, icon: "🔗", tip: "142 backlinks · 28 referring domains", detail: "Backlink dari situs otoritatif adalah salah satu faktor ranking terkuat Google. Kualitas jauh lebih penting dari kuantitas — 10 backlink dari media nasional lebih berharga dari 1.000 backlink spam.", actions: ["Identifikasi 20 situs relevan untuk outreach setiap bulan", "Buat 'linkable assets': tool gratis, template, atau riset data", "Reclaim unlinked brand mentions via Google Alerts", "Audit dan disavow backlink toxic (spam/PBN)"], backlinks: [
                { domain: "techcrunch.com", da: 93, type: "editorial" as const, anchorText: "AI marketing platform GeoVera", doFollow: true },
                { domain: "producthunt.com", da: 89, type: "mention" as const, anchorText: "GeoVera — AI Brand Intelligence", doFollow: true },
                { domain: "hubspot.com", da: 92, type: "editorial" as const, anchorText: "best AI marketing tools 2026", doFollow: true },
                { domain: "g2.com", da: 86, type: "directory" as const, anchorText: "GeoVera reviews", doFollow: true },
                { domain: "entrepreneur.com", da: 91, type: "editorial" as const, anchorText: "AI-powered brand automation", doFollow: true },
                { domain: "medium.com", da: 94, type: "guest" as const, anchorText: "How AI is changing brand marketing", doFollow: true },
                { domain: "clutch.co", da: 82, type: "directory" as const, anchorText: "GeoVera AI Marketing", doFollow: true },
                { domain: "indiehackers.com", da: 78, type: "mention" as const, anchorText: "geovera.xyz", doFollow: false },
                { domain: "betalist.com", da: 74, type: "mention" as const, anchorText: "GeoVera", doFollow: true },
                { domain: "capterra.com", da: 88, type: "directory" as const, anchorText: "GeoVera software reviews", doFollow: true },
              ] },
              { rank: 7, label: "Domain Authority & Reputasi", score: 44, status: "low" as const, icon: "🏆", tip: "DA 34 · Perlu lebih banyak backlink berkualitas", detail: "Domain Authority (DA) mencerminkan kekuatan keseluruhan domain berdasarkan profil backlink. DA rendah berarti situs baru/muda butuh waktu dan strategi link building aktif untuk bersaing di SERP kompetitif.", actions: ["Guest posting di blog/media dengan DA > 50", "Buat konten linkable: data original, infografik, studi kasus", "Daftar di direktori bisnis terpercaya (Google Business, Clutch)", "Bangun HARO (Help A Reporter Out) untuk mention media"] },
              { rank: 8, label: "User Experience & Navigasi", score: 69, status: "warn" as const, icon: "🧭", tip: "Bounce rate 48% · Avg session 2m 14s", detail: "Google menggunakan sinyal UX seperti bounce rate, dwell time, dan click depth sebagai indikator kualitas halaman. Navigasi yang intuitif membuat pengguna mengeksplorasi lebih banyak halaman, mengirim sinyal positif ke Google.", actions: ["Tambah internal link relevan di setiap artikel (min 3)", "Buat breadcrumb navigation yang jelas", "Optimalkan above-the-fold content", "A/B test CTA untuk menurunkan bounce rate"] },
              { rank: 9, label: "Struktur Teknis & Keamanan", score: 78, status: "good" as const, icon: "🔒", tip: "HTTPS aktif · Sitemap valid · 3 item perlu perhatian", detail: "Fondasi teknis yang kuat memastikan Google bisa crawl dan index situs dengan efisien. HTTPS, sitemap XML, robots.txt yang benar, dan zero crawl errors adalah keharusan dasar SEO modern.", actions: ["Verifikasi Search Console setiap minggu", "Fix broken links dan redirect chains", "Pastikan canonical tags konsisten", "Submit sitemap ke Bing Webmaster Tools juga"], techIssues: [
                { label: "HTTPS & SSL Certificate", severity: "ok" as const, detail: "Aktif & valid hingga Des 2026. Auto-renew enabled." },
                { label: "XML Sitemap", severity: "ok" as const, detail: "Sitemap.xml tersubmit ke Google & Bing. 142 URL terindex." },
                { label: "robots.txt", severity: "ok" as const, detail: "Konfigurasi benar. Tidak ada halaman penting yang diblokir." },
                { label: "Core Web Vitals", severity: "ok" as const, detail: "LCP 1.8s · FID 12ms · CLS 0.04 — semua hijau." },
                { label: "Canonical Tags", severity: "warn" as const, detail: "8 halaman belum memiliki canonical tag. Berpotensi duplicate content." },
                { label: "Broken Internal Links", severity: "warn" as const, detail: "3 internal link mengarah ke halaman 404. Perlu diperbaiki segera." },
                { label: "Redirect Chains", severity: "warn" as const, detail: "2 redirect chain ditemukan (301→301). Sebaiknya dipersingkat ke 1 redirect." },
                { label: "Structured Data / Schema", severity: "warn" as const, detail: "Schema Article ada di 60% halaman. 40% belum memiliki markup." },
                { label: "Duplicate Meta Descriptions", severity: "error" as const, detail: "12 halaman memiliki meta description yang identik. Harus diunikkan." },
                { label: "Hreflang Tags", severity: "ok" as const, detail: "Tidak diperlukan — situs single language (EN)." },
              ] },
            ] as SeoFactor[]).map((f) => {
              const isSelected = selected?.type === "seo-factor" && selected.item.rank === f.rank;
              const barColor = f.status === "good" ? "bg-green-500" : f.status === "warn" ? "bg-orange-400" : "bg-red-400";
              const scoreColor = f.status === "good" ? "text-green-600 dark:text-green-400" : f.status === "warn" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";
              const badgeCls = f.status === "good"
                ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                : f.status === "warn"
                ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
              const badgeLabel = f.status === "good" ? "Good" : f.status === "warn" ? "Needs work" : "Low";
              return (
                <button
                  key={f.rank}
                  onClick={() => handleSelect({ type: "seo-factor", item: f })}
                  className={`w-full text-left rounded-xl border p-2.5 transition-all ${isSelected ? "border-brand-500 bg-brand-50/50 shadow-sm dark:border-brand-400 dark:bg-brand-500/5" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"}`}
                >
                  {/* Top row: icon + label */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm leading-none flex-shrink-0">{f.icon}</span>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-snug flex-1 min-w-0">{f.label}</h4>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 ${badgeCls}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  {/* Tip */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{f.tip}</p>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* ── GEO — AI Platform visibility ── */}
      {activeSection === "geo" && (
        <div>
          {/* ── Top 8 GEO Factors ── */}
          <SectionHeader label="Top Faktor GEO" />
          <div className="space-y-1 mb-4">
            {geoFactors.map((f) => {
              const isSelected = selected?.type === "geo-factor" && selected.item.rank === f.rank;
              const badgeCls = f.status === "good"
                ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                : f.status === "warn"
                ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
              const badgeLabel = f.status === "good" ? "Good" : f.status === "warn" ? "Needs work" : "Low";
              return (
                <button
                  key={f.rank}
                  onClick={() => handleSelect({ type: "geo-factor", item: f })}
                  className={`w-full text-left rounded-xl border p-2.5 transition-all ${isSelected ? "border-brand-500 bg-brand-50/50 shadow-sm dark:border-brand-400 dark:bg-brand-500/5" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm leading-none flex-shrink-0">{f.icon}</span>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white leading-snug flex-1 min-w-0">{f.label}</h4>
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 ${badgeCls}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{f.tip}</p>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* ── SOCIAL — Post cards by 7D ── */}
      {activeSection === "social" && (
        <div>
          {/* Week 1 — Feb 23–26 */}
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-2">
              {filteredSocial
                .filter(s => ["Feb 23","Feb 24","Feb 25","Feb 26"].includes(s.publishedDate))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((s) => {
                  const isSelected = selected?.type === "social" && selected.item.id === s.id;
                  const socialScore = Math.round(s.factorScores.filter(x => x > 0).reduce((a, b) => a + b, 0) / (s.factorScores.filter(x => x > 0).length || 1));
                  const scoreCol = socialScore >= 70 ? "text-green-600 dark:text-green-400" : socialScore >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
                  const scoreBadge = socialScore >= 70 ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : socialScore >= 50 ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400" : "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400";
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect({ type: "social", item: s })}
                      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
                        isSelected
                          ? "border-brand-500 shadow-md dark:border-brand-400"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                      }`}
                    >
                      {/* Image header */}
                      <div className={`relative h-32 bg-gradient-to-br ${s.imageBg} flex items-center justify-center overflow-hidden`}>
                        <span className="text-4xl opacity-80 select-none">{s.imageEmoji}</span>
                        {/* Platform + type badge */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="text-white text-sm leading-none drop-shadow">{s.platformIcon}</span>
                          <span className="bg-black/40 text-white text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full backdrop-blur-sm capitalize">{s.type}</span>
                        </div>
                        {/* Social score badge */}
                        <div className={`absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 rounded-full px-2 py-0.5 backdrop-blur-sm ${scoreCol}`}>
                          <span className="text-xs font-bold">{socialScore}</span>
                          <span className="text-[9px] font-medium text-gray-500">score</span>
                        </div>
                        {/* Trend badge */}
                        <div className="absolute bottom-2 right-2">
                          <TrendBadge trend={s.trend} pct={s.trendPct} />
                        </div>
                      </div>
                      {/* Timestamp — tepat di bawah gambar */}
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-[11px] text-gray-400">{s.timestamp}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500">👁 {formatNum(s.reach)}</span>
                          <span className="text-[11px] text-gray-500">❤️ {formatNum(s.likes)}</span>
                          <span className="text-[11px] text-gray-500">💬 {s.comments}</span>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="p-3">
                        {/* Title */}
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1.5">{s.title}</p>
                        {/* Caption */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">{s.caption}</p>
                        {/* Hashtags */}
                        <div className="flex flex-wrap gap-1">
                          {s.hashtags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs text-brand-600 dark:text-brand-400 font-medium truncate">{tag}</span>
                          ))}
                          {s.hashtags.length > 2 && <span className="text-xs text-gray-400">+{s.hashtags.length - 2}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Week 2 — Feb 16–22 */}
          <div className="mb-3">
            <div className="grid grid-cols-2 gap-2">
              {filteredSocial
                .filter(s => ["Feb 22"].includes(s.publishedDate))
                .map((s) => {
                  const isSelected = selected?.type === "social" && selected.item.id === s.id;
                  const socialScore = Math.round(s.factorScores.filter(x => x > 0).reduce((a, b) => a + b, 0) / (s.factorScores.filter(x => x > 0).length || 1));
                  const scoreCol = socialScore >= 70 ? "text-green-600 dark:text-green-400" : socialScore >= 50 ? "text-brand-600 dark:text-brand-400" : "text-orange-500 dark:text-orange-400";
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect({ type: "social", item: s })}
                      className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
                        isSelected
                          ? "border-brand-500 shadow-md dark:border-brand-400"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                      }`}
                    >
                      <div className={`relative h-32 bg-gradient-to-br ${s.imageBg} flex items-center justify-center overflow-hidden`}>
                        <span className="text-4xl opacity-80 select-none">{s.imageEmoji}</span>
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="text-white text-sm leading-none drop-shadow">{s.platformIcon}</span>
                          <span className="bg-black/40 text-white text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full backdrop-blur-sm capitalize">{s.type}</span>
                        </div>
                        <div className={`absolute top-2 right-2 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 rounded-full px-2 py-0.5 backdrop-blur-sm ${scoreCol}`}>
                          <span className="text-xs font-bold">{socialScore}</span>
                          <span className="text-[9px] font-medium text-gray-500">score</span>
                        </div>
                        <div className="absolute bottom-2 right-2">
                          <TrendBadge trend={s.trend} pct={s.trendPct} />
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 mb-1">{s.title}</p>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {s.hashtags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[10px] text-brand-600 dark:text-brand-400 font-medium truncate">{tag}</span>
                          ))}
                          {s.hashtags.length > 2 && <span className="text-[10px] text-gray-400">+{s.hashtags.length - 2}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400">{s.timestamp}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">👁 {formatNum(s.reach)}</span>
                          <span className="text-[10px] text-gray-400">❤️ {formatNum(s.likes)}</span>
                          <span className="text-[10px] text-gray-400">💬 {s.comments}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Load more — up to 60 posts / 28D, then by request */}
          <div className="flex flex-col items-center gap-1.5 py-3">
            <button className="text-xs text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-500/10 px-3 py-1.5 rounded-full hover:bg-brand-100 transition-colors">
              Load 7D berikutnya (max 12 posts/batch)
            </button>
            <p className="text-[10px] text-gray-400">Max 60 posts · 28D · lebih lanjut by request</p>
          </div>
        </div>
      )}

      </div>{/* end scrollable body */}

      {/* ── Sticky bottom tabs — SEO / GEO / Social ── */}
      <div className="sticky bottom-0 z-10 border-t border-gray-200 dark:border-gray-800 overflow-hidden rounded-b-xl">
        <div className="flex h-full">
          {([
            {
              key: "seo" as AnalyticsSection,
              label: "SEO",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              ),
            },
            {
              key: "geo" as AnalyticsSection,
              label: "GEO",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              ),
            },
            {
              key: "social" as AnalyticsSection,
              label: "Social",
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              ),
            },
          ]).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => handleSectionChange(key)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[11px] font-medium transition-colors border-r last:border-r-0 border-gray-200 dark:border-gray-800 ${
                activeSection === key
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                  : "bg-white text-gray-400 dark:bg-gray-900 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const right = <DetailPanel selected={selected} section={activeSection} />;

  return (
    <ThreeColumnLayout
      left={left}
      center={center}
      right={right}
      mobileRightOpen={mobileRightOpen}
      onMobileBack={handleMobileBack}
      mobileBackLabel="Analytics"
    />
  );
}
