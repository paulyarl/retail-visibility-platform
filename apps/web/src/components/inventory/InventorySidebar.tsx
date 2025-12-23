'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavigationHelpers } from '@/lib/navigation/NavigationHelpers';

interface InventorySidebarProps {
  tenantId: string;
  className?: string;
}

export default function InventorySidebar({ tenantId, className }: InventorySidebarProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const inventoryItems = [
    {
      label: 'Items',
      href: `/t/${tenantId}/items`,
      icon: NavigationHelpers.getStandardIcon('STORE'),
      description: 'Manage your product catalog'
    },
    {
      label: 'Barcode Scanner',
      href: `/t/${tenantId}/scan`,
      icon: NavigationHelpers.getStandardIcon('BARCODE'),
      description: 'Scan products to add or update inventory'
    },
    {
      label: 'Quick Start',
      href: `/t/${tenantId}/quick-start`,
      icon: NavigationHelpers.getStandardIcon('QUICK_START'),
      description: 'Get started with sample products and photos'
    }
  ];

  const isCurrentPage = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className={cn(
      'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            {NavigationHelpers.getStandardIcon('INVENTORY_CENTER')}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Inventory Center
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Product management tools
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label={isExpanded ? 'Collapse inventory menu' : 'Expand inventory menu'}
        >
          <svg
            className={cn(
              'w-4 h-4 text-neutral-500 transition-transform',
              isExpanded ? 'rotate-90' : ''
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-2">
          {inventoryItems.map((item) => {
            const isActive = isCurrentPage(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block p-3 rounded-lg border transition-all duration-200 hover:shadow-sm',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-primary-200 dark:hover:border-primary-800'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0',
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/40'
                      : 'bg-white dark:bg-neutral-700'
                  )}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm font-medium leading-tight',
                      isActive
                        ? 'text-primary-900 dark:text-primary-100'
                        : 'text-neutral-900 dark:text-white'
                    )}>
                      {item.label}
                      {isActive && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-tight">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Actions Footer */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Quick Actions
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/t/${tenantId}/items?create=true`}
              className="flex items-center justify-center px-3 py-2 text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-md hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              + Add Item
            </Link>
            <Link
              href={`/t/${tenantId}/categories`}
              className="flex items-center justify-center px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Categories
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
