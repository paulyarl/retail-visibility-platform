'use client';

import React from 'react';

interface SectionDividerProps {
  variant?: 'gradient' | 'subtle' | 'spacer';
  spacerHeight?: number; // in rem
  className?: string;
}

/**
 * Themed section separators for storefront layouts.
 *
 * - gradient: Existing gradient line (via-purple-500)
 * - subtle: Thin border-bottom divider
 * - spacer: Empty div with configurable height
 */
export default function SectionDivider({
  variant = 'subtle',
  spacerHeight = 4,
  className = '',
}: SectionDividerProps) {
  if (variant === 'gradient') {
    return (
      <div className={`w-full h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent ${className}`} />
    );
  }

  if (variant === 'subtle') {
    return (
      <div className={`w-full border-b border-neutral-100 dark:border-neutral-800 ${className}`} />
    );
  }

  // spacer
  return (
    <div
      className={className}
      style={{ height: `${spacerHeight}rem` }}
    />
  );
}
