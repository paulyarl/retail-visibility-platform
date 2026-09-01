'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Phone,
  Store,
  ArrowLeft,
  ArrowRight,
  Info,
  Tag,
  ShoppingBasket,
} from 'lucide-react';
import placesBrowsePublicService, {
  PlaceListing,
} from '@/services/PlacesBrowsePublicService';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import AddBusinessCta from '@/components/directory/AddBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';

interface PlaceCategoryClientProps {
  categorySlug: string;
  city?: string;
}

function formatCategoryName(slug: string): string {
  return decodeURIComponent(slug)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function PlaceCategoryClient({
  categorySlug,
  city,
}: PlaceCategoryClientProps) {
  const [places, setPlaces] = useState<PlaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryName = formatCategoryName(categorySlug);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        setLoading(true);
        const data = await placesBrowsePublicService.getPlacesByCategory(
          categorySlug,
          city,
        );
        if (data) {
          setPlaces(data.places);
        } else {
          setError('Failed to load places.');
        }
      } catch {
        setError('Failed to load places.');
      } finally {
        setLoading(false);
      }
    };
    fetchPlaces();
  }, [categorySlug, city]);

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

  // Group by city for the city filter chips
  const cityCounts: Record<string, number> = {};
  for (const place of places) {
    const key = place.city || 'Unknown';
    cityCounts[key] = (cityCounts[key] || 0) + 1;
  }
  const cities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/directory" className="hover:text-neutral-700 dark:hover:text-neutral-200">
              Directory
            </Link>
            <span>/</span>
            <Link href="/place" className="hover:text-neutral-700 dark:hover:text-neutral-200">
              Places
            </Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">
              {categoryName}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                  {categoryName}
                </h1>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400">
                {places.length} {places.length === 1 ? 'place' : 'places'} listed
                {city ? ` in ${city}` : ''}
              </p>
            </div>
            <Link
              href="/place"
              className="inline-flex items-center text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              All categories
            </Link>
          </div>

          {/* City filter chips */}
          {cities.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href={`/place/category/${categorySlug}`}
                className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  !city
                    ? 'bg-blue-600 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                All cities
              </Link>
              {cities.map(([cityName, count]) => (
                <Link
                  key={cityName}
                  href={`/place/category/${categorySlug}?city=${encodeURIComponent(cityName)}`}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    city === cityName
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  {cityName}
                  <span className="font-medium">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Places list */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {places.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              No Places in {categoryName}
              {city ? ` in ${city}` : ''}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              We don't have any published listings in this category yet.
            </p>
            <Link
              href="/place"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Browse all categories
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                categoryName={categoryName}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                About These Listings
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                These places are listed from public information (address, phone, and
                publicly available data). They are not claimed profiles. If you own one
                of these businesses, claim your listing to verify information, add
                photos, and get a dashboard to manage your online presence.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddBusinessCta
          category={categoryName}
          source={`/place/category/${categorySlug}`}
        />
        <SuggestBusinessCta
          category={categoryName}
          source={`/place/category/${categorySlug}`}
        />
      </div>

      <PoweredByFooter />
    </div>
  );
}

// ====================
// PlaceCard — compact card for category browse pages
// ====================

function PlaceCard({
  place,
  categoryName,
}: {
  place: PlaceListing;
  categoryName: string;
}) {
  const fullAddress = [place.address, place.city, place.state, place.zipCode]
    .filter(Boolean)
    .join(', ');

  const claimHref = place.claimToken
    ? `/place/claim/${place.claimToken}`
    : '#claim-inquiry';

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow">
      {/* Logo or placeholder */}
      <div className="h-32 bg-gradient-to-br from-blue-50 to-neutral-100 dark:from-blue-900/20 dark:to-neutral-700 flex items-center justify-center">
        {place.logoUrl ? (
          <img
            src={place.logoUrl}
            alt={place.businessName}
            className="h-full w-full object-cover"
          />
        ) : (
          <Store className="w-10 h-10 text-neutral-400" />
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            href={`/place/${place.slug}`}
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400"
          >
            {place.businessName}
          </Link>
          {place.snapEbtReported && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium flex-shrink-0">
              <ShoppingBasket className="w-3 h-3" />
              SNAP/EBT
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          <Tag className="w-3 h-3" />
          {categoryName}
        </div>

        {place.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-3">
            {place.description}
          </p>
        )}

        {/* Location + phone */}
        <div className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
          {fullAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{fullAddress}</span>
            </div>
          )}
          {place.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <a
                href={`tel:${place.phone}`}
                className="hover:text-neutral-900 dark:hover:text-neutral-200"
              >
                {place.phone}
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
          <Link
            href={`/place/${place.slug}`}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center"
          >
            View details
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          {place.claimToken && (
            <Link
              href={claimHref}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Is this your business?
            </Link>
          )}
        </div>

        {/* Disclaimer */}
        {place.publicDisclaimer && (
          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500 italic">
            {place.publicDisclaimer}
          </p>
        )}
      </div>
    </div>
  );
}
