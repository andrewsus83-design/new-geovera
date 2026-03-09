import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * social-auto-reply
 *
 * Two-action pipeline for Smart Auto Reply feature:
 *
 * action: "fetch_and_classify"
 *   Step 1: Fetch new comments from Late API (GET /comments/list-inbox-comments)
 *   Step 2: Smart hash dedup — skip already-processed comments
 *   Step 3: Score commenter profile (follower count, verified, engagement)
 *   Step 4: Claude Haiku classify each comment:
 *           → Group A (auto_reply): simple (emojis, "thanks", "nice", one-word praise)
 *           → Group B (attention):  complex (questions, complaints, purchase intent, influencers)
 *   Step 5: For Group A — Claude Haiku generates reply draft
 *   Step 6: Write results to gv_reply_queue + gv_attention_queue
 *
 * action: "send_replies"
 *   Step 1: Fetch queued items from gv_reply_queue (status=queued, weight DESC)
 *   Step 2: Check per-platform rate limit (gv_reply_rate_limit)
 *   Step 3: POST to Late API (POST /comments/reply-to-inbox-post)
 *   Step 4: Update status in gv_reply_queue + rate limit counters
 *
 * action: "send_single"
 *   Sends a specific reply (manual or AI draft) to a single comment
 *   Used by the auto-reply UI "Send Reply" / "Send AI Reply" buttons
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://geovera.xyz",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LATE_API_BASE  = "https://getlate.dev/api/v1";
const LATE_API_KEY   = Deno.env.get("LATE_API_KEY") ?? "";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── Types ───────────────────────────────────────────────────────────────────

interface LateComment {
  id: string;
  postId: string;
  accountId: string;
  platform: string;
  text: string;
  author: {
    id: string;
    username: string;
    followerCount?: number;
    isVerified?: boolean;
  };
  timestamp: string;
  likes?: number;
}

interface ClassifyResult {
  group: "auto_reply" | "attention";
  classification?: string;   // attention only: purchase_intent|complaint|question|influencer|vip|spam|neutral
  sentiment?: string;
  urgency?: string;
  ai_reply_draft?: string;   // auto_reply only
  ai_suggestion?: string;    // attention only
  profile_score: number;
  profile_tier: string;
  weight: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function lateHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${LATE_API_KEY}`,
  };
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonErr(body: unknown, status = 500): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** SHA-256 hash of (comment_id + comment_text) for dedup */
async function smartHash(commentId: string, text: string): Promise<string> {
  const raw = `${commentId}::${text.trim().toLowerCase()}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Score commenter profile 0–100 + assign tier */
function scoreProfile(author: LateComment["author"]): { score: number; tier: string } {
  let score = 30; // baseline
  const followers = author.followerCount ?? 0;

  if (author.isVerified) score += 30;
  if (followers >= 100_000) score += 30;
  else if (followers >= 10_000) score += 20;
  else if (followers >= 1_000) score += 10;
  else if (followers < 10) score -= 10; // likely bot

  score = Math.max(0, Math.min(100, score));

  let tier = "medium";
  if (score >= 90) tier = "vip";
  else if (score >= 70) tier = "high";
  else if (score <= 20) tier = "bot";
  else if (score <= 35) tier = "low";

  return { score, tier };
}

// ── Step: Claude Haiku batch classify ───────────────────────────────────────

async function classifyComments(
  brandName: string,
  brandVoice: string,
  comments: LateComment[]
): Promise<Map<string, ClassifyResult>> {
  const results = new Map<string, ClassifyResult>();

  // Process in batches of 20 (Haiku is fast + cheap)
  const BATCH = 20;
  for (let i = 0; i < comments.length; i += BATCH) {
    const batch = comments.slice(i, i + BATCH);

    const { score: profileScore, tier: profileTier } = scoreProfile(batch[0].author);

    // Build compact input list
    const commentList = batch.map((c, idx) =>
      `${idx + 1}. [id:${c.id}] "${c.text.slice(0, 200)}" — @${c.author.username} (${c.author.followerCount ?? 0} followers)`
    ).join("\n");

    const prompt = `You are a social media manager for ${brandName}.
Brand voice: ${brandVoice}

Classify each comment and return ONLY valid JSON array (no markdown).

Comments:
${commentList}

For each comment, return:
{
  "id": "<comment id>",
  "group": "auto_reply" | "attention",
  "classification": "purchase_intent"|"complaint"|"question"|"influencer"|"vip"|"spam"|"neutral",
  "sentiment": "positive"|"neutral"|"negative",
  "urgency": "urgent"|"normal"|"low",
  "ai_reply_draft": "<short friendly reply if group=auto_reply, else null>",
  "ai_suggestion": "<brief reply strategy if group=attention, else null>"
}

RULES:
- group="auto_reply": ONLY for clearly simple comments (single emoji, "nice!", "love this", "thanks", "great", "fire", "🔥❤️", etc.)
- group="attention": questions, complaints, "how much?", "where to buy?", influencer accounts (high followers), spam, anything requiring judgment
- ai_reply_draft: max 80 characters, warm and on-brand for auto_reply comments
- Return a JSON array, one object per comment`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-20250514",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.error("[SAR] Haiku error:", res.status, await res.text());
        continue;
      }

      const data = await res.json();
      const rawText: string = data.content?.[0]?.text ?? "[]";
      const cleaned = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
      const parsed: Array<{
        id: string;
        group: "auto_reply" | "attention";
        classification?: string;
        sentiment?: string;
        urgency?: string;
        ai_reply_draft?: string | null;
        ai_suggestion?: string | null;
      }> = JSON.parse(cleaned);

      for (const item of parsed) {
        const comment = batch.find(c => c.id === item.id);
        if (!comment) continue;

        const { score, tier } = scoreProfile(comment.author);
        // VIP/Influencer overrides to attention regardless of Haiku classification
        const group = (tier === "vip" || tier === "high") ? "attention" : item.group;

        results.set(item.id, {
          group,
          classification: item.classification ?? "neutral",
          sentiment: item.sentiment ?? "neutral",
          urgency: item.urgency ?? "normal",
          ai_reply_draft: group === "auto_reply" ? (item.ai_reply_draft ?? null) : undefined,
          ai_suggestion: group === "attention" ? (item.ai_suggestion ?? null) : undefined,
          profile_score: score,
          profile_tier: tier,
          weight: score + (item.urgency === "urgent" ? 30 : item.urgency === "normal" ? 10 : 0),
        });
      }
    } catch (err) {
      console.error("[SAR] Haiku classify batch failed:", err);
    }
  }

  return results;
}

