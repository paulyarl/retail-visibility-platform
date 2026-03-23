/**
 * Admin Analytics Dashboard
 * Comprehensive analytics and insights for platform administrators
 */

'use client';

import { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Store, 
  ShoppingCart, 
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Globe,
  Clock,
  ArrowUp,
  ArrowDown,
  Filter,
  Download
} from 'lucide-react';
import AnalyticsOverview from '@/components/analytics/AnalyticsOverview';
import PageTrafficAnalytics from '@/components/analytics/PageTrafficAnalytics';
import UserBehaviorAnalytics from '@/components/analytics/UserBehaviorAnalytics';
import PopularContentAnalytics from '@/components/analytics/PopularContentAnalytics';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import TimeSeriesAnalytics from '@/components/analytics/TimeSeriesAnalytics';
import GeographicAnalytics from '@/components/analytics/GeographicAnalytics';

export interface AnalyticsFilters {
  period?: string;
  startDate?: string;
  endDate?: string;
  pageType?: string;
  name?: string;
  type?: 'store' | 'product' | 'category' | 'platform' | 'dashboard' | 'onboarding' | 'admin';
  region?: string;
}

export default function AnalyticsDashboard() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: 'week',
    pageType: 'all',
    region: 'all'
  });

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  Analytics Dashboard
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Platform insights and user behavior analytics
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">Last updated</p>
                  <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <AnalyticsFilters
              initialFilters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Overview Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Overview
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Key performance indicators and platform metrics
              </p>
            </div>
            <AnalyticsOverview filters={filters} />
          </section>

          {/* Traffic Analysis Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Traffic Analysis
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Page views, user engagement, and traffic patterns
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PageTrafficAnalytics filters={filters} />
              <TimeSeriesAnalytics filters={filters} />
            </div>
          </section>

          {/* User Behavior Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                User Behavior
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                User journeys, engagement patterns, and session analytics
              </p>
            </div>
            <UserBehaviorAnalytics filters={filters} />
          </section>

          {/* Content & Geographic Analysis Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-600" />
                Content & Geographic Insights
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Popular content performance and geographic distribution
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PopularContentAnalytics filters={filters} />
              <GeographicAnalytics filters={filters} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
