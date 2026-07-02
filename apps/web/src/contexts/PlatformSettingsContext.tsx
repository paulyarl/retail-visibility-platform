'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { publicBrandingService } from '@/services/PublicBrandingService';
import { adminSettingsService } from '@/services/AdminSettingsService';
import { useAuth } from './AuthContext';

interface PlatformSettings {
  platformName: string;
  platformDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  // Payment settings
  minimumPaymentAmount?: {
    amount: number; // in cents
    currency: string;
    displayAmount: string; // formatted for display
  };
  platformFeePercentage?: number;
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // const isAuthenticated = false;
  // const authLoading = false;

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Only use public branding service for platform settings
      const settingsData = await publicBrandingService.getPublicBrandingSettings();
      // console.log('[PlatformSettingsProvider] Using public branding service');

      // Map PlatformSettings to the context's PlatformSettings interface
      if (settingsData) {
        // console.log('[PlatformSettingsProvider] Raw settings data:', settingsData);
        
        // Try to fetch payment settings from admin service
        let paymentSettings = null;
        let paymentData = null;
        try {
          if (isAuthenticated){
            paymentData = await adminSettingsService.getPaymentSettings();
            if (paymentData) {
              paymentSettings = paymentData.minimumPaymentAmount;
            }
          }
        } catch (paymentError) {
          console.warn('[PlatformSettingsProvider] Failed to fetch payment settings, using defaults:', paymentError);
        }

        const mappedSettings: PlatformSettings = {
          platformName: settingsData.platformName || 'Visible Shelf',
          platformDescription: settingsData.platformDescription || 'Manage your retail operations with ease',
          logoUrl: settingsData.logoUrl || null,
          faviconUrl: settingsData.faviconUrl || null,
          // Use payment settings from API or fallback to defaults
          minimumPaymentAmount: paymentSettings || {
            amount: 200, // $2.00 in cents
            currency: 'USD',
            displayAmount: '$2.00',
          },
          platformFeePercentage: paymentData?.platformFeePercentage ?? 3.0,
        };
        // console.log('[PlatformSettingsProvider] Mapped settings:', mappedSettings);
        setSettings(mappedSettings);
      } else {
        console.warn('[PlatformSettingsProvider] No public branding settings found, using defaults');
        setSettings(null);
      }
    } catch (error) {
      console.error('[PlatformSettingsProvider] Failed to load public branding settings:', error);
      setError('Failed to load platform settings');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchSettings();
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return null;
  }

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