// ── Action: fetch_and_classify ───────────────────────────────────────────────

async function fetchAndClassify(supabase: ReturnType<typeof createClient>, brandId: string) {
  // Load brand info + connected Late accounts
  const { data: brand } = await supabase
    .from("gv_brands")
    .select("brand_name, late_profile_id, industry")
    .eq("id", brandId)
    .single();

  if (!brand?.late_profile_id) {
    return jsonErr({ error: "Brand has no connected Late profile. Connect platforms first." }, 400);
  }

  // Load brand voice for reply tone
  const { data: voice } = await supabase
    .from("gv_brand_voice_guidelines")
    .select("tone, language_style")
    .eq("brand_id", brandId)
    .maybeSingle();

  const brandVoice = [voice?.tone, voice?.language_style].filter(Boolean).join(", ") || "friendly and professional";

  // Fetch connected accounts from Late API
  const accountsRes = await fetch(
    `${LATE_API_BASE}/accounts?profileId=${brand.late_profile_id}`,
    { headers: lateHeaders(), signal: AbortSignal.timeout(15_000) }
  );

  if (!accountsRes.ok) {
    return jsonErr({ error: "Failed to fetch Late API accounts" }, 502);
  }

  const accountsData = await accountsRes.json();
  const accounts: Array<{ id: string; platform: string }> = accountsData.accounts ?? accountsData.data ?? [];

  if (accounts.length === 0) {
    return jsonOk({ success: true, processed: 0, message: "No connected accounts" });
  }

  let totalFetched = 0, totalQueued = 0, totalAttention = 0, totalSkipped = 0;

  // Process each connected account
  for (const account of accounts) {
    try {
      // Fetch posts with comment counts
      const postsRes = await fetch(
        `${LATE_API_BASE}/comments/list-inbox-comments?accountId=${account.id}&limit=20`,
        { headers: lateHeaders(), signal: AbortSignal.timeout(15_000) }
      );
      if (!postsRes.ok) continue;

      const postsData = await postsRes.json();
      const posts: Array<{ id: string; commentCount: number }> = postsData.posts ?? postsData.data ?? [];

      // For each post with comments, fetch the actual comments
      for (const post of posts.filter(p => (p.commentCount ?? 0) > 0).slice(0, 5)) {
        const commentsRes = await fetch(
          `${LATE_API_BASE}/comments/get-inbox-post-comments?accountId=${account.id}&postId=${post.id}&limit=50`,
          { headers: lateHeaders(), signal: AbortSignal.timeout(15_000) }
        );
        if (!commentsRes.ok) continue;

        const commentsData = await commentsRes.json();
        const rawComments: LateComment[] = (commentsData.comments ?? commentsData.data ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          postId: post.id,
          accountId: account.id,
          platform: account.platform,
          text: (c.text ?? c.content ?? "") as string,
          author: {
            id: ((c.author as Record<string, unknown>)?.id ?? "") as string,
            username: ((c.author as Record<string, unknown>)?.username ?? "unknown") as string,
            followerCount: ((c.author as Record<string, unknown>)?.followerCount ?? 0) as number,
            isVerified: ((c.author as Record<string, unknown>)?.isVerified ?? false) as boolean,
          },
          timestamp: (c.timestamp ?? c.created_at ?? new Date().toISOString()) as string,
          likes: (c.likes ?? 0) as number,
        })).filter((c: LateComment) => c.text.trim().length > 0);

        totalFetched += rawComments.length;

        // Dedup via smart hash
        const hashPairs = await Promise.all(
          rawComments.map(async c => ({ comment: c, hash: await smartHash(c.id, c.text) }))
        );

        // Check existing hashes in DB
        const hashes = hashPairs.map(h => h.hash);
        const { data: existing } = await supabase
          .from("gv_reply_queue")
          .select("comment_hash")
          .eq("brand_id", brandId)
          .in("comment_hash", hashes);

        const { data: existingAttn } = await supabase
          .from("gv_attention_queue")
          .select("comment_hash")
          .eq("brand_id", brandId)
          .in("comment_hash", hashes);

        const seenHashes = new Set([
          ...(existing ?? []).map((r: Record<string, unknown>) => r.comment_hash as string),
          ...(existingAttn ?? []).map((r: Record<string, unknown>) => r.comment_hash as string),
        ]);

        const newComments = hashPairs.filter(h => !seenHashes.has(h.hash));
        totalSkipped += hashPairs.length - newComments.length;

        if (newComments.length === 0) continue;

        // Classify with Haiku
        const classifications = await classifyComments(
          brand.brand_name,
          brandVoice,
          newComments.map(h => h.comment)
        );

        // Write to DB
        const queueRows: Record<string, unknown>[] = [];
        const attentionRows: Record<string, unknown>[] = [];

        for (const { comment, hash } of newComments) {
          const cls = classifications.get(comment.id);
          if (!cls) continue;

          const base = {
            brand_id: brandId,
            platform: account.platform,
            account_id: account.id,
            post_id: comment.postId,
            comment_id: comment.id,
            commenter_username: comment.author.username,
            commenter_id: comment.author.id,
            comment_text: comment.text,
            comment_hash: hash,
            profile_tier: cls.profile_tier,
            profile_score: cls.profile_score,
          };

          if (cls.group === "auto_reply") {
            queueRows.push({
              ...base,
              ai_reply_draft: cls.ai_reply_draft ?? null,
              weight: cls.weight,
              status: "queued",
            });
          } else {
            attentionRows.push({
              ...base,
              classification: cls.classification ?? "neutral",
              sentiment: cls.sentiment ?? "neutral",
              urgency: cls.urgency ?? "normal",
              ai_suggestion: cls.ai_suggestion ?? null,
              is_read: false,
              is_resolved: false,
            });
          }
        }

        if (queueRows.length > 0) {
          const { error } = await supabase
            .from("gv_reply_queue")
            .insert(queueRows);
          if (error) console.error("[SAR] Queue insert error:", error.message);
          else totalQueued += queueRows.length;
        }

        if (attentionRows.length > 0) {
          const { error } = await supabase
            .from("gv_attention_queue")
            .insert(attentionRows);
          if (error) console.error("[SAR] Attention insert error:", error.message);
          else totalAttention += attentionRows.length;
        }
      }
    } catch (err) {
      console.error(`[SAR] Error processing account ${account.id}:`, err);
    }
  }

  return jsonOk({
    success: true,
    fetched: totalFetched,
    skipped_duplicate: totalSkipped,
    queued_for_auto_reply: totalQueued,
    queued_for_attention: totalAttention,
  });
}

