/**
 * Popular Content Analytics Component
 * Shows most viewed stores, products, and categories
 */

'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Store, Package, Tag, Star, Eye, Users } from 'lucide-react';

interface PopularContentAnalyticsProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

interface PopularItem {
  id: string;
  name: string;
  type: 'store' | 'product' | 'category';
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  trend: number;
  url?: string;
  category?: string;
}

export default function PopularContentAnalytics({ filters }: PopularContentAnalyticsProps) {
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPopularContent();
  }, [filters]);

  const fetchPopularContent = async () => {
    setLoading(true);
    try {
      // Mock data based on tracking patterns
      const mockPopularItems: PopularItem[] = [
        {
          id: 'trending-shops',
          name: 'Trending Shops',
          type: 'category',
          views: 3400,
          uniqueVisitors: 890,
          avgTimeOnPage: 156,
          trend: 12.5,
          url: '/shops',
          category: 'Directory'
        },
        {
          id: 'tid-m8ijkrnk',
          name: 'Baraka International Market',
          type: 'store',
          views: 2180,
          uniqueVisitors: 645,
          avgTimeOnPage: 245,
          trend: 8.3,
          url: '/shops/baraka-international-market',
          category: 'Grocery Store'
        },
        {
          id: 'directory-main',
          name: 'Directory Main',
          type: 'category',
          views: 1890,
          uniqueVisitors: 520,
          avgTimeOnPage: 98,
          trend: -2.1,
          url: '/directory',
          category: 'Directory'
        },
        {
          id: 'prod-12345',
          name: 'Organic Fresh Produce Bundle',
          type: 'product',
          views: 1560,
          uniqueVisitors: 412,
          avgTimeOnPage: 89,
          trend: 15.7,
          url: '/product/organic-fresh-produce-bundle',
          category: 'Products'
        },
        {
          id: 'grocery-stores',
          name: 'Grocery Stores',
          type: 'category',
          views: 1420,
          uniqueVisitors: 398,
          avgTimeOnPage: 134,
          trend: 6.2,
          url: '/directory/grocery-stores',
          category: 'Directory'
        },
        {
          id: 'tid-abc123',
          name: 'Fresh Market Place',
          type: 'store',
          views: 1280,
          uniqueVisitors: 367,
          avgTimeOnPage: 198,
          trend: 3.4,
          url: '/shops/fresh-market-place',
          category: 'Supermarket'
        },
        {
          id: 'electronics',
          name: 'Electronics Store',
          type: 'category',
          views: 980,
          uniqueVisitors: 289,
          avgTimeOnPage: 167,
          trend: -5.6,
          url: '/directory/electronics',
          category: 'Directory'
        },
        {
          id: 'prod-67890',
          name: 'Premium Coffee Beans',
          type: 'product',
          views: 890,
          uniqueVisitors: 267,
          avgTimeOnPage: 76,
          trend: 9.8,
          url: '/product/premium-coffee-beans',
          category: 'Products'
        }
      ];

      await new Promise(resolve => setTimeout(resolve, 600));
      setPopularItems(mockPopularItems);
    } catch (error) {
      console.error('Error fetching popular content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-600" />
          Popular Content Analytics
        </h3>
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-orange-600" />
        Popular Content Analytics
      </h3>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['All', 'Stores', 'Products', 'Categories'].map((filter) => (
          <button
            key={filter}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              filter === 'All'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Popular items list */}
      <div className="space-y-2">
        {popularItems.map((item, index) => (
          <PopularItemRow key={item.id} item={item} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function PopularItemRow({ item, rank }: { item: PopularItem; rank: number }) {
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'store': return <Store className="w-4 h-4 text-blue-500" />;
      case 'product': return <Package className="w-4 h-4 text-green-500" />;
      case 'category': return <Tag className="w-4 h-4 text-purple-500" />;
      default: return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (trend < 0) {
      return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
    }
    return <div className="w-4 h-4"></div>;
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500 w-6">#{rank}</span>
          {getItemIcon(item.type)}
        </div>
        <div>
          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="capitalize">{item.type}</span>
            {item.category && (
              <>
                <span>•</span>
                <span>{item.category}</span>
              </>
            )}
            {item.url && (
              <>
                <span>•</span>
                <span className="text-blue-600 hover:text-blue-700 cursor-pointer">
                  View
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3 text-gray-400" />
          <span className="font-medium text-gray-900">{item.views.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600">{item.uniqueVisitors.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600">{formatTime(item.avgTimeOnPage)}</span>
        </div>
        
        <div className={`flex items-center gap-1 font-medium ${
          item.trend > 0 ? 'text-green-600' : item.trend < 0 ? 'text-red-600' : 'text-gray-500'
        }`}>
          {getTrendIcon(item.trend)}
          <span>{Math.abs(item.trend)}%</span>
        </div>
      </div>
    </div>
  );
}
