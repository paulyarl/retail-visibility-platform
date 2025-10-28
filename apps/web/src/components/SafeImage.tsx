'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface SafeImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
}

/**
 * SafeImage component that handles image optimization errors gracefully
 * Falls back to unoptimized images if optimization fails
 */
export function SafeImage({ src, fallbackSrc, alt, ...props }: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [useUnoptimized, setUseUnoptimized] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!useUnoptimized && typeof src === 'string') {
      // First try: retry with unoptimized
      setUseUnoptimized(true);
      setImgSrc(src);
    } else if (fallbackSrc && !hasError) {
      // Second try: use fallback
      setImgSrc(fallbackSrc);
      setHasError(true);
      setUseUnoptimized(false);
    } else {
      // Final fallback: mark as error
      setHasError(true);
    }
  };

  if (hasError && !fallbackSrc) {
    // Show placeholder if all attempts failed
    return (
      <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
        <svg className="h-24 w-24 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      unoptimized={useUnoptimized}
      onError={handleError}
    />
  );
}
