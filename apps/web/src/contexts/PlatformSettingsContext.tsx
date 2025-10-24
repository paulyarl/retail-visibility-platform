'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface PlatformSettings {
  platformName: string;
  platformDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/settings/branding');
      if (!res.ok) throw new Error('Failed to fetch platform settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching platform settings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set default values on error
      setSettings({
        platformName: 'Retail Visibility Platform',
        platformDescription: 'Manage your retail operations with ease',
        logoUrl: null,
        faviconUrl: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading, error, refetch: fetchSettings }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (context === undefined) {
    // Return default values instead of throwing during SSR/build
    return {
      settings: {
        platformName: 'Retail Visibility Platform',
        platformDescription: 'Manage your retail operations with ease',
        logoUrl: null,
        faviconUrl: null,
      },
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }
  return context;
}
