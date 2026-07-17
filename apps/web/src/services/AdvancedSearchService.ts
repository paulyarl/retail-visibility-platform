/**
 * Advanced Search Service with Autocomplete
 * 
 * Intelligent search with autocomplete, suggestions, and advanced filtering
 * Integrates with platform caching and search analytics
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface SearchQuery {
  query: string;
  filters?: {
    category?: string;
    priceRange?: [number, number];
    brand?: string[];
    condition?: string;
    location?: { lat: number; lng: number; radius: number };
    rating?: number;
    inStock?: boolean;
    freeShipping?: boolean;
    sale?: boolean;
  };
  sort?: {
    field: 'relevance' | 'price' | 'rating' | 'date' | 'popularity';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  image?: string;
  category: string;
  brand: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  tenantId: string;
  tenantName: string;
  location?: string;
  relevanceScore: number;
  highlights?: {
    title?: string[];
    description?: string[];
    attributes?: string[];
  };
  metadata?: Record<string, any>;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'product' | 'category' | 'brand' | 'trending';
  count?: number;
  imageUrl?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface SearchAnalytics {
  query: string;
  results: number;
  clickedResults: number;
  conversionRate: number;
  averagePosition: number;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  filters: Record<string, any>;
}

/**
 * Advanced Search Service
 * 
 * Provides intelligent search with autocomplete and analytics
 * Leverages platform caching and search optimization
 */
class AdvancedSearchService extends PublicApiSingleton {
  private static instance: AdvancedSearchService;
  private searchHistory: string[] = [];
  private popularQueries: string[] = [];
  private searchCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();

  private constructor() {
    super('advanced-search-service', { encrypt: false });
    this.loadSearchHistory();
    this.loadPopularQueries();
  }

  public static getInstance(): AdvancedSearchService {
    if (!AdvancedSearchService.instance) {
      AdvancedSearchService.instance = new AdvancedSearchService();
    }
    return AdvancedSearchService.instance;
  }

