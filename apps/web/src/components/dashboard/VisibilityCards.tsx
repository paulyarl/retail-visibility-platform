/**
 * Visibility Cards Component
 * 
 * Highlights the two main visibility channels:
 * 1. Storefront - Your own branded online store
 * 2. Directory - Listed in the platform directory
 * 
 * These cards align with the "Visibility" pillar and provide
 * clear CTAs to view/manage these critical features.
 */

'use client';

import { Card, CardContent } from '@/components/ui';
import { ExternalLink, Store, MapPin, Eye, Settings } from 'lucide-react';
import Link from 'next/link';

interface VisibilityCardsProps {
  tenantId: string;
  tenantName: string;
  hasStorefront?: boolean;
  isInDirectory?: boolean;
  storefrontUrl?: string;
  directoryUrl?: string;
}

export default function VisibilityCards({
  tenantId,
  tenantName,
  hasStorefront = true,
  isInDirectory = false,
  storefrontUrl,
  directoryUrl,
}: VisibilityCardsProps) {
  // Generate URLs if not provided
  const finalStorefrontUrl = storefrontUrl || `/storefront/${tenantId}`;
  const finalDirectoryUrl = directoryUrl || `/directory/${tenantId}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Storefront Card */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Store className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                Your Storefront
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Your branded online store where customers can browse and discover your products
              </p>

              {/* Status */}
              <div className="flex items-center gap-2 mb-4">
                {hasStorefront ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Live & Active
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Setup Required
                    </span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={finalStorefrontUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  View Storefront
                  <ExternalLink className="w-3 h-3" />
                </Link>
                
                <Link
                  href={`/t/${tenantId}/settings/storefront`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Directory Card */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:shadow-lg transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <MapPin className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                Directory Listing
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                Get discovered by local shoppers searching for products in your area
              </p>

              {/* Status */}
              <div className="flex items-center gap-2 mb-4">
                {isInDirectory ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">
                      Listed & Discoverable
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Not Listed Yet
                    </span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Always show Browse Directory */}
                <Link
                  href="/directory"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  {isInDirectory ? 'View Your Listing' : 'Browse Directory'}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                
                {/* Get Listed or Settings */}
                {!isInDirectory ? (
                  <Link
                    href={`/t/${tenantId}/settings/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm"
                  >
                    <MapPin className="w-4 h-4" />
                    Get Listed
                  </Link>
                ) : (
                  <Link
                    href={`/t/${tenantId}/settings/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
