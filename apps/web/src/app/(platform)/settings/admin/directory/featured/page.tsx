'use client';

import { useState, useEffect } from 'react';
import { Card } from '@mantine/core';
import { Badge } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { TrendingUp, Award, Trophy, Sparkles, RefreshCw } from 'lucide-react';
import { directoryService } from '@/services/DirectoryService';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

interface PremiumFeaturedStats {
  trending: { count: number; avgScore: number; topProduct: string };
  recommended: { count: number; avgRating: number; topProduct: string };
  bestseller: { count: number; totalSales: number; topProduct: string };
  random_featured: { count: number; diversity: number; topProduct: string };
}

interface FeaturedProduct {
  id: string;
  name: string;
  brand: string;
  priceCents: number;
  storeName: string;
  storeCity: string;
  featuredType: 'trending' | 'recommended' | 'bestseller' | 'random_featured';
  score?: number;
  rating?: number;
  sales?: number;
}

export default function PremiumFeaturedDirectoryPage() {
  const [stats, setStats] = useState<PremiumFeaturedStats | null>(null);
  const [recentProducts, setRecentProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'trending' | 'recommended' | 'bestseller' | 'random_featured' | 'all'>('all');

  const featuredTypes = [
    { id: 'trending', name: 'Trending Products', description: 'Products with high engagement and growth velocity', icon: TrendingUp, color: 'pink', gradient: 'from-pink-500 to-rose-500', metric: 'Trending Score' },
    { id: 'recommended', name: 'Recommended Products', description: 'AI-curated products based on quality and user preferences', icon: Award, color: 'teal', gradient: 'from-teal-500 to-cyan-500', metric: 'Average Rating' },
    { id: 'bestseller', name: 'Bestseller Products', description: 'Top-performing products by sales and conversion', icon: Trophy, color: 'amber', gradient: 'from-amber-500 to-yellow-500', metric: 'Total Sales' },
    { id: 'random_featured', name: 'Discover Products', description: 'Curated random discoveries for product exploration', icon: Sparkles, color: 'cyan', gradient: 'from-cyan-500 to-blue-500', metric: 'Diversity Score' },
  ] as const;

  useEffect(() => { fetchPremiumFeaturedData(); }, []);

  const fetchPremiumFeaturedData = async () => {
    try {
      setLoading(true);
      const statsResults = await Promise.all(featuredTypes.map(type => directoryService.getFeaturedStats(type.id)));
      setStats({
        trending: { count: statsResults[0]?.count || 0, avgScore: statsResults[0]?.avgScore || 0, topProduct: statsResults[0]?.topProduct || 'N/A' },
        recommended: { count: statsResults[1]?.count || 0, avgRating: statsResults[1]?.avgRating || 0, topProduct: statsResults[1]?.topProduct || 'N/A' },
        bestseller: { count: statsResults[2]?.count || 0, totalSales: statsResults[2]?.totalSales || 0, topProduct: statsResults[2]?.topProduct || 'N/A' },
        random_featured: { count: statsResults[3]?.count || 0, diversity: statsResults[3]?.diversity || 0, topProduct: statsResults[3]?.topProduct || 'N/A' },
      });
      const productsData = await directoryService.getPremiumFeaturedProducts(20);
      setRecentProducts(productsData.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch premium featured data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedType === 'all' ? recentProducts : recentProducts.filter(p => p.featuredType === selectedType);
  const getTypeInfo = (typeId: string) => featuredTypes.find(t => t.id === typeId);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Premium Featured Products"
        description="Platform-controlled featured product algorithms and performance analytics"
        actions={
          <div className="flex items-center gap-3">
            <button onClick={fetchPremiumFeaturedData} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link href="/settings/admin/directory" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">← Directory Panel</Link>
          </div>
        }
      />

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-800">{error}</p></div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {featuredTypes.map((type) => {
          const Icon = type.icon;
          const typeStats = stats?.[type.id as keyof PremiumFeaturedStats];
          return (
            <Card key={type.id} className="p-6 rounded-lg border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-r ${type.gradient}`}><Icon className="w-6 h-6 text-white" /></div>
                <Badge variant="default">{typeStats?.count || 0} products</Badge>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{type.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{type.description}</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{type.metric}:</span>
                  <span className="text-sm font-medium">
                    {type.id === 'trending' && (stats as any)?.trending?.avgScore?.toFixed(2)}
                    {type.id === 'recommended' && (stats as any)?.recommended?.avgRating?.toFixed(1)}
                    {type.id === 'bestseller' && `${(stats as any)?.bestseller?.totalSales || 0} sales`}
                    {type.id === 'random_featured' && `${((stats as any)?.random_featured?.diversity * 100 || 0).toFixed(0)}%`}
                  </span>
                </div>
                {typeStats?.topProduct && <div className="text-xs text-gray-500 truncate">Top: {typeStats.topProduct}</div>}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['all', ...featuredTypes.map(t => t.id)].map((typeId) => {
            const typeInfo = typeId === 'all' ? null : getTypeInfo(typeId);
            const Icon = typeInfo?.icon;
            return (
              <button key={typeId} onClick={() => setSelectedType(typeId as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${selectedType === typeId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                {Icon && <Icon className="w-4 h-4" />}
                {typeId === 'all' ? 'All Products' : typeInfo?.name}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product, index) => {
          const typeInfo = getTypeInfo(product.featuredType);
          const Icon = typeInfo?.icon || Sparkles;
          return (
            <Card key={`${product.id}-${product.featuredType || 'none'}-${index}`} className="p-4 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">{product.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{product.brand}</p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-r ${typeInfo?.gradient || 'from-gray-500 to-gray-600'}`}><Icon className="w-4 h-4 text-white" /></div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-gray-900 dark:text-white">${(product.priceCents / 100).toFixed(2)}</span>
                <Badge variant="default">{typeInfo?.name}</Badge>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400"><div>{product.storeName}</div><div>{product.storeCity}</div></div>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-xs">
                  {product.featuredType === 'trending' && <><span>Trending Score:</span><span className="font-medium">{product.score?.toFixed(2)}</span></>}
                  {product.featuredType === 'recommended' && <><span>Rating:</span><span className="font-medium">{product.rating?.toFixed(1)} ⭐</span></>}
                  {product.featuredType === 'bestseller' && <><span>Sales:</span><span className="font-medium">{product.sales || 0}</span></>}
                  {product.featuredType === 'random_featured' && <><span>Discovery:</span><span className="font-medium">Random</span></>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="p-12 rounded-lg text-center">
          <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No premium featured products</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedType === 'all' ? 'No premium featured products found.' : `No products found in the ${getTypeInfo(selectedType)?.name || selectedType} category.`}
          </p>
        </Card>
      )}
    </div>
  );
}