  /**
   * Perform advanced search
   */
  async search(searchQuery: SearchQuery): Promise<{
    results: SearchResult[];
    total: number;
    facets: Record<string, Array<{ value: string; count: number }>>;
    suggestions: SearchSuggestion[];
    analytics: {
      queryId: string;
      searchTime: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateSearchCacheKey(searchQuery);
      
      const response = await this.makeDefaultRequest<{
        results: SearchResult[];
        total: number;
        facets: Record<string, Array<{ value: string; count: number }>>;
        suggestions: SearchSuggestion[];
        queryId: string;
      }>(
        '/api/search/advanced',
        {
          method: 'POST',
          body: JSON.stringify(searchQuery)
        },
        cacheKey,
        5 * 60 * 1000 // 5 minutes cache for search results
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Search failed:', { detail: response.error });
        return this.getDefaultSearchResult();
      }

      const searchTime = Date.now() - startTime;
      
      // Cache results
      this.searchCache.set(cacheKey, {
        results: response.data?.results || [],
        timestamp: Date.now()
      });

      // Update search history
      this.updateSearchHistory(searchQuery.query);

      // Track search analytics
      this.trackSearchAnalytics({
        query: searchQuery.query,
        results: response.data?.total || 0,
        clickedResults: 0,
        conversionRate: 0,
        averagePosition: 0,
        timestamp: new Date(),
        sessionId: this.getSessionId(),
        filters: searchQuery.filters || {}
      });

      return {
        results: response.data?.results || [],
        total: response.data?.total || 0,
        facets: response.data?.facets || {},
        suggestions: response.data?.suggestions || [],
        analytics: {
          queryId: response.data?.queryId || '',
          searchTime
        }
      };
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Search error:', { detail: error });
      return this.getDefaultSearchResult();
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocompleteSuggestions(
    query: string,
    limit: number = 10
  ): Promise<SearchSuggestion[]> {
    if (query.length < 2) {
      return this.getRecentSuggestions();
    }

    try {
      const cacheKey = `search-autocomplete-${query}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        suggestions: SearchSuggestion[];
      }>(
        `/api/search/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`,
        {},
        cacheKey,
        2 * 60 * 1000 // 2 minutes cache for autocomplete
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Autocomplete failed:', { detail: response.error });
        return this.getDefaultSuggestions(query);
      }

      return response.data?.suggestions || this.getDefaultSuggestions(query);
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Autocomplete error:', { detail: error });
      return this.getDefaultSuggestions(query);
    }
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit: number = 10): Promise<string[]> {
    try {
      const cacheKey = `search-trending-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        trending: string[];
      }>(
        `/api/search/trending?limit=${limit}`,
        {},
        cacheKey,
        10 * 60 * 1000 // 10 minutes cache for trending
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Trending searches failed:', { detail: response.error });
        return this.popularQueries.slice(0, limit);
      }

      this.popularQueries = response.data?.trending || [];
      return response.data?.trending || this.popularQueries.slice(0, limit);
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Trending searches error:', { detail: error });
      return this.popularQueries.slice(0, limit);
    }
  }

  /**
   * Get related searches
   */
  async getRelatedSearches(query: string, limit: number = 5): Promise<string[]> {
    try {
      const cacheKey = `search-related-${encodeURIComponent(query)}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        related: string[];
      }>(
        `/api/search/related?q=${encodeURIComponent(query)}&limit=${limit}`,
        {},
        cacheKey,
        15 * 60 * 1000 // 15 minutes cache for related searches
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Related searches failed:', { detail: response.error });
        return [];
      }

      return response.data?.related || [];
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Related searches error:', { detail: error });
      return [];
    }
  }

  /**
   * Get search suggestions for a category
   */
  async getCategorySuggestions(categoryId: string, limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const cacheKey = `search-category-${categoryId}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        suggestions: SearchSuggestion[];
      }>(
        `/api/search/category/${categoryId}?limit=${limit}`,
        {},
        cacheKey,
        20 * 60 * 1000 // 20 minutes cache for category suggestions
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Category suggestions failed:', { detail: response.error });
        return [];
      }

      return response.data?.suggestions || [];
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Category suggestions error:', { detail: error });
      return [];
    }
  }

