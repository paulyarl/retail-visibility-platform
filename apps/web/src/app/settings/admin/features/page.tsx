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

  const flagDescriptions: Record<FeatureFlag, { title: string; description: string }> = {
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
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Feature Flags"
          description="Control feature rollout and experimentation"
          icon={Icons.Settings}
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {success && (
          <Alert variant="success" title="Feature Flag Updated" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Feature Flags List */}
        <div className="space-y-4">
          {Object.entries(flags).map(([flagKey, config]) => {
            const flag = flagKey as FeatureFlag;
            const info = flagDescriptions[flag];
            
            return (
              <Card key={flag}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-neutral-900">{info.title}</h3>
                        {getStrategyBadge(config.strategy)}
                        <code className="text-xs bg-neutral-100 px-2 py-1 rounded font-mono text-neutral-600">
                          {flag}
                        </code>
                      </div>
                      <p className="text-sm text-neutral-600 mb-4">{info.description}</p>

                      {/* Strategy Details */}
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500">Strategy:</span>
                          <span className="ml-2 font-medium text-neutral-900">{config.strategy}</span>
                        </div>
                        {config.strategy === 'percentage' && (
                          <div>
                            <span className="text-neutral-500">Rollout:</span>
                            <span className="ml-2 font-medium text-neutral-900">{config.percentage}%</span>
                          </div>
                        )}
                        {config.strategy === 'pilot' && config.pilotTenants && config.pilotTenants.length > 0 && (
                          <div>
                            <span className="text-neutral-500">Pilot Tenants:</span>
                            <span className="ml-2 font-medium text-neutral-900">{config.pilotTenants.length}</span>
                          </div>
                        )}
                      </div>

                      {/* Percentage Rollout Slider */}
                      {config.strategy === 'percentage' && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-neutral-700 mb-2">
                            Rollout Percentage: {config.percentage}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="10"
                            value={config.percentage || 0}
                            onChange={(e) => handlePercentage(flag, parseInt(e.target.value))}
                            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                          />
                          <div className="flex justify-between text-xs text-neutral-500 mt-1">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Toggle Button */}
                    <div className="ml-6">
                      <button
                        onClick={() => handleToggle(flag)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                          config.strategy !== 'off' ? 'bg-primary-600' : 'bg-neutral-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                            config.strategy !== 'off' ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 pt-4 border-t border-neutral-200 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        enablePercentage(flag, 20);
                        setSuccess(`${flag} set to 20% rollout`);
                        setFlags(getAllFeatureFlags());
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      disabled={config.strategy === 'percentage' && config.percentage === 20}
                    >
                      20% Rollout
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        enablePercentage(flag, 50);
                        setSuccess(`${flag} set to 50% rollout`);
                        setFlags(getAllFeatureFlags());
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      disabled={config.strategy === 'percentage' && config.percentage === 50}
                    >
                      50% Rollout
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        enableForAll(flag);
                        setSuccess(`${flag} enabled for all`);
                        setFlags(getAllFeatureFlags());
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      disabled={config.strategy === 'on'}
                    >
                      Enable All
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        disableForAll(flag);
                        setSuccess(`${flag} disabled`);
                        setFlags(getAllFeatureFlags());
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      disabled={config.strategy === 'off'}
                    >
                      Disable
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Feature Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-neutral-600">
              <p>
                <strong>Off:</strong> Feature is disabled for all users
              </p>
              <p>
                <strong>Pilot:</strong> Feature is enabled for specific tenants or regions
              </p>
              <p>
                <strong>Percentage:</strong> Feature is enabled for a percentage of users (gradual rollout)
              </p>
              <p>
                <strong>On:</strong> Feature is enabled for all users
              </p>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-900">
                  💡 <strong>Tip:</strong> Use percentage rollout to gradually enable features and monitor for issues before full deployment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
