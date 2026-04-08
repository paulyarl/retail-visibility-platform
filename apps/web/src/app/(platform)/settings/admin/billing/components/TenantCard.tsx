import { Badge, Button, Select } from '@mantine/core';
import Link from 'next/link';
import { useState } from 'react';
import { Tenant, DbTier } from '../types';

interface TenantCardProps {
  tenant: Tenant;
  tiers: DbTier[];
  onUpdateTenant?: (tenantId: string, updates: { tier?: string; status?: string }) => void;
  isUpdating?: boolean;
}

export default function TenantCard({ tenant, tiers, onUpdateTenant, isUpdating = false }: TenantCardProps) {
  const tier = tiers.find((t) => t.tierKey === tenant.subscriptionTier);
  const [localTier, setLocalTier] = useState(tenant.subscriptionTier || '');
  const [localStatus, setLocalStatus] = useState(tenant.subscriptionStatus || 'active');

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      trial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      past_due: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return colors[status || 'active'] || colors.active;
  };

  const handleTierChange = (value: string | null) => {
    if (!value) return;
    setLocalTier(value);
    if (onUpdateTenant) {
      onUpdateTenant(tenant.id, { tier: value });
    }
  };

  const handleStatusChange = (value: string | null) => {
    if (!value) return;
    setLocalStatus(value);
    if (onUpdateTenant) {
      onUpdateTenant(tenant.id, { status: value });
    }
  };

  // Create sorted tier options with multiple separators
  const individualTiers = tiers
    .filter(t => !t.tierKey.startsWith('trial_') && t.tierKey !== 'expired_trial' && t.tierType === 'individual')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(t => ({ value: t.tierKey, label: `${t.displayName} ($${t.priceMonthly}/mo)` }));
  
  const organizationTiers = tiers
    .filter(t => !t.tierKey.startsWith('trial_') && t.tierKey !== 'expired_trial' && t.tierType === 'organization')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(t => ({ value: t.tierKey, label: `${t.displayName} ($${t.priceMonthly}/mo)` }));
  
  // Add trial tiers with proper sorting (excluding expired_trial)
  const trialTiers = [
    { value: 'trial_google_only', label: 'Trial: Google Only ($0/mo)' },
    { value: 'trial_starter', label: 'Trial: Starter ($0/mo)' },
    { value: 'trial_professional', label: 'Trial: Professional ($0/mo)' },
    { value: 'trial_chain_starter', label: 'Trial: Chain Starter ($0/mo)' },
  ];
  
  // Combine with multiple separators
  const allTierOptions = [
    ...individualTiers,
    { value: 'separator', label: '--- Organization Tiers ---', disabled: true },
    ...organizationTiers,
    { value: 'separator2', label: '--- Trials ---', disabled: true },
    ...trialTiers,
    { value: 'separator3', label: '--- Expired ---', disabled: true },
    { value: 'expired_trial', label: 'Expired Trial ($0/mo)' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'separator', label: '--- Grace Period ---', disabled: true },
    { value: 'trial', label: 'Trial' },
    { value: 'past_due', label: 'Past Due' },
    { value: 'separator2', label: '--- Inactive ---', disabled: true },
    { value: 'canceled', label: 'Canceled' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <div className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</div>
            </div>
            {tier && (
              <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {tier.displayName}
              </Badge>
            )}
            <Badge variant="default" className={getStatusColor(tenant.subscriptionStatus)}>
              {tenant.subscriptionStatus || 'active'}
            </Badge>
            {tenant.trialEndsAt && (
              <Badge variant="light" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                Trial: {new Date(tenant.trialEndsAt).toLocaleDateString()}
              </Badge>
            )}
            {tenant.organization && (
              <Badge variant="light" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Chain: {tenant.organization.name}
              </Badge>
            )}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <p>ID: {tenant.id}</p>
            {tenant.metadata?.city && tenant.metadata?.state && (
              <p>Location: {tenant.metadata.city}, {tenant.metadata.state}</p>
            )}
          </div>
        </div>
        <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
          <div className="w-48">
            <label className="text-xs font-medium text-neutral-700 mb-1 block">Tier</label>
            <Select
              value={localTier}
              onChange={handleTierChange}
              data={allTierOptions}
              disabled={isUpdating}
              size="sm"
              className="w-full"
            />
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-neutral-700 mb-1 block">Status</label>
            <Select
              value={localStatus}
              onChange={handleStatusChange}
              data={statusOptions}
              disabled={isUpdating}
              size="sm"
              className="w-full"
            />
          </div>
          <div className="w-48">
            <Link href={`/settings/subscription?tenantId=${tenant.id}`}>
              <Button variant="outline" size="sm" className="w-full text-xs">
                Manage Subscription
              </Button>
            </Link>
          </div>
          {isUpdating && (
            <div className="flex items-center gap-2 text-xs text-primary-600">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Updating...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
