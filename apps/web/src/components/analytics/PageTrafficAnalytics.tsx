/**
 * Page Traffic Analytics Component
 * Shows traffic patterns across different page types
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Eye, 
  Users, 
  Clock, 
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Globe,
  Store
} from 'lucide-react';
import { platformAnalyticsService } from '@/services/analytics/PlatformAnalyticsService';
import { clientLogger } from '@/lib/client-logger';

interface PageTrafficAnalyticsProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

interface PageTrafficData {
  pageType: string;
  views: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  trend: number;
}

interface TopPage {
  path: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  entityType: string;
  entityId: string;
  avgDuration: number;
}

export default function PageTrafficAnalytics({ filters }: PageTrafficAnalyticsProps) {
  const [trafficData, setTrafficData] = useState<PageTrafficData[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageTrafficData = async () => {
      try {
        setLoading(true);
        const data = await platformAnalyticsService.getPageTrafficAnalytics(filters);
        setTrafficData(data.pageTypeBreakdown);
        setTopPages(data.topPages);
        setError(null);
      } catch (err) {
        clientLogger.error('Error fetching page traffic analytics:', { detail: err });
        setError('Failed to load page traffic data');
      } finally {
        setLoading(false);
      }
    };

    fetchPageTrafficData();
  }, [filters]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-3 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <BarChart3 className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Type Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Page Type Performance</h3>
          <BarChart3 className="w-5 h-5 text-gray-500" />
        </div>
        
        <div className="space-y-4">
          {trafficData.map((pageType, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-lg ${
                  pageType.pageType === 'storefront' ? 'bg-blue-100' :
                  pageType.pageType === 'directory' ? 'bg-green-100' :
                  pageType.pageType === 'product' ? 'bg-purple-100' :
                  'bg-gray-100'
                }`}>
                  {pageType.pageType === 'storefront' ? <Store className="w-4 h-4 text-blue-600" /> :
                   pageType.pageType === 'directory' ? <Globe className="w-4 h-4 text-green-600" /> :
                   pageType.pageType === 'product' ? <BarChart3 className="w-4 h-4 text-purple-600" /> :
                   <Eye className="w-4 h-4 text-gray-600" />}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 capitalize">{pageType.pageType}</h4>
                  <p className="text-sm text-gray-500">{pageType.views.toLocaleString()} views</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Visitors</p>
                  <p className="font-medium">{pageType.uniqueVisitors.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Avg Duration</p>
                  <p className="font-medium">{Math.round(pageType.avgSessionDuration)}s</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Bounce Rate</p>
                  <p className="font-medium">{pageType.bounceRate.toFixed(1)}%</p>
                </div>
                <div className={`flex items-center text-sm ${
                  pageType.trend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {pageType.trend >= 0 ? (
                    <ArrowUp className="w-4 h-4 mr-1" />
                  ) : (
                    <ArrowDown className="w-4 h-4 mr-1" />
                  )}
                  {Math.abs(pageType.trend).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Pages</h3>
          <TrendingUp className="w-5 h-5 text-gray-500" />
        </div>
        
        <div className="space-y-3">
          {topPages.map((page, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center space-x-4">
                <div className="text-lg font-medium text-gray-400 w-8">
                  #{index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{page.title}</h4>
                  <p className="text-sm text-gray-500">{page.path}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Views</p>
                  <p className="font-medium">{page.views.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Unique</p>
                  <p className="font-medium">{page.uniqueVisitors.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Avg Time</p>
                  <p className="font-medium">{Math.round(page.avgDuration)}s</p>
                </div>
                <div className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {page.entityType}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
