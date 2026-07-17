"use client";

import { useState, useEffect, useCallback } from 'react';
import { directoryListingService } from '@/services/DirectoryListingSingletonService';
import { clientLogger } from '@/lib/client-logger';

type DirectoryPhoto = {
  id: string;
  url: string;
  position: number;
  alt?: string | null;
  caption?: string | null;
};

type DirectoryListing = {
  id: string;
  business_name?: string;
  is_directory_published?: boolean;
};

interface DirectoryMagazineGalleryProps {
  listing: DirectoryListing;
  isPublished: boolean;
}

export default function DirectoryMagazineGallery({ listing, isPublished }: DirectoryMagazineGalleryProps) {
  const [photos, setPhotos] = useState<DirectoryPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

  const openZoom = useCallback((idx: number) => setZoomIdx(idx), []);
  const closeZoom = useCallback(() => setZoomIdx(null), []);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true);
        if (!isPublished) return;
        const photoAssets = await directoryListingService.getDirectoryListingPhotos(listing.id);
        setPhotos(photoAssets.sort((a, b) => a.position - b.position));
      } catch (e) {
        clientLogger.error("Failed to load directory photos:", { detail: e });
      } finally {
        setLoading(false);
      }
    };
    loadPhotos();
  }, [listing.id, isPublished]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
    );
  }

  if (photos.length === 0) return null;

  // Single photo — large display
  if (photos.length === 1) {
    const photo = photos[0];
    return (
      <div className="w-full">
        <div
          className="relative w-full aspect-video rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
          onClick={() => openZoom(0)}
        >
          <img
            src={photo.url}
            alt={photo.alt || listing.business_name || 'Directory photo'}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
            Primary
          </span>
        </div>
        {photo.caption && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">{photo.caption}</p>
        )}
        {zoomIdx !== null && <ZoomOverlay photos={photos} index={zoomIdx} onClose={closeZoom} listingName={listing.business_name} />}
      </div>
    );
  }

  // 2-3 photos — simplified grid
  if (photos.length <= 3) {
    return (
      <div className="w-full">
        <div className="grid gap-2 grid-cols-2">
          {photos.map((photo, idx) => (
            <div
              key={photo.id || idx}
              className={`relative rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group ${
                photos.length === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-video'
              }`}
              onClick={() => openZoom(idx)}
            >
              <img
                src={photo.url}
                alt={photo.alt || `${listing.business_name || 'Directory'} ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
              {idx === 0 && (
                <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
                  Primary
                </span>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
        {zoomIdx !== null && <ZoomOverlay photos={photos} index={zoomIdx} onClose={closeZoom} listingName={listing.business_name} />}
      </div>
    );
  }

  // 4+ photos — full magazine mosaic
  const hero = photos[0];
  const rest = photos.slice(1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {/* Hero image — spans 2 cols + 2 rows */}
        <div
          className="relative col-span-2 md:row-span-2 aspect-video md:aspect-auto rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
          onClick={() => openZoom(0)}
        >
          <img
            src={hero.url}
            alt={hero.alt || `${listing.business_name || 'Directory'} 1`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
            Primary
          </span>
          {hero.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {hero.caption}
            </div>
          )}
        </div>

        {/* Mosaic tiles */}
        {rest.map((photo, idx) => {
          const actualIdx = idx + 1;
          return (
            <div
              key={photo.id || actualIdx}
              className="relative aspect-video rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
              onClick={() => openZoom(actualIdx)}
            >
              <img
                src={photo.url}
                alt={photo.alt || `${listing.business_name || 'Directory'} ${actualIdx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {zoomIdx !== null && <ZoomOverlay photos={photos} index={zoomIdx} onClose={closeZoom} listingName={listing.business_name} />}
    </div>
  );
}

/** Full-screen zoom overlay for focused image viewing */
function ZoomOverlay({
  photos,
  index,
  onClose,
  listingName,
}: {
  photos: DirectoryPhoto[];
  index: number;
  onClose: () => void;
  listingName?: string;
}) {
  const [current, setCurrent] = useState(index);

  const prev = () => setCurrent((p) => (p === 0 ? photos.length - 1 : p - 1));
  const next = () => setCurrent((p) => (p === photos.length - 1 ? 0 : p + 1));
  const photo = photos[current];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close zoom"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {photos.length > 1 && (
        <button
          className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Previous photo"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.alt || `${listingName || 'Directory'} ${current + 1}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        <div className="mt-3 text-center">
          <span className="text-white text-sm font-medium">
            {current + 1} / {photos.length}
          </span>
          {photo.caption && (
            <p className="text-gray-300 text-sm mt-1">{photo.caption}</p>
          )}
        </div>
      </div>

      {photos.length > 1 && (
        <button
          className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Next photo"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
