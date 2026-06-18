'use client';

import { useState } from 'react';
import Image from 'next/image';

interface LayoutPreviewThumbProps {
  src: string;
  alt: string;
  icon: string;
}

export default function LayoutPreviewThumb({ src, alt, icon }: LayoutPreviewThumbProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
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
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 50vw, 240px"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
