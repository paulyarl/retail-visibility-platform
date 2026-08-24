'use client';

import { useEffect, useState, useMemo } from 'react';
import { Camera } from 'lucide-react';

interface GbpPhoto {
  id: string;
  category: string | null;
  sourceUrl: string | null;
  googleUrl: string | null;
  description: string | null;
}

interface GbpPhotosData {
  enabled: boolean;
  photos: GbpPhoto[];
}

interface GbpPhotoGallerySectionProps {
  slug: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  COVER: 'Cover Photos',
  PROFILE: 'Profile Photos',
  EXTERIOR: 'Exterior',
  INTERIOR: 'Interior',
  PRODUCT: 'Products',
  TEAM: 'Team',
  FOOD_AND_DRINK: 'Food & Drink',
  MENU: 'Menu',
  AT_WORK: 'At Work',
  ADDITIONAL: 'More Photos',
};

export function GbpPhotoGallerySection({ slug }: GbpPhotoGallerySectionProps) {
  const [data, setData] = useState<GbpPhotosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/directory/${encodeURIComponent(slug)}/gbp-photos`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json.data);
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const categories = useMemo(() => {
    if (!data?.photos) return [];
    const set = new Set<string>();
    data.photos.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [data]);

  const filteredPhotos = useMemo(() => {
    if (!data?.photos) return [];
    if (activeCategory === 'ALL') return data.photos;
    return data.photos.filter((p) => p.category === activeCategory);
  }, [data, activeCategory]);

  if (loading || !data || !data.enabled || data.photos.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Photos
        </h2>
        <span className="text-xs text-gray-400 ml-1">from Google</span>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'ALL'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            All ({data.photos.length})
          </button>
          {categories.map((cat) => {
            const count = data.photos.filter((p) => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {CATEGORY_LABELS[cat] || cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filteredPhotos.slice(0, 24).map((photo) => (
          <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 group relative">
            <img
              src={photo.sourceUrl || photo.googleUrl || ''}
              alt={photo.description || ''}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {photo.description && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <p className="text-xs text-white line-clamp-2">{photo.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
