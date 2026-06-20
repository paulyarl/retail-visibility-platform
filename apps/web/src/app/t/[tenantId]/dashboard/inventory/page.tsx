/**
 * Central Inventory Dashboard Page
 * 
 * Main hub for inventory management with:
 * - Quick actions for common tasks
 * - Status indicators and metrics
 * - Product overview with filtering
 * - Shop management-inspired UX patterns
 * 
 * Follows the same patterns as shop management dashboard
 */

import { Metadata } from 'next';
import { Button } from '@mantine/core';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import InventoryDashboard from '@/components/inventory/InventoryDashboard';
import { CachedTenantService } from '@/lib/cache/cached-tenant-service';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';

interface InventoryDashboardPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export async function generateMetadata({ params }: InventoryDashboardPageProps): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await CachedTenantService.getTenantInfo(tenantId);
  
  if (!tenant) {
    return {
      title: 'Inventory Dashboard - Not Found',
      description: 'Tenant not found'
    };
  }

  return {
    title: `Inventory Dashboard - ${tenant.name}`,
    description: `Manage inventory and products for ${tenant.name}`,
  };
}

export default async function InventoryDashboardPage({ params }: InventoryDashboardPageProps) {
  const { tenantId } = await params;
  // Verify tenant exists
  const tenant = await CachedTenantService.getTenantInfo(tenantId);
  
  if (!tenant) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<InventoryDashboardSkeleton />}>
        <InventoryDashboardWrapper tenantId={tenantId} tenant={tenant} />
      </Suspense>
    </div>
  );
}

/**
 * Wrapper component to handle client-side data fetching
 */
async function InventoryDashboardWrapper({ tenantId, tenant }: { tenantId: string; tenant: any }) {
  // Get capacity usage for the tenant
  const usage = await useSubscriptionUsage(tenantId);

  return (
    <InventoryDashboard 
      tenantId={tenantId}
      tenant={tenant}
      usage={usage}
    />
  );
}

/**
 * Loading skeleton for the dashboard
 */
function InventoryDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions skeleton */}
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Product list skeleton */}
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
