'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Store, ArrowRight, Info } from 'lucide-react';
import placesBrowsePublicService, {
  PlaceCategory,
  NationalCategoryRosterEntry,
} from '@/services/PlacesBrowsePublicService';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export default function PlacesIndexClient({
  roster,
  initialCategories,
}: {
  roster?: NationalCategoryRosterEntry[] | null;
  initialCategories?: PlaceCategory[] | null;
}) {
  const [categories, setCategories] = useState<PlaceCategory[]>(initialCategories ?? []);
  const [loading, setLoading] = useState(!initialCategories);
  const [error, setError] = useState<string | null>(null);

  // National category packets keyed by slug + name — each card can surface the
  // national framing excerpt instead of name+count alone.
  const rosterByCategory = new Map<string, NationalCategoryRosterEntry>();
  for (const entry of roster ?? []) {
    if (entry.market.categoryKey) {
      rosterByCategory.set(entry.market.categoryKey.toLowerCase(), entry);
    }
    if (entry.market.categoryName) {
      rosterByCategory.set(entry.market.categoryName.toLowerCase(), entry);
    }
  }
  const rosterFor = (cat: PlaceCategory) =>
    rosterByCategory.get(cat.slug.toLowerCase()) ??
    rosterByCategory.get(cat.category.toLowerCase());

  useEffect(() => {
    // The server already read the shelf — only fetch when it couldn't.
    if (initialCategories) return;

    const fetchCategories = async () => {
      try {
        setLoading(true);
        const data = await placesBrowsePublicService.getCategories();
        if (data) {
          setCategories(data.categories);
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
  }, [initialCategories]);

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
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
              No Places Listed Yet
            </h2>
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
      {/* Categories grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div
              key={cat.slug}
              className="group bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <Link href={`/place/category/${cat.slug}`} className="block">
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
                {(() => {
                  const entry = rosterFor(cat);
                  const excerpt =
                    entry?.context?.category_overview || entry?.effective?.description;
                  return excerpt ? (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {excerpt}
                    </p>
                  ) : null;
                })()}
              </Link>

              {/* City breakdown — each chip links the seed city shelf
                  (/place/city/{city-slug}, city-only slug per the API). */}
              {cat.cities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {cat.cities.slice(0, 4).map((c) => (
                    <Link
                      key={`${c.city}-${c.state}`}
                      href={`/place/city/${c.city.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      {c.city}, {c.state}
                      <span className="font-medium">{c.placeCount}</span>
                    </Link>
                  ))}
                  {cat.cities.length > 4 && (
                    <span className="text-xs text-neutral-400 px-2 py-1">
                      +{cat.cities.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
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
                one of these businesses, claim it free to fix your details, add photos,
                and showcase 5 top sellers from your own dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>

      <PoweredByFooter />
    </div>
  );
}
