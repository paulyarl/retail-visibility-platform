/**
 * Inventory Stats Component
 * 
 * Displays key inventory metrics following shop management patterns:
 * - Total products count
 * - Active products
 * - Low stock alerts
 * - Out of stock items
 * - Total inventory value
 * - Recent activity
 * 
 * Mobile-responsive with status indicators
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign,
  BarChart3,
  RefreshCw,
  ShoppingCart,
  Eye,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@mantine/core';
import { inventoryStatsService } from '@/services/InventoryStatsSingletonService';
import { Skeleton } from '@/components/ui/Skeleton';

/* import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton'; */
import { clientLogger } from '@/lib/client-logger';

interface InventoryStatsProps {
  tenantId: string;
  loading?: boolean;
  refresh?: () => void;
}

interface Stats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalStock: number;
  totalValue: number;
  averagePrice: number;
  recentOrders: number;
  totalViews: number;
  conversionRate: number;
  productsWithVariants: number;
}

export default function InventoryStats({ tenantId, loading = false, refresh }: InventoryStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [tenantId, refresh]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      setError(null);
      
      const stats = await inventoryStatsService.getInventoryStats(tenantId);
      setStats(stats);
    } catch (err) {
      clientLogger.error('Error fetching inventory stats:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const getStatColor = (value: number, threshold: number, inverse = false) => {
    if (inverse) {
      if (value >= threshold) return 'text-green-600';
      if (value >= threshold * 0.8) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (value >= threshold) return 'text-red-600';
      if (value >= threshold * 0.8) return 'text-yellow-600';
      return 'text-green-600';
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (statsLoading || loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-12" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading stats</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={fetchStats} size="sm">Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3 w-12" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Total
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalProducts)}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeProducts} active
          </p>
        </CardContent>
      </Card>

      {/* Low Stock Alert */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <Badge 
            variant={stats.lowStockItems > 0 ? "error" : "default"} 
            className="text-xs"
          >
            Alert
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatColor(stats.lowStockItems, 5)}`}>
            {formatNumber(stats.lowStockItems)}
          </div>
          <p className="text-xs text-muted-foreground">
            Low stock items
          </p>
        </CardContent>
      </Card>

      {/* Out of Stock */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <Badge 
            variant={stats.outOfStockItems > 0 ? "error" : "default"} 
            className="text-xs"
          >
            Critical
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatColor(stats.outOfStockItems, 1)}`}>
            {formatNumber(stats.outOfStockItems)}
          </div>
          <p className="text-xs text-muted-foreground">
            Out of stock
          </p>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Value
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(stats.totalValue)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total inventory value
          </p>
        </CardContent>
      </Card>

      {/* Average Price */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Average
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.averagePrice)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average product price
          </p>
        </CardContent>
      </Card>

      {/* Total Stock */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Stock
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatColor(stats.totalStock, 100, true)}`}>
            {formatNumber(stats.totalStock)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total units in stock
          </p>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Orders
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {formatNumber(stats.recentOrders)}
          </div>
          <p className="text-xs text-muted-foreground">
            Recent orders (30 days)
          </p>
        </CardContent>
      </Card>

      {/* Total Views */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Views
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {formatNumber(stats.totalViews)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total page views
          </p>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Rate
          </Badge>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getStatColor(stats.conversionRate * 100, 2, true)}`}>
            {stats.conversionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            Conversion rate
          </p>
        </CardContent>
      </Card>

      {/* Products with Variants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <Badge variant="default" className="text-xs">
            Variants
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNumber(stats.productsWithVariants)}
          </div>
          <p className="text-xs text-muted-foreground">
            Products with variants
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
