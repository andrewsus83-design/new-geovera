// Type definitions for Daily Insights system

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory =
  | 'competitor_intelligence'
  | 'performance_decline'
  | 'trend_opportunity'
  | 'partnership_opportunity'
  | 'content_optimization'
  | 'seo_alert'
  | 'keyword_opportunity'
  | 'local_seo_alert'
  | 'content_publishing'
  | 'content_promotion'
  | 'content_creation'
  | 'ai_recommendation'
  | 'market_opportunity'
  | 'crisis_response';

export type SourceType = 'radar' | 'search' | 'hub' | 'chat' | 'crisis';
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface InsightTask {
  // Core Identity
  id?: string;
  brand_id: string;

  // Task Content
  title: string;
  why: string;
  description?: string;

  // Categorization
  category: TaskCategory;
  priority: TaskPriority;
  priorityScore: number;

  // Timing
  deadline: Date;
  expectedDuration?: number;

  // Expected Outcome
  expectedOutcome: string;
  successMetrics?: SuccessMetric[];

  // Parameters
  parameters: Record<string, any>;

  // Source Tracking
  sourceType: SourceType;
  sourceData: {
    dataPoints: string[];
    aiProvider?: string;
    confidenceScore?: number;
    dataAge?: number;
  };

  // Action Tracking
  actionStatus: ActionStatus;
  completedAt?: Date;
  dismissedReason?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;

  // --- LINKAGE: IDs that connect tasks to source records ---
  // Set on trend_opportunity tasks generated from gv_trends
  trend_id?: string;
  // Set on viral discovery tasks generated from gv_viral_discoveries
  viral_discovery_id?: string;
  // Set after auto-article draft is triggered; null until then
  auto_article_id?: string;
}

export interface SuccessMetric {
  metric: string;
  target: number;
  unit: string;
  timeframe: string;
}

export interface CrisisAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  metrics: Record<string, any>;
  recommendedActions: string[];
}

export interface RadarData {
  creatorRankings: any[];
  brandMarketshare: any[];
  activeTrends: any[];
  topCreatorContent: any[];
  competitorBrands: any[];
}

export interface SearchData {
  keywordPerformance: any[];
  geoScores: any[];
  searchResults: any[];
  competitors: any[];
}

export interface HubData {
  articles: any[];
  analytics: any[];
  pendingArticles: any[];
  quota: any;
}

export interface ChatData {
  conversations: any[];
  insights: any[];
  briefs: any[];
}

export interface GenerateInsightsRequest {
  brandId: string;
  tier: 'basic' | 'premium' | 'partner';
  forceRegenerate?: boolean;
}

export interface GenerateInsightsResponse {
  tasks: InsightTask[];
  crises: CrisisAlert[];
  metadata: {
    generatedAt: string;
    taskCount: number;
    crisisCount: number;
    dataSourcesCovered: string[];
  };
}
