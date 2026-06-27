'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import BadgeFilterBar from './BadgeFilterBar';

interface StorefrontBadgeFilterProps {
  tenantId: string;
  className?: string;
}

export default function StorefrontBadgeFilter({ tenantId, className = '' }: StorefrontBadgeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedBadges = searchParams.get('badge')?.split(',').filter(Boolean) || [];

  const handleBadgeToggle = (badgeKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = new Set(selectedBadges);
    if (current.has(badgeKey)) {
      current.delete(badgeKey);
    } else {
      current.add(badgeKey);
    }
    if (current.size > 0) {
      params.set('badge', Array.from(current).join(','));
    } else {
      params.delete('badge');
    }
    params.delete('page');
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  const handleClearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('badge');
    params.delete('page');
    router.push(`/tenant/${tenantId}?${params.toString()}`);
  };

  return (
    <BadgeFilterBar
      selectedBadges={selectedBadges}
      onBadgeToggle={handleBadgeToggle}
      onClearAll={handleClearAll}
      className={className}
      tenantId={tenantId}
    />
  );
}
