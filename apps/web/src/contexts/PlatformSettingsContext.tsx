'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { brandingSettingsService } from '@/services/BrandingSettingsSingletonService';

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
      // Use the singleton service instead of direct fetch to leverage caching
      const settings = await brandingSettingsService.getBrandingSettings();

      // Map PlatformSettings to the context's PlatformSettings interface
      if (settings) {
        const mappedSettings: PlatformSettings = {
          platformName: settings.platformName || 'Visible Shelf',
          platformDescription: 'Manage your retail operations with ease', // Default since not in PlatformSettings
          logoUrl: settings.logoUrl || null,
          faviconUrl: settings.faviconUrl || null,
        };
        setSettings(mappedSettings);
      } else {
        setSettings(null);
      }
    } catch (err) {
      console.error('Error fetching platform settings:', err);
      // Silently set default values on error (no error state)
      setSettings({
        platformName: 'Visible Shelf',
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
        platformName: 'Visible Shelf',
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
