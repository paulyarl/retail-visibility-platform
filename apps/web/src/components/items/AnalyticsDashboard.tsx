/**
 * Analytics Dashboard Component
 * 
 * Analytics integration for product performance with:
 * - Product performance metrics (views, clicks, conversions)
 * - Inventory health indicators (low stock alerts, dead stock)
 * - Category performance overview
 * - Top performing products
 * - Recent activity feed
 * - Export analytics data
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Button, Tooltip } from '@/components/ui';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MousePointer, 
  ShoppingCart, 
  Package, 
  AlertTriangle,
  Activity,
  Download,
  Calendar,
  DollarSign,
  Users,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface AnalyticsDashboardProps {
  tenantId: string;
  timeRange: '7d' | '30d' | '90d' | '1y';
  onTimeRangeChange: (range: '7d' | '30d' | '90d' | '1y') => void;
}

interface ProductAnalytics {
  productId: string;
  productName: string;
  sku: string;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  productCount: number;
  totalViews: number;
  totalRevenue: number;
  topProduct: string;
}

interface InventoryHealth {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  deadStockCount: number; // No views in 30 days
  healthyStockCount: number;
  totalValue: number;
  stockTurnover: number;
}

interface ActivityFeed {
  id: string;
  type: 'view' | 'click' | 'conversion' | 'stock_alert' | 'new_product';
  productId: string;
  productName: string;
  timestamp: string;
  value?: number;
  message: string;
}

/**
 * Analytics Dashboard for product performance
 */
