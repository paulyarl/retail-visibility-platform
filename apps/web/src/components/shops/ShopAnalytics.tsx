'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package, 
  Eye, 
  ShoppingCart,
  Star,
  Calendar,
  Download,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity,
  DollarSign,
  Clock,
  MapPin,
  Globe,
  Phone,
  Mail,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink
} from 'lucide-react';
import { type Shop } from '@/services/ShopsService';

interface ShopAnalyticsProps {
  tenantId: string;
  shops: Shop[];
}

interface AnalyticsData {
  overview: {
    totalViews: number;
    totalOrders: number;
    totalRevenue: number;
    averageRating: number;
    conversionRate: number;
    monthlyGrowth: number;
  };
  traffic: {
    daily: Array<{ date: string; views: number; visitors: number }>;
    sources: Array<{ source: string; views: number; percentage: number }>;
    locations: Array<{ city: string; views: number; percentage: number }>;
  };
  products: {
    topProducts: Array<{
      id: string;
      name: string;
      views: number;
      orders: number;
      revenue: number;
      rating: number;
    }>;
    categories: Array<{ category: string; count: number; percentage: number }>;
  };
  engagement: {
    followers: number;
    reviews: number;
    questions: number;
    shares: number;
    socialMedia: Array<{ platform: string; clicks: number; percentage: number }>;
  };
  revenue: {
    daily: Array<{ date: string; revenue: number; orders: number }>;
    monthly: Array<{ month: string; revenue: number; orders: number }>;
    byShop: Array<{ shopName: string; revenue: number; orders: number; percentage: number }>;
  };
}

const timeRanges = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

