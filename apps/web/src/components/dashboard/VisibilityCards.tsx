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
import { UserProfileData } from "@/hooks/useUserProfile";
import { Card, CardContent } from '@/components/ui';
import { ExternalLink, Store, MapPin, Eye, Settings } from 'lucide-react';
import Link from 'next/link';

interface VisibilityCardsProps {
  tenantId: string;
  tenantName: string;
  hasStorefront?: boolean;
  isInDirectory?: boolean;
  hasPublishedDirectory?: boolean;
  googleProductCount?: number;
  hasProduct?: boolean;
  storefrontUrl?: string;
  directoryUrl?: string;
  tenantCity?: string;
  tenantState?: string;
  tenantCategory?: string;
  profile?: UserProfileData;
  slug?: string | null;
  
}

export default function VisibilityCards({
  tenantId,
  tenantName,
  hasStorefront = true,
  isInDirectory = false,
  hasPublishedDirectory = false,
  googleProductCount = 0,
  hasProduct = googleProductCount > 0,
  storefrontUrl,
  directoryUrl,
  tenantCity,
  tenantState,
  tenantCategory,
  profile,
  slug,
}: VisibilityCardsProps) {
  // Generate URLs if not provided
  const finalStorefrontUrl = storefrontUrl || `/tenant/${tenantId}`;
  const finalShopUrl = storefrontUrl || `/shops/${slug || tenantId}`;
  const finalDirectoryUrl = directoryUrl || `/directory/${slug || '/directory'}`;
  
  // Build directory URL with location and category filters for proximity viewing
  const buildDirectoryUrl = () => {
    const params = new URLSearchParams();
    if (tenantCity) params.append('city', tenantCity);
    if (tenantState) params.append('state', tenantState);
    if (tenantCategory) params.append('category', tenantCategory);
    
    const queryString = params.toString();
    return queryString ? `/directory?${queryString}` : hasPublishedDirectory && slug ? `/directory/${slug}` : '/directory';
  };
  
  const buildShopsDirectoryUrl = () => {
    const params = new URLSearchParams();
    if (tenantCity) params.append('city', tenantCity);
    if (tenantState) params.append('state', tenantState);
    if (tenantCategory) params.append('category', tenantCategory);
    
    const queryString = params.toString();
    return queryString ? `/shops?${queryString}` : hasPublishedDirectory && slug ? `/shops/${slug}` : '/shops';
  };
  
  const proximityDirectoryUrl = buildDirectoryUrl();
  const proximityShopsDirectoryUrl = buildShopsDirectoryUrl();

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
              <p className="text-sm text-neutral-600 dark:text-neutral-200 mb-4">
                Your branded online store where customers can browse and discover your products
              </p>

              {/* Status */}
              <div className="flex items-center gap-2 mb-4">
                {hasProduct ? (
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
                {/* Always show Browse Directory - filtered by location and category for proximity viewing */}
                <Link
                  href={`${hasProduct ? finalStorefrontUrl : `/t/${tenantId}/items`}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm pointer-events-auto cursor-pointer"
                  title={tenantCity && tenantCategory ? `Browse ${tenantCategory} stores in ${tenantCity}, ${tenantState}` : 'Browse platform directory'}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  <Eye className="w-4 h-4" />
                  {hasProduct ? 'View Your Listing' : 'Setup your products'}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                
                {/* Get Listed or Settings */}
                {!hasProduct ? (
                  <Link
                    href={`/t/${tenantId}/items`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <MapPin className="w-4 h-4" />
                    Add Items
                  </Link>
                ) : (
                  <Link
                    href={`/t/${tenantId}/settings/tenant`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <Settings className="w-4 h-4" />
                    Store Settings
                  </Link>
                )}
                 {/*Browse Platform Directory*/}
                 <Link
                    href={`/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <Settings className="w-4 h-4" />
                    Browse Platform Directory
                  </Link>
              
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Directory Card */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 hover:shadow-lg transition-shadow">
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
                Your Directory Listing
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-200 mb-4">
                Get discovered by local shoppers searching for products in your area
              </p>

              {/* Status */}
              <div className="flex items-center gap-2 mb-4">
                {hasPublishedDirectory ? (
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
                {/* Always show Browse Directory - filtered by location and category for proximity viewing */}
                <Link
                  href={proximityDirectoryUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm pointer-events-auto cursor-pointer"
                  title={tenantCity && tenantCategory ? `Browse ${tenantCategory} stores in ${tenantCity}, ${tenantState}` : 'Browse platform directory'}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  <Eye className="w-4 h-4" />
                  {hasPublishedDirectory ? 'View Your Listing' : 'Browse Platform Directory'}
                  <ExternalLink className="w-3 h-3" />
                </Link>
                
                {/* Get Listed or Settings */}
                {!hasPublishedDirectory ? (
                  <Link
                    href={`/t/${tenantId}/settings/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <MapPin className="w-4 h-4" />
                    Get Listed
                  </Link>
                ) : (
                  <Link
                    href={`/t/${tenantId}/settings/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                )}
                 {/*Browse Platform Directory*/}
                 <Link
                    href={`/directory`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm pointer-events-auto cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <Settings className="w-4 h-4" />
                    Browse Platform Directory
                  </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    
    </div>
  );
}
