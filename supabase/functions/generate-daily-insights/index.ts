import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GenerateInsightsRequest, GenerateInsightsResponse, InsightTask } from "./types.ts";
import { fetchRadarData, fetchSearchData, fetchHubData, fetchChatData } from "./data-collectors.ts";
import { detectCrises } from "./crisis-detection.ts";
import {
  generateRadarTasks,
  generateSearchTasks,
  generateHubTasks,
  generateChatTasks,
} from "./task-generators.ts";
import { calculatePriorityScore, selectDiverseTasks, getTierLimit } from "./priority-scoring.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Auto-article trigger helpers ─────────────────────────────────────────────

// A task qualifies for auto-draft when it's a trend/content radar task with high score
function isAutoArticleEligible(task: InsightTask): boolean {
  return (
    (task.category === "trend_opportunity" || task.category === "content_creation") &&
    task.sourceType === "radar" &&
    task.priorityScore >= 70
  );
}

// Fire-and-forget: trigger generate-article for a qualifying task.
// Errors are swallowed so article generation failures never block the insights response.
function triggerAutoDraft(
  supabaseUrl: string,
  serviceKey: string,
  brandId: string,
  task: InsightTask
): void {
  const body = JSON.stringify({
    brand_id: brandId,
    topic: task.title,
    task_id: task.id ?? null,
    trend_id: task.parameters?.trendId ?? task.trend_id ?? null,
    viral_discovery_id: task.parameters?.discoveryId ?? task.viral_discovery_id ?? null,
    keywords: task.parameters?.keywords ?? [],
    target_platforms: ["linkedin", "website"],
    mode: "auto_draft",
  });

  fetch(`${supabaseUrl}/functions/v1/generate-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      // Sentinel header: generate-article checks this to bypass auth/quota
      "X-Service-Call": "true",
    },
    body,
  }).catch((err) => {
    console.error(`[Insights] Auto-draft trigger failed for task "${task.title}":`, err);
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const requestData: GenerateInsightsRequest = await req.json();
    const { brandId, tier, forceRegenerate } = requestData;

    if (!brandId) {
      return new Response(JSON.stringify({ error: "brandId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Insights] Generating daily insights for brand: ${brandId}, tier: ${tier}`);

    // Step 1: Check if insights already exist for today (unless force regenerate)
    const today = new Date().toISOString().split("T")[0];
    if (!forceRegenerate) {
      const { data: existingInsights } = await supabase
        .from("gv_daily_insights")
        .select("*")
        .eq("brand_id", brandId)
        .eq("insight_date", today)
        .single();

      if (existingInsights) {
        console.log(`[Insights] Found existing insights for today, returning cached data`);
        return new Response(
          JSON.stringify({
            tasks: existingInsights.tasks || [],
            crises: existingInsights.crisis_alerts || [],
            metadata: {
              generatedAt: existingInsights.created_at,
              taskCount: existingInsights.total_tasks || 0,
              crisisCount: existingInsights.crisis_count || 0,
              dataSourcesCovered: [
                existingInsights.radar_scanned && "radar",
                existingInsights.search_scanned && "search",
                existingInsights.hub_scanned && "hub",
                existingInsights.chat_scanned && "chat",
              ].filter(Boolean),
              cached: true,
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Step 2: Determine task limit based on tier
    const taskLimit = getTierLimit(tier || "basic");
    console.log(`[Insights] Task limit for tier ${tier}: ${taskLimit}`);

    // Step 3: Gather data from all sources
    console.log(`[Insights] Fetching data from all sources...`);
    const [radarData, searchData, hubData, chatData] = await Promise.all([
      fetchRadarData(supabase, brandId, 7),
      fetchSearchData(supabase, brandId, 7),
      fetchHubData(supabase, brandId, 7),
      fetchChatData(supabase, brandId, 7),
    ]);

    console.log(`[Insights] Data fetched - Radar: ${radarData.creatorRankings.length} rankings`);

    // Step 4: Detect crises (highest priority)
    console.log(`[Insights] Detecting crises...`);
    const crisisAlerts = await detectCrises(supabase, brandId, radarData, searchData);
    console.log(`[Insights] Found ${crisisAlerts.length} crisis alerts`);

    // Log crises to database
    for (const crisis of crisisAlerts) {
      await supabase.from("gv_crisis_events").insert({
        brand_id: brandId,
        crisis_type: crisis.type,
        severity: crisis.severity,
        title: crisis.title,
        description: crisis.description,
        metrics: crisis.metrics,
        recommended_actions: crisis.recommendedActions,
        detected_at: crisis.detectedAt,
        status: "active",
      });
    }

    // Step 5: Generate task candidates from each source
    console.log(`[Insights] Generating task candidates...`);
    const [radarTasks, searchTasks, hubTasks, chatTasks] = await Promise.all([
      generateRadarTasks(supabase, brandId, radarData),
      generateSearchTasks(supabase, brandId, searchData),
      generateHubTasks(supabase, brandId, hubData),
      generateChatTasks(supabase, brandId, chatData),
    ]);

    console.log(
      `[Insights] Generated - Radar: ${radarTasks.length}, Search: ${searchTasks.length}, Hub: ${hubTasks.length}, Chat: ${chatTasks.length}`
    );

    // Convert crisis alerts to tasks
    const crisisTasks: InsightTask[] = crisisAlerts.map((crisis) => ({
      brand_id: brandId,
      title: crisis.title,
      why: crisis.description,
      description: crisis.recommendedActions.join("\n"),
      category: "crisis_response",
      priority: crisis.severity === "critical" || crisis.severity === "high" ? "urgent" : "high",
      priorityScore: crisis.severity === "critical" ? 98 : crisis.severity === "high" ? 90 : 80,
      deadline: new Date(Date.now() + (crisis.severity === "critical" ? 2 : 4) * 60 * 60 * 1000),
      expectedDuration: 120,
      expectedOutcome: crisis.recommendedActions[0] || "Crisis resolved",
      parameters: crisis.metrics,
      sourceType: "crisis",
      sourceData: {
        dataPoints: [],
        confidenceScore: 0.95,
        dataAge: 1,
      },
      actionStatus: "pending",
    }));

    // Step 6: Merge all candidates
    const allCandidates = [...crisisTasks, ...radarTasks, ...searchTasks, ...hubTasks, ...chatTasks];

    // Step 7: Calculate priority scores for each task
    console.log(`[Insights] Calculating priority scores...`);
    for (const task of allCandidates) {
      task.priorityScore = calculatePriorityScore(task);
      task.createdAt = new Date();
      task.updatedAt = new Date();
    }

    // Step 8: Rank tasks by priority score
    const rankedTasks = allCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

    // Step 9: Select top N tasks (with diversity)
    console.log(`[Insights] Selecting top ${taskLimit} diverse tasks...`);
    const selectedTasks = selectDiverseTasks(rankedTasks, taskLimit);

    console.log(`[Insights] Selected ${selectedTasks.length} tasks`);

    // Step 10: Save to database
    const insightRecord = {
      brand_id: brandId,
      insight_date: today,
      tasks: selectedTasks,
      total_tasks: selectedTasks.length,
      tasks_completed: 0,
      tasks_snoozed: 0,
      tasks_dismissed: 0,
      crisis_alerts: crisisAlerts,
      crisis_level: crisisAlerts.length > 0 ? crisisAlerts[0].severity : "none",
      crisis_count: crisisAlerts.length,
      radar_scanned: radarData.creatorRankings.length > 0,
      hub_scanned: hubData.articles.length > 0,
      search_scanned: searchData.keywordPerformance.length > 0,
      chat_scanned: chatData.conversations.length > 0,
    };

    const { error: insertError } = await supabase.from("gv_daily_insights").insert(insightRecord);

    if (insertError) {
      console.error(`[Insights] Error saving insights:`, insertError);
      throw new Error(`Failed to save insights: ${insertError.message}`);
    }

    console.log(`[Insights] Successfully saved insights to database`);

    // Step 11: Fire-and-forget auto article drafts for eligible tasks.
    // Runs AFTER successful DB insert — article failures never block the insights response.
    const eligibleForAutoDraft = selectedTasks.filter(isAutoArticleEligible);
    if (eligibleForAutoDraft.length > 0) {
      console.log(`[Insights] Triggering auto-drafts for ${eligibleForAutoDraft.length} task(s)`);
      for (const task of eligibleForAutoDraft) {
        triggerAutoDraft(supabaseUrl, supabaseServiceKey, brandId, task);
      }
    }

    // Return response
    const response: GenerateInsightsResponse = {
      tasks: selectedTasks,
      crises: crisisAlerts,
      metadata: {
        generatedAt: new Date().toISOString(),
        taskCount: selectedTasks.length,
        crisisCount: crisisAlerts.length,
        dataSourcesCovered: [
          radarData.creatorRankings.length > 0 && "radar",
          searchData.keywordPerformance.length > 0 && "search",
          hubData.articles.length > 0 && "hub",
          chatData.conversations.length > 0 && "chat",
        ].filter(Boolean) as string[],
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Insights] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
