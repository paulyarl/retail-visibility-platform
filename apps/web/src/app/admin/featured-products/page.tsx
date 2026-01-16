"use client";

import { useState, useEffect } from 'react';
import { Star, TrendingUp, Store, Package, Eye, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

interface FeaturedProduct {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  price_cents: number;
  image_url?: string;
  is_featured: boolean;
  featured_at: string;
  featured_until?: string;
  featured_priority: number;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
  };
}

interface FeaturingStats {
  totalFeatured: number;
  byTier: Array<{ tier: string; count: string }>;
  expiringSoon: number;
}

export default function AdminFeaturedProductsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeaturingStats | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, productsRes] = await Promise.all([
        api.get('/api/admin/products/featuring/stats'),
        api.get(`/api/admin/products/featured?limit=${limit}&offset=${page * limit}`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
        setTotal(productsData.total || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'trial': 'bg-gray-100 text-gray-700',
      'google-only': 'bg-blue-100 text-blue-700',
      'starter': 'bg-green-100 text-green-700',
      'professional': 'bg-purple-100 text-purple-700',
      'enterprise': 'bg-amber-100 text-amber-700',
      'organization': 'bg-red-100 text-red-700'
    };
    return colors[tier] || 'bg-gray-100 text-gray-700';
  };

  if (loading && page === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
          Featured Products Overview
        </h1>
        <p className="mt-2 text-gray-600">
          Platform-wide view of all featured products across tenants
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Featured */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Featured</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalFeatured}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-600 fill-amber-600" />
              </div>
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.expiringSoon}</p>
                <p className="text-xs text-gray-500 mt-1">Next 7 days</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          {/* By Tier */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-600">By Tier</p>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              {stats.byTier.slice(0, 3).map((item) => (
                <div key={item.tier} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{item.tier}:</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Featured Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            All Featured Products ({total})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Featured Since
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <Eye className="w-5 h-5" />
                          </div>
                        )}
                        <div className="absolute -top-1 -right-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-xs">
                          {product.title || product.name}
                        </p>
                        {product.brand && (
                          <p className="text-xs text-gray-500">{product.brand}</p>
                        )}
                        <p className="text-sm text-gray-600">
                          ${(product.price_cents / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {product.tenants.name}
                        </p>
                        <p className="text-xs text-gray-500">{product.tenant_id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTierColor(product.tenants.subscription_tier)}`}>
                      {product.tenants.subscription_tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full"
                          style={{ width: `${product.featured_priority}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {product.featured_priority}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(product.featured_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {product.featured_until ? (
                      <span className={
                        new Date(product.featured_until) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                          ? 'text-red-600 font-medium'
                          : ''
                      }>
                        {formatDate(product.featured_until)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800"
                        title="View product"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/t/${product.tenant_id}/items/${product.id}`}
                        target="_blank"
                        className="text-gray-600 hover:text-gray-800"
                        title="View in tenant dashboard"
                      >
                        <Store className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} products
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {products.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Featured Products Yet</h3>
          <p className="text-gray-600">
            Featured products will appear here once tenants start featuring their products
          </p>
        </div>
      )}
    </div>
  );
}
