/**
 * Shop Search Component
 * Advanced shop search with real-time suggestions, history, and analytics
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Shop } from '@/types/shop';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { 
  Search, 
  Clock, 
  TrendingUp, 
  Star, 
  MapPin, 
  X, 
  ChevronRight,
  Filter,
  BarChart3,
  Users,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShopCategories } from '@/hooks/shops/useShopCategories';
import { Button } from '@mantine/core';
import { clientLogger } from '@/lib/client-logger';

interface ShopSearchProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  placeholder?: string;
  suggestions?: Shop[];
  className?: string;
}

interface SearchFilters {
  category?: string;
  location?: string;
  rating?: number;
  priceRange?: {
    min?: number;
    max?: number;
  };
  sortBy?: 'relevance' | 'rating' | 'reviews' | 'distance';
}

interface SearchSuggestion extends Shop {
  searchScore: number;
  matchType: 'exact' | 'partial' | 'category' | 'location';
  highlightedName?: string;
  highlightedLocation?: string;
}

interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  resultCount: number;
  filters?: SearchFilters;
}

interface SearchAnalytics {
  totalSearches: number;
  popularQueries: Array<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  averageResults: number;
  searchSuccess: number;
}

export function ShopSearch({ 
  onSearch, 
  placeholder = "Search shops, products, or categories...", 
  suggestions = [],
  className 
}: ShopSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch dynamic shop categories
  const { categories, loading: categoriesLoading, error: categoriesError } = useShopCategories();
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history and analytics on mount
  useEffect(() => {
    loadSearchHistory();
    loadSearchAnalytics();
  }, []);

  // Filter suggestions based on query using useMemo to prevent infinite loop
  const filteredSuggestions = useMemo(() => {
    if (query.length < 2) {
      return [];
    }

    return suggestions
      .map(shop => ({
        ...shop,
        searchScore: calculateSearchScore(shop, query),
        matchType: getMatchType(shop, query),
        highlightedName: highlightText(shop.name, query),
        highlightedLocation: highlightText(shop.location, query)
      }))
      .filter(shop => shop.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, 8);
  }, [query, suggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateSearchScore = (shop: Shop, query: string): number => {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match
    if (shop.name.toLowerCase() === queryLower) {
      score += 100;
    } else if (shop.name.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Category match
    if (shop.category.toLowerCase().includes(queryLower)) {
      score += 30;
    }

    // Location match
    if (shop.location.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    // Description match
    if (shop.description?.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Rating bonus
    score += shop.rating * 2;

    // Review count bonus
    score += Math.min(shop.reviewCount / 10, 10);

    return score;
  };

  const getMatchType = (shop: Shop, query: string): 'exact' | 'partial' | 'category' | 'location' => {
    const queryLower = query.toLowerCase();
    
    if (shop.name.toLowerCase() === queryLower) {
      return 'exact';
    } else if (shop.name.toLowerCase().includes(queryLower)) {
      return 'partial';
    } else if (shop.category.toLowerCase().includes(queryLower)) {
      return 'category';
    } else if (shop.location.toLowerCase().includes(queryLower)) {
      return 'location';
    }
    
    return 'partial';
  };

  const highlightText = (text: string, query: string): string => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const loadSearchHistory = () => {
    try {
      const history = localStorage.getItem('shopSearchHistory');
      if (history) {
        const parsed = JSON.parse(history);
        setSearchHistory(parsed.slice(0, 10)); // Keep only last 10
      }
    } catch (error) {
      clientLogger.error('Error loading search history:', { detail: error });
    }
  };

  const loadSearchAnalytics = () => {
    try {
      const analyticsData = localStorage.getItem('shopSearchAnalytics');
      if (analyticsData) {
        setAnalytics(JSON.parse(analyticsData));
      } else {
        // Mock analytics for demo
        setAnalytics({
          totalSearches: 1247,
          popularQueries: [
            { query: 'coffee', count: 89, trend: 'up' },
            { query: 'electronics', count: 67, trend: 'up' },
            { query: 'fashion', count: 45, trend: 'stable' },
            { query: 'food', count: 38, trend: 'down' }
          ],
          averageResults: 23.4,
          searchSuccess: 87.3
        });
      }
    } catch (error) {
      clientLogger.error('Error loading search analytics:', { detail: error });
    }
  };

  const saveSearchToHistory = (query: string, resultCount: number) => {
    const historyItem: SearchHistoryItem = {
      query,
      timestamp: new Date(),
      resultCount,
      filters: { ...filters }
    };

    const updatedHistory = [historyItem, ...searchHistory.filter(h => h.query !== query)].slice(0, 10);
    setSearchHistory(updatedHistory);
    
    try {
      localStorage.setItem('shopSearchHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      clientLogger.error('Error saving search history:', { detail: error });
    }
  };

  const handleSearch = useCallback((searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setIsOpen(false);
    
    // Simulate API call
    setTimeout(() => {
      const resultCount = Math.floor(Math.random() * 50) + 1;
      saveSearchToHistory(searchQuery, resultCount);
      onSearch(searchQuery, filters);
      setIsLoading(false);
    }, 500);
  }, [onSearch, filters]); // Remove query to prevent infinite loop

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.name);
    handleSearch(suggestion.name);
  };

  const handleHistoryClick = (historyItem: SearchHistoryItem) => {
    setQuery(historyItem.query);
    setFilters(historyItem.filters || {});
    handleSearch(historyItem.query);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('shopSearchHistory');
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="w-3 h-3 text-green-600" />;
      case 'down':
        return <ArrowDown className="w-3 h-3 text-red-600" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className={cn('relative', className)} ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              className="pl-10 pr-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && 'bg-blue-50 border-blue-200')}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {Object.values(filters).some(v => v !== undefined && v !== '') && (
              <Badge variant="default" className="ml-2 text-xs">
                {Object.values(filters).filter(v => v !== undefined && v !== '').length}
              </Badge>
            )}
          </Button>
          
          <Button onClick={() => handleSearch()} disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-50 max-h-96 overflow-y-auto">
          <CardContent className="p-0">
            {/* Search Suggestions */}
            {filteredSuggestions.length > 0 && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Suggestions</h4>
                <div className="space-y-2">
                  {filteredSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.tenantId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="relative w-10 h-10">
                        {suggestion.imageUrl ? (
                          <Image
                            src={suggestion.imageUrl}
                            alt={suggestion.name}
                            fill
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-xs">🏪</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 
                            className="font-medium text-gray-900 truncate"
                            dangerouslySetInnerHTML={{ __html: suggestion.highlightedName || suggestion.name }}
                          />
                          <Badge variant="default" className="text-xs">
                            {suggestion.matchType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span>{suggestion.rating.toFixed(1)}</span>
                          <span>({suggestion.reviewCount})</span>
                          <MapPin className="w-3 h-3 ml-2" />
                          <span 
                            className="truncate"
                            dangerouslySetInnerHTML={{ __html: suggestion.highlightedLocation || suggestion.location }}
                          />
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Recent Searches</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  {searchHistory.slice(0, 5).map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleHistoryClick(item)}
                    >
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm">{item.query}</h5>
                        <p className="text-xs text-gray-600">
                          {item.resultCount} results • {new Date(item.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            {analytics && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Popular Searches</h4>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <div className="space-y-2">
                  {analytics.popularQueries.slice(0, 5).map((query, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleHistoryClick({
                        query: query.query,
                        timestamp: new Date(),
                        resultCount: query.count
                      })}
                    >
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm">{query.query}</h5>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{query.count} searches</span>
                          {getTrendIcon(query.trend)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Analytics Summary */}
            {analytics && (
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {analytics.totalSearches.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600">Total Searches</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {analytics.averageResults.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-600">Avg Results</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {analytics.searchSuccess.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Success Rate</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card className="absolute top-full left-0 right-0 mt-2 z-40">
          <CardContent className="p-4">
            <h4 className="font-medium text-gray-900 mb-4">Search Filters</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <Select 
                  value={filters.category || ''} 
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value || undefined }))}
                  disabled={categoriesLoading}
                >
                  <option value="">All Categories</option>
                  {categoriesError && (
                    <option value="" disabled>Error loading categories</option>
                  )}
                  {categories.map((category: any) => (
                    <option key={category.shop_category} value={category.shop_category}>
                      {category.shop_category} ({category.count} shops)
                    </option>
                  ))}
                </Select>
                {categoriesLoading && (
                  <div className="text-xs text-gray-500 mt-1">Loading categories...</div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <Input
                  placeholder="City or region"
                  value={filters.location || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value || undefined }))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Rating</label>
                <Select 
                  value={filters.rating?.toString() || ''} 
                  onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value ? Number(e.target.value) : undefined }))}
                >
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <Select 
                  value={filters.sortBy || 'relevance'} 
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                >
                  <option value="relevance">Relevance</option>
                  <option value="rating">Rating</option>
                  <option value="reviews">Reviews</option>
                  <option value="distance">Distance</option>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </Button>
              <Button onClick={() => setShowFilters(false)}>
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
