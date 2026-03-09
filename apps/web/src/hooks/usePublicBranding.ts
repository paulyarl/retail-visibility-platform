/**
 * Hook for accessing public platform branding
 * Provides platform name, logo, and other branding settings
 */

'use client';

import { useState, useEffect } from 'react';
import { publicBrandingService, PublicBrandingSettings } from '@/services/PublicBrandingService';

interface UsePublicBrandingResult {
  branding: PublicBrandingSettings | null;
  loading: boolean;
  error: string | null;
}

export function usePublicBranding(): UsePublicBrandingResult {
  const [branding, setBranding] = useState<PublicBrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchBranding = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await publicBrandingService.getPublicBrandingSettings();
        
        if (mounted) {
          setBranding(result);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load branding');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchBranding();

    return () => {
      mounted = false;
    };
  }, []);

  return { branding, loading, error };
}
