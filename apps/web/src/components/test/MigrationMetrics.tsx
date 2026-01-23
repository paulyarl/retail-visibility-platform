/**
 * Migration Metrics Component
 * 
 * Displays comprehensive real-time metrics for the singleton migration test
 * including performance data, cache statistics, and success rates.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertCircle, TrendingUp, Clock, Database, Zap, Target, Package, Folder, Store } from 'lucide-react';
import { useRandomFeaturedProducts } from '@/providers/data/ProductSingleton';
import { useDirectoryCategories } from '@/hooks/useDirectoryCategories';
import { useFeaturedStores } from '@/hooks/useFeaturedStores';

interface SingletonMetrics {
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  averageResponseTime: number;
  hitRate: number;
}

interface TestResults {
  products?: {
    success: boolean;
    responseTime: number;
    fromCache: boolean;
    itemCount: number;
    error?: string;
  };
  categories?: {
    success: boolean;
    responseTime: number;
    fromCache: boolean;
    itemCount: number;
    error?: string;
  };
  stores?: {
    success: boolean;
    responseTime: number;
    fromCache: boolean;
    itemCount: number;
    error?: string;
  };
}

interface MigrationMetricsProps {
  testResults: TestResults;
}

export default function MigrationMetrics({ testResults }: MigrationMetricsProps) {
  // Get real-time metrics from all three singletons
  const productMetrics = useRandomFeaturedProducts({ lat: 40.7128, lng: -74.0060 }, 10);
  const categoryMetrics = useDirectoryCategories({ includeChildren: true, includeProductCount: true });
  const storeMetrics = useFeaturedStores({ limit: 10, location: { lat: 40.7128, lng: -74.0060, radius: 50 } });

  const [realTimeMetrics, setRealTimeMetrics] = useState({
    products: { cacheHits: 0, cacheMisses: 0, totalRequests: 0, averageResponseTime: 0, hitRate: 0 },
    categories: { cacheHits: 0, cacheMisses: 0, totalRequests: 0, averageResponseTime: 0, hitRate: 0 },
    stores: { cacheHits: 0, cacheMisses: 0, totalRequests: 0, averageResponseTime: 0, hitRate: 0 },
  });

  // Create stable dependencies for useEffect
  const metricsDependencies = useMemo(() => ({
    productCacheHits: productMetrics.metrics?.cacheHits || 0,
    productCacheMisses: productMetrics.metrics?.cacheMisses || 0,
    productTotalRequests: productMetrics.metrics?.totalRequests || 0,
    productAvgResponseTime: productMetrics.metrics?.averageResponseTime || 0,
    categoryCacheHits: categoryMetrics.metrics?.cacheHits || 0,
    categoryCacheMisses: categoryMetrics.metrics?.cacheMisses || 0,
    categoryTotalRequests: categoryMetrics.metrics?.totalRequests || 0,
    categoryAvgResponseTime: categoryMetrics.metrics?.averageResponseTime || 0,
    storeCacheHits: storeMetrics.metrics?.cacheHits || 0,
    storeCacheMisses: storeMetrics.metrics?.cacheMisses || 0,
    storeTotalRequests: storeMetrics.metrics?.totalRequests || 0,
    storeAvgResponseTime: storeMetrics.metrics?.averageResponseTime || 0,
  }), [
    productMetrics.metrics?.cacheHits,
    productMetrics.metrics?.cacheMisses,
    productMetrics.metrics?.totalRequests,
    productMetrics.metrics?.averageResponseTime,
    categoryMetrics.metrics?.cacheHits,
    categoryMetrics.metrics?.cacheMisses,
    categoryMetrics.metrics?.totalRequests,
    categoryMetrics.metrics?.averageResponseTime,
    storeMetrics.metrics?.cacheHits,
    storeMetrics.metrics?.cacheMisses,
    storeMetrics.metrics?.totalRequests,
    storeMetrics.metrics?.averageResponseTime,
  ]);

  // Update real-time metrics when singleton data changes
  useEffect(() => {
    setRealTimeMetrics({
      products: {
        cacheHits: metricsDependencies.productCacheHits,
        cacheMisses: metricsDependencies.productCacheMisses,
        totalRequests: metricsDependencies.productTotalRequests,
        averageResponseTime: metricsDependencies.productAvgResponseTime,
        hitRate: metricsDependencies.productTotalRequests > 0 
          ? (metricsDependencies.productCacheHits / metricsDependencies.productTotalRequests) * 100 
          : 0,
      },
      categories: {
        cacheHits: metricsDependencies.categoryCacheHits,
        cacheMisses: metricsDependencies.categoryCacheMisses,
        totalRequests: metricsDependencies.categoryTotalRequests,
        averageResponseTime: metricsDependencies.categoryAvgResponseTime,
        hitRate: metricsDependencies.categoryTotalRequests > 0 
          ? (metricsDependencies.categoryCacheHits / metricsDependencies.categoryTotalRequests) * 100 
          : 0,
      },
      stores: {
        cacheHits: metricsDependencies.storeCacheHits,
        cacheMisses: metricsDependencies.storeCacheMisses,
        totalRequests: metricsDependencies.storeTotalRequests,
        averageResponseTime: metricsDependencies.storeAvgResponseTime,
        hitRate: metricsDependencies.storeTotalRequests > 0 
          ? (metricsDependencies.storeCacheHits / metricsDependencies.storeTotalRequests) * 100 
          : 0,
      },
    });
  }, [metricsDependencies]);

  const calculateOverallMetrics = () => {
    const allMetrics = [realTimeMetrics.products, realTimeMetrics.categories, realTimeMetrics.stores];
    const totalCacheHits = allMetrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = allMetrics.reduce((sum, m) => sum + m.cacheMisses, 0);
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / 3;
    const avgHitRate = allMetrics.reduce((sum, m) => sum + m.hitRate, 0) / 3;

    return {
      totalCacheHits,
      totalCacheMisses,
      totalRequests,
      averageResponseTime: Math.round(avgResponseTime),
      averageHitRate: avgHitRate.toFixed(1),
      totalItems: (productMetrics.products?.length || 0) + (categoryMetrics.categories?.length || 0) + (storeMetrics.stores?.length || 0),
    };
  };

  const getRecommendations = () => {
    const metrics = calculateOverallMetrics();
    const recommendations = [];

    if (parseFloat(metrics.averageHitRate) >= 60) {
      recommendations.push({
        type: 'success',
        title: 'Excellent Cache Performance',
        description: `Average hit rate of ${metrics.averageHitRate}% is excellent for 15-minute TTL.`,
        icon: CheckCircle,
      });
    }

    if (metrics.averageResponseTime < 300) {
      recommendations.push({
        type: 'success',
        title: 'Great Performance',
        description: `Average response time of ${metrics.averageResponseTime}ms is well within acceptable limits.`,
        icon: Zap,
      });
    }

    if (parseFloat(metrics.averageHitRate) < 50) {
      recommendations.push({
        type: 'warning',
        title: 'Cache Optimization Needed',
        description: 'Consider increasing cache TTL or implementing more aggressive caching strategies.',
        icon: Database,
      });
    }

    if (metrics.averageResponseTime > 500) {
      recommendations.push({
        type: 'warning',
        title: 'Performance Optimization Needed',
        description: 'Consider optimizing database queries or implementing Redis caching.',
        icon: Clock,
      });
    }

    if (parseFloat(metrics.averageHitRate) >= 60 && metrics.averageResponseTime < 300) {
      recommendations.push({
        type: 'success',
        title: 'Phase 1 Migration Complete',
        description: 'All singletons performing excellently. Ready for Phase 2 implementation.',
        icon: Target,
      });
    }

    return recommendations;
  };

  const metrics = calculateOverallMetrics();
  const recommendations = getRecommendations();

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-blue-900 flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Phase 1 Migration Summary</span>
          </h4>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            parseFloat(metrics.averageHitRate) >= 60 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {parseFloat(metrics.averageHitRate) >= 60 ? '✅ Excellent Performance' : '⚠️ Optimization Needed'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{metrics.totalCacheHits}</div>
            <div className="text-sm text-blue-700">Cache Hits</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{metrics.averageHitRate}%</div>
            <div className="text-sm text-blue-700">Avg Hit Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{metrics.averageResponseTime}ms</div>
            <div className="text-sm text-blue-700">Avg Response</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{metrics.totalItems}</div>
            <div className="text-sm text-blue-700">Items Loaded</div>
          </div>
        </div>
      </div>

      {/* Individual Singleton Performance */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>Singleton Performance Metrics</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ProductSingleton */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Package className="w-4 h-4 text-blue-600" />
              <h5 className="font-medium text-blue-900">ProductSingleton</h5>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Hits:</span>
                <span className="font-medium">{realTimeMetrics.products.cacheHits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Misses:</span>
                <span className="font-medium">{realTimeMetrics.products.cacheMisses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium">{realTimeMetrics.products.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Response:</span>
                <span className="font-medium">{realTimeMetrics.products.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Products:</span>
                <span className="font-medium">{productMetrics.products?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* CategorySingleton */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Folder className="w-4 h-4 text-green-600" />
              <h5 className="font-medium text-green-900">CategorySingleton</h5>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Hits:</span>
                <span className="font-medium">{realTimeMetrics.categories.cacheHits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Misses:</span>
                <span className="font-medium">{realTimeMetrics.categories.cacheMisses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium">{realTimeMetrics.categories.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Response:</span>
                <span className="font-medium">{realTimeMetrics.categories.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Categories:</span>
                <span className="font-medium">{categoryMetrics.categories?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* StoreSingleton */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Store className="w-4 h-4 text-purple-600" />
              <h5 className="font-medium text-purple-900">StoreSingleton</h5>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Hits:</span>
                <span className="font-medium">{realTimeMetrics.stores.cacheHits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cache Misses:</span>
                <span className="font-medium">{realTimeMetrics.stores.cacheMisses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Hit Rate:</span>
                <span className="font-medium">{realTimeMetrics.stores.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Response:</span>
                <span className="font-medium">{realTimeMetrics.stores.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stores:</span>
                <span className="font-medium">{storeMetrics.stores?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Performance Analysis & Recommendations</span>
        </h4>
        
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 p-3 rounded-lg border ${
                rec.type === 'success' ? 'bg-green-50 border-green-200' :
                rec.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <rec.icon className={`w-5 h-5 mt-0.5 ${
                rec.type === 'success' ? 'text-green-600' :
                rec.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`} />
              <div>
                <h5 className={`font-medium ${
                  rec.type === 'success' ? 'text-green-900' :
                  rec.type === 'warning' ? 'text-yellow-900' :
                  'text-blue-900'
                }`}>
                  {rec.title}
                </h5>
                <p className={`text-sm ${
                  rec.type === 'success' ? 'text-green-700' :
                  rec.type === 'warning' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  {rec.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}