/**
 * Featured Product Scoring System
 * 
 * Calculates a quality score for stores to prioritize featured products
 * from high-quality, well-maintained stores in the directory.
 * 
 * Total Score: 0-100 points
 * 
 * Scoring Breakdown (Optimized for Local Shopping):
 * - Location & Discoverability (40 pts): Location data, hours, proximity
 * - Store Quality (30 pts): Reviews, ratings, product count
 * - Profile Completeness (20 pts): Logo, description, branding
 * - Engagement (10 pts): Subscription tier, website, recency
 */

export interface StoreQualityMetrics {
  tenantId: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  subscriptionTier: string;
  hasLogo: boolean;
  hasDescription: boolean;
  hasBusinessHours: boolean;
  hasLocation: boolean;
  hasWebsite: boolean;
  updatedAt: Date;
}

export interface ScoredStore extends StoreQualityMetrics {
  qualityScore: number;
  scoreBreakdown: {
    locationDiscoverability: number;
    storeQuality: number;
    profileCompleteness: number;
    engagement: number;
  };
}

/**
 * Calculate comprehensive quality score for a store
 * Returns score from 0-100
 */
export function calculateStoreQualityScore(metrics: StoreQualityMetrics): ScoredStore {
  const breakdown = {
    locationDiscoverability: calculateLocationDiscoverabilityScore(metrics),
    storeQuality: calculateStoreReputationScore(metrics),
    profileCompleteness: calculateProfileCompletenessScore(metrics),
    engagement: calculateEngagementScore(metrics),
  };

  const qualityScore = 
    breakdown.locationDiscoverability + 
    breakdown.storeQuality + 
    breakdown.profileCompleteness + 
    breakdown.engagement;

  return {
    ...metrics,
    qualityScore: Math.round(qualityScore * 10) / 10, // Round to 1 decimal
    scoreBreakdown: breakdown,
  };
}

/**
 * Location & Discoverability Score (40 points max)
 * PRIMARY FACTOR for local shopping directory
 * - Location data (20 pts): Latitude/longitude for maps and proximity
 * - Business hours (15 pts): Customers need to know when you're open
 * - Recently updated (5 pts): Active stores get slight boost
 */
function calculateLocationDiscoverabilityScore(metrics: StoreQualityMetrics): number {
  let score = 0;

  // Location data (20 pts) - CRITICAL for local shopping
  if (metrics.hasLocation) {
    score += 20;
  }

  // Business hours (15 pts) - Essential for local shopping
  if (metrics.hasBusinessHours) {
    score += 15;
  }

  // Recency (5 pts) - Active stores get slight boost
  const now = new Date();
  const updatedAt = new Date(metrics.updatedAt);
  const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceUpdate <= 7) score += 5;
  else if (daysSinceUpdate <= 14) score += 4;
  else if (daysSinceUpdate <= 30) score += 3;
  else if (daysSinceUpdate <= 60) score += 2;
  else if (daysSinceUpdate <= 90) score += 1;

  return Math.min(score, 40);
}

/**
 * Store Reputation Score (30 points max)
 * - Rating average (0-15 pts): Higher ratings = more points
 * - Rating count (0-10 pts): More reviews = more credibility
 * - Product count (0-5 pts): Larger inventory = more selection
 */
function calculateStoreReputationScore(metrics: StoreQualityMetrics): number {
  let score = 0;

  // Rating average (0-15 pts)
  // 5.0 stars = 15 pts, 4.0 stars = 12 pts, etc.
  if (metrics.ratingAvg > 0) {
    score += (metrics.ratingAvg / 5.0) * 15;
  }

  // Rating count (0-10 pts)
  // 50+ reviews = 10 pts, 25 reviews = 5 pts, etc.
  if (metrics.ratingCount > 0) {
    const reviewScore = Math.min(metrics.ratingCount / 5, 10);
    score += reviewScore;
  }

  // Product count (0-5 pts)
  // 50+ products = 5 pts, 25 products = 2.5 pts, etc.
  if (metrics.productCount > 0) {
    const productScore = Math.min(metrics.productCount / 10, 5);
    score += productScore;
  }

  return Math.min(score, 30);
}

/**
 * Profile Completeness Score (20 points max)
 * - Logo (10 pts): Professional branding
 * - Description (10 pts): Store information
 */
