'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

interface DemoBadgeProps {
  isDemo?: boolean | null;
  demoExpiresAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'overlay';
  className?: string;
}

const sizeConfig = {
  sm: { badge: 'text-[10px] px-1.5 py-0.5 gap-0.5', icon: 'w-3 h-3' },
  md: { badge: 'text-xs px-2 py-0.5 gap-1', icon: 'w-3.5 h-3.5' },
  lg: { badge: 'text-sm px-2.5 py-1 gap-1', icon: 'w-4 h-4' },
};

export default function DemoBadge({
  isDemo,
  demoExpiresAt,
  size = 'md',
  variant = 'inline',
  className = '',
}: DemoBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isDemo) return null;

  const sc = sizeConfig[size];
  const expiresText = demoExpiresAt
    ? `Expires ${new Date(demoExpiresAt).toLocaleDateString()}`
    : 'This is a demo profile';

  if (variant === 'overlay') {
    return (
      <div
        className={`relative inline-flex items-center bg-amber-500/90 text-white rounded-full font-semibold shadow-sm ${sc.badge} ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span>Demo</span>
        {showTooltip && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg">
            {expiresText}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full font-medium border border-amber-200 dark:border-amber-800 ${sc.badge} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={expiresText}
    >
      <span>Demo</span>
      <Info className={sc.icon} />
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white shadow-lg pointer-events-none">
          {expiresText}
        </div>
      )}
    </span>
  );
}
