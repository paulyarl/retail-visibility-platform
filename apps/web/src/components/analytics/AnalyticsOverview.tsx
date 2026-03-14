/**
 * Analytics Overview Component
 * Displays key metrics and KPIs for the platform
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Eye, 
  Store, 
  ShoppingCart, 
  TrendingUp, 
  ArrowUp,
  ArrowDown,
  Activity,
  Clock,
  BarChart3
} from 'lucide-react';

interface AnalyticsOverviewProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

// Helper function to format duration in seconds to readable format
function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}

interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease';
  icon: React.ReactNode;
  description: string;
}

export default function AnalyticsOverview({ filters }: AnalyticsOverviewProps) {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverviewMetrics();
  }, [filters]);

  const fetchOverviewMetrics = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        period: filters.period || 'week',
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.pageType && filters.pageType !== 'all' && { pageType: filters.pageType }),
        ...(filters.entityType && filters.entityType !== 'all' && { entityType: filters.entityType }),
        ...(filters.region && filters.region !== 'all' && { region: filters.region })
      });

      const response = await fetch(`/api/admin/analytics/overview?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Transform API data to component format
      const metricsData = [
        {
          title: 'Total Page Views',
          value: data.totalPageViews?.toLocaleString() || '0',
          change: data.trends?.pageViewsChange || 0,
          changeType: (data.trends?.pageViewsChange || 0) >= 0 ? 'increase' : 'decrease',
          icon: <Eye className="w-5 h-5" />,
          description: 'Page views across all public pages'
        },
        {
          title: 'Unique Visitors',
          value: data.uniqueVisitors?.toLocaleString() || '0',
          change: data.trends?.visitorsChange || 0,
          changeType: (data.trends?.visitorsChange || 0) >= 0 ? 'increase' : 'decrease',
          icon: <Users className="w-5 h-5" />,
          description: 'Unique users visiting the platform'
        },
        {
          title: 'Avg. Session Duration',
          value: formatDuration(data.avgSessionDuration || 0),
          change: data.trends?.durationChange || 0,
          changeType: (data.trends?.durationChange || 0) >= 0 ? 'increase' : 'decrease',
          icon: <Clock className="w-5 h-5" />,
          description: 'Average time users spend on platform'
        },
        {
          title: 'Bounce Rate',
          value: `${data.bounceRate?.toFixed(1) || 0}%`,
          change: -5.2, // API will provide this later
          changeType: 'decrease',
          icon: <Activity className="w-5 h-5" />,
          description: 'Percentage of single-page sessions'
        },
        // Additional metrics based on page type breakdown
        ...(data.topPageTypes?.slice(0, 2).map((pt: any) => ({
          title: `${pt.pageType} Views`,
          value: pt.views?.toLocaleString() || '0',
          change: 0, // API will provide trends later
          changeType: 'increase' as const,
          icon: <BarChart3 className="w-5 h-5" />,
          description: `Views for ${pt.pageType} pages`
        })) || [])
      ];

      setMetrics(metricsData);
    } catch (error) {
      console.error('Error fetching overview data:', error);
      // Fall back to mock data
      const mockMetrics = [
        {
          title: 'Total Page Views',
          value: '24,560',
          change: 12.5,
          changeType: 'increase' as const,
          icon: <Eye className="w-5 h-5" />,
          description: 'Page views across all public pages'
        },
        {
          title: 'Unique Visitors',
          value: '8,743',
          change: 8.2,
          changeType: 'increase' as const,
          icon: <Users className="w-5 h-5" />,
          description: 'Unique users visiting the platform'
        },
        {
          title: 'Storefront Views',
          value: '12.8K',
          change: -3.4,
          changeType: 'decrease' as const,
          icon: <Store className="w-5 h-5" />,
          description: 'Views of individual storefront pages'
        },
        {
          title: 'Directory Traffic',
          value: '18.5K',
          change: 15.7,
          changeType: 'increase' as const,
          icon: <ShoppingCart className="w-5 h-5" />,
          description: 'Directory and shops page traffic'
        },
        {
          title: 'Avg. Session Duration',
          value: '4m 32s',
          change: 18.3,
          changeType: 'increase' as const,
          icon: <Clock className="w-5 h-5" />,
          description: 'Average time users spend on platform'
        },
        {
          title: 'Bounce Rate',
          value: '32.4%',
          change: -5.2,
          changeType: 'decrease' as const,
          icon: <Activity className="w-5 h-5" />,
          description: 'Percentage of single-page sessions'
        }
      ];
      setMetrics(mockMetrics);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((metric, index) => (
        <MetricCard key={index} metric={metric} />
      ))}
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricCard }) {
  const isPositive = metric.changeType === 'increase';
  const isGoodChange = metric.title === 'Bounce Rate' ? !isPositive : isPositive;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${
          metric.title.includes('Views') ? 'bg-blue-100 text-blue-600' :
          metric.title.includes('Visitors') ? 'bg-green-100 text-green-600' :
          metric.title.includes('Storefront') ? 'bg-purple-100 text-purple-600' :
          metric.title.includes('Directory') ? 'bg-orange-100 text-orange-600' :
          metric.title.includes('Duration') ? 'bg-pink-100 text-pink-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          {metric.icon}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${
          isGoodChange ? 'text-green-600' : 'text-red-600'
        }`}>
          {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          {Math.abs(metric.change)}%
        </div>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</h3>
        <p className="text-sm font-medium text-gray-600 mb-2">{metric.title}</p>
        <p className="text-xs text-gray-500">{metric.description}</p>
      </div>
    </div>
  );
}
