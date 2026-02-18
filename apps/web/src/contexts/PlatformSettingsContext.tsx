'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { brandingSettingsService } from '@/services/BrandingSettingsSingletonService';
import { publicBrandingService } from '@/services/PublicBrandingService';

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
      
      // Try public service first (works for everyone)
      let settingsData = await publicBrandingService.getPublicBrandingSettings();
      
      // If public service fails (404 or other error), try authenticated service
      if (!settingsData) {
        try {
          settingsData = await brandingSettingsService.getBrandingSettings();
          console.log('[PlatformSettingsProvider] Using authenticated service as fallback');
        } catch (authError) {
          // Auth service also failed, use defaults
          console.warn('[PlatformSettingsProvider] Both services failed, using defaults');
          settingsData = null;
        }
      } else {
        console.log('[PlatformSettingsProvider] Using public branding service');
      }

      // Map PlatformSettings to the context's PlatformSettings interface
      if (settingsData) {
        const mappedSettings: PlatformSettings = {
          platformName: settingsData.platformName || 'Visible Shelf',
          platformDescription: settingsData.platformDescription || 'Manage your retail operations with ease',
          logoUrl: settingsData.logoUrl || null,
          faviconUrl: settingsData.faviconUrl || null,
        };
        setSettings(mappedSettings);
      } else {
        // Use default settings when both services fail
        setSettings({
          platformName: 'Visible Shelf',
          platformDescription: 'Manage your retail operations with ease',
          logoUrl: null,
          faviconUrl: null,
        });
      }
    } catch (err) {
      console.error('Error fetching platform settings:', err);
      // Use default settings on error
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
