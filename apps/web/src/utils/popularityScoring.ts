/**
 * Unified Popularity Scoring System for Directory Categories
 * 
 * This service provides consistent scoring across all category browsers
 * using configurable weights and multiple data metrics.
 */

import { useMemo } from 'react';

export interface CategoryMetrics {
  // Display fields (required for rendering)
  id: string;
  slug: string;
  name: string;
  icon?: string;
  
  // Scoring metrics
  storeCount: number;
  primaryStoreCount?: number;
  secondaryStoreCount?: number;
  productCount?: number;
  avgRating?: number;
  ratingCount?: number;
  featuredStoreCount?: number;
  syncedStoreCount?: number;
  geographicSpread?: number; // number of cities/states
  isPrimary?: boolean; // for GBP categories
  categorySlug?: string;
  categoryName?: string;
  // NEW: Location-aware fields
  nearbyStoreCount?: number; // stores within user's radius
  avgDistance?: number; // average distance to stores
  recentActivityScore?: number; // recent updates/new items
  localPopularityScore?: number; // local search frequency
  
  // Enhanced fields from storefront_category_counts MV
  totalProducts?: number;
  totalInStock?: number;
  avgPriceCents?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  totalWithImages?: number;
  totalWithDescriptions?: number;
  imageCoverage?: number;
  stockLevel?: number;
  priceRange?: {
    min: number;
    max: number;
    avg: number;
  };
}

export interface ScoringWeights {
  storeCount: number;
  primaryStoreBonus: number;
  productCount: number;
  inventoryDepth: number;
  specializationBonus: number;
  diversityBonus: number;
  ratingBonus: number;
  featuredBonus: number;
  geographicBonus: number;
  primaryCategoryBonus: number; // for GBP categories
  // NEW: Location-aware weights
  proximityWeight: number; // highest priority for nearby stores
  distanceDecay: number; // how quickly distance reduces score
  activityBoost: number; // recent activity bonus
  localPopularityWeight: number; // local search frequency
}

export interface ScoreBreakdown {
  totalScore: number;
  components: {
    baseStores: number;
    primaryBonus: number;
    productBonus: number;
    inventoryBonus: number;
    specializationBonus: number;
    diversityBonus: number;
    ratingBonus: number;
    featuredBonus: number;
    geographicBonus: number;
    primaryCategoryBonus: number;
    // NEW: Location-aware components
    proximityBonus: number;
    distanceDecayPenalty: number;
    activityBonus: number;
    localPopularityBonus: number;
  };
}

// Default scoring weights - can be tuned based on business needs
const DEFAULT_WEIGHTS: ScoringWeights = {
  storeCount: 10,           // Base weight for store count
  primaryStoreBonus: 5,     // Bonus per primary store
  productCount: 0.1,        // Weight per product
  inventoryDepth: 25,       // Bonus for having many products (>50)
  specializationBonus: 15,  // Bonus for having both primary & secondary
  diversityBonus: 10,       // Bonus for primary > secondary ratio
  ratingBonus: 2,            // Weight per rating point
  featuredBonus: 20,         // Bonus per featured store
  geographicBonus: 5,        // Bonus per city/state
  primaryCategoryBonus: 50, // GBP primary category bonus
  // NEW: Location-aware weights (proximity has highest priority)
  proximityWeight: 100,     // Highest weight for nearby stores
  distanceDecay: 0.1,       // Exponential decay per mile
  activityBoost: 30,        // Recent activity bonus
  localPopularityWeight: 15, // Local search frequency
};

/**
 * Calculate popularity score for a category
 */
