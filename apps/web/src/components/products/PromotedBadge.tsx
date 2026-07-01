'use client';

import { Crown } from 'lucide-react';

interface PromotedBadgeProps {
  priority?: number;
  className?: string;
  variant?: 'overlay' | 'inline';
}

export function PromotedBadge({ priority, className = '', variant = 'overlay' }: PromotedBadgeProps) {
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ${className}`}>
        <Crown className="w-3 h-3" />
        Promoted
      </span>
    );
  }

  return (
    <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white shadow-md ${className}`}>
      <Crown className="w-3 h-3" />
      Promoted
    </div>
  );
}

export function promotedCardClass(): string {
  return 'ring-2 ring-amber-400/60 shadow-lg shadow-amber-200/40 dark:shadow-amber-900/20';
}
