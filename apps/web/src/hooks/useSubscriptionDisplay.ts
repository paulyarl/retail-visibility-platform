/**
 * Customizable subscription display hook
 * Allows tenants to choose which subscription data points are visible on their dashboard
 * Preferences are persisted to localStorage
 */

import { useState, useEffect, useCallback } from 'react';

// Available display fields
export type SubscriptionDisplayField =
  | 'effectiveTier'      // Current effective tier (org or individual)
  | 'subscriptionStatus' // Active, trial, etc.
  | 'organization'       // Organization name and tier
  | 'tenantTier'         // Individual tenant tier
  | 'pricing'            // Monthly price
  | 'skuLimit'           // Max SKUs
  | 'locationLimit'      // Max locations
  | 'features'           // Feature count summary
  | 'trialInfo'          // Trial end date if applicable
  | 'organizationTenants'; // Organization's tenant list

export interface SubscriptionDisplayConfig {
  visibleFields: SubscriptionDisplayField[];
  layout: 'compact' | 'expanded' | 'minimal';
  showUpgradePrompt: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SubscriptionDisplayConfig = {
  visibleFields: ['effectiveTier', 'subscriptionStatus', 'skuLimit', 'locationLimit'],
  layout: 'compact',
  showUpgradePrompt: true,
};

// Field metadata for UI
export const FIELD_METADATA: Record<SubscriptionDisplayField, {
  label: string;
  description: string;
  icon: string;
  category: 'subscription' | 'limits' | 'organization';
}> = {
  effectiveTier: {
    label: 'Current Tier',
    description: 'Your active subscription tier',
    icon: 'Crown',
    category: 'subscription',
  },
  subscriptionStatus: {
    label: 'Status',
    description: 'Subscription status (active, trial, etc.)',
    icon: 'Activity',
    category: 'subscription',
  },
  organization: {
    label: 'Organization',
    description: 'Chain/organization membership',
    icon: 'Building2',
    category: 'organization',
  },
  tenantTier: {
    label: 'Individual Tier',
    description: 'Your location\'s base tier',
    icon: 'Tag',
    category: 'subscription',
  },
  pricing: {
    label: 'Monthly Price',
    description: 'Current subscription cost',
    icon: 'DollarSign',
    category: 'subscription',
  },
  skuLimit: {
    label: 'SKU Limit',
    description: 'Maximum products allowed',
    icon: 'Package',
    category: 'limits',
  },
  locationLimit: {
    label: 'Location Limit',
    description: 'Maximum locations allowed',
    icon: 'MapPin',
    category: 'limits',
  },
  features: {
    label: 'Features',
    description: 'Available feature count',
    icon: 'Layers',
    category: 'subscription',
  },
  trialInfo: {
    label: 'Trial Info',
    description: 'Trial end date and remaining days',
    icon: 'Clock',
    category: 'subscription',
  },
  organizationTenants: {
    label: 'Organization Locations',
    description: 'All locations in your organization',
    icon: 'Building2',
    category: 'organization',
  },
};

const STORAGE_KEY = 'subscription-display-config';

/**
 * Hook for managing subscription display preferences
 */
export function useSubscriptionDisplay(tenantId?: string) {
  const [config, setConfig] = useState<SubscriptionDisplayConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Storage key scoped to tenant
  const storageKey = tenantId ? `${STORAGE_KEY}-${tenantId}` : STORAGE_KEY;

  // Load config from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(storageKey);
      // console.log('[useSubscriptionDisplay] Loading from localStorage:', { storageKey, saved });
      if (saved) {
        const parsed = JSON.parse(saved);
        // console.log('[useSubscriptionDisplay] Parsed config:', parsed);
        // Merge with defaults to handle new fields
        setConfig({
          ...DEFAULT_CONFIG,
          ...parsed,
          visibleFields: parsed.visibleFields || DEFAULT_CONFIG.visibleFields,
        });
      }
    } catch (error) {
      console.warn('[useSubscriptionDisplay] Failed to load config:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save config to localStorage
  const saveConfig = useCallback((newConfig: SubscriptionDisplayConfig) => {
    if (typeof window === 'undefined') return;

    try {
      // console.log('[useSubscriptionDisplay] Saving config:', { storageKey, newConfig });
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.warn('[useSubscriptionDisplay] Failed to save config:', error);
    }
  }, [storageKey]);

  // Toggle a field's visibility
  const toggleField = useCallback((field: SubscriptionDisplayField) => {
    const newVisibleFields = config.visibleFields.includes(field)
      ? config.visibleFields.filter(f => f !== field)
      : [...config.visibleFields, field];
    
    saveConfig({ ...config, visibleFields: newVisibleFields });
  }, [config, saveConfig]);

  // Set all visible fields at once
  const setVisibleFields = useCallback((fields: SubscriptionDisplayField[]) => {
    // Use functional update to avoid stale config closure
    setConfig(prev => {
      const newConfig = { ...prev, visibleFields: fields };
      if (typeof window !== 'undefined') {
        console.log('[useSubscriptionDisplay] setVisibleFields saving:', { storageKey, newConfig });
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
      }
      return newConfig;
    });
  }, [storageKey]);

  // Set layout mode
  const setLayout = useCallback((layout: SubscriptionDisplayConfig['layout']) => {
    // Use functional update to avoid stale config closure
    setConfig(prev => {
      const newConfig = { ...prev, layout };
      if (typeof window !== 'undefined') {
        console.log('[useSubscriptionDisplay] setLayout saving:', { storageKey, newConfig });
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
      }
      return newConfig;
    });
  }, [storageKey]);

  // Toggle upgrade prompt visibility
  const toggleUpgradePrompt = useCallback(() => {
    saveConfig({ ...config, showUpgradePrompt: !config.showUpgradePrompt });
  }, [config, saveConfig]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    saveConfig(DEFAULT_CONFIG);
  }, [saveConfig]);

  // Check if a field is visible
  const isFieldVisible = useCallback((field: SubscriptionDisplayField) => {
    return config.visibleFields.includes(field);
  }, [config.visibleFields]);

  return {
    config,
    isLoading,
    toggleField,
    setVisibleFields,
    setLayout,
    toggleUpgradePrompt,
    resetToDefaults,
    isFieldVisible,
  };
}
