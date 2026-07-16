/**
 * Time Series Analytics Component
 * Shows trends over time with interactive charts
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface TimeSeriesAnalyticsProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

interface TimeSeriesData {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

interface TrendMetric {
  label: string;
  current: number;
  previous: number;
  change: number;
  changeType: 'increase' | 'decrease';
}

export default function TimeSeriesAnalytics({ filters }: TimeSeriesAnalyticsProps) {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [trendMetrics, setTrendMetrics] = useState<TrendMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeSeriesData();
  }, [filters]);

  const fetchTimeSeriesData = async () => {
    setLoading(true);
    try {
      // Generate mock time series data for the last 30 days
      const generateMockData = (): TimeSeriesData[] => {
        const data: TimeSeriesData[] = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          
          // Simulate some realistic patterns
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const baseViews = isWeekend ? 800 : 1200;
          const randomVariation = Math.random() * 0.4 - 0.2; // ±20% variation
          
          data.push({
            date: date.toISOString().split('T')[0],
            pageViews: Math.floor(baseViews * (1 + randomVariation)),
            uniqueVisitors: Math.floor(baseViews * 0.25 * (1 + randomVariation)),
            sessions: Math.floor(baseViews * 0.35 * (1 + randomVariation)),
            avgSessionDuration: Math.floor(240 + Math.random() * 120), // 4-6 minutes
            bounceRate: 25 + Math.random() * 20 // 25-45%
          });
        }
        
        return data;
      };

      const mockTimeSeriesData = generateMockData();

      // Calculate trend metrics
      const recentData = mockTimeSeriesData.slice(-7); // Last 7 days
      const previousData = mockTimeSeriesData.slice(-14, -7); // Previous 7 days

      const calculateTrend = (recent: number[], previous: number[]) => {
        const recentSum = recent.reduce((a, b) => a + b, 0);
        const previousSum = previous.reduce((a, b) => a + b, 0);
        const change = ((recentSum - previousSum) / previousSum) * 100;
        return {
          current: Math.floor(recentSum / recent.length),
          previous: Math.floor(previousSum / previous.length),
          change: Math.abs(change),
          changeType: change >= 0 ? 'increase' : 'decrease' as 'increase' | 'decrease'
        };
      };

      const mockTrendMetrics: TrendMetric[] = [
        {
          ...calculateTrend(
            recentData.map(d => d.pageViews),
            previousData.map(d => d.pageViews)
          ),
          label: 'Daily Views'
        },
        {
          ...calculateTrend(
            recentData.map(d => d.uniqueVisitors),
            previousData.map(d => d.uniqueVisitors)
          ),
          label: 'Unique Visitors'
        },
        {
          ...calculateTrend(
            recentData.map(d => d.sessions),
            previousData.map(d => d.sessions)
          ),
          label: 'Sessions'
        },
        {
          ...calculateTrend(
            recentData.map(d => d.avgSessionDuration),
            previousData.map(d => d.avgSessionDuration)
          ),
          label: 'Avg Duration'
        }
      ];

      await new Promise(resolve => setTimeout(resolve, 800));
      setTimeSeriesData(mockTimeSeriesData);
      setTrendMetrics(mockTrendMetrics);
    } catch (error) {
      clientLogger.error('Error fetching time series data:', { detail: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Traffic Trends Over Time
        </h3>
        <div className="space-y-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-purple-600" />
        Traffic Trends Over Time
      </h3>

      {/* Trend Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {trendMetrics.map((metric, index) => (
          <TrendMetricCard key={index} metric={metric} index={index} />
        ))}
      </div>

      {/* Time Series Chart */}
      <div className="mb-8">
        <h4 className="text-sm font-medium text-gray-700 mb-4">30-Day Traffic Overview</h4>
        <div className="h-64 bg-gray-50 rounded-lg p-4">
          <SimpleTimeSeriesChart data={timeSeriesData} />
        </div>
      </div>

      {/* Recent Performance */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-4">Recent Daily Performance</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {timeSeriesData.slice(-10).reverse().map((data, index) => (
            <DailyPerformanceRow key={index} data={data} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendMetricCard({ metric, index }: { metric: TrendMetric; index: number }) {
  const labels = ['Daily Views', 'Unique Visitors', 'Sessions', 'Avg Duration'];
  const icons = [
    <Activity className="w-4 h-4" />,
    <TrendingUp className="w-4 h-4" />,
    <BarChart3 className="w-4 h-4" />,
    <Calendar className="w-4 h-4" />
  ];

  const formatValue = (value: number, index: number) => {
    if (index === 3) {
      // Duration in minutes
      return `${Math.floor(value / 60)}m ${value % 60}s`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-600 mb-2">
        {icons[index]}
        <span className="text-sm font-medium">{labels[index]}</span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-lg font-bold text-gray-900">{formatValue(metric.current, index)}</p>
        <div className={`flex items-center gap-1 text-xs font-medium ${
          metric.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
        }`}>
          <TrendingUp className={`w-3 h-3 ${metric.changeType === 'decrease' ? 'rotate-180' : ''}`} />
          {metric.change.toFixed(1)}%
        </div>
      </div>
      <p className="text-xs text-gray-500">
        vs {formatValue(metric.previous, index)} previous period
      </p>
    </div>
  );
}

function SimpleTimeSeriesChart({ data }: { data: TimeSeriesData[] }) {
  const maxValue = Math.max(...data.map(d => d.pageViews));
  
  return (
    <div className="h-full flex items-end justify-between gap-1">
      {data.map((point, index) => {
        const height = (point.pageViews / maxValue) * 100;
        const isToday = index === data.length - 1;
        
        return (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="w-full relative group">
              <div 
                className={`w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600 ${
                  isToday ? 'bg-blue-600' : ''
                }`}
                style={{ height: `${height}%` }}
              ></div>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <div>{point.date}</div>
                <div>{point.pageViews.toLocaleString()} views</div>
                <div>{point.uniqueVisitors.toLocaleString()} visitors</div>
              </div>
            </div>
            <div className={`text-xs mt-1 text-center ${
              isToday ? 'text-blue-600 font-medium' : 'text-gray-500'
            }`}>
              {new Date(point.date).getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyPerformanceRow({ data }: { data: TimeSeriesData }) {
  const date = new Date(data.date);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">{dayName}</p>
          <p className="text-xs text-gray-500">{monthDay}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-right">
        <div>
          <p className="font-medium text-gray-900">{data.pageViews.toLocaleString()}</p>
          <p className="text-xs text-gray-500">views</p>
        </div>
        <div>
          <p className="font-medium text-gray-900">{data.uniqueVisitors.toLocaleString()}</p>
          <p className="text-xs text-gray-500">visitors</p>
        </div>
        <div>
          <p className="font-medium text-gray-900">{Math.floor(data.avgSessionDuration / 60)}m</p>
          <p className="text-xs text-gray-500">avg session</p>
        </div>
        <div>
          <p className="font-medium text-gray-900">{data.bounceRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">bounce</p>
        </div>
      </div>
    </div>
  );
}
