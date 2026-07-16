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
import { platformAnalyticsService } from '@/services/analytics/PlatformAnalyticsService';
import { clientLogger } from '@/lib/client-logger';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverviewMetrics = async () => {
      try {
        setLoading(true);
        const data = await platformAnalyticsService.getOverviewMetrics(filters);
        
        const formattedMetrics: MetricCard[] = [
          {
            title: 'Total Page Views',
            value: data.totalPageViews?.toLocaleString() || '0',
            change: data.trends?.pageViewsChange || 0,
            changeType: (data.trends?.pageViewsChange || 0) >= 0 ? 'increase' : 'decrease',
            icon: <Eye className="w-5 h-5" />,
            description: 'Total pages viewed across the platform'
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
          }
        ];

        setMetrics(formattedMetrics);
        setError(null);
      } catch (err) {
        clientLogger.error('Error fetching overview analytics:', { detail: err });
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewMetrics();
  }, [filters]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <Activity className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {metric.icon}
              <h3 className="ml-2 text-sm font-medium text-gray-600">{metric.title}</h3>
            </div>
            <div className={`flex items-center text-sm ${
              metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}>
              {metric.changeType === 'increase' ? (
                <ArrowUp className="w-4 h-4 mr-1" />
              ) : (
                <ArrowDown className="w-4 h-4 mr-1" />
              )}
              {Math.abs(metric.change).toFixed(1)}%
            </div>
          </div>
          
          <div className="mb-2">
            <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
          </div>
          
          <p className="text-xs text-gray-500">{metric.description}</p>
        </div>
      ))}
    </div>
  );
}