export default function ShopAnalytics({ tenantId, shops }: ShopAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, selectedShop, tenantId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Mock analytics data - would come from API
      const mockAnalytics: AnalyticsData = {
        overview: {
          totalViews: 15420,
          totalOrders: 892,
          totalRevenue: 45680,
          averageRating: 4.3,
          conversionRate: 5.8,
          monthlyGrowth: 12.4
        },
        traffic: {
          daily: [
            { date: '2024-01-15', views: 234, visitors: 189 },
            { date: '2024-01-16', views: 267, visitors: 201 },
            { date: '2024-01-17', views: 198, visitors: 167 },
            { date: '2024-01-18', views: 312, visitors: 245 },
            { date: '2024-01-19', views: 289, visitors: 223 },
            { date: '2024-01-20', views: 356, visitors: 289 },
            { date: '2024-01-21', views: 423, visitors: 334 },
          ],
          sources: [
            { source: 'Direct', views: 8923, percentage: 57.8 },
            { source: 'Google Search', views: 3456, percentage: 22.4 },
            { source: 'Social Media', views: 1876, percentage: 12.2 },
            { source: 'Referral', views: 1165, percentage: 7.6 },
          ],
          locations: [
            { city: 'New York', views: 5678, percentage: 36.8 },
            { city: 'Los Angeles', views: 3234, percentage: 21.0 },
            { city: 'Chicago', views: 2345, percentage: 15.2 },
            { city: 'Houston', views: 1876, percentage: 12.2 },
            { city: 'Phoenix', views: 1287, percentage: 8.3 },
          ]
        },
        products: {
          topProducts: [
            { id: '1', name: 'Premium Coffee Beans', views: 892, orders: 67, revenue: 1340, rating: 4.8 },
            { id: '2', name: 'Artisan Bread', views: 756, orders: 89, revenue: 1123, rating: 4.6 },
            { id: '3', name: 'Organic Honey', views: 634, orders: 45, revenue: 890, rating: 4.9 },
            { id: '4', name: 'Handmade Soap', views: 523, orders: 34, revenue: 456, rating: 4.7 },
            { id: '5', name: 'Fresh Eggs', views: 445, orders: 78, revenue: 234, rating: 4.5 },
          ],
          categories: [
            { category: 'Food & Beverages', count: 234, percentage: 45.2 },
            { category: 'Health & Beauty', count: 123, percentage: 23.8 },
            { category: 'Home & Garden', count: 89, percentage: 17.2 },
            { category: 'Clothing', count: 73, percentage: 14.1 },
          ]
        },
        engagement: {
          followers: 1234,
          reviews: 567,
          questions: 89,
          shares: 234,
          socialMedia: [
            { platform: 'Facebook', clicks: 1234, percentage: 45.2 },
            { platform: 'Instagram', clicks: 876, percentage: 32.1 },
            { platform: 'Twitter', clicks: 456, percentage: 16.7 },
            { platform: 'LinkedIn', clicks: 167, percentage: 6.1 },
          ]
        },
        revenue: {
          daily: [
            { date: '2024-01-15', revenue: 1234, orders: 23 },
            { date: '2024-01-16', revenue: 1567, orders: 34 },
            { date: '2024-01-17', revenue: 989, orders: 19 },
            { date: '2024-01-18', revenue: 1876, orders: 41 },
            { date: '2024-01-19', revenue: 2134, orders: 48 },
            { date: '2024-01-20', revenue: 2456, orders: 52 },
            { date: '2024-01-21', revenue: 2890, orders: 61 },
          ],
          monthly: [
            { month: '2023-12', revenue: 45678, orders: 987 },
            { month: '2023-11', revenue: 38945, orders: 823 },
            { month: '2023-10', revenue: 34567, orders: 745 },
            { month: '2023-09', revenue: 28934, orders: 612 },
            { month: '2023-08', revenue: 23456, orders: 534 },
          ],
          byShop: shops.length > 0 ? shops.map((shop, index) => ({
            shopName: shop.name,
            revenue: Math.floor(Math.random() * 10000) + 1000,
            orders: Math.floor(Math.random() * 100) + 20,
            percentage: Math.floor(100 / shops.length)
          })) : []
        }
      };

      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    // Mock export functionality
    console.log('Exporting analytics data...');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-64 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No analytics data available</h3>
          <p className="text-gray-600">
            Analytics will appear once you have shops with activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shop Analytics</h2>
          <p className="text-gray-600">
            Track performance across all your shops
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedShop} onChange={(e) => setSelectedShop(e.target.value)}>
            <option value="all">All Shops</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </Select>
          
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            {timeRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </Select>

          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Views</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.overview.totalViews.toLocaleString()}
                </p>
                <div className="flex items-center text-sm text-green-600">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  {analytics.overview.monthlyGrowth}%
                </div>
              </div>
              <Eye className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.overview.totalOrders}
                </p>
                <p className="text-sm text-gray-500">Last {timeRange}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analytics.overview.totalRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Last {timeRange}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.overview.averageRating.toFixed(1)}
                </p>
                <div className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="text-sm text-gray-500 ml-1">
                    ({analytics.engagement.reviews} reviews)
                  </span>
                </div>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.overview.conversionRate}%
                </p>
                <p className="text-sm text-gray-500">Orders / Views</p>
              </div>
              <Activity className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Followers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.engagement.followers.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total across shops</p>
              </div>
              <Users className="w-8 h-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Traffic Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.traffic.daily.slice(0, 7).map((day) => (
                        <div key={day.date} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{day.date}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">{day.views} views</div>
                            <div className="text-xs text-gray-500">{day.visitors} visitors</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analytics.revenue.daily.slice(0, 7).map((day) => (
                        <div key={day.date} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{day.date}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">${day.revenue}</div>
                            <div className="text-xs text-gray-500">{day.orders} orders</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.products.topProducts.map((product, index) => (
                        <div key={product.id} className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Star className="w-3 h-3 text-yellow-500 fill-current" />
                              <span>{product.rating}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">${product.revenue}</div>
                            <div className="text-xs text-gray-500">{product.orders} orders</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Traffic Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.traffic.sources.map((source) => (
                        <div key={source.source} className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{source.source}</span>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-600">{source.views}</div>
                            <Badge variant="default">{source.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Locations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.traffic.locations.map((location) => (
                        <div key={location.city} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">{location.city}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-600">{location.views}</div>
                            <Badge variant="default">{location.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Other tabs would have similar detailed content */}
            <TabsContent value="traffic">
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Traffic Analytics</h3>
                <p className="text-gray-600">
                  Detailed traffic analysis coming soon
                </p>
              </div>
            </TabsContent>

            <TabsContent value="products">
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Product Analytics</h3>
                <p className="text-gray-600">
                  Detailed product performance coming soon
                </p>
              </div>
            </TabsContent>

            <TabsContent value="revenue">
              <div className="text-center py-12">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue Analytics</h3>
                <p className="text-gray-600">
                  Detailed revenue analysis coming soon
                </p>
              </div>
            </TabsContent>

            <TabsContent value="engagement">
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Engagement Analytics</h3>
                <p className="text-gray-600">
                  Detailed engagement metrics coming soon
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
