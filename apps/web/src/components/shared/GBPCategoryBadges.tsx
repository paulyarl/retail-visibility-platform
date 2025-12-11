'use client';

import Link from 'next/link';

interface GBPCategory {
  id: string;
  name: string;
  slug: string;
  isPrimary?: boolean;
}

interface GBPCategoryBadgesProps {
  categories: GBPCategory[];
  /** Base path for category links. Default: '/directory/categories' */
  basePath?: string;
  /** Size variant. Default: 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Show store count badge. Default: false */
  showCount?: boolean;
  /** Category counts mapping (slug -> count) */
  categoryCounts?: Record<string, number>;
  /** Custom className for the container */
  className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Grocery store': '🏪',
  'Supermarket': '🛒',
  'Convenience store': '🏪',
  'International Foods': '🌍',
  'Electronics store': '🛍️',
  'Shoe store': '👟',
  'Clothing store': '👕',
  'Hardware store': '🔧',
  'Restaurant': '🍽️',
  'Pharmacy': '💊',
  'Bookstore': '📚',
  'Pet store': '🐕',
  'Coffee shop': '☕',
  'Bakery': '🥖',
  'Butcher shop': '🥩',
  'Florist': '💐',
  'Jewelry store': '💎',
  'Toy store': '🧸',
  'Sporting goods store': '⚽',
  'Furniture store': '🛋️',
};

const SIZE_CLASSES = {
  sm: {
    container: 'gap-1.5',
    badge: 'px-2 py-0.5 text-[10px]',
    icon: 'text-xs',
    primaryLabel: 'px-1 py-0.5 text-[9px]',
    count: 'text-[9px] px-1 py-0.5',
  },
  md: {
    container: 'gap-2',
    badge: 'px-3 py-1 text-xs',
    icon: 'text-sm',
    primaryLabel: 'px-1.5 py-0.5 text-[10px]',
    count: 'text-xs px-1.5 py-0.5',
  },
  lg: {
    container: 'gap-2.5',
    badge: 'px-4 py-1.5 text-sm',
    icon: 'text-base',
    primaryLabel: 'px-2 py-0.5 text-xs',
    count: 'text-xs px-2 py-1',
  },
};

/**
 * GBPCategoryBadges - Reusable component for displaying Google Business Profile categories
 * 
 * Features:
 * - Displays primary and secondary categories with visual distinction
 * - Automatic emoji icons for common categories
 * - Responsive sizing (sm, md, lg)
 * - Optional store count display
 * - Customizable link paths
 * - Sorted with primary category first
 * 
 * @example
 * ```tsx
 * <GBPCategoryBadges 
 *   categories={listing.categories}
 *   size="md"
 *   basePath="/directory/categories"
 * />
 * ```
 */
export default function GBPCategoryBadges({
  categories,
  basePath = '/directory/categories',
  size = 'md',
  showCount = false,
  categoryCounts = {},
  className = '',
}: GBPCategoryBadgesProps) {
  if (!categories || categories.length === 0) {
    return null;
  }

  const sizeClasses = SIZE_CLASSES[size];

  // Sort categories: primary first, then alphabetically
  const sortedCategories = [...categories].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={`flex flex-wrap ${sizeClasses.container} ${className}`}>
      {sortedCategories.map((category, index) => {
        const icon = CATEGORY_ICONS[category.name] || '🏢';
        const count = categoryCounts[category.slug];
        const key = category.id || `${category.slug}-${index}`;

        return (
          <Link
            key={key}
            href={`${basePath}/${category.slug}`}
            className={`inline-flex items-center gap-1.5 ${sizeClasses.badge} rounded-full font-medium transition-colors hover:opacity-80 ${
              category.isPrimary
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-900 border border-purple-300 dark:border-purple-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
            }`}
          >
            <span className={sizeClasses.icon}>{icon}</span>
            <span>{category.name}</span>
            
            {showCount && count !== undefined && (
              <span className={`${sizeClasses.count} bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-800 rounded-full`}>
                {count} stores
              </span>
            )}
            
            {category.isPrimary && (
              <span className={`${sizeClasses.primaryLabel} bg-purple-200 dark:bg-purple-800/50 text-purple-700 dark:text-purple-200 rounded-full`}>
                Primary
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