export function calculatePopularityScore(
  metrics: CategoryMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ScoreBreakdown {
  // Performance monitoring (development only)
  const startTime = process.env.NODE_ENV === 'development' ? performance.now() : 0;

  const {
    storeCount,
    primaryStoreCount = 0,
    secondaryStoreCount = 0,
    productCount = 0,
    avgRating = 0,
    ratingCount = 0,
    featuredStoreCount = 0,
    syncedStoreCount = 0,
    geographicSpread = 0,
    isPrimary = false,
    // NEW: Location-aware fields
    nearbyStoreCount = 0,
    avgDistance = 0,
    recentActivityScore = 0,
    localPopularityScore = 0,
  } = metrics;

  // Base score from store count
  const baseStores = storeCount * weights.storeCount;

  // Bonus for primary stores (specialization)
  const primaryBonus = primaryStoreCount * weights.primaryStoreBonus;

  // Bonus for product count (activity)
  const productBonus = productCount * weights.productCount;

  // Bonus for having many products (active inventory)
  const inventoryBonus = productCount > 50 ? weights.inventoryDepth : 0;

  // Bonus for having both primary and secondary stores (diversity)
  const specializationBonus = 
    (primaryStoreCount > 0 && secondaryStoreCount > 0) 
      ? weights.specializationBonus 
      : 0;

  // Bonus for strong category fit (primary > secondary ratio)
  const diversityBonus = 
    (primaryStoreCount > secondaryStoreCount && primaryStoreCount > 0)
      ? weights.diversityBonus
      : 0;

  // Bonus for high ratings (quality)
  const ratingBonus = 
    (avgRating > 0 && ratingCount > 5)
      ? avgRating * weights.ratingBonus
      : 0;

  // Bonus for featured stores (premium)
  const featuredBonus = featuredStoreCount * weights.featuredBonus;

  // Bonus for geographic spread (reach)
  const geographicBonus = geographicSpread * weights.geographicBonus;

  // Bonus for GBP primary categories
  const primaryCategoryBonus = isPrimary ? weights.primaryCategoryBonus : 0;

  // NEW: Location-aware scoring (highest priority)
  // Massive boost for nearby stores
  const proximityBonus = nearbyStoreCount * weights.proximityWeight;
  
  // Exponential distance decay - closer stores get exponentially higher scores
  const distanceDecayPenalty = avgDistance > 0 
    ? Math.exp(-avgDistance * weights.distanceDecay) * -50 
    : 0;
  
  // Recent activity boost
  const activityBonus = recentActivityScore * weights.activityBoost;
  
  // Local popularity (search frequency in area)
  const localPopularityBonus = localPopularityScore * weights.localPopularityWeight;

  const totalScore = 
    baseStores +
    primaryBonus +
    productBonus +
    inventoryBonus +
    specializationBonus +
    diversityBonus +
    ratingBonus +
    featuredBonus +
    geographicBonus +
    primaryCategoryBonus +
    // NEW: Location-aware components (proximity has highest impact)
    proximityBonus +
    distanceDecayPenalty +
    activityBonus +
    localPopularityBonus;

  const result = {
    totalScore,
    components: {
      baseStores,
      primaryBonus,
      productBonus,
      inventoryBonus,
      specializationBonus,
      diversityBonus,
      ratingBonus,
      featuredBonus,
      geographicBonus,
      primaryCategoryBonus,
      // NEW: Location-aware components
      proximityBonus,
      distanceDecayPenalty,
      activityBonus,
      localPopularityBonus,
    },
  };

  // Performance logging (development only)
  if (process.env.NODE_ENV === 'development') {
    const endTime = performance.now();
    // console.log(`🎯 Score calculation: ${(endTime - startTime).toFixed(3)}ms`);
  }

  return result;
}

/**
 * Sort categories by popularity score
 */
export function sortByPopularity<T extends CategoryMetrics>(
  categories: T[],
  weights?: ScoringWeights
): T[] {
  return [...categories].sort((a, b) => {
    const scoreA = calculatePopularityScore(a, weights).totalScore;
    const scoreB = calculatePopularityScore(b, weights).totalScore;
    return scoreB - scoreA;
  });
}

/**
 * Get top N categories by popularity
 */
export function getTopCategories<T extends CategoryMetrics>(
  categories: T[],
  limit: number,
  weights?: ScoringWeights
): T[] {
  return sortByPopularity(categories, weights).slice(0, limit);
}

/**
 * Get scoring weights for different contexts
 */
export const SCORING_PRESETS = {
  // Emphasize quantity and reach
  BROAD_APPEAL: {
    ...DEFAULT_WEIGHTS,
    storeCount: 15,
    geographicBonus: 10,
    diversityBonus: 15,
  },
  
  // Emphasize specialization and quality
  NICHE_FOCUS: {
    ...DEFAULT_WEIGHTS,
    primaryStoreBonus: 10,
    specializationBonus: 25,
    ratingBonus: 5,
    featuredBonus: 30,
  },
  
  // Emphasize activity and inventory
  ACTIVE_MARKETPLACE: {
    ...DEFAULT_WEIGHTS,
    productCount: 0.2,
    inventoryDepth: 40,
    primaryStoreBonus: 8,
  },
  
  // NEW: Location-aware scoring (proximity has highest priority)
  LOCATION_AWARE: {
    ...DEFAULT_WEIGHTS,
    proximityWeight: 150,     // Even higher weight for proximity
    distanceDecay: 0.15,      // Stronger distance decay
    activityBoost: 40,        // Higher activity bonus
    localPopularityWeight: 25, // Higher local search weight
    storeCount: 5,            // Reduced global store count weight
    geographicBonus: 3,       // Reduced global geographic weight
  },
  
  // NEW: Hyper-local (extreme proximity focus)
  HYPER_LOCAL: {
    ...DEFAULT_WEIGHTS,
    proximityWeight: 200,     // Maximum proximity weight
    distanceDecay: 0.2,       // Very strong distance decay
    activityBoost: 50,        // High activity bonus
    localPopularityWeight: 30, // High local search weight
    storeCount: 2,            // Minimal global store count weight
    geographicBonus: 1,       // Minimal global geographic weight
    primaryStoreBonus: 3,      // Reduced specialization weight
  },
  
  // Balanced approach (default)
  BALANCED: DEFAULT_WEIGHTS,
} as const;

/**
 * React hook for memoized popularity scoring
 */
export function usePopularityScore(
  metrics: CategoryMetrics,
  weights?: ScoringWeights
): ScoreBreakdown {
  return useMemo(() => {
    return calculatePopularityScore(metrics, weights);
  }, [metrics, weights]);
}

/**
 * React hook for memoized category sorting
 */
export function useSortedCategories<T extends CategoryMetrics>(
  categories: T[],
  limit?: number,
  weights?: ScoringWeights
): T[] {
  return useMemo(() => {
    const sorted = sortByPopularity(categories, weights);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [categories, limit, weights]);
}

export type ScoringPreset = keyof typeof SCORING_PRESETS;
