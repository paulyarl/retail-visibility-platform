'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  BarChart3, 
  Package, 
  TrendingUp, 
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
  Sparkles,
  Leaf,
  AlertTriangle,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';

interface Analytics {
  totalScanned: number;
  recentScans: {
    last7Days: number;
    last30Days: number;
  };
  dataQuality: {
    withNutrition: number;
    withImages: number;
    withEnvironmental: number;
    withAllergens: number;
    nutritionPercentage: string;
    imagesPercentage: string;
    environmentalPercentage: string;
    allergensPercentage: string;
  };
  topProducts: any[];
  cacheBenefit: {
    cacheHits: number;
    apiCallsSaved: number;
    estimatedSavings: string;
  };
}

export default function TenantInsightsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewBarcode, setPreviewBarcode] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [tenantId]);

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/scan/tenant/${tenantId}/analytics`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!previewBarcode.trim()) return;
    
    setPreviewLoading(true);
    setPreviewResult(null);
    
    try {
      const response = await fetch(`/api/scan/preview/${previewBarcode}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (data.success) {
        setPreviewResult(data);
      }
    } catch (error) {
      console.error('Failed to preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Inventory Intelligence
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Your scanning analytics and product insights
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Scanned */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Package className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.totalScanned.toLocaleString()}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Products Scanned</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {analytics?.recentScans.last7Days} in last 7 days
            </p>
          </div>

          {/* This Month */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.recentScans.last30Days.toLocaleString()}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 30 Days</h3>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Recent activity
            </p>
          </div>

          {/* Cost Savings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-emerald-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${analytics?.cacheBenefit.estimatedSavings}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Your Savings</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              From universal cache
            </p>
          </div>

          {/* Data Quality */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.dataQuality.nutritionPercentage}%
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Nutrition Data</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {analytics?.dataQuality.withNutrition.toLocaleString()} products
            </p>
          </div>
        </div>

        {/* Data Quality Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Product Data Quality</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Nutrition */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nutrition</span>
                </div>
                <span className="text-sm font-bold text-blue-600">{analytics?.dataQuality.nutritionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${analytics?.dataQuality.nutritionPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {analytics?.dataQuality.withNutrition.toLocaleString()} products
              </p>
            </div>

            {/* Images */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Images</span>
                </div>
                <span className="text-sm font-bold text-purple-600">{analytics?.dataQuality.imagesPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${analytics?.dataQuality.imagesPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {analytics?.dataQuality.withImages.toLocaleString()} products
              </p>
            </div>

            {/* Environmental */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Environmental</span>
                </div>
                <span className="text-sm font-bold text-green-600">{analytics?.dataQuality.environmentalPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${analytics?.dataQuality.environmentalPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {analytics?.dataQuality.withEnvironmental.toLocaleString()} products
              </p>
            </div>

            {/* Allergens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allergens</span>
                </div>
                <span className="text-sm font-bold text-orange-600">{analytics?.dataQuality.allergensPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full transition-all"
                  style={{ width: `${analytics?.dataQuality.allergensPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {analytics?.dataQuality.withAllergens.toLocaleString()} products
              </p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Most Scanned Products</h2>
            {analytics?.topProducts && analytics.topProducts.length > 0 ? (
              <div className="space-y-3">
                {analytics.topProducts.map((product, idx) => (
                  <div key={product.sku} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{product.brand} • {product.sku}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">{product.scanCount}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">scans</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No products scanned yet</p>
                <p className="text-sm mt-1">Start scanning to see your top products</p>
              </div>
            )}
          </div>

          {/* Enrichment Preview Tool */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Product Preview Tool</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Check what data is available before scanning a product
            </p>
            
            {/* Search Input */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Enter barcode (e.g., 012345678901)"
                value={previewBarcode}
                onChange={(e) => setPreviewBarcode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePreview()}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handlePreview}
                disabled={previewLoading || !previewBarcode.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {previewLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Check
              </button>
            </div>

            {/* Preview Result */}
            {previewResult && (
              <div className="mt-4">
                {previewResult.found ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">Product Found in Cache!</h3>
                        <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                          {previewResult.product.name} by {previewResult.product.brand}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            {previewResult.product.dataAvailable.nutrition ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={previewResult.product.dataAvailable.nutrition ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}>
                              Nutrition Facts
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {previewResult.product.dataAvailable.images ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={previewResult.product.dataAvailable.images ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}>
                              Product Images
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {previewResult.product.dataAvailable.allergens ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={previewResult.product.dataAvailable.allergens ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}>
                              Allergen Info
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {previewResult.product.dataAvailable.environmental ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={previewResult.product.dataAvailable.environmental ? 'text-green-800 dark:text-green-200' : 'text-gray-600 dark:text-gray-400'}>
                              Environmental
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Scanned by {previewResult.product.popularity} other {previewResult.product.popularity === 1 ? 'store' : 'stores'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Not in Cache</h3>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          {previewResult.message}
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                          This product will be fetched from external APIs when you scan it, and then cached for future use.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
