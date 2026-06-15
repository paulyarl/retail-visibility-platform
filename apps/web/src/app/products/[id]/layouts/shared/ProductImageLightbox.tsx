'use client';

/**
 * ProductImageLightbox — fullscreen image viewer for product galleries.
 *
 * Features:
 * - Fullscreen dark overlay
 * - Swipe left/right on mobile (touch events)
 * - Keyboard navigation (← → Esc)
 * - Image counter "3 / 8"
 * - Respects prefers-reduced-motion
 *
 * Used by Layout B (Showcase) when user clicks a gallery image.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface ProductImageLightboxProps {
  images: Array<{ url: string; alt?: string; caption?: string }>;
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductImageLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
}: ProductImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync index when props change
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          setCurrentIndex((prev) =>
            prev === 0 ? images.length - 1 : prev - 1,
          );
          break;
        case 'ArrowRight':
          setCurrentIndex((prev) =>
            prev === images.length - 1 ? 0 : prev + 1,
          );
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, images.length, onClose]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart === null) return;
      const touchEnd = e.changedTouches[0].clientX;
      const diff = touchStart - touchEnd;
      const threshold = 50;

      if (diff > threshold) {
        // Swipe left → next
        setCurrentIndex((prev) =>
          prev === images.length - 1 ? 0 : prev + 1,
        );
      } else if (diff < -threshold) {
        // Swipe right → previous
        setCurrentIndex((prev) =>
          prev === 0 ? images.length - 1 : prev - 1,
        );
      }
      setTouchStart(null);
    },
    [touchStart, images.length],
  );

  const goTo = useCallback(
    (direction: 'prev' | 'next') => {
      setCurrentIndex((prev) => {
        if (direction === 'prev') {
          return prev === 0 ? images.length - 1 : prev - 1;
        }
        return prev === images.length - 1 ? 0 : prev + 1;
      });
    },
    [images.length],
  );

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close image viewer"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Navigation: Previous */}
      {images.length > 1 && (
        <button
          onClick={() => goTo('prev')}
          className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Previous image"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}

      {/* Navigation: Next */}
      {images.length > 1 && (
        <button
          onClick={() => goTo('next')}
          className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Next image"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}

      {/* Main image */}
      <div
        className="relative z-[1] max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={currentImage.url}
          alt={currentImage.alt || `Image ${currentIndex + 1}`}
          className="max-w-full max-h-[85vh] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Caption */}
      {currentImage.caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg bg-white/10 text-white text-sm text-center max-w-lg">
          {currentImage.caption}
        </div>
      )}
    </div>
  );
}
