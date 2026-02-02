'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import TenantSettingsSingleton, { 
  TenantInfo, 
  TenantProfile, 
  TenantTier, 
  FeaturedProductsLimits 
} from '@/lib/singletons/TenantSettingsSingleton';

// ====================
// CONTEXT
// ====================

interface TenantSettingsContextValue {
  singleton: TenantSettingsSingleton | null;
  actions: {
    fetchTenantInfo: () => Promise<TenantInfo>;
    fetchTenantProfile: () => Promise<TenantProfile>;
    fetchTenantTier: () => Promise<TenantTier>;
    fetchFeaturedProductsLimits: () => Promise<FeaturedProductsLimits>;
    fetchAllSettings: () => Promise<{
      info: TenantInfo;
      profile: TenantProfile;
      tier: TenantTier;
      featuredLimits: FeaturedProductsLimits;
    }>;
    updateTenantProfile: (updates: Partial<TenantProfile>) => Promise<TenantProfile>;
    invalidateAllCaches: () => Promise<void>;
    invalidateCache: (type: 'info' | 'profile' | 'tier' | 'featured-limits') => Promise<void>;
    getMetrics: () => any;
    resetMetrics: () => void;
  };
}

const TenantSettingsContext = createContext<TenantSettingsContextValue | undefined>(undefined);

// ====================
// PROVIDER
// ====================

export function TenantSettingsProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const tenantId = params?.tenantId as string | undefined;
  const [singleton, setSingleton] = useState<TenantSettingsSingleton | null>(null);

  useEffect(() => {
    if (tenantId) {
      const instance = TenantSettingsSingleton.getInstance(tenantId);
      setSingleton(instance);

      return () => {
        // Cleanup on unmount if needed
        // TenantSettingsSingleton.destroyInstance(tenantId);
      };
    }
  }, [tenantId]);

  const actions = {
    fetchTenantInfo: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.fetchTenantInfo();
    },
    fetchTenantProfile: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.fetchTenantProfile();
    },
    fetchTenantTier: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.fetchTenantTier();
    },
    fetchFeaturedProductsLimits: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.fetchFeaturedProductsLimits();
    },
    fetchAllSettings: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.fetchAllSettings();
    },
    updateTenantProfile: async (updates: Partial<TenantProfile>) => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.updateTenantProfile(updates);
    },
    invalidateAllCaches: async () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.invalidateAllCaches();
    },
    invalidateCache: async (type: 'info' | 'profile' | 'tier' | 'featured-limits') => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.invalidateCache(type);
    },
    getMetrics: () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.getMetrics();
    },
    resetMetrics: () => {
      if (!singleton) throw new Error('TenantSettingsSingleton not initialized');
      return singleton.resetMetrics();
    },
  };

  return (
    <TenantSettingsContext.Provider value={{ singleton, actions }}>
      {children}
    </TenantSettingsContext.Provider>
  );
}

// ====================
// HOOK
// ====================

export function useTenantSettings() {
  const context = useContext(TenantSettingsContext);
  if (!context) {
    throw new Error('useTenantSettings must be used within TenantSettingsProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOKS
// ====================

export function useTenantInfo() {
  const { actions } = useTenantSettings();
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await actions.fetchTenantInfo();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenant info');
      console.error('[useTenantInfo] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  return {
    info,
    loading,
    error,
    refresh: loadInfo,
  };
}

export function useTenantProfile() {
  const { actions } = useTenantSettings();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await actions.fetchTenantProfile();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenant profile');
      console.error('[useTenantProfile] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateProfile = async (updates: Partial<TenantProfile>) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await actions.updateTenantProfile(updates);
      setProfile(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tenant profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    error,
    refresh: loadProfile,
    updateProfile,
  };
}

export function useFeaturedProductsLimits() {
  const { actions } = useTenantSettings();
  const [limits, setLimits] = useState<FeaturedProductsLimits | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLimits = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await actions.fetchFeaturedProductsLimits();
      setLimits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured products limits');
      console.error('[useFeaturedProductsLimits] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLimits();
  }, []);

  return {
    limits,
    loading,
    error,
    refresh: loadLimits,
  };
}
