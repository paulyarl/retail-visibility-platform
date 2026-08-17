'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Store, ArrowRight, Info } from 'lucide-react';
import placesBrowsePublicService, {
  PlaceCategory,
} from '@/services/PlacesBrowsePublicService';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export default function PlacesIndexClient() {
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [totalPlaces, setTotalPlaces] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const data = await placesBrowsePublicService.getCategories();
        if (data) {
          setCategories(data.categories);
          setTotalPlaces(data.totalPlaces);
        } else {
          setError('Failed to load places.');
        }
      } catch {
        setError('Failed to load places.');
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <p className="text-neutral-600 dark:text-neutral-400">{error}</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Store className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              No Places Listed Yet
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              We're building our directory of local businesses. Check back soon.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center mt-6 text-blue-600 hover:text-blue-700 font-medium"
            >
              Browse the full directory
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/directory" className="hover:text-neutral-700 dark:hover:text-neutral-200">
              Directory
            </Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">Places</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            Places Directory
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Local businesses listed from public information. Browse by category to find
            places near you. Is this your business? Claim your listing to verify and
            update details.
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <Store className="w-4 h-4" />
              {totalPlaces} {totalPlaces === 1 ? 'place' : 'places'}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </span>
          </div>
        </div>
      </div>

      {/* Categories grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/place/category/${cat.slug}`}
              className="group bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {cat.category}
                    </h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {cat.placeCount} {cat.placeCount === 1 ? 'place' : 'places'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>

              {/* City breakdown */}
              {cat.cities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {cat.cities.slice(0, 4).map((c) => (
                    <span
                      key={`${c.city}-${c.state}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                    >
                      <MapPin className="w-3 h-3" />
                      {c.city}, {c.state}
                      <span className="font-medium">{c.placeCount}</span>
                    </span>
                  ))}
                  {cat.cities.length > 4 && (
                    <span className="text-xs text-neutral-400 px-2 py-1">
                      +{cat.cities.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* Info banner */}
        <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                About These Listings
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Places listed here are sourced from public information (address, phone,
                and publicly available data). They are not claimed profiles. If you own
                one of these businesses, you can claim your listing to verify
                information, add photos, and get a dashboard to manage your online
                presence.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PoweredByFooter />
    </div>
  );
}
