'use client';

import { Eye, Heart, TrendingUp } from 'lucide-react';

interface SocialProofBadgesProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  showSocialProof?: boolean;
}

export function SocialProofBadges({
  product,
  layoutVariant = 'classic',
  showSocialProof = false,
}: SocialProofBadgesProps) {
  if (!showSocialProof) return null;

  const isCompact = layoutVariant === 'quick-commerce';
  const viewCount = product.metadata?.viewCount || product.metadata?.view_count || product.viewCount;
  const likeCount = product.metadata?.likeCount || product.metadata?.like_count || product.likeCount;
  const trendingRank = product.metadata?.trendingRank || product.metadata?.trending_rank;

  const badges: { icon: typeof Eye; label: string; value: string }[] = [];

  if (viewCount != null) {
    badges.push({
      icon: Eye,
      label: 'Views',
      value: viewCount > 1000 ? `${(viewCount / 1000).toFixed(1)}k` : String(viewCount),
    });
  }

  if (likeCount != null) {
    badges.push({
      icon: Heart,
      label: 'Likes',
      value: likeCount > 1000 ? `${(likeCount / 1000).toFixed(1)}k` : String(likeCount),
    });
  }

  if (trendingRank != null && trendingRank <= 10) {
    badges.push({
      icon: TrendingUp,
      label: 'Trending',
      value: `#${trendingRank}`,
    });
  }

  if (badges.length === 0) return null;

  if (isCompact) {
    return (
      <div className="flex items-center gap-2">
        {badges.map((b) => (
          <span
            key={b.label}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
          >
            <b.icon size={12} />
            {b.value}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {badges.map((b) => (
        <span
          key={b.label}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
        >
          <b.icon size={14} />
          {b.value} {b.label}
        </span>
      ))}
    </div>
  );
}
