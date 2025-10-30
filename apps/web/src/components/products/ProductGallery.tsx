"use client";

import { useState } from 'react';

type Photo = {
  url: string;
  alt?: string | null;
  caption?: string | null;
  position: number;
};

interface ProductGalleryProps {
  gallery: Photo[];
  productTitle: string;
}

export default function ProductGallery({ gallery, productTitle }: ProductGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (gallery.length === 0) return null;

  const currentPhoto = gallery[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="space-y-4">
        {/* Main Carousel */}
        <div className="relative">
          <div className="aspect-video w-full max-h-96 bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden relative group">
              {/* Main Image */}
              <img
                key={currentPhoto.url}
                src={currentPhoto.url}
                alt={currentPhoto.alt || productTitle}
                className="object-contain w-full h-full transition-all duration-500 group-hover:scale-105"
              />

              {/* Previous Button */}
              {gallery.length > 1 && (
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 z-10"
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Next Button */}
              {gallery.length > 1 && (
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110 z-10"
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Image Counter */}
              {gallery.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {currentIndex + 1} / {gallery.length}
                </div>
              )}

              {/* Zoom Button */}
              <button
                onClick={() => window.open(currentPhoto.url, '_blank')}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
                aria-label="View full size"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </button>
          </div>

          {/* Caption */}
          {currentPhoto.caption && (
            <p className="text-sm text-neutral-600 text-center italic mt-3 animate-fade-in" key={currentPhoto.url}>
              {currentPhoto.caption}
            </p>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-neutral-100">
              {gallery.map((photo, idx) => (
                <button
                  key={photo.url + idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    idx === currentIndex
                      ? 'border-primary-600 ring-2 ring-primary-600 ring-offset-2 scale-105'
                      : 'border-neutral-200 hover:border-primary-400 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo.url}
                    alt={photo.alt || `${productTitle} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
