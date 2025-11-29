"use client";

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui';
import Link from 'next/link';
import { MapPin, Star, Package, Navigation2 } from 'lucide-react';

interface DirectoryListing {
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
  category?: {
    name: string;
    slug: string;
    isPrimary?: boolean;
  };
  gbpPrimaryCategoryName?: string;
}

interface DirectoryListProps {
  listings: DirectoryListing[];
  loading?: boolean;
}

export default function DirectoryList({ listings, loading }: DirectoryListProps) {
  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-24 h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4" />
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <svg 
          className="mx-auto h-16 w-16 text-neutral-400 dark:text-neutral-600 mb-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
          />
        </svg>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          No stores found
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listings.map((listing, index) => {
        // Determine destination URL
        const canUseCustomUrl = ['professional', 'enterprise', 'organization'].includes(
          listing.subscriptionTier
        );
        
        const destinationUrl = 
          canUseCustomUrl && listing.useCustomWebsite && listing.website
            ? listing.website
            : `/tenant/${listing.tenantId}`;
        
        const isExternalLink = canUseCustomUrl && listing.useCustomWebsite && listing.website;

        return (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
          >
            <Link
              href={destinationUrl}
              target={isExternalLink ? '_blank' : undefined}
              rel={isExternalLink ? 'noopener noreferrer' : undefined}
              className="block group"
            >
              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 p-4">
                <div className="flex gap-4">
                  {/* Logo */}
                  <div className="relative w-24 h-24 shrink-0 bg-neutral-100 dark:bg-neutral-700 rounded-lg overflow-hidden">
                    {listing.logoUrl ? (
                      <img
                        src={listing.logoUrl}
                        alt={listing.businessName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {listing.businessName}
                        </h3>
                        {/* Category - Context-aware display */}
                        {(listing.category?.name || listing.gbpPrimaryCategoryName || listing.primaryCategory) && (
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                            {listing.category?.name || listing.gbpPrimaryCategoryName || listing.primaryCategory?.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        {listing.isFeatured && (
                          <Badge variant="warning" className="text-xs">
                            ⭐ Featured
                          </Badge>
                        )}
                        {listing.isOpen !== undefined && (
                          <Badge 
                            variant={listing.isOpen ? 'success' : 'error'} 
                            className="text-xs"
                          >
                            {listing.isOpen ? '🟢 Open' : '🔴 Closed'}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Info Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {/* Rating */}
                      {listing.ratingAvg > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {listing.ratingAvg.toFixed(1)}
                          </span>
                          {listing.ratingCount > 0 && (
                            <span className="text-neutral-500">
                              ({listing.ratingCount})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Location */}
                      {(listing.city || listing.state) && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {listing.city}{listing.city && listing.state ? ', ' : ''}{listing.state}
                          </span>
                        </div>
                      )}

                      {/* Distance */}
                      {listing.distance !== undefined && (
                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                          <Navigation2 className="w-4 h-4" />
                          <span>{listing.distance.toFixed(1)} mi</span>
                        </div>
                      )}

                      {/* Product Count */}
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{listing.productCount} {listing.productCount === 1 ? 'product' : 'products'}</span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                        {isExternalLink ? 'Visit Website' : 'View Storefront'} →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

export { DirectoryList };
