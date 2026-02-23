"use client";

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import EnhancedTickerSettings from '@/components/admin/EnhancedTickerSettings';
import { tickerConfigService } from '@/services/TickerConfigService';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function TickerSettingsPage() {
  const {
    hasAccess,
    loading: accessLoading,
    isPlatformAdmin,
  } = useAccessControl(
    null, // No tenant context needed
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [availableTiers, setAvailableTiers] = useState<string[]>([]);
  const [availableTenants, setAvailableTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load available tiers and tenants for the ticker settings
        const [tiersResult, tenantsResult] = await Promise.all([
          tickerConfigService.getAvailableTiers(),
          tickerConfigService.getAvailableTenants()
        ]);

        if (tiersResult.success && tiersResult.data) {
          setAvailableTiers(tiersResult.data);
        }

        if (tenantsResult.success && tenantsResult.data) {
          setAvailableTenants(tenantsResult.data);
        }
      } catch (error) {
        console.error('Failed to load ticker data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (hasAccess) {
      loadData();
    }
  }, [hasAccess]);

  // Access control checks
  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Platform Ticker Settings"
        pageDescription="Manage platform-wide notifications and announcements"
        title="Platform Administrator Access Required"
        message="The Platform Ticker Settings is only accessible to platform administrators. This area contains sensitive platform-wide communication tools."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: '/settings/admin', label: 'Back to Admin Dashboard' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Platform Ticker Settings"
        description="Manage platform-wide notifications and announcements with scheduling and targeting"
        icon={Icons.Bell}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin Dashboard'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <EnhancedTickerSettings
          availableTiers={availableTiers}
          availableTenants={availableTenants}
          onSave={(config) => {
            console.log('Ticker settings saved:', config);
            // You can add additional logic here like showing a success notification
          }}
        />
      </div>
    </div>
  );
}
