/**
 * User Behavior Analytics Component
 * Shows user engagement patterns and behavior insights
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUp, 
  ArrowDown, 
  Activity,
  Eye,
  Target
} from 'lucide-react';
import { platformAnalyticsService } from '@/services/analytics/PlatformAnalyticsService';
import { clientLogger } from '@/lib/client-logger';

interface UserBehaviorAnalyticsProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

interface UserJourney {
  step: string;
  users: number;
  conversionRate: number;
  avgTime: number;
}

interface EngagementPattern {
  period: string;
  pageViews: number;
  uniqueUsers: number;
  avgSessionDuration: number;
  returnVisitors: number;
}

export default function UserBehaviorAnalytics({ filters }: UserBehaviorAnalyticsProps) {
  const [userJourney, setUserJourney] = useState<UserJourney[]>([]);
  const [engagementPatterns, setEngagementPatterns] = useState<EngagementPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserBehaviorData = async () => {
      try {
        setLoading(true);
        const data = await platformAnalyticsService.getUserBehaviorAnalytics(filters);
        setUserJourney(data.journeyFunnel);
        setEngagementPatterns(data.timeOfDayEngagement);
        setError(null);
      } catch (err) {
        clientLogger.error('Error fetching user behavior analytics:', { detail: err });
        setError('Failed to load user behavior data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserBehaviorData();
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
          <Activity className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Journey Funnel */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">User Journey Funnel</h3>
          <Target className="w-5 h-5 text-gray-500" />
        </div>
        
        <div className="space-y-4">
          {userJourney.map((step, index) => (
            <div key={index} className="relative">
              {index < userJourney.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-300"></div>
              )}
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-green-100' :
                    index === userJourney.length - 1 ? 'bg-blue-100' :
                    'bg-yellow-100'
                  }`}>
                    <span className={`text-sm font-medium ${
                      index === 0 ? 'text-green-600' :
                      index === userJourney.length - 1 ? 'text-blue-600' :
                      'text-yellow-600'
                    }`}>
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{step.step}</h4>
                    <p className="text-sm text-gray-500">{step.users.toLocaleString()} users</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Conversion</p>
                    <p className="font-medium">{step.conversionRate.toFixed(1)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Avg Time</p>
                    <p className="font-medium">{Math.round(step.avgTime)}s</p>
                  </div>
                  <div className={`flex items-center text-sm ${
                    step.conversionRate >= 50 ? 'text-green-600' : 
                    step.conversionRate >= 25 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {step.conversionRate >= 50 ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 mr-1" />
                    )}
                    {step.conversionRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Patterns */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Time of Day Engagement</h3>
          <Clock className="w-5 h-5 text-gray-500" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Hours */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Peak Activity Hours</h4>
            <div className="space-y-3">
              {engagementPatterns
                .sort((a, b) => b.uniqueUsers - a.uniqueUsers)
                .slice(0, 6)
                .map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        pattern.uniqueUsers > 30 ? 'bg-green-500' :
                        pattern.uniqueUsers > 20 ? 'bg-yellow-500' :
                        'bg-gray-400'
                      }`}></div>
                      <span className="font-medium text-gray-900">{pattern.period}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-600">{pattern.uniqueUsers} users</span>
                      <span className="text-gray-400">({pattern.pageViews} views)</span>
                      <span className="text-blue-600">{pattern.avgSessionDuration}s</span>
                      <span className="text-green-600">{pattern.returnVisitors} returns</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Engagement Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-4">Engagement Metrics</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Avg Session Duration</span>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {Math.round(
                    engagementPatterns.reduce((sum, p) => sum + p.avgSessionDuration, 0) / 
                    engagementPatterns.length
                  )}s
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-gray-900">Return Visitors</span>
                </div>
                <span className="text-sm font-medium text-green-600">
                  {engagementPatterns.reduce((sum, p) => sum + p.returnVisitors, 0)} total returns
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-gray-900">Total Unique Users</span>
                </div>
                <span className="text-sm font-medium text-purple-600">
                  {engagementPatterns.reduce((sum, p) => sum + p.uniqueUsers, 0)} unique users
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-gray-900">Peak Hour</span>
                </div>
                <span className="text-sm font-medium text-purple-600">
                  {(() => {
                    const peakPattern = engagementPatterns.reduce((max, p) => 
                      p.uniqueUsers > max.uniqueUsers ? p : max
                    , engagementPatterns[0]);
                    return `${peakPattern.period || 'N/A'} - ${peakPattern.uniqueUsers || 0} users`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