export default function AnalyticsDashboard({
  tenantId,
  timeRange,
  onTimeRangeChange,
}: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState<ProductAnalytics[]>([]);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics[]>([]);
  const [inventoryHealth, setInventoryHealth] = useState<InventoryHealth | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityFeed[]>([]);
  const [overallMetrics, setOverallMetrics] = useState({
    totalViews: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRevenue: 0,
    averageConversionRate: 0,
    viewsTrend: 'up' as 'up' | 'down' | 'stable',
    revenueTrend: 'up' as 'up' | 'down' | 'stable',
  });

  // Mock data - in production, fetch from API
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        setTopProducts([
          {
            productId: '1',
            productName: 'Premium Wireless Headphones',
            sku: 'WH-001',
            views: 1250,
            clicks: 180,
            conversions: 45,
            revenue: 4495.50,
            conversionRate: 3.6,
            trend: 'up',
            trendPercentage: 12.5,
          },
          {
            productId: '2',
            productName: 'Smart Watch Pro',
            sku: 'SW-002',
            views: 980,
            clicks: 156,
            conversions: 32,
            revenue: 3199.68,
            conversionRate: 3.3,
            trend: 'up',
            trendPercentage: 8.2,
          },
          {
            productId: '3',
            productName: 'Bluetooth Speaker',
            sku: 'BS-003',
            views: 756,
            clicks: 89,
            conversions: 18,
            revenue: 899.82,
            conversionRate: 2.4,
            trend: 'down',
            trendPercentage: -5.1,
          },
        ]);

        setCategoryAnalytics([
          {
            categoryId: 'cat1',
            categoryName: 'Electronics',
            productCount: 45,
            totalViews: 12500,
            totalRevenue: 45780.50,
            topProduct: 'Premium Wireless Headphones',
          },
          {
            categoryId: 'cat2',
            categoryName: 'Accessories',
            productCount: 32,
            totalViews: 8900,
            totalRevenue: 23450.25,
            topProduct: 'Smart Watch Pro',
          },
        ]);

        setInventoryHealth({
          totalProducts: 156,
          lowStockCount: 12,
          outOfStockCount: 3,
          deadStockCount: 8,
          healthyStockCount: 133,
          totalValue: 125750.00,
          stockTurnover: 4.2,
        });

        setRecentActivity([
          {
            id: '1',
            type: 'conversion',
            productId: '1',
            productName: 'Premium Wireless Headphones',
            timestamp: '2024-01-30T14:30:00Z',
            value: 99.90,
            message: 'Product sold - Premium Wireless Headphones',
          },
          {
            id: '2',
            type: 'stock_alert',
            productId: '3',
            productName: 'Bluetooth Speaker',
            timestamp: '2024-01-30T13:15:00Z',
            message: 'Low stock alert - Bluetooth Speaker (3 remaining)',
          },
          {
            id: '3',
            type: 'view',
            productId: '2',
            productName: 'Smart Watch Pro',
            timestamp: '2024-01-30T12:45:00Z',
            message: 'High traffic - Smart Watch Pro viewed 25 times',
          },
        ]);

        setOverallMetrics({
          totalViews: 28450,
          totalClicks: 3420,
          totalConversions: 156,
          totalRevenue: 15480.25,
          averageConversionRate: 4.6,
          viewsTrend: 'up',
          revenueTrend: 'up',
        });

        setLoading(false);
      }, 1000);
    };

    fetchAnalytics();
  }, [tenantId, timeRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', percentage: number) => {
    if (trend === 'up') {
      return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    } else if (trend === 'down') {
      return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    }
    return <div className="w-4 h-4 text-gray-400" />;
  };

  const getActivityIcon = (type: ActivityFeed['type']) => {
    switch (type) {
      case 'view': return <Eye className="w-4 h-4 text-blue-600" />;
      case 'click': return <MousePointer className="w-4 h-4 text-purple-600" />;
      case 'conversion': return <ShoppingCart className="w-4 h-4 text-green-600" />;
      case 'stock_alert': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'new_product': return <Package className="w-4 h-4 text-indigo-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Time Range:</span>
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-md">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? 'default' : 'ghost'}
                onClick={() => onTimeRangeChange(range)}
                className="h-8"
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </Button>
            ))}
          </div>
          <Tooltip content="Export analytics data">
            <Button variant="outline" size="sm" className="h-8">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Views</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(overallMetrics.totalViews)}</p>
                <div className="flex items-center mt-1">
                  {getTrendIcon(overallMetrics.viewsTrend, 0)}
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Conversions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallMetrics.totalConversions}</p>
                <div className="flex items-center mt-1">
                  <span className="text-sm text-gray-500">{overallMetrics.averageConversionRate}% conversion rate</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(overallMetrics.totalRevenue)}</p>
                <div className="flex items-center mt-1">
                  {getTrendIcon(overallMetrics.revenueTrend, 0)}
                  <span className="text-sm text-gray-500 ml-1">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(overallMetrics.totalRevenue / overallMetrics.totalConversions)}
                </p>
                <div className="flex items-center mt-1">
                  <BarChart3 className="w-4 h-4 text-gray-400 mr-1" />
                  <span className="text-sm text-gray-500">Per conversion</span>
                </div>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products and Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Products */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Products</h3>
              <Badge variant="info">Last {timeRange}</Badge>
            </div>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center text-sm font-medium text-primary-600 dark:text-primary-400">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{product.productName}</p>
                      <p className="text-sm text-gray-500">{product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(product.revenue)}</p>
                    <div className="flex items-center justify-end gap-1">
                      {getTrendIcon(product.trend, product.trendPercentage)}
                      <span className={`text-sm ${product.trend === 'up' ? 'text-green-600' : product.trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                        {Math.abs(product.trendPercentage)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Performance</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {categoryAnalytics.map((category) => (
                <div key={category.categoryId} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{category.categoryName}</h4>
                    <span className="text-sm text-gray-500">{category.productCount} products</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Views:</span>
                      <span className="ml-2 font-medium">{formatNumber(category.totalViews)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 font-medium">{formatCurrency(category.totalRevenue)}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Top:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{category.topProduct}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Health and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Health */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Inventory Health</h3>
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            {inventoryHealth && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{inventoryHealth.healthyStockCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Healthy Stock</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{inventoryHealth.lowStockCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Low Stock</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{inventoryHealth.outOfStockCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Out of Stock</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{inventoryHealth.deadStockCount}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Dead Stock</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Inventory Value:</span>
                    <span className="font-medium">{formatCurrency(inventoryHealth.totalValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Stock Turnover:</span>
                    <span className="font-medium">{inventoryHealth.stockTurnover}x</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="mt-1">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {activity.value && (
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(activity.value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
