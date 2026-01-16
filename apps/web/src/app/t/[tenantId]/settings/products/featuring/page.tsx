"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Star, TrendingUp, Eye, Sparkles, Check, X, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';
import Image from 'next/image';

interface Product {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  is_featured: boolean;
  featured_at?: string;
  featured_until?: string;
  featured_priority: number;
  has_variants?: boolean;
  availability?: string;
}

interface FeaturingStatus {
  tier: string;
  limit: number;
  current: number;
  available: number;
  canFeature: boolean;
}

export default function ProductFeaturingPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FeaturingStatus | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, featuredRes, productsRes] = await Promise.all([
        api.get(`/api/tenants/${tenantId}/products/featuring/status`),
        api.get(`/api/tenants/${tenantId}/products/featured`),
        api.get(`/api/tenants/${tenantId}/items?limit=100`)
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (featuredRes.ok) {
        const featuredData = await featuredRes.json();
        setFeaturedProducts(featuredData.products || []);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        const available = (productsData.items || []).filter((p: Product) => !p.is_featured);
        setAvailableProducts(available);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeature = async (productId: string) => {
    if (!status?.canFeature) {
      alert(`You've reached your featuring limit (${status?.limit} products for ${status?.tier} tier)`);
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post(`/api/tenants/${tenantId}/products/${productId}/feature`, {
        priority: 50
      });

      if (response.ok) {
        await fetchData();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to feature product');
      }
    } catch (error) {
      console.error('Error featuring product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnfeature = async (productId: string) => {
    setProcessing(true);
    try {
      const response = await api.delete(`/api/tenants/${tenantId}/products/${productId}/feature`);

      if (response.ok) {
        await fetchData();
      } else {
        alert('Failed to unfeature product');
      }
    } catch (error) {
      console.error('Error unfeaturing product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePriority = async (productId: string, newPriority: number) => {
    setProcessing(true);
    try {
      const response = await api.patch(`/api/tenants/${tenantId}/products/${productId}/feature/priority`, {
        priority: newPriority
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error updating priority:', error);
    } finally {
      setProcessing(false);
    }
  };

  const filteredAvailable = availableProducts.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading featuring settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-amber-500" />
          Featured Products
        </h1>
        <p className="mt-2 text-gray-600">
          Highlight your best products with prominent display styling
        </p>
      </div>

      {/* Status Card */}
      {status && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-100 border-2 border-amber-200 rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-600" />
                Featuring Status
              </h3>
              <p className="mt-1 text-gray-700">
                Using <span className="font-semibold">{status.current}</span> of{' '}
                <span className="font-semibold">{status.limit}</span> featured slots
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Tier: <span className="font-semibold capitalize">{status.tier}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-amber-600">
                {status.available}
              </div>
              <div className="text-sm text-gray-600">slots available</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  status.current >= status.limit
                    ? 'bg-red-500'
                    : status.current / status.limit > 0.8
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((status.current / status.limit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {!status.canFeature && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">
                ⚠️ You've reached your featuring limit. Unfeature some products or upgrade your tier to feature more.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Featured Products */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          Currently Featured ({featuredProducts.length})
        </h2>

        {featuredProducts.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Featured Products Yet</h3>
            <p className="text-gray-600">
              Feature your best products to give them prominent display styling and boost conversions
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg border-2 border-amber-200 p-4 relative">
                {/* Featured Badge */}
                <div className="absolute top-2 left-2 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    <Star className="w-3 h-3 fill-white" />
                    FEATURED
                  </span>
                </div>

                {/* Product Image */}
                <div className="relative h-48 bg-gray-100 rounded-lg mb-4">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover rounded-lg"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Eye className="w-12 h-12" />
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="mb-4">
                  {product.brand && (
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{product.brand}</p>
                  )}
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {product.title || product.name}
                  </h3>
                  <p className="text-lg font-bold text-gray-900">
                    ${(product.price_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                </div>

                {/* Priority Controls */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-600">Priority:</span>
                  <button
                    onClick={() => handleUpdatePriority(product.id, Math.min(product.featured_priority + 10, 100))}
                    disabled={processing}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="Increase priority"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-gray-900">{product.featured_priority}</span>
                  <button
                    onClick={() => handleUpdatePriority(product.id, Math.max(product.featured_priority - 10, 0))}
                    disabled={processing}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    title="Decrease priority"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Unfeature Button */}
                <button
                  onClick={() => handleUnfeature(product.id)}
                  disabled={processing}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? 'Processing...' : 'Remove from Featured'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Products */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Add Products to Featured
        </h2>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAvailable.slice(0, 12).map((product) => (
            <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="relative w-16 h-16 bg-gray-100 rounded flex-shrink-0">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover rounded"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Eye className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">
                    {product.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    ${(product.price_cents / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                </div>
              </div>

              {/* Feature Button */}
              <button
                onClick={() => handleFeature(product.id)}
                disabled={processing || !status?.canFeature}
                className="w-full mt-3 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4" />
                {processing ? 'Processing...' : 'Feature This Product'}
              </button>
            </div>
          ))}
        </div>

        {filteredAvailable.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No products found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Benefits Section */}
      <div className="mt-12 bg-gray-50 rounded-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Why Feature Products?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Stand Out</h4>
              <p className="text-gray-600 text-sm">Featured badge and gradient styling make products impossible to miss</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Boost Sales</h4>
              <p className="text-gray-600 text-sm">Featured products get 3x more clicks and 2x higher conversion rates</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Premium Display</h4>
              <p className="text-gray-600 text-sm">Larger images, enhanced typography, and prominent call-to-action buttons</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Check className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Easy Management</h4>
              <p className="text-gray-600 text-sm">Feature and unfeature products instantly, adjust priorities with one click</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
