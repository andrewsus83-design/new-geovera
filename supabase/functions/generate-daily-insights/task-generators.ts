// Task generation from each data source

import { InsightTask, RadarData, SearchData, HubData, ChatData } from './types.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export async function generateRadarTasks(
  supabase: SupabaseClient,
  brandId: string,
  radarData: RadarData
): Promise<InsightTask[]> {
  const tasks: InsightTask[] = [];
  const today = new Date();

  // Task Type 1: Competitor Surge Alert
  for (const competitor of radarData.competitorBrands) {
    const growthRate = await calculateGrowthRate(supabase, competitor.id, 7);

    if (growthRate > 20) {
      tasks.push({
        brand_id: brandId,
        title: `Competitor Alert: ${competitor.name} is growing rapidly`,
        why: `${competitor.name} gained ${growthRate.toFixed(1)}% mindshare in 7 days. Immediate competitor analysis needed to understand their strategy.`,
        category: 'competitor_intelligence',
        priority: 'high',
        priorityScore: 85 + growthRate * 0.5,
        deadline: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        expectedDuration: 180,
        expectedOutcome: 'Detailed report on competitor strategy, content themes, and partnership opportunities',
        successMetrics: [
          { metric: 'competitor_analysis_completed', target: 1, unit: 'report', timeframe: '48 hours' },
          { metric: 'counter_strategy_launched', target: 1, unit: 'campaign', timeframe: '7 days' },
        ],
        parameters: {
          competitorId: competitor.id,
          competitorName: competitor.name,
          growthRate: growthRate,
          timeframe: '7 days',
        },
        sourceType: 'radar',
        sourceData: {
          dataPoints: [`gv_discovered_brands:${competitor.id}`],
          confidenceScore: 0.9,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 2: Ranking Drop Alert
  if (radarData.creatorRankings.length >= 2) {
    const latestRanking = radarData.creatorRankings[0];
    const previousRanking = radarData.creatorRankings.find(
      (r) => r.snapshot_date !== latestRanking.snapshot_date
    );

    if (previousRanking) {
      const rankDrop = latestRanking.rank_position - previousRanking.rank_position;
      if (rankDrop >= 3) {
        const deadline = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
        tasks.push({
          brand_id: brandId,
          title: `Mindshare Ranking Dropped by ${rankDrop} positions`,
          why: `Your brand dropped from #${previousRanking.rank_position} to #${latestRanking.rank_position} in creator mindshare. This affects visibility and brand awareness.`,
          category: 'performance_decline',
          priority: 'urgent',
          priorityScore: 90 + rankDrop * 2,
          deadline,
          // ENFORCE: task expires at deadline (24H)
          expiresAt: deadline,
          expectedDuration: 120,
          expectedOutcome: 'Root cause analysis and action plan to recover ranking position',
          successMetrics: [
            { metric: 'ranking_recovered', target: previousRanking.rank_position, unit: 'position', timeframe: '14 days' },
          ],
          parameters: {
            currentRank: latestRanking.rank_position,
            previousRank: previousRanking.rank_position,
            rankDrop: rankDrop,
          },
          sourceType: 'radar',
          sourceData: {
            dataPoints: [`gv_creator_rankings:${latestRanking.id}`],
            confidenceScore: 0.95,
            dataAge: 12,
          },
          actionStatus: 'pending',
        });
      }
    }
  }

  // Task Type 3: Viral Trend Opportunity (72H window)
  for (const trend of radarData.activeTrends.slice(0, 3)) {
    if (trend.status === 'rising') {
      // deadline: 72H from now — trend windows are strict
      const deadline = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      tasks.push({
        brand_id: brandId,
        title: `Jump on rising trend: ${trend.trend_name}`,
        why: `Trend ${trend.trend_name} is rising with ${trend.total_posts} posts and ${trend.total_reach} reach. Early participation can boost visibility.`,
        category: 'trend_opportunity',
        priority: 'high',
        priorityScore: 75 + (trend.growth_rate || 0) * 0.3,
        deadline,
        // ENFORCE: task expires when the 72H window closes
        expiresAt: deadline,
        expectedDuration: 240,
        expectedOutcome: 'Create and publish 2-3 pieces of content aligned with this trend',
        successMetrics: [
          { metric: 'content_published', target: 3, unit: 'posts', timeframe: '3 days' },
          { metric: 'trend_reach', target: 500000, unit: 'impressions', timeframe: '7 days' },
          { metric: 'trend_engagement', target: 15000, unit: 'interactions', timeframe: '7 days' },
        ],
        parameters: {
          trendId: trend.id,
          trendName: trend.trend_name,
          trendHashtag: trend.trend_hashtag,
          totalPosts: trend.total_posts,
          growthRate: trend.growth_rate,
          keywords: trend.keywords || [],
        },
        sourceType: 'radar',
        sourceData: {
          dataPoints: [`gv_trends:${trend.id}`],
          confidenceScore: 0.85,
          dataAge: 24,
        },
        actionStatus: 'pending',
        // Link to source trend record for auto-article trigger
        trend_id: trend.id,
      });
    }
  }

  // Task Type 4: Top Creator Collaboration
  const topCreators = radarData.creatorRankings.slice(0, 5);
  for (const creator of topCreators) {
    if (creator.rank_position <= 10) {
      tasks.push({
        brand_id: brandId,
        title: `Reach out to top creator: ${creator.name}`,
        why: `Creator ${creator.name} is ranked #${creator.rank_position} with ${creator.mindshare_percentage}% mindshare. Collaboration can expand brand reach.`,
        category: 'partnership_opportunity',
        priority: 'medium',
        priorityScore: 60 + (10 - creator.rank_position) * 2,
        deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        expectedDuration: 90,
        expectedOutcome: 'Initial outreach completed, partnership proposal sent',
        parameters: {
          creatorId: creator.creator_id,
          creatorName: creator.name,
          creatorRank: creator.rank_position,
          mindsharePercent: creator.mindshare_percentage,
        },
        sourceType: 'radar',
        sourceData: {
          dataPoints: [`gv_creator_rankings:${creator.id}`],
          confidenceScore: 0.8,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 5: Content Gap Analysis
  const { data: contentGaps } = await supabase
    .from('gv_creator_content')
    .select('content_theme, COUNT(*) as theme_count')
    .contains('brand_mentions', [brandId])
    .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .group('content_theme')
    .order('theme_count', { ascending: true })
    .limit(3);

  if (contentGaps && contentGaps.length > 0) {
    const lowTheme = contentGaps[0];
    tasks.push({
      brand_id: brandId,
      title: `Content gap detected: Underrepresented in ${lowTheme.content_theme}`,
      why: `Only ${lowTheme.theme_count} pieces of ${lowTheme.content_theme} content in the last 30 days. Competitors are outpacing you in this category.`,
      category: 'content_optimization',
      priority: 'medium',
      priorityScore: 58,
      deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      expectedDuration: 180,
      expectedOutcome: 'Create 3-5 pieces of content in this underrepresented category',
      parameters: {
        contentTheme: lowTheme.content_theme,
        currentCount: lowTheme.theme_count,
        targetCount: 5,
      },
      sourceType: 'radar',
      sourceData: {
        dataPoints: ['gv_creator_content:aggregated'],
        confidenceScore: 0.82,
        dataAge: 48,
      },
      actionStatus: 'pending',
    });
  }

  // Task Type 6: Viral BuzzSumo Discovery Integration
  const { data: viralDiscoveries } = await supabase
    .from('gv_viral_discoveries')
    .select('*')
    .eq('brand_id', brandId)
    .eq('story_generated', true)
    .gte('discovery_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('peak_engagement_score', { ascending: false })
    .limit(2);

  if (viralDiscoveries && viralDiscoveries.length > 0) {
    for (const discovery of viralDiscoveries) {
      // deadline: 48H — viral windows close fast
      const deadline = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
      tasks.push({
        brand_id: brandId,
        title: `Capitalize on viral discovery: ${discovery.topic_title}`,
        why: `Viral topic with ${(discovery.estimated_reach / 1000000).toFixed(1)}M reach detected. Authority score: ${(discovery.authority_score * 100).toFixed(0)}%. Create content to ride this wave.`,
        category: 'trend_opportunity',
        priority: 'high',
        priorityScore: 78 + discovery.authority_score * 10,
        deadline,
        // ENFORCE: 48H expiry matches the viral window
        expiresAt: deadline,
        expectedDuration: 150,
        expectedOutcome: 'Publish authoritative content leveraging this viral trend',
        successMetrics: [
          { metric: 'content_published', target: 1, unit: 'article', timeframe: '48 hours' },
          { metric: 'social_shares', target: 500, unit: 'shares', timeframe: '7 days' },
        ],
        parameters: {
          discoveryId: discovery.id,
          topicTitle: discovery.topic_title,
          estimatedReach: discovery.estimated_reach,
          authorityScore: discovery.authority_score,
          platforms: discovery.social_platforms,
          keywords: discovery.trending_keywords || [],
        },
        sourceType: 'radar',
        sourceData: {
          dataPoints: [`gv_viral_discoveries:${discovery.id}`],
          aiProvider: 'perplexity',
          confidenceScore: discovery.authority_score,
          dataAge: Math.floor((Date.now() - new Date(discovery.discovery_date).getTime()) / (24 * 60 * 60 * 1000)),
        },
        actionStatus: 'pending',
        // Link to source viral discovery record for auto-article trigger
        viral_discovery_id: discovery.id,
      });
    }
  }

  // Task Type 7: Content Performance Analysis
  if (radarData.topCreatorContent.length > 0) {
    const avgEngagement = radarData.topCreatorContent.reduce((sum, c) => sum + (c.engagement_total || 0), 0) / radarData.topCreatorContent.length;
    const lowPerformers = radarData.topCreatorContent.filter(c => (c.engagement_total || 0) < avgEngagement * 0.5);

    if (lowPerformers.length >= 3) {
      tasks.push({
        brand_id: brandId,
        title: `${lowPerformers.length} pieces of content underperforming`,
        why: `${lowPerformers.length} recent posts have engagement 50% below average (${Math.round(avgEngagement)} avg). Analyze and optimize content strategy.`,
        category: 'content_optimization',
        priority: 'medium',
        priorityScore: 55,
        deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        expectedDuration: 120,
        expectedOutcome: 'Content audit completed, optimization strategy implemented',
        parameters: {
          underperformingCount: lowPerformers.length,
          averageEngagement: avgEngagement,
          threshold: avgEngagement * 0.5,
        },
        sourceType: 'radar',
        sourceData: {
          dataPoints: lowPerformers.map(c => `gv_creator_content:${c.id}`),
          confidenceScore: 0.88,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  return tasks;
}

export async function generateSearchTasks(
  supabase: SupabaseClient,
  brandId: string,
  searchData: SearchData
): Promise<InsightTask[]> {
  const tasks: InsightTask[] = [];
  const today = new Date();

  // Task Type 1: Keyword Ranking Drop
  for (const keyword of searchData.keywordPerformance) {
    if (keyword.rank_change && keyword.rank_change < -3) {
      const estimatedTrafficLoss = Math.abs(keyword.rank_change) * ((keyword.search_volume || 1000) * 0.15);
      tasks.push({
        brand_id: brandId,
        title: `Keyword '${keyword.keyword}' dropped ${Math.abs(keyword.rank_change)} positions`,
        why: `Your ranking for '${keyword.keyword}' fell from #${keyword.rank - keyword.rank_change} to #${keyword.rank}. Estimated traffic loss: ${Math.round(estimatedTrafficLoss)} visits/month.`,
        category: 'seo_alert',
        priority: 'high',
        priorityScore: 80 + Math.abs(keyword.rank_change) * 2,
        deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        expectedDuration: 150,
        expectedOutcome: 'SEO optimization plan implemented, ranking stabilized or improved',
        successMetrics: [
          { metric: 'keyword_rank', target: Math.max(1, keyword.rank - Math.abs(keyword.rank_change)), unit: 'position', timeframe: '14 days' },
          { metric: 'organic_traffic', target: Math.round(estimatedTrafficLoss), unit: 'visits', timeframe: '30 days' },
        ],
        parameters: {
          keywordId: keyword.id,
          keyword: keyword.keyword,
          currentRank: keyword.rank,
          rankChange: keyword.rank_change,
          keywordType: keyword.keyword_type,
          searchVolume: keyword.search_volume,
          estimatedTrafficLoss: Math.round(estimatedTrafficLoss),
        },
        sourceType: 'search',
        sourceData: {
          dataPoints: [`gv_keywords:${keyword.id}`],
          confidenceScore: 0.88,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 2: GEO Score Decline
  for (const location of searchData.geoScores) {
    if (location.score_change && location.score_change < -5) {
      tasks.push({
        brand_id: brandId,
        title: `GEO score dropped in ${location.location}`,
        why: `Google Maps visibility score fell from ${location.previous_score} to ${location.current_score} in ${location.location}. This impacts local discovery.`,
        category: 'local_seo_alert',
        priority: 'high',
        priorityScore: 75 + Math.abs(location.score_change) * 1.5,
        deadline: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        expectedDuration: 120,
        expectedOutcome: 'GEO optimization completed: reviews responded, photos updated, GMB profile enhanced',
        parameters: {
          location: location.location,
          currentScore: location.current_score,
          previousScore: location.previous_score,
          scoreChange: location.score_change,
        },
        sourceType: 'search',
        sourceData: {
          dataPoints: [`gv_geo_scores:${location.id}`],
          confidenceScore: 0.85,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 3: Keyword Opportunity Detection
  // Analyze competitor keywords not being tracked
  for (const competitor of searchData.competitors.slice(0, 3)) {
    const { data: competitorKeywords } = await supabase
      .from('gv_keywords')
      .select('keyword, search_volume, rank')
      .eq('brand_id', competitor.competitor_id)
      .order('search_volume', { ascending: false })
      .limit(10);

    if (competitorKeywords && competitorKeywords.length > 0) {
      const { data: ownKeywords } = await supabase
        .from('gv_keywords')
        .select('keyword')
        .eq('brand_id', brandId);

      const ownKeywordSet = new Set(ownKeywords?.map(k => k.keyword.toLowerCase()) || []);
      const untappedKeywords = competitorKeywords.filter(k => !ownKeywordSet.has(k.keyword.toLowerCase()));

      if (untappedKeywords.length > 0) {
        const topUntapped = untappedKeywords[0];
        tasks.push({
          brand_id: brandId,
          title: `New keyword opportunity: '${topUntapped.keyword}'`,
          why: `Competitor ${competitor.name} ranks #${topUntapped.rank} for '${topUntapped.keyword}' with ${topUntapped.search_volume} monthly searches. Untapped opportunity to capture traffic.`,
          category: 'keyword_opportunity',
          priority: 'medium',
          priorityScore: 65 + (topUntapped.search_volume || 0) / 100,
          deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
          expectedDuration: 180,
          expectedOutcome: 'Keyword tracked, content optimized for this keyword, initial ranking achieved',
          parameters: {
            keyword: topUntapped.keyword,
            searchVolume: topUntapped.search_volume,
            competitorRank: topUntapped.rank,
            competitorName: competitor.name,
          },
          sourceType: 'search',
          sourceData: {
            dataPoints: [`gv_competitors:${competitor.id}`],
            confidenceScore: 0.82,
            dataAge: 24,
          },
          actionStatus: 'pending',
        });
      }
    }
  }

  // Task Type 4: Positive Ranking Momentum
  const gainers = searchData.keywordPerformance.filter(k => k.rank_change && k.rank_change > 2);
  if (gainers.length > 0) {
    const topGainer = gainers.sort((a, b) => (b.rank_change || 0) - (a.rank_change || 0))[0];
    tasks.push({
      brand_id: brandId,
      title: `Momentum detected: '${topGainer.keyword}' up ${topGainer.rank_change} positions`,
      why: `Your keyword '${topGainer.keyword}' jumped from #${topGainer.rank - topGainer.rank_change} to #${topGainer.rank}. Double down on this success with additional content.`,
      category: 'content_optimization',
      priority: 'medium',
      priorityScore: 60,
      deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
      expectedDuration: 90,
      expectedOutcome: 'Create supporting content to reinforce ranking gains',
      parameters: {
        keyword: topGainer.keyword,
        rankGain: topGainer.rank_change,
        currentRank: topGainer.rank,
      },
      sourceType: 'search',
      sourceData: {
        dataPoints: [`gv_keywords:${topGainer.id}`],
        confidenceScore: 0.9,
        dataAge: 12,
      },
      actionStatus: 'pending',
    });
  }

  // Task Type 5: Zero-Click Search Opportunity
  const topKeywords = searchData.keywordPerformance
    .filter(k => k.rank > 0 && k.rank <= 10)
    .slice(0, 5);

  if (topKeywords.length > 0) {
    tasks.push({
      brand_id: brandId,
      title: `Optimize for Featured Snippets: ${topKeywords.length} opportunities`,
      why: `You rank in top 10 for ${topKeywords.length} keywords. Optimize content to capture featured snippets and increase visibility.`,
      category: 'seo_alert',
      priority: 'medium',
      priorityScore: 62,
      deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      expectedDuration: 150,
      expectedOutcome: 'Content restructured with Q&A format, lists, and tables to target featured snippets',
      parameters: {
        eligibleKeywords: topKeywords.map(k => k.keyword),
        totalOpportunities: topKeywords.length,
      },
      sourceType: 'search',
      sourceData: {
        dataPoints: topKeywords.map(k => `gv_keywords:${k.id}`),
        confidenceScore: 0.78,
        dataAge: 24,
      },
      actionStatus: 'pending',
    });
  }

  return tasks;
}

export async function generateHubTasks(
  supabase: SupabaseClient,
  brandId: string,
  hubData: HubData
): Promise<InsightTask[]> {
  const tasks: InsightTask[] = [];
  const today = new Date();

  // Task Type 1: Publish Pending Articles
  if (hubData.pendingArticles.length > 0 && hubData.quota?.remaining_quota > 0) {
    tasks.push({
      brand_id: brandId,
      title: `Review and publish ${hubData.pendingArticles.length} pending articles`,
      why: `You have ${hubData.pendingArticles.length} AI-generated articles ready for review. Publishing authoritative content boosts SEO and brand credibility.`,
      category: 'content_publishing',
      priority: 'medium',
      priorityScore: 60 + hubData.pendingArticles.length * 5,
      deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
      expectedDuration: 90,
      expectedOutcome: 'All pending articles reviewed, edited, and published on Authority Hub',
      successMetrics: [
        { metric: 'articles_published', target: hubData.pendingArticles.length, unit: 'articles', timeframe: '3 days' },
        { metric: 'seo_score', target: 85, unit: 'score', timeframe: 'per article' },
      ],
      parameters: {
        pendingCount: hubData.pendingArticles.length,
        remainingQuota: hubData.quota.remaining_quota,
        articleIds: hubData.pendingArticles.map((a) => a.id),
      },
      sourceType: 'hub',
      sourceData: {
        dataPoints: hubData.pendingArticles.map((a) => `gv_hub_generation_queue:${a.id}`),
        confidenceScore: 0.92,
        dataAge: 12,
      },
      actionStatus: 'pending',
    });
  }

  // Task Type 2: Low Performing Content Promotion
  for (const article of hubData.articles.slice(0, 5)) {
    const analytics = hubData.analytics.find((a) => a.article_id === article.id);
    const daysSincePublished = Math.floor(
      (Date.now() - new Date(article.published_at).getTime()) / (24 * 60 * 60 * 1000)
    );

    if (analytics && analytics.views < 10 && daysSincePublished > 7) {
      tasks.push({
        brand_id: brandId,
        title: `Promote underperforming article: ${article.title}`,
        why: `Article '${article.title}' has only ${analytics.views} views in ${daysSincePublished} days. Promotion can increase visibility and ROI.`,
        category: 'content_promotion',
        priority: 'low',
        priorityScore: 40 + daysSincePublished,
        deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        expectedDuration: 60,
        expectedOutcome: 'Article shared on social media, newsletter, and optimized for SEO',
        parameters: {
          articleId: article.id,
          articleTitle: article.title,
          currentViews: analytics.views,
          daysSincePublished: daysSincePublished,
        },
        sourceType: 'hub',
        sourceData: {
          dataPoints: [`gv_hub_articles:${article.id}`],
          confidenceScore: 0.75,
          dataAge: 48,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 3: Generate New Content
  if (hubData.quota?.remaining_quota > 0) {
    tasks.push({
      brand_id: brandId,
      title: `Generate new Authority Hub article (${hubData.quota.remaining_quota} credits remaining)`,
      why: `You have ${hubData.quota.remaining_quota} article credits remaining. Creating fresh content improves SEO and establishes thought leadership.`,
      category: 'content_creation',
      priority: 'medium',
      priorityScore: 55,
      deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      expectedDuration: 120,
      expectedOutcome: 'New article generated, reviewed, and published on a relevant trending topic',
      parameters: {
        remainingQuota: hubData.quota.remaining_quota,
      },
      sourceType: 'hub',
      sourceData: {
        dataPoints: [],
        confidenceScore: 0.8,
        dataAge: 12,
      },
      actionStatus: 'pending',
    });
  }

  // Task Type 4: Content Update/Refresh
  const oldArticles = hubData.articles.filter(a => {
    const daysSince = Math.floor((Date.now() - new Date(a.published_at).getTime()) / (24 * 60 * 60 * 1000));
    return daysSince > 90 && daysSince < 365;
  });

  if (oldArticles.length > 0) {
    const topOldArticle = oldArticles.sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
    const daysSince = Math.floor((Date.now() - new Date(topOldArticle.published_at).getTime()) / (24 * 60 * 60 * 1000));

    tasks.push({
      brand_id: brandId,
      title: `Refresh aging content: ${topOldArticle.title}`,
      why: `Article '${topOldArticle.title}' is ${daysSince} days old with ${topOldArticle.view_count || 0} views. Update with fresh data to maintain SEO rankings.`,
      category: 'content_optimization',
      priority: 'low',
      priorityScore: 48,
      deadline: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
      expectedDuration: 90,
      expectedOutcome: 'Article updated with current data, statistics, and examples',
      parameters: {
        articleId: topOldArticle.id,
        articleTitle: topOldArticle.title,
        daysSincePublished: daysSince,
        currentViews: topOldArticle.view_count,
      },
      sourceType: 'hub',
      sourceData: {
        dataPoints: [`gv_hub_articles:${topOldArticle.id}`],
        confidenceScore: 0.72,
        dataAge: daysSince,
      },
      actionStatus: 'pending',
    });
  }

  // Task Type 5: Content Series Opportunity
  const articlesByTopic = hubData.articles.reduce((acc, article) => {
    const topic = article.topic || 'general';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(article);
    return acc;
  }, {} as Record<string, any[]>);

  for (const [topic, articles] of Object.entries(articlesByTopic)) {
    if (articles.length >= 3 && articles.length < 5) {
      const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
      tasks.push({
        brand_id: brandId,
        title: `Expand content series: ${topic}`,
        why: `You have ${articles.length} articles on ${topic} with ${totalViews} total views. Create 2 more to complete a comprehensive content series.`,
        category: 'content_creation',
        priority: 'low',
        priorityScore: 50,
        deadline: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000),
        expectedDuration: 180,
        expectedOutcome: 'Complete content series with 5+ articles on this topic',
        parameters: {
          topic: topic,
          currentArticleCount: articles.length,
          targetCount: 5,
          totalViews: totalViews,
        },
        sourceType: 'hub',
        sourceData: {
          dataPoints: articles.map(a => `gv_hub_articles:${a.id}`),
          confidenceScore: 0.7,
          dataAge: 48,
        },
        actionStatus: 'pending',
      });
      break; // Only suggest one series opportunity
    }
  }

  return tasks;
}

export async function generateChatTasks(
  supabase: SupabaseClient,
  brandId: string,
  chatData: ChatData
): Promise<InsightTask[]> {
  const tasks: InsightTask[] = [];
  const today = new Date();

  // Task Type 1: Unaddressed AI Insights
  for (const insight of chatData.insights) {
    if (insight.priority && ['high', 'urgent'].includes(insight.priority) && !insight.action_taken) {
      tasks.push({
        brand_id: brandId,
        title: insight.title || 'Review AI Insight',
        why: insight.description || 'AI has identified an important insight for your brand',
        category: 'ai_recommendation',
        priority: insight.priority as any,
        priorityScore: insight.priority === 'urgent' ? 85 : 70,
        deadline: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
        expectedDuration: 60,
        expectedOutcome: 'Insight reviewed and actionable steps taken or dismissed with reasoning',
        parameters: {
          insightId: insight.id,
          insightType: insight.insight_type,
          confidenceScore: insight.confidence_score,
          aiProvider: insight.ai_provider,
        },
        sourceType: 'chat',
        sourceData: {
          dataPoints: [`gv_ai_insights:${insight.id}`],
          aiProvider: insight.ai_provider,
          confidenceScore: insight.confidence_score,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 2: Daily Brief Action Items
  if (chatData.briefs.length > 0) {
    const latestBrief = chatData.briefs[0];

    if (latestBrief.untapped_opportunities && latestBrief.untapped_opportunities.length > 0) {
      const topOpportunity = latestBrief.untapped_opportunities[0];
      tasks.push({
        brand_id: brandId,
        title: `Explore Blue Ocean opportunity: ${topOpportunity.topic}`,
        why: `AI detected untapped market: '${topOpportunity.topic}' with ${topOpportunity.volume} search volume and low competition. First-mover advantage available.`,
        category: 'market_opportunity',
        priority: 'high',
        priorityScore: 70 + (topOpportunity.volume || 0) / 100,
        deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
        expectedDuration: 180,
        expectedOutcome: 'Market research completed, content strategy developed for this opportunity',
        parameters: {
          topic: topOpportunity.topic,
          volume: topOpportunity.volume,
          competition: topOpportunity.competition,
          briefId: latestBrief.id,
        },
        sourceType: 'chat',
        sourceData: {
          dataPoints: [`gv_daily_briefs:${latestBrief.id}`],
          aiProvider: 'claude',
          confidenceScore: 0.85,
          dataAge: Math.floor((Date.now() - new Date(latestBrief.brief_date).getTime()) / (24 * 60 * 60 * 1000)),
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 3: Conversation Follow-ups
  const recentConversations = chatData.conversations.slice(0, 5);
  for (const conv of recentConversations) {
    if (conv.requires_followup && !conv.followup_completed) {
      tasks.push({
        brand_id: brandId,
        title: `Follow up on AI conversation: ${conv.topic || 'Discussion'}`,
        why: `Your recent conversation about ${conv.topic || 'brand strategy'} requires follow-up action. AI recommended specific next steps.`,
        category: 'ai_recommendation',
        priority: 'medium',
        priorityScore: 58,
        deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        expectedDuration: 45,
        expectedOutcome: 'Follow-up actions completed as discussed in conversation',
        parameters: {
          conversationId: conv.id,
          topic: conv.topic,
          messageCount: conv.message_count,
        },
        sourceType: 'chat',
        sourceData: {
          dataPoints: [`gv_ai_conversations:${conv.id}`],
          aiProvider: conv.ai_provider || 'claude',
          confidenceScore: 0.75,
          dataAge: Math.floor((Date.now() - new Date(conv.created_at).getTime()) / (24 * 60 * 60 * 1000)),
        },
        actionStatus: 'pending',
      });
    }
  }

  // Task Type 4: Pattern Analysis from Chat History
  if (chatData.conversations.length >= 10) {
    const topicCounts: Record<string, number> = {};
    chatData.conversations.forEach(conv => {
      const topic = conv.topic || 'general';
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const mostDiscussedTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostDiscussedTopic && mostDiscussedTopic[1] >= 3) {
      tasks.push({
        brand_id: brandId,
        title: `Recurring topic in AI chats: ${mostDiscussedTopic[0]}`,
        why: `You've discussed ${mostDiscussedTopic[0]} in ${mostDiscussedTopic[1]} recent conversations. This indicates a strategic priority that needs dedicated attention.`,
        category: 'ai_recommendation',
        priority: 'medium',
        priorityScore: 56,
        deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        expectedDuration: 120,
        expectedOutcome: 'Strategic plan developed to address this recurring topic',
        parameters: {
          topic: mostDiscussedTopic[0],
          conversationCount: mostDiscussedTopic[1],
        },
        sourceType: 'chat',
        sourceData: {
          dataPoints: chatData.conversations.map(c => `gv_ai_conversations:${c.id}`),
          aiProvider: 'claude',
          confidenceScore: 0.8,
          dataAge: 24,
        },
        actionStatus: 'pending',
      });
    }
  }

  return tasks;
}

// Helper function to calculate growth rate
async function calculateGrowthRate(
  supabase: SupabaseClient,
  competitorId: string,
  days: number
): Promise<number> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('gv_brand_marketshare')
    .select('marketshare_percentage, snapshot_date')
    .eq('brand_id', competitorId)
    .gte('snapshot_date', startDate)
    .order('snapshot_date', { ascending: false })
    .limit(2);

  if (!data || data.length < 2) {
    return 0;
  }

  const latest = data[0].marketshare_percentage;
  const previous = data[1].marketshare_percentage;

  if (previous === 0) {
    return 0;
  }

  return ((latest - previous) / previous) * 100;
}
