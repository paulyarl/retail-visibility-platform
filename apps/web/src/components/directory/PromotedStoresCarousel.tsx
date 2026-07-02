'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, MapPin, Package } from 'lucide-react';

interface PromotedStore {
  tenantId: string;
  businessName: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  state?: string;
  primaryCategory?: string;
  promotionTier?: string;
  ratingAvg?: number;
  productCount?: number;
}

const TIER_STYLES: Record<string, { gradient: string; badge: string }> = {
  featured: { gradient: 'from-purple-500 to-purple-600', badge: 'bg-purple-100 text-purple-700' },
  premium: { gradient: 'from-blue-500 to-blue-600', badge: 'bg-blue-100 text-blue-700' },
  basic: { gradient: 'from-amber-500 to-amber-600', badge: 'bg-amber-100 text-amber-700' },
};

export default function PromotedStoresCarousel() {
  const [stores, setStores] = useState<PromotedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPromoted = async () => {
      try {
        const res = await fetch('/api/directory/stores?limit=100&sort=activity');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const promoted = (data.listings || []).filter(
          (s: any) => s.isPromoted && s.promotionTier,
        );
        setStores(promoted.slice(0, 12));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPromoted();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Star className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Promoted Stores
          </h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 h-40 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || stores.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Promoted Stores
          </h2>
        </div>
        <Link
          href="/directory/stores"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View all →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
        {stores.map((store) => {
          const tierStyle = TIER_STYLES[store.promotionTier || 'basic'] || TIER_STYLES.basic;
          return (
            <Link
              key={store.tenantId}
              href={`/directory/${store.slug || store.tenantId}`}
              className="flex-shrink-0 w-64 snap-start group"
            >
              <div className={`relative h-40 rounded-xl overflow-hidden border-2 ${
                store.promotionTier === 'featured' ? 'border-purple-300 dark:border-purple-700' :
                store.promotionTier === 'premium' ? 'border-blue-300 dark:border-blue-700' :
                'border-amber-300 dark:border-amber-700'
              }`}>
                {store.logoUrl ? (
                  <img
                    src={store.logoUrl}
                    alt={store.businessName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${tierStyle.gradient} flex items-center justify-center`}>
                    <Package className="w-12 h-12 text-white/60" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white shadow-sm bg-gradient-to-r ${tierStyle.gradient}`}>
                    <Star className="w-3 h-3 fill-white" />
                    {store.promotionTier ? store.promotionTier.charAt(0).toUpperCase() + store.promotionTier.slice(1) : 'Promoted'}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {store.businessName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {store.primaryCategory && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${tierStyle.badge}`}>
                      {store.primaryCategory}
                    </span>
                  )}
                  {(store.city || store.state) && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {[store.city, store.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
