"use client";

import { useState, useEffect } from 'react';
import TenantAppShell from '@/components/app-shell/TenantAppShell';
import { apiRequest } from '@/lib/api';

interface DynamicTenantSidebarProps {
  tenantId: string;
  children: React.ReactNode;
}

interface DirectoryListing {
  id: string;
  tenantId: string;
  isPublished: boolean;
  businessProfile?: {
    slug?: string;
  };
}

/**
 * Dynamic tenant sidebar that conditionally shows directory link based on published status
 * Now includes fixed header with tenant branding
 */
export default function DynamicTenantSidebar({ tenantId, children }: DynamicTenantSidebarProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<any[]>([]);

  useEffect(() => {
    const fetchDirectoryStatus = async () => {
      try {
        // Use the same approach as storefront page
        const res = await apiRequest(`/api/directory/${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setListing({
            id: data.listing?.id || tenantId,
            tenantId: tenantId,
            isPublished: true,
            businessProfile: {
              slug: data.listing?.slug,
            },
          });
        } else {
          setListing({
            id: tenantId,
            tenantId: tenantId,
            isPublished: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch directory status:', error);
        setListing({
          id: tenantId,
          tenantId: tenantId,
          isPublished: false,
        });
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      fetchDirectoryStatus();
    }
  }, [tenantId]);

  useEffect(() => {
    // Base navigation structure
    const baseNav = [
      { label: 'Dashboard', href: `/t/${tenantId}` },
      { 
        label: 'Google Business Profile', 
        href: `/t/${tenantId}/settings/hours`,
        children: [
          { label: 'Store Hours', href: `/t/${tenantId}/settings/hours` },
          { label: 'Business Category', href: `/t/${tenantId}/settings/gbp-category` },
          { label: 'Product Categories', href: `/t/${tenantId}/categories` },
          { label: 'Directory Settings', href: `/t/${tenantId}/settings/directory` },
        ]
      },
      { 
        label: 'Order Processing', 
        href: `/t/${tenantId}/orders`,
        children: [
          { label: 'Order Management', href: `/t/${tenantId}/orders` },
          { label: 'Payment Gateways', href: `/t/${tenantId}/settings/payment-gateways` },
          { label: 'Fulfillment Options', href: `/t/${tenantId}/settings/fulfillment` },
        ]
      },
      { 
        label: 'Inventory', 
        href: `/t/${tenantId}/items`,
        children: [
          { label: 'Items', href: `/t/${tenantId}/items` },
          { label: 'Barcode Scan', href: `/t/${tenantId}/scan` },
          { label: 'Quick Start', href: `/t/${tenantId}/quick-start` },
          { label: 'Categories', href: `/t/${tenantId}/categories` },
          { label: 'Storefront', href: `/tenant/${tenantId}` },
        ]
      },
      { 
        label: 'Featured Products', 
        href: `/t/${tenantId}/settings/products/featuring`,
        children: [
          { label: 'Directory Featured Products', href: `/t/${tenantId}/settings/products/featuring` },
          { label: 'Storefront Featured Products', href: `/t/${tenantId}/settings/featured-products` },
          { label: 'Inventory Featured Products', href: `/t/${tenantId}/settings/products/inventory-featuring` },
        ]
      },
      { 
        label: 'Onboarding', 
        href: `/t/${tenantId}/onboarding`,
        children: [
          // Profile & Identity
          { label: 'Store Profile', href: `/t/${tenantId}/settings/tenant` },
          { label: 'My Account', href: `/t/${tenantId}/settings/account` },
          { label: 'Branding', href: `/t/${tenantId}/settings/branding` },
          { label: 'Custom Subdomain', href: `/t/${tenantId}/settings/subdomain` },
          
          // Location Status
          { label: 'Location Status', href: `/t/${tenantId}/settings/location-status` },
          
          // Team & Organization
          { label: 'Team Members', href: `/t/${tenantId}/settings/users` },
          { label: 'Organization Settings', href: `/t/${tenantId}/settings/organization` },
        ]
      },
      { 
        label: 'Settings', 
        href: `/t/${tenantId}/settings`,
        children: [
          // Account & Preferences
          { label: 'Appearance', href: `/t/${tenantId}/settings/appearance` },
          { label: 'Language & Region', href: `/t/${tenantId}/settings/language` },
          
          // Advanced Settings
          { label: 'Propagation Control', href: `/t/${tenantId}/settings/propagation` },
          
          // Subscription
          { label: 'Platform Offerings', href: `/settings/offerings` },
          { label: 'My Subscription', href: `/t/${tenantId}/settings/subscription` },
        ]
      },
    ];

    // Add directory section (always show settings, only show view link when published)
    const directorySection = {
      label: 'Directory',
      href: `/t/${tenantId}/settings/directory`,
      children: [
        ...(listing?.isPublished && listing?.businessProfile?.slug ? [
          { label: 'View in Directory', href: `/directory/${listing.businessProfile.slug}` }
        ] : []),
        { label: 'Directory Settings', href: `/t/${tenantId}/settings/directory` },
      ]
    };

    // Add integrations section
    const integrationsSection = {
      label: 'Integrations',
      href: `/t/${tenantId}/settings/integrations`,
      children: [
        { label: 'Google Business Profile', href: `/t/${tenantId}/settings/integrations/google-business` },
        { label: 'Google Merchant Center', href: `/t/${tenantId}/settings/integrations/google-merchant` },
        { label: 'Feed Validation', href: `/t/${tenantId}/feed-validation` },
        { 
          label: 'POS Systems', 
          href: `/t/${tenantId}/settings/integrations`,
          children: [
            { label: 'Clover POS', href: `/t/${tenantId}/settings/integrations/clover` },
            { label: 'Square POS', href: `/t/${tenantId}/settings/integrations/square` },
          ]
        },
      ]
    };

    baseNav.splice(3, 0, directorySection);
    baseNav.splice(4, 0, integrationsSection);
    // Move Settings to be more prominent (after Inventory, before Onboarding)
    const settingsSection = baseNav.pop(); // Remove Settings from end
    if (settingsSection) {
      baseNav.splice(3, 0, settingsSection); // Insert after Inventory
    }

    setNav(baseNav);
  }, [tenantId, listing]);

  if (loading) {
    // Show loading state with fixed header
    return (
      <div className="min-h-dvh flex flex-col bg-neutral-50">
        {/* Fixed Header Loading State */}
        <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="h-8 w-8 bg-neutral-200 rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-neutral-200 rounded animate-pulse" />
          </div>
        </header>
        
        {/* Sidebar Loading State */}
        <div className="flex flex-1">
          <div className="w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 animate-pulse">
            <div className="p-4 space-y-4">
              <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TenantAppShell 
      navItems={nav}
    >
      {children}
    </TenantAppShell>
  );
}
