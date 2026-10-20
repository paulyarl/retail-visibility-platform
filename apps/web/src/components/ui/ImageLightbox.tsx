"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxPhoto {
  url: string;
  alt?: string | null;
}

interface ImageLightboxProps {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  fallbackAlt: string;
}

/** In-page full-screen image viewer. Mount it only while open. */
export default function ImageLightbox({ photos, index, onIndexChange, onClose, fallbackAlt }: ImageLightboxProps) {
  const count = photos.length;
  const photo = photos[index] ?? photos[0];
  const prev = () => onIndexChange(index === 0 ? count - 1 : index - 1);
  const next = () => onIndexChange(index === count - 1 ? 0 : index + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && count > 1) prev();
      if (e.key === "ArrowRight" && count > 1) next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img
        key={photo.url}
        src={photo.url}
        alt={photo.alt || fallbackAlt}
        className="max-h-full max-w-full object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute top-4 right-4 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-2 shadow-lg"
      >
        <X className="w-6 h-6" />
      </button>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-3 shadow-lg"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-neutral-900 rounded-full p-3 shadow-lg"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