  /**
   * Track search click
   */
  async trackSearchClick(
    queryId: string,
    productId: string,
    position: number
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/search/click',
        {
          method: 'POST',
          body: JSON.stringify({
            queryId,
            productId,
            position,
            timestamp: new Date(),
            sessionId: this.getSessionId()
          })
        },
        `search-click-${queryId}-${productId}`,
        0 // No caching for click tracking
      );
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Failed to track search click:', { detail: error });
    }
  }

  /**
   * Track search conversion
   */
  async trackSearchConversion(
    queryId: string,
    productId: string,
    conversionType: 'add_to_cart' | 'purchase' | 'wishlist'
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/search/conversion',
        {
          method: 'POST',
          body: JSON.stringify({
            queryId,
            productId,
            conversionType,
            timestamp: new Date(),
            sessionId: this.getSessionId()
          })
        },
        `search-conversion-${queryId}-${productId}`,
        0 // No caching for conversion tracking
      );
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Failed to track search conversion:', { detail: error });
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    totalSearches: number;
    uniqueQueries: number;
    topQueries: Array<{ query: string; count: number; conversionRate: number }>;
    averageResults: number;
    clickThroughRate: number;
    conversionRate: number;
    zeroResultsRate: number;
  }> {
    try {
      const cacheKey = `search-analytics-${timeRange}`;
      
      const response = await this.makeDefaultRequest<{
        analytics: any;
      }>(
        `/api/search/analytics?timeRange=${timeRange}`,
        {},
        cacheKey,
        5 * 60 * 1000 // 5 minutes cache for analytics
      );

      if (!response.success) {
        clientLogger.error('[AdvancedSearchService] Search analytics failed:', { detail: response.error });
        return this.getDefaultAnalytics();
      }

      return response.data?.analytics || this.getDefaultAnalytics();
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Search analytics error:', { detail: error });
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    this.searchHistory = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('search_history');
    }
  }

  /**
   * Get search history
   */
  getSearchHistory(): string[] {
    return this.searchHistory;
  }

  /**
   * Add to search history
   */
  addToSearchHistory(query: string): void {
    this.updateSearchHistory(query);
  }

  /**
   * Generate search cache key
   */
  private generateSearchCacheKey(searchQuery: SearchQuery): string {
    const key = {
      q: searchQuery.query,
      f: searchQuery.filters,
      s: searchQuery.sort,
      p: searchQuery.pagination
    };
    
    return `search-${btoa(JSON.stringify(key)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
  }

  /**
   * Update search history
   */
  private updateSearchHistory(query: string): void {
    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(q => q !== query);
    
    // Add to beginning
    this.searchHistory.unshift(query);
    
    // Limit to 50 items
    this.searchHistory = this.searchHistory.slice(0, 50);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('search_history', JSON.stringify(this.searchHistory));
    }
  }

  /**
   * Load search history
   */
  private loadSearchHistory(): void {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('search_history');
        if (saved) {
          this.searchHistory = JSON.parse(saved);
        }
      } catch (error) {
        clientLogger.error('[AdvancedSearchService] Failed to load search history:', { detail: error });
      }
    }
  }

  /**
   * Load popular queries
   */
  private async loadPopularQueries(): Promise<void> {
    try {
      const trending = await this.getTrendingSearches(20);
      this.popularQueries = trending;
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Failed to load popular queries:', { detail: error });
    }
  }

  /**
   * Get recent suggestions
   */
  private getRecentSuggestions(): SearchSuggestion[] {
    return this.searchHistory.slice(0, 5).map(query => ({
      text: query,
      type: 'query' as const,
      count: 1
    }));
  }

  /**
   * Get default suggestions
   */
  private getDefaultSuggestions(query: string): SearchSuggestion[] {
    const recent = this.searchHistory
      .filter(q => q.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map(q => ({
        text: q,
        type: 'query' as const,
        count: 1
      }));

    const trending = this.popularQueries
      .filter(q => q.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map(q => ({
        text: q,
        type: 'trending' as const,
        count: 1
      }));

    return [...recent, ...trending];
  }

  /**
   * Get default search result
   */
  private getDefaultSearchResult() {
    return {
      results: [],
      total: 0,
      facets: {},
      suggestions: [],
      analytics: {
        queryId: 'default',
        searchTime: 0
      }
    };
  }

  /**
   * Get default analytics
   */
  private getDefaultAnalytics() {
    return {
      totalSearches: 0,
      uniqueQueries: 0,
      topQueries: [],
      averageResults: 0,
      clickThroughRate: 0,
      conversionRate: 0,
      zeroResultsRate: 0
    };
  }

  /**
   * Track search analytics
   */
  private async trackSearchAnalytics(analytics: Omit<SearchAnalytics, 'userId'>): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/search/analytics/track',
        {
          method: 'POST',
          body: JSON.stringify(analytics)
        },
        `search-analytics-${Date.now()}`,
        0 // No caching for analytics tracking
      );
    } catch (error) {
      clientLogger.error('[AdvancedSearchService] Failed to track search analytics:', { detail: error });
    }
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    if (typeof window === 'undefined') {
      return 'server-session';
    }

    let sessionId = sessionStorage.getItem('search_session_id');
    if (!sessionId) {
      sessionId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('search_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, value] of Array.from(this.searchCache.entries())) {
      if (now - value.timestamp > maxAge) {
        this.searchCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const advancedSearchService = AdvancedSearchService.getInstance();
export default AdvancedSearchService;
