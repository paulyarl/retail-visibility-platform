"use client";

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui';
import Link from 'next/link';

interface StoreCardProps {
  listing: {
    id: string;
    tenantId: string;
    businessName: string;
    slug: string;
    address?: string;
    city?: string;
    state?: string;
    phone?: string;
    logoUrl?: string;
    primaryCategory?: string;
    ratingAvg: number;
    ratingCount: number;
    productCount: number;
    isFeatured: boolean;
    subscriptionTier: string;
    useCustomWebsite: boolean;
    website?: string;
    distance?: number;
    isOpen?: boolean;
  };
  index: number;
}

export default function StoreCard({ listing, index }: StoreCardProps) {
  // Determine destination URL based on tier and settings
  const canUseCustomUrl = ['professional', 'enterprise', 'organization'].includes(
    listing.subscriptionTier
  );
  
  const destinationUrl = 
    canUseCustomUrl && listing.useCustomWebsite && listing.website
      ? listing.website
      : `/tenant/${listing.tenantId}`;
  
  const isExternalLink = canUseCustomUrl && listing.useCustomWebsite && listing.website;

  // Format rating
  const formatRating = (rating: number) => {
    return rating > 0 ? rating.toFixed(1) : 'New';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group cursor-pointer"
    >
      <Link
        href={destinationUrl}
        target={isExternalLink ? '_blank' : undefined}
        rel={isExternalLink ? 'noopener noreferrer' : undefined}
        className="block"
      >
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg transition-shadow duration-200">
          {/* Logo/Image */}
          <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
            {listing.logoUrl ? (
              <img
                src={listing.logoUrl}
                alt={listing.businessName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-16 h-16 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}

            {/* Featured Badge */}
            {listing.isFeatured && (
              <div className="absolute top-2 left-2">
                <Badge variant="warning" className="text-xs font-semibold">
                  ⭐ Featured
                </Badge>
              </div>
            )}

            {/* Open/Closed Badge */}
            {listing.isOpen !== undefined && (
              <div className="absolute top-2 right-2">
                <Badge 
                  variant={listing.isOpen ? 'success' : 'error'} 
                  className="text-xs"
                >
                  {listing.isOpen ? '🟢 Open' : '🔴 Closed'}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {/* Business Name & Rating */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 flex-1">
                {listing.businessName}
              </h3>
              {listing.ratingAvg > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-yellow-500 text-sm">⭐</span>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatRating(listing.ratingAvg)}
                  </span>
                  {listing.ratingCount > 0 && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({listing.ratingCount})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Category */}
            {listing.primaryCategory && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                {listing.primaryCategory.replace(/_/g, ' ')}
              </p>
            )}

            {/* Location */}
            {(listing.city || listing.state) && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">
                  {listing.city}{listing.city && listing.state ? ', ' : ''}{listing.state}
                </span>
              </div>
            )}

            {/* Distance (if provided) */}
            {listing.distance !== undefined && (
              <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>{listing.distance.toFixed(1)} miles away</span>
              </div>
            )}

            {/* Product Count */}
            <div className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>{listing.productCount} {listing.productCount === 1 ? 'product' : 'products'}</span>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <div className="w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                {isExternalLink ? 'Visit Website' : 'View Storefront'} →
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
