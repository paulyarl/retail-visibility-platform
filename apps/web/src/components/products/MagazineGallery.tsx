"use client";

import { useState, useCallback } from 'react';

type Photo = {
  url: string;
  alt?: string | null;
  caption?: string | null;
  position: number;
};

interface MagazineGalleryProps {
  gallery: Photo[];
  productTitle: string;
}

export default function MagazineGallery({ gallery, productTitle }: MagazineGalleryProps) {
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

  const openZoom = useCallback((idx: number) => setZoomIdx(idx), []);
  const closeZoom = useCallback(() => setZoomIdx(null), []);

  if (gallery.length === 0) return null;

  // Single image — just show it large
  if (gallery.length === 1) {
    const photo = gallery[0];
    return (
      <div className="w-full">
        <div
          className="relative w-full aspect-square rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
          onClick={() => openZoom(0)}
        >
          <img
            src={photo.url}
            alt={photo.alt || productTitle}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        {photo.caption && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">{photo.caption}</p>
        )}
        {zoomIdx !== null && <ZoomOverlay photos={gallery} index={zoomIdx} onClose={closeZoom} productTitle={productTitle} />}
      </div>
    );
  }

  // 2-3 images — simplified grid
  if (gallery.length <= 3) {
    return (
      <div className="w-full">
        <div className={`grid gap-2 ${gallery.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
          {gallery.map((photo, idx) => (
            <div
              key={idx}
              className={`relative rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group ${
                gallery.length === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'
              }`}
              onClick={() => openZoom(idx)}
            >
              <img
                src={photo.url}
                alt={photo.alt || `${productTitle} ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photo.caption}
                </div>
              )}
            </div>
          ))}
        </div>
        {zoomIdx !== null && <ZoomOverlay photos={gallery} index={zoomIdx} onClose={closeZoom} productTitle={productTitle} />}
      </div>
    );
  }

  // 4+ images — full magazine mosaic
  const hero = gallery[0];
  const rest = gallery.slice(1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {/* Hero image — spans 2 cols + 2 rows */}
        <div
          className="relative col-span-2 md:row-span-2 aspect-square md:aspect-auto rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
          onClick={() => openZoom(0)}
        >
          <img
            src={hero.url}
            alt={hero.alt || `${productTitle} 1`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
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
              key={actualIdx}
              className="relative aspect-square rounded-xl overflow-hidden cursor-zoom-in bg-gray-100 dark:bg-gray-800 group"
              onClick={() => openZoom(actualIdx)}
            >
              <img
                src={photo.url}
                alt={photo.alt || `${productTitle} ${actualIdx + 1}`}
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

      {zoomIdx !== null && <ZoomOverlay photos={gallery} index={zoomIdx} onClose={closeZoom} productTitle={productTitle} />}
    </div>
  );
}

/** Full-screen zoom overlay for focused image viewing */
function ZoomOverlay({
  photos,
  index,
  onClose,
  productTitle,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  productTitle: string;
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
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close zoom"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev button */}
      {photos.length > 1 && (
        <button
          className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Previous image"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.alt || `${productTitle} ${current + 1}`}
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

      {/* Next button */}
      {photos.length > 1 && (
        <button
          className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Next image"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
