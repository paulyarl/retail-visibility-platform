'use client';

import React from 'react';

export function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
      {children}
    </span>
  );
}
