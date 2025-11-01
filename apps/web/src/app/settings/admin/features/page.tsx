"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  getAllFeatureFlags, 
  enableForAll, 
  enablePilot, 
  enablePercentage, 
  disableForAll,
  type FeatureFlag 
} from '@/lib/featureFlags';

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState(getAllFeatureFlags());
  const [success, setSuccess] = useState<string | null>(null);

  const handleToggle = (flag: FeatureFlag) => {
    const currentConfig = flags[flag];
    
    if (currentConfig.strategy === 'off') {
      enableForAll(flag);
      setSuccess(`${flag} enabled for all users`);
    } else {
      disableForAll(flag);
      setSuccess(`${flag} disabled`);
    }
    
    setFlags(getAllFeatureFlags());
    setTimeout(() => setSuccess(null), 3000);
  };

  const handlePercentage = (flag: FeatureFlag, percentage: number) => {
    enablePercentage(flag, percentage);
    setSuccess(`${flag} set to ${percentage}% rollout`);
    setFlags(getAllFeatureFlags());
    setTimeout(() => setSuccess(null), 3000);
  };

  const getStrategyBadge = (strategy: string) => {
    switch (strategy) {
      case 'on':
        return <Badge variant="success">Enabled</Badge>;
      case 'off':
        return <Badge variant="default">Disabled</Badge>;
      case 'pilot':
        return <Badge variant="info">Pilot</Badge>;
      case 'percentage':
        return <Badge variant="warning">Rollout</Badge>;
      default:
        return <Badge variant="default">{strategy}</Badge>;
    }
  };

  const flagDescriptions: Partial<Record<FeatureFlag, { title: string; description: string }>> = {
    FF_MAP_CARD: {
      title: 'Map Card',
      description: 'Google Maps integration for tenant locations with privacy controls',
    },
    FF_SWIS_PREVIEW: {
      title: 'SWIS Preview',
      description: 'Product preview widget showing live inventory feed',
    },
    FF_BUSINESS_PROFILE: {
      title: 'Business Profile',
      description: 'Complete business profile management and onboarding',
    },
    FF_DARK_MODE: {
      title: 'Dark Mode',
      description: 'Dark theme support across the platform (coming soon)',
    },
    FF_GOOGLE_CONNECT_SUITE: {
      title: 'Google Connect Suite',
      description: 'Unified Google Merchant Center + Business Profile integration (v1: read-only)',
    },
    FF_APP_SHELL_NAV: {
      title: 'App Shell Navigation',
      description: 'Enable the new header and Tenant Switcher (URL-driven tenant context)',
    },
    FF_TENANT_URLS: {
      title: 'Tenant-Scoped URLs',
      description: 'Enable tenant-scoped routes like /t/{tenantId}/items and /t/{tenantId}/settings',
    },
    FF_ITEMS_V2_GRID: {
      title: 'Items Grid v2',
      description: 'Enable the new high-performance items grid (virtualized, faster filters)',
    },
    FF_CATEGORY_MANAGEMENT_PAGE: {
      title: 'Category Management',
      description: 'Enable category management page and features',
    },
    FF_CATEGORY_QUICK_ACTIONS: {
      title: 'Category Quick Actions',
      description: 'Enable quick actions for category management',
    },
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Feature Flags"
          description="Control feature rollout and experimentation (localStorage-based)"
          icon={Icons.Settings}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {success && (
            <Alert variant="success" className="mb-6" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-6">
            {(Object.keys(flags) as FeatureFlag[]).map((flag) => {
              const config = flags[flag];
              const meta = flagDescriptions[flag];

              return (
                <Card key={flag}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900">
                            {meta?.title || flag}
                          </h3>
                          {getStrategyBadge(config.strategy)}
                          <code className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded font-mono">
                            {flag}
                          </code>
                        </div>
                        <p className="text-sm text-neutral-600 mb-4">
                          {meta?.description || 'No description available'}
                        </p>

                        {/* Strategy Display */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="text-sm text-neutral-600">Strategy: <strong>{config.strategy}</strong></span>
                          {config.strategy === 'percentage' && (
                            <span className="text-sm text-neutral-600">({config.percentage}% rollout)</span>
                          )}
                          {config.strategy === 'pilot' && config.pilotTenants && config.pilotTenants.length > 0 && (
                            <span className="text-sm text-neutral-600">({config.pilotTenants.length} tenant(s))</span>
                          )}
                        </div>

                        {/* Rollout Buttons */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <button
                            onClick={() => {
                              const pct = 20;
                              handlePercentage(flag, pct);
                            }}
                            className="px-3 py-1 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
                          >
                            20% Rollout
                          </button>
                          <button
                            onClick={() => {
                              const pct = 50;
                              handlePercentage(flag, pct);
                            }}
                            className="px-3 py-1 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
                          >
                            50% Rollout
                          </button>
                          <button
                            onClick={() => {
                              enableForAll(flag);
                              setSuccess(`${flag} enabled for all`);
                              setFlags(getAllFeatureFlags());
                              setTimeout(() => setSuccess(null), 3000);
                            }}
                            className="px-3 py-1 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
                          >
                            Enable All
                          </button>
                          <button
                            onClick={() => {
                              disableForAll(flag);
                              setSuccess(`${flag} disabled`);
                              setFlags(getAllFeatureFlags());
                              setTimeout(() => setSuccess(null), 3000);
                            }}
                            className="px-3 py-1 text-sm border border-neutral-300 rounded hover:bg-neutral-50 text-red-600"
                          >
                            Disable
                          </button>
                        </div>

                        {/* Tenant Override Option */}
                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                          <input
                            type="checkbox"
                            id={`override-${flag}`}
                            checked={false}
                            onChange={() => {
                              // TODO: Implement DB sync for allowTenantOverride
                              console.log('Override toggle clicked for', flag);
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                          />
                          <label htmlFor={`override-${flag}`} className="text-sm text-neutral-700 cursor-pointer">
                            Allow tenants to override this flag
                          </label>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <div className="flex items-center gap-4 ml-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.strategy === 'on' || config.strategy === 'percentage'}
                            onChange={() => handleToggle(flag)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Migration Notice */}
          <Card className="mt-8 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Migration Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-neutral-700">
                  <strong>Current:</strong> These flags are stored in localStorage (browser-only, no persistence).
                </p>
                <p className="text-sm text-neutral-700">
                  <strong>New System:</strong> Database-backed flags with tenant override support are ready but not yet migrated.
                </p>
                <div className="bg-white border border-amber-200 rounded p-3 text-sm">
                  <p className="font-medium text-neutral-900 mb-2">To enable tenant override functionality:</p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-700 ml-2">
                    <li>Migrate existing flags to database</li>
                    <li>Update this page to use DB-backed API</li>
                    <li>Enable "Allow tenants to override" checkbox</li>
                  </ol>
                </div>
                <Link href="/admin/platform/flags" className="inline-flex items-center text-sm text-primary-600 hover:underline font-medium">
                  Preview new DB-backed flags system →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
