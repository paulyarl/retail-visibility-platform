'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  BarChart3, 
  Database, 
  TrendingUp, 
  Package, 
  DollarSign,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Sparkles,
  Leaf,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react';

interface PopularProduct {
  barcode: string;
  name: string;
  brand: string;
  fetchCount: number;
  source: string;
}

interface Analytics {
  totalProducts: number;
  popularProducts: PopularProduct[];
  dataQuality: {
    withNutrition: number;
    withImages: number;
    withEnvironmental: number;
    nutritionPercentage: string;
    imagesPercentage: string;
    environmentalPercentage: string;
  };
  sourceBreakdown: any[];
  recentAdditions: number;
  apiCallsSaved: number;
  estimatedCostSavings: string;
}

export default function EnrichmentDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAnalytics();
    loadProducts();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page, sourceFilter]);

  const loadAnalytics = async () => {
    try {
      const response = await apiRequest('api/admin/enrichment/analytics');
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

  const loadProducts = async () => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(searchQuery && { query: searchQuery }),
        ...(sourceFilter && { source: sourceFilter }),
      });

      const response = await apiRequest(`api/admin/enrichment/search?${params}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadProducts();
  };

  const viewProductDetails = async (barcode: string) => {
    try {
      const response = await apiRequest(`api/admin/enrichment/${barcode}`);
      const data = await response.json();
      if (data.success) {
        setSelectedProduct(data.product);
      }
    } catch (error) {
      console.error('Failed to load product details:', error);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                Product Intelligence Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Universal barcode cache analytics and management
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <Database className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.totalProducts.toLocaleString()}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Products</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {analytics?.recentAdditions} added in last 24h
            </p>
          </div>

          {/* API Calls Saved */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.apiCallsSaved.toLocaleString()}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">API Calls Saved</h3>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              99% efficiency gain
            </p>
          </div>

          {/* Cost Savings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-emerald-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                ${analytics?.estimatedCostSavings}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Estimated Savings</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Based on $0.01/call
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Data Quality Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Nutrition */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Nutrition Facts</span>
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Product Images</span>
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
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Environmental Data</span>
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
          </div>
        </div>

        {/* Popular Products */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Most Popular Products</h2>
          <div className="space-y-3">
            {analytics?.popularProducts.map((product: PopularProduct, idx: number) => (
              <div key={product.barcode} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{product.brand} • {product.barcode}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-white">{product.fetchCount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">scans</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Browser */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Product Cache Browser</h2>
          
          {/* Search and Filters */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by barcode, name, or brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Sources</option>
              <option value="open_food_facts">Open Food Facts</option>
              <option value="upc_database">UPC Database</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Search
            </button>
          </div>

          {/* Products Table */}
          {searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Barcode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scans</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {products.map((product: any) => (
                      <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {product.imageThumbnailUrl && (
                              <img src={product.imageThumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">{product.brand}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{product.barcode}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            product.source === 'open_food_facts' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          }`}>
                            {product.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{product.fetchCount}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => viewProductDetails(product.barcode)}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Barcode</div>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedProduct.barcode}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Brand</div>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedProduct.brand}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Source</div>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedProduct.source}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Fetch Count</div>
                    <div className="font-medium text-gray-900 dark:text-white">{selectedProduct.fetchCount}</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Complete Metadata</div>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedProduct.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
