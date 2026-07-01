'use client';

import { useState, useMemo } from 'react';
import { useSystemBadges, useTenantBadges } from '@/hooks/useBadgeRegistry';
import { Tag, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface BadgeFilterBarProps {
  selectedBadges: string[];
  onBadgeToggle: (badgeKey: string) => void;
  onClearAll: () => void;
  className?: string;
  tenantId?: string;
}

export default function BadgeFilterBar({
  selectedBadges,
  onBadgeToggle,
  onClearAll,
  className = '',
  tenantId,
}: BadgeFilterBarProps) {
  const { data: systemBadges } = useSystemBadges();
  const { data: tenantBadgeData } = useTenantBadges(tenantId);
  const [isExpanded, setIsExpanded] = useState(false);

  const tenantBadges = useMemo(() => {
    // When tenantId is provided, use tenant badges (system + custom). Otherwise fall back to system only.
    const badges = tenantId ? tenantBadgeData : systemBadges;
    if (!badges) return [];
    return badges.filter(b => b.group === 'tenant' && b.isActive);
  }, [systemBadges, tenantBadgeData, tenantId]);

  if (tenantBadges.length === 0) return null;

  const visibleBadges = isExpanded ? tenantBadges : tenantBadges.slice(0, 6);
  const hasMore = tenantBadges.length > 6;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Filter by Badge</h3>
          {selectedBadges.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {selectedBadges.length} selected
            </span>
          )}
        </div>
        {selectedBadges.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleBadges.map((badge) => {
          const isSelected = selectedBadges.includes(badge.key);
          return (
            <button
              key={badge.key}
              onClick={() => onBadgeToggle(badge.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {badge.icon && <span className="text-base leading-none">{badge.icon}</span>}
              <span>{badge.label}</span>
              {isSelected && <X className="w-3 h-3" />}
            </button>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          {isExpanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}
