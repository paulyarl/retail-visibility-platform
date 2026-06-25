'use client';

import { Share2, Globe, MessageCircle, Camera } from 'lucide-react';

interface SocialShareButtonsProps {
  product: any;
  currentUrl?: string;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  storefrontType?: string;
  canUseShareButtons?: boolean;
}

export function SocialShareButtons({
  product,
  currentUrl,
  layoutVariant = 'classic',
  storefrontType,
  canUseShareButtons = true,
}: SocialShareButtonsProps) {
  if (!canUseShareButtons) return null;

  const isCompact = layoutVariant === 'quick-commerce';
  const isSocial = storefrontType === 'social';
  const shareUrl = currentUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = `Check out ${product.title || product.name}!`;

  const platforms = [
    {
      name: 'Facebook',
      icon: Globe,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Instagram',
      icon: Camera,
      href: `https://www.instagram.com/`,
      color: 'text-pink-600 dark:text-pink-400',
    },
    {
      name: 'TikTok',
      icon: Share2,
      href: `https://www.tiktok.com/upload?url=${encodeURIComponent(shareUrl)}`,
      color: 'text-neutral-900 dark:text-white',
    },
    {
      name: 'Pinterest',
      icon: Share2,
      href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}`,
      color: 'text-red-600 dark:text-red-400',
    },
  ];

  if (isCompact) {
    return (
      <div className="flex items-center gap-1.5">
        {platforms.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${p.name}`}
            className={`w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${p.color}`}
          >
            <p.icon size={14} />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${isSocial ? '' : 'opacity-80'}`}>
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <Share2 size={16} className="flex-shrink-0" />
        <span className="font-medium">Share this {isSocial ? 'find' : 'product'}</span>
      </div>
      <div className="flex items-center gap-2">
        {platforms.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${p.name}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${p.color}`}
          >
            <p.icon size={14} />
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