function calculateProfileCompletenessScore(metrics: StoreQualityMetrics): number {
  let score = 0;

  if (metrics.hasLogo) score += 10;
  if (metrics.hasDescription) score += 10;

  return score;
}

/**
 * Engagement Score (10 points max)
 * - Subscription tier (0-7 pts): Higher tiers show commitment
 * - Website (3 pts): External online presence
 */
function calculateEngagementScore(metrics: StoreQualityMetrics): number {
  let score = 0;

  // Subscription tier (0-7 pts)
  switch (metrics.subscriptionTier?.toLowerCase()) {
    case 'enterprise':
      score += 7;
      break;
    case 'pro':
      score += 5;
      break;
    case 'starter':
      score += 3;
      break;
    default:
      score += 0;
  }

  // Website (3 pts)
  if (metrics.hasWebsite) score += 3;

  return score;
}

/**
 * SQL query to get featured products with store quality scoring
 * Orders by quality score DESC, then featured_priority DESC
 */
export const FEATURED_PRODUCTS_WITH_SCORING_QUERY = `
  WITH store_scores AS (
    SELECT 
      tenant_id,
      -- Location & Discoverability (40 pts max) - PRIMARY for local shopping
      (CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN business_hours IS NOT NULL THEN 15 ELSE 0 END) +
      (CASE 
        WHEN updated_at > NOW() - INTERVAL '7 days' THEN 5
        WHEN updated_at > NOW() - INTERVAL '14 days' THEN 4
        WHEN updated_at > NOW() - INTERVAL '30 days' THEN 3
        WHEN updated_at > NOW() - INTERVAL '60 days' THEN 2
        WHEN updated_at > NOW() - INTERVAL '90 days' THEN 1
        ELSE 0
      END) as location_discoverability_score,
      
      -- Store Reputation (30 pts max)
      COALESCE((rating_avg / 5.0) * 15, 0) +
      LEAST(COALESCE(rating_count / 5.0, 0), 10) +
      LEAST(COALESCE(product_count / 10.0, 0), 5) as store_quality_score,
      
      -- Profile Completeness (20 pts max)
      (CASE WHEN logo_url IS NOT NULL AND logo_url != '' THEN 10 ELSE 0 END) +
      (CASE WHEN description IS NOT NULL AND LENGTH(description) > 50 THEN 10 ELSE 0 END) as profile_completeness_score,
      
      -- Engagement (10 pts max)
      (CASE 
        WHEN subscription_tier = 'enterprise' THEN 7
        WHEN subscription_tier = 'pro' THEN 5
        WHEN subscription_tier = 'starter' THEN 3
        ELSE 0
      END) +
      (CASE WHEN website IS NOT NULL AND website != '' THEN 3 ELSE 0 END) as engagement_score
    FROM directory_listings_list
    WHERE is_published = true
  )
  SELECT 
    sp.*,
    ss.location_discoverability_score,
    ss.store_quality_score,
    ss.profile_completeness_score,
    ss.engagement_score,
    (ss.location_discoverability_score + ss.store_quality_score + ss.profile_completeness_score + ss.engagement_score) as quality_score
  FROM storefront_products sp
  JOIN store_scores ss ON sp.tenant_id = ss.tenant_id
  WHERE sp.is_actively_featured = true
  ORDER BY 
    quality_score DESC,
    sp.featured_priority DESC,
    sp.featured_at DESC
  LIMIT $1
`;

/**
 * Get minimum quality threshold for featured products
 * Stores below this score should not have featured products displayed prominently
 * Note: With location-focused scoring, stores without location data are heavily penalized
 */
export const MINIMUM_QUALITY_THRESHOLD = 35; // Out of 100 (location data is critical)

/**
 * Quality tier classifications
 */
export enum QualityTier {
  EXCELLENT = 'excellent',  // 80-100 pts
  GOOD = 'good',            // 60-79 pts
  FAIR = 'fair',            // 40-59 pts
  POOR = 'poor',            // 30-39 pts
  UNQUALIFIED = 'unqualified' // 0-29 pts
}

export function getQualityTier(score: number): QualityTier {
  if (score >= 80) return QualityTier.EXCELLENT;
  if (score >= 60) return QualityTier.GOOD;
  if (score >= 40) return QualityTier.FAIR;
  if (score >= 30) return QualityTier.POOR;
  return QualityTier.UNQUALIFIED;
}
