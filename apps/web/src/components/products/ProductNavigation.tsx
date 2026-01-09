"use client";

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface ProductNavigationProps {
  tenantId: string;
  directorySlug?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export function ProductNavigation({ tenantId, directorySlug }: ProductNavigationProps) {
  const { user, isAuthenticated } = useAuth();
  
  // Check if user belongs to this item's tenant
  const userBelongsToTenant = user?.tenants?.some(
    (t: { id: string }) => t.id === tenantId
  );
  
  // Only show inventory link for users who belong to this tenant
  // Storefront and directory links are public
  
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {userBelongsToTenant && (
        <Link href={`/items?tenantId=${tenantId}`}>
          <Button variant="ghost" size="sm">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Inventory
          </Button>
        </Link>
      )}
      
      <Link href={`/tenant/${tenantId}`}>
        <Button variant="ghost" size="sm">
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          View Storefront
        </Button>
      </Link>
      
      {directorySlug && (
        <Link href={`/directory/${directorySlug}`}>
          <Button variant="ghost" size="sm">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View Directory Listing
          </Button>
        </Link>
      )}
    </div>
  );
}


export default ProductNavigation;
