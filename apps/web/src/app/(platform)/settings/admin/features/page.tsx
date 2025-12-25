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

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

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
          <Card className="mt-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                New System Available!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-green-800 font-medium">
                  ✅ Database-backed flags with tenant override support are now ready!
                </p>
                <div className="bg-white border border-green-200 rounded p-4 text-sm space-y-2">
                  <p className="font-medium text-neutral-900">New Features:</p>
                  <ul className="list-disc list-inside space-y-1 text-neutral-700 ml-2">
                    <li>Persistent storage across sessions and users</li>
                    <li>Tenant override permissions (allow tenants to enable flags)</li>
                    <li>Real-time updates without browser refresh</li>
                    <li>Rollout notes and documentation</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Link 
                    href="/settings/admin/platform-flags" 
                    className="inline-flex items-center px-4 py-2 bg-green-600 rounded hover:bg-green-700 font-medium text-sm shadow-sm"
                    style={{ color: '#ffffff' }}
                  >
                    Switch to New System →
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('This will open the migration guide. Continue?')) {
                        window.open('https://github.com/paulyarl/retail-visibility-platform/blob/main/docs/FEATURE_FLAGS_SYSTEM.md#migration-guide', '_blank');
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-green-600 text-green-700 rounded hover:bg-green-50 font-medium text-sm"
                  >
                    View Migration Guide
                  </button>
                </div>
                <p className="text-xs text-green-700">
                  <strong>Note:</strong> This localStorage-based system will remain available for backward compatibility.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
