/**
 * Geographic Analytics Component
 * Shows geographic distribution of users and traffic
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, MapPin, TrendingUp, Users, Eye } from 'lucide-react';

interface GeographicAnalyticsProps {
  filters: {
    period?: string;
    startDate?: string;
    endDate?: string;
    pageType?: string;
    entityType?: string;
    region?: string;
  };
}

interface GeographicData {
  region: string;
  country: string;
  city?: string;
  users: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  trend: number;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export default function GeographicAnalytics({ filters }: GeographicAnalyticsProps) {
  const [geographicData, setGeographicData] = useState<GeographicData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGeographicData();
  }, [filters]);

  const fetchGeographicData = async () => {
    setLoading(true);
    try {
      // Mock geographic data based on the tracking coordinates you provided
      const mockGeographicData: GeographicData[] = [
        {
          region: 'North America',
          country: 'United States',
          city: 'Indianapolis',
          users: 3420,
          pageViews: 15600,
          avgSessionDuration: 285,
          bounceRate: 31.2,
          trend: 12.5,
          coordinates: { lat: 39.7684, lng: -86.1581 }
        },
        {
          region: 'North America',
          country: 'United States',
          city: 'Chicago',
          users: 2180,
          pageViews: 9800,
          avgSessionDuration: 267,
          bounceRate: 29.8,
          trend: 8.3,
          coordinates: { lat: 41.8781, lng: -87.6298 }
        },
        {
          region: 'North America',
          country: 'United States',
          city: 'New York',
          users: 1890,
          pageViews: 8900,
          avgSessionDuration: 312,
          bounceRate: 26.5,
          trend: 15.7,
          coordinates: { lat: 40.7128, lng: -74.0060 }
        },
        {
          region: 'Europe',
          country: 'United Kingdom',
          city: 'London',
          users: 980,
          pageViews: 4200,
          avgSessionDuration: 298,
          bounceRate: 33.1,
          trend: -2.4,
          coordinates: { lat: 51.5074, lng: -0.1278 }
        },
        {
          region: 'North America',
          country: 'Canada',
          city: 'Toronto',
          users: 760,
          pageViews: 3400,
          avgSessionDuration: 276,
          bounceRate: 30.5,
          trend: 6.8,
          coordinates: { lat: 43.6532, lng: -79.3832 }
        },
        {
          region: 'Asia',
          country: 'India',
          city: 'Mumbai',
          users: 540,
          pageViews: 2300,
          avgSessionDuration: 189,
          bounceRate: 41.2,
          trend: 18.9,
          coordinates: { lat: 19.0760, lng: 72.8777 }
        },
        {
          region: 'Europe',
          country: 'Germany',
          city: 'Berlin',
          users: 420,
          pageViews: 1800,
          avgSessionDuration: 267,
          bounceRate: 28.9,
          trend: 3.2,
          coordinates: { lat: 52.5200, lng: 13.4050 }
        },
        {
          region: 'Australia',
          country: 'Australia',
          city: 'Sydney',
          users: 380,
          pageViews: 1600,
          avgSessionDuration: 245,
          bounceRate: 35.7,
          trend: -1.8,
          coordinates: { lat: -33.8688, lng: 151.2093 }
        }
      ];

      await new Promise(resolve => setTimeout(resolve, 600));
      setGeographicData(mockGeographicData);
    } catch (error) {
      console.error('Error fetching geographic data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Geographic Analytics
        </h3>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Globe className="w-5 h-5 text-blue-600" />
        Geographic Analytics
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{geographicData.length}</p>
          <p className="text-xs text-blue-700">Countries</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {geographicData.reduce((sum, d) => sum + d.users, 0).toLocaleString()}
          </p>
          <p className="text-xs text-green-700">Total Users</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">
            {Math.floor(geographicData.reduce((sum, d) => sum + d.avgSessionDuration, 0) / geographicData.length / 60)}m
          </p>
          <p className="text-xs text-purple-700">Avg Session</p>
        </div>
      </div>

      {/* Geographic List */}
      <div className="space-y-2">
        {geographicData.map((location, index) => (
          <GeographicRow key={index} location={location} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}

function GeographicRow({ location, rank }: { location: GeographicData; rank: number }) {
  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (trend < 0) {
      return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
    }
    return <div className="w-4 h-4"></div>;
  };

  const getRegionFlag = (country: string) => {
    const flags: Record<string, string> = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'India': '🇮🇳',
      'Germany': '🇩🇪',
      'Australia': '🇦🇺'
    };
    return flags[country] || '🌍';
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-500 w-6">#{rank}</span>
        <div className="text-lg">{getRegionFlag(location.country)}</div>
        <div>
          <p className="font-medium text-gray-900 text-sm">
            {location.city && `${location.city}, `}{location.country}
          </p>
          <p className="text-xs text-gray-500">{location.region}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-sm text-right">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="font-medium text-gray-900">{location.users.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Eye className="w-3 h-3 text-gray-400" />
          <span className="text-gray-600">{location.pageViews.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <span className="text-gray-600">{Math.floor(location.avgSessionDuration / 60)}m</span>
        </div>
        
        <div className={`flex items-center gap-1 font-medium ${
          location.trend > 0 ? 'text-green-600' : location.trend < 0 ? 'text-red-600' : 'text-gray-500'
        }`}>
          {getTrendIcon(location.trend)}
          <span>{Math.abs(location.trend)}%</span>
        </div>
      </div>
    </div>
  );
}
