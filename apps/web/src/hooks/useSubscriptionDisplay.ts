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
  | 'capabilities'       // Effective capability domains summary
  | 'capabilityBreakdown' // Per-domain enabled/disabled breakdown
  | 'trialInfo'          // Trial end date if applicable
  | 'organizationTenants'; // Organization's tenant list

export interface SubscriptionDisplayConfig {
  visibleFields: SubscriptionDisplayField[];
  layout: 'compact' | 'expanded' | 'minimal';
  showUpgradePrompt: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SubscriptionDisplayConfig = {
  visibleFields: ['effectiveTier', 'subscriptionStatus', 'skuLimit', 'locationLimit', 'capabilities'],
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
  capabilities: {
    label: 'Capabilities',
    description: 'Active platform capability domains',
    icon: 'Shield',
    category: 'subscription',
  },
  capabilityBreakdown: {
    label: 'Capability Breakdown',
    description: 'Per-domain enabled/disabled status from effective capabilities',
    icon: 'Shield',
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
const CONFIG_CHANGED_EVENT = 'subscription-display-config-changed';

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

    const loadFromStorage = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          const migratedFields = (parsed.visibleFields || DEFAULT_CONFIG.visibleFields)
            .map((f: string) => f === 'features' ? 'capabilities' : f);
          setConfig({
            ...DEFAULT_CONFIG,
            ...parsed,
            visibleFields: migratedFields as SubscriptionDisplayField[],
          });
        }
      } catch (error) {
        console.warn('[useSubscriptionDisplay] Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromStorage();

    // Listen for config changes from other hook instances (e.g. the options modal)
    const handleConfigChanged = (e: Event) => {
      if (e instanceof CustomEvent && e.detail?.storageKey === storageKey) {
        loadFromStorage();
      }
    };
    window.addEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged);

    return () => {
      window.removeEventListener(CONFIG_CHANGED_EVENT, handleConfigChanged);
    };
  }, [storageKey]);

  // Save config to localStorage and notify other hook instances
  const saveConfig = useCallback((newConfig: SubscriptionDisplayConfig) => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      setConfig(newConfig);
      window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { storageKey } }));
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
    setConfig(prev => {
      const newConfig = { ...prev, visibleFields: fields };
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
        window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { storageKey } }));
      }
      return newConfig;
    });
  }, [storageKey]);

  // Set layout mode
  const setLayout = useCallback((layout: SubscriptionDisplayConfig['layout']) => {
    setConfig(prev => {
      const newConfig = { ...prev, layout };
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
        window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { storageKey } }));
      }
      return newConfig;
    });
  }, [storageKey]);

  // Toggle upgrade prompt visibility
  const toggleUpgradePrompt = useCallback(() => {
    setConfig(prev => {
      const newConfig = { ...prev, showUpgradePrompt: !prev.showUpgradePrompt };
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
        window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { storageKey } }));
      }
      return newConfig;
    });
  }, [storageKey]);

  // Set upgrade prompt visibility directly (for batch save)
  const setShowUpgradePrompt = useCallback((show: boolean) => {
    setConfig(prev => {
      const newConfig = { ...prev, showUpgradePrompt: show };
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, JSON.stringify(newConfig));
        window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, { detail: { storageKey } }));
      }
      return newConfig;
    });
  }, [storageKey]);

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
    setShowUpgradePrompt,
    resetToDefaults,
    isFieldVisible,
  };
}
