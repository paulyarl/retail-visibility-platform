"use client";

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui';
import type { SwisPreviewItem } from './SwisPreviewWidget';

interface SwisProductCardProps {
  item: SwisPreviewItem;
  index: number;
  badgesEnabled: boolean;
}

export default function SwisProductCard({ item, index, badgesEnabled }: SwisProductCardProps) {
  // Format price
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };

  // Get availability badge variant
  const getAvailabilityVariant = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return 'success';
      case 'out_of_stock':
        return 'error';
      case 'preorder':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get availability label
  const getAvailabilityLabel = (availability: string) => {
    switch (availability) {
      case 'in_stock':
        return 'In Stock';
      case 'out_of_stock':
        return 'Out of Stock';
      case 'preorder':
        return 'Pre-order';
      default:
        return availability;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group cursor-pointer"
    >
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
        {/* Image */}
        <div className="relative aspect-square bg-neutral-100 overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Badges Overlay */}
          {badgesEnabled && item.badges && item.badges.length > 0 && (
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {item.badges.map((badge) => (
                <Badge
                  key={badge}
                  variant={
                    badge === 'new' ? 'info' :
                    badge === 'sale' ? 'warning' :
                    badge === 'low_stock' ? 'error' :
                    'default'
                  }
                  className="text-xs"
                >
                  {badge.toUpperCase()}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Brand */}
          {item.brand && (
            <p className="text-xs text-neutral-500 uppercase tracking-wide truncate">
              {item.brand}
            </p>
          )}

          {/* Title */}
          <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 min-h-[2.5rem]">
            {item.title}
          </h3>

          {/* Price */}
          <p className="text-lg font-bold text-neutral-900">
            {formatPrice(item.price, item.currency)}
          </p>

          {/* Availability */}
          <Badge
            variant={getAvailabilityVariant(item.availability)}
            className="text-xs"
          >
            {getAvailabilityLabel(item.availability)}
          </Badge>

          {/* Category (if available) */}
          {item.categoryPath && item.categoryPath.length > 0 && (
            <p className="text-xs text-neutral-400 truncate">
              {item.categoryPath.join(' › ')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