// ── Action: send_replies ─────────────────────────────────────────────────────

async function sendReplies(supabase: ReturnType<typeof createClient>, brandId: string, limit = 10) {
  const now = new Date();

  // Get queued items sorted by weight
  const { data: queued } = await supabase
    .from("gv_reply_queue")
    .select("id, platform, account_id, post_id, comment_id, ai_reply_draft, weight")
    .eq("brand_id", brandId)
    .eq("status", "queued")
    .not("ai_reply_draft", "is", null)
    .order("weight", { ascending: false })
    .limit(limit);

  if (!queued || queued.length === 0) {
    return jsonOk({ success: true, sent: 0, message: "No queued replies" });
  }

  let sent = 0, failed = 0;

  for (const item of queued) {
    // Check rate limit for this platform
    const { data: rateLimit } = await supabase
      .from("gv_reply_rate_limit")
      .select("last_reply_at, cooldown_seconds, replies_last_hour")
      .eq("brand_id", brandId)
      .eq("platform", item.platform)
      .maybeSingle();

    if (rateLimit?.last_reply_at) {
      const lastReply = new Date(rateLimit.last_reply_at);
      const cooldown = rateLimit.cooldown_seconds ?? 300;
      const elapsed = (now.getTime() - lastReply.getTime()) / 1000;
      if (elapsed < cooldown) {
        console.log(`[SAR] Rate limited on ${item.platform} — ${Math.round(cooldown - elapsed)}s remaining`);
        continue;
      }
    }

    // Hourly cap: max 20 replies per platform per hour
    if ((rateLimit?.replies_last_hour ?? 0) >= 20) {
      console.log(`[SAR] Hourly cap reached for ${item.platform}`);
      continue;
    }

    // Mark as processing
    await supabase
      .from("gv_reply_queue")
      .update({ status: "processing", updated_at: now.toISOString() })
      .eq("id", item.id);

    // Send via Late API
    try {
      const replyRes = await fetch(`${LATE_API_BASE}/comments/reply-to-inbox-post`, {
        method: "POST",
        headers: lateHeaders(),
        body: JSON.stringify({
          accountId: item.account_id,
          postId: item.post_id,
          commentId: item.comment_id,
          content: item.ai_reply_draft,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (replyRes.ok) {
        await supabase
          .from("gv_reply_queue")
          .update({ status: "sent", sent_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("id", item.id);

        // Update rate limit
        await supabase
          .from("gv_reply_rate_limit")
          .upsert({
            brand_id: brandId,
            platform: item.platform,
            last_reply_at: now.toISOString(),
            replies_last_hour: (rateLimit?.replies_last_hour ?? 0) + 1,
            updated_at: now.toISOString(),
          }, { onConflict: "brand_id,platform" });

        sent++;
      } else {
        const errText = await replyRes.text();
        await supabase
          .from("gv_reply_queue")
          .update({ status: "failed", error_message: errText, updated_at: now.toISOString() })
          .eq("id", item.id);
        failed++;
      }
    } catch (err) {
      await supabase
        .from("gv_reply_queue")
        .update({ status: "failed", error_message: String(err), updated_at: now.toISOString() })
        .eq("id", item.id);
      failed++;
    }
  }

  return jsonOk({ success: true, sent, failed, total_processed: sent + failed });
}

// ── Action: send_single ──────────────────────────────────────────────────────

async function sendSingle(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  queueId: string,
  replyText: string,
  source: "queue" | "attention"
) {
  const table = source === "queue" ? "gv_reply_queue" : "gv_attention_queue";

  const { data: item } = await supabase
    .from(table)
    .select("account_id, post_id, comment_id, platform")
    .eq("id", queueId)
    .eq("brand_id", brandId)
    .single();

  if (!item) {
    return jsonErr({ error: "Comment not found" }, 404);
  }

  const replyRes = await fetch(`${LATE_API_BASE}/comments/reply-to-inbox-post`, {
    method: "POST",
    headers: lateHeaders(),
    body: JSON.stringify({
      accountId: item.account_id,
      postId: item.post_id,
      commentId: item.comment_id,
      content: replyText,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!replyRes.ok) {
    const errText = await replyRes.text();
    return jsonErr({ error: `Late API error: ${errText}` }, 502);
  }

  const now = new Date().toISOString();

  if (source === "queue") {
    await supabase
      .from("gv_reply_queue")
      .update({ status: "sent", sent_at: now, updated_at: now })
      .eq("id", queueId);
  } else {
    await supabase
      .from("gv_attention_queue")
      .update({ is_resolved: true, resolved_at: now, updated_at: now })
      .eq("id", queueId);
  }

  return jsonOk({ success: true, sent: true });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonErr({ error: "Method not allowed" }, 405);

  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return jsonErr({ error: "Missing Authorization" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return jsonErr({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { action, brand_id, queue_id, reply_text, source, limit } = body;

  if (!brand_id) return jsonErr({ error: "brand_id is required" }, 400);

  switch (action) {
    case "fetch_and_classify":
      return await fetchAndClassify(supabase, brand_id);

    case "send_replies":
      return await sendReplies(supabase, brand_id, limit ?? 10);

    case "send_single":
      if (!queue_id || !reply_text) {
        return jsonErr({ error: "queue_id and reply_text required" }, 400);
      }
      return await sendSingle(supabase, brand_id, queue_id, reply_text, source ?? "queue");

    default:
      return jsonErr({ error: `Unknown action: ${action}. Valid: fetch_and_classify | send_replies | send_single` }, 400);
  }
});
