'use client';

import { useState, useEffect, useCallback } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { metaIntegrationService, MetaStatus } from '@/services/MetaIntegrationService';
import { tiktokIntegrationService, TikTokStatus } from '@/services/TikTokIntegrationService';

export interface SocialCommerceConnections {
  socialLinks: Record<string, string> | null;
  metaStatus: MetaStatus | null;
  tiktokStatus: TikTokStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSocialCommerceConnections(tenantId: string | undefined): SocialCommerceConnections {
  const [socialLinks, setSocialLinks] = useState<Record<string, string> | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TikTokStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const [profileResult, metaResult, tiktokResult] = await Promise.allSettled([
          platformHomeService.getTenantProfile(tenantId),
          metaIntegrationService.getOAuthStatus(tenantId),
          tiktokIntegrationService.getOAuthStatus(tenantId),
        ]);

        if (cancelled) return;

        if (profileResult.status === 'fulfilled') {
          setSocialLinks((profileResult.value as any)?.social_links || null);
        }

        if (metaResult.status === 'fulfilled') {
          setMetaStatus(metaResult.value);
        } else {
          setMetaStatus(null);
        }

        if (tiktokResult.status === 'fulfilled') {
          setTiktokStatus(tiktokResult.value);
        } else {
          setTiktokStatus(null);
        }

        if (profileResult.status === 'rejected' && metaResult.status === 'rejected' && tiktokResult.status === 'rejected') {
          setError('Failed to load social commerce connections');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load connections');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();

    return () => { cancelled = true; };
  }, [tenantId, refreshKey]);

  return { socialLinks, metaStatus, tiktokStatus, loading, error, refresh };
}
