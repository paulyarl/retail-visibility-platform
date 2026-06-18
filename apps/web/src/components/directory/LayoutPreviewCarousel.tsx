'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LayoutSlide } from '@/utils/directoryEntryLayouts';

interface LayoutPreviewCarouselProps {
  slides: LayoutSlide[];
  icon: string;
}

export default function LayoutPreviewCarousel({ slides, icon }: LayoutPreviewCarouselProps) {
  const [validSlides, setValidSlides] = useState<LayoutSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValidSlides([]);
    setCurrent(0);
    setReady(false);

    let active = true;
    const results = Array.from({ length: slides.length }, () => false);
    let remaining = slides.length;

    if (slides.length === 0) {
      setReady(true);
      return;
    }

    slides.forEach((slide, index) => {
      const img = new window.Image();
      img.src = slide.src;
      img.onload = () => {
        if (!active) return;
        results[index] = true;
        remaining -= 1;
        if (remaining === 0) {
          setValidSlides(slides.filter((_, i) => results[i]));
          setReady(true);
        }
      };
      img.onerror = () => {
        if (!active) return;
        remaining -= 1;
        if (remaining === 0) {
          setValidSlides(slides.filter((_, i) => results[i]));
          setReady(true);
        }
      };
    });

    return () => {
      active = false;
    };
  }, [slides]);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? validSlides.length - 1 : c - 1));
  }, [validSlides.length]);

  const next = useCallback(() => {
    setCurrent((c) => (c === validSlides.length - 1 ? 0 : c + 1));
  }, [validSlides.length]);

  // Swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 40;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0) next();
      else prev();
    }
  };

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-700 text-sm text-gray-400">
        Loading preview…
      </div>
    );
  }

  if (validSlides.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-700/40 text-4xl"
        aria-hidden="true"
      >
        {icon}
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {validSlides.map((slide, idx) => {
        const offset = idx - current;
        const isVisible = offset === 0;
        return (
          <div
            key={slide.src}
            className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
              isVisible ? 'translate-x-0' : offset > 0 ? 'translate-x-full' : '-translate-x-full'
            }`}
            aria-hidden={!isVisible}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(max-width: 640px) 50vw, 240px"
              className="object-cover"
              priority={idx === 0}
            />
          </div>
        );
      })}

      {validSlides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous preview slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-neutral-900/90 p-1.5 text-neutral-700 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next preview slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 dark:bg-neutral-900/90 p-1.5 text-neutral-700 dark:text-neutral-100 shadow-sm hover:bg-white dark:hover:bg-neutral-900 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {validSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrent(idx)}
                aria-label={`Go to preview slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === current ? 'w-4 bg-blue-600' : 'w-1.5 bg-white/70 dark:bg-neutral-400/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
