'use client';

import React from 'react';

export interface SocialPlatformBadgesProps {
  tenant: any;
  layoutVariant?: 'classic' | 'editorial' | 'immersive';
  className?: string;
}

export function SocialPlatformBadges({
  tenant,
  layoutVariant = 'classic',
  className = '',
}: SocialPlatformBadgesProps) {
  const meta = tenant?.metadata || {};
  const platforms: { name: string; url?: string; badge: string }[] = [];

  if (meta.instagram) {
    platforms.push({ name: 'Instagram', url: meta.instagram, badge: 'IG' });
  }
  if (meta.facebook) {
    platforms.push({ name: 'Facebook', url: meta.facebook, badge: 'FB' });
  }
  if (meta.tiktok) {
    platforms.push({ name: 'TikTok', url: meta.tiktok, badge: 'TT' });
  }
  if (meta.twitter || meta.x) {
    platforms.push({ name: 'X', url: meta.twitter || meta.x, badge: 'X' });
  }

  if (platforms.length === 0) return null;

  const badgeSize = layoutVariant === 'immersive' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {platforms.map((p) => (
        <a
          key={p.name}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${p.name}`}
          className={`flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700 ${badgeSize}`}
        >
          {p.badge}
        </a>
      ))}
    </div>
  );
}

export default SocialPlatformBadges;
