"use client";

import { useState, useEffect } from "react";

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
};

interface DirectoryPhotoGalleryDisplayProps {
  listing: DirectoryListing;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function DirectoryPhotoGalleryDisplay({ listing }: DirectoryPhotoGalleryDisplayProps) {
  const [photos, setPhotos] = useState<DirectoryPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/directory/${listing.id}/photos`);
        if (res.ok) {
          const data = await res.json();
          const photoAssets = Array.isArray(data) ? data : [];
          setPhotos(photoAssets.sort((a, b) => a.position - b.position));
        }
      } catch (e) {
        console.error("Failed to load directory photos:", e);
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [listing.id]);

  if (loading) {
    return null; // Don't show loading state on public pages
  }

  if (photos.length === 0) {
    return null; // Don't render if no photos
  }

  const currentPhoto = photos[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Store Gallery</h2>
      
      <div className="space-y-4">
        {/* Main Carousel */}
        <div className="relative">
          <div className="aspect-video w-full max-h-96 bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden relative group">
            {/* Main Image */}
            <img
              key={currentPhoto.url}
              src={currentPhoto.url}
              alt={currentPhoto.alt || listing.business_name || "Business photo"}
              className="object-contain w-full h-full transition-all duration-500 group-hover:scale-105"
            />

            {/* Primary Badge */}
            {currentPhoto.position === 0 && (
              <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-10">
                Primary Photo
              </div>
            )}

            {/* Previous Button */}
            {photos.length > 1 && (
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
            {photos.length > 1 && (
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
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {photos.length}
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
        {photos.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-neutral-100">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                  idx === currentIndex
                    ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2 scale-105'
                    : 'border-neutral-200 hover:border-blue-400 opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.alt || `${listing.business_name} ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Primary indicator on thumbnail - only show on first photo */}
                {photo.position === 0 && (
                  <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                    <span className="text-white text-xs font-bold bg-blue-600 px-1 rounded">1st</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
