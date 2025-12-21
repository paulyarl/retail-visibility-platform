"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Skeleton, Alert } from '@/components/ui';
import SwisProductCard from './SwisProductCard';
import { useSwisPreview } from '@/hooks/useSwisPreview';

export interface SwisPreviewItem {
  sku: string;
  title: string;
  brand?: string;
  price: number;
  currency: string;
  image_url?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  updated_at: string;
  categoryPath?: string[];
  badges?: Array<'new' | 'sale' | 'low_stock'>;
}

interface SwisPreviewWidgetProps {
  tenantId: string;
  limit?: number;
  sortOrder?: 'updated_desc' | 'price_asc' | 'alpha_asc';
  badgesEnabled?: boolean;
  onViewAll?: () => void;
  editable?: boolean;
}

export default function SwisPreviewWidget({
  tenantId,
  limit = 12,
  sortOrder = 'updated_desc',
  badgesEnabled = true,
  onViewAll,
  editable = false,
}: SwisPreviewWidgetProps) {
  const { items, loading, error, lastUpdated, refetch } = useSwisPreview({
    tenantId,
    limit,
    sortOrder,
  });

  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <CardTitle>Our Products</CardTitle>
          </div>
          {onViewAll && items.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View All
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Error State */}
        {error && (
          <Alert variant="error" title="Failed to load products">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button size="sm" variant="ghost" onClick={refetch}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: limit > 8 ? 8 : limit }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-sm font-medium text-neutral-900 mb-2">No products yet</h3>
            <p className="text-sm text-neutral-500">
              Add products to your inventory to see them here
            </p>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && items.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {items.map((item, index) => (
                <SwisProductCard
                  key={item.sku}
                  item={item}
                  index={index}
                  badgesEnabled={badgesEnabled}
                />
              ))}
            </motion.div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                  Updated {formatLastUpdated(lastUpdated)}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
