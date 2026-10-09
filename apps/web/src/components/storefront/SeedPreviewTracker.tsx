'use client';

/**
 * SeedPreviewTracker — B-3 page-view tracking for seed_preview demo
 * storefronts (SEED_PREVIEW_STOREFRONT_SPEC §6b). Mounted only when
 * tenantInfo.isDemo so real tenants emit nothing here. Mounted on both
 * preview surfaces: /shops/[slug] and /tenant/[slug].
 *
 * Posts to the shelf event route with surface='seed_preview'; the API
 * resolves the slug to the preview tenant (tenant_id) and drops the event
 * if the slug isn't a live seed_preview demo.
 *
 * Fires: listing_viewed on mount, session_heartbeat every 30s while visible,
 * session_end via sendBeacon. All fire-and-forget — tracking never affects
 * storefront rendering.
 */

import { useEffect, useRef } from 'react';
import directoryPresencePublicService, {
  type DirectoryShelfEventPayload,
} from '@/services/DirectoryPresencePublicService';

export default function SeedPreviewTracker({ slug }: { slug: string }) {
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  );
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!slug) return;
    sessionStartRef.current = Date.now();

    const track = (event: DirectoryShelfEventPayload) => {
      directoryPresencePublicService
        .trackShelfEvent('seed_preview', slug, event)
        .catch(() => {
          // fire-and-forget
        });
    };

    const sendSessionEnd = () => {
      const events: DirectoryShelfEventPayload[] = [
        { sessionId: sessionIdRef.current, eventType: 'session_end', dwellMs: Date.now() - sessionStartRef.current },
      ];
      const url = `/api/public/directory/surfaces/seed_preview/${encodeURIComponent(slug)}/events/batch`;
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
      directoryPresencePublicService.trackShelfEventBatchKeepalive('seed_preview', slug, events).catch(() => {
        // fire-and-forget
      });
    };

    track({
      eventType: 'listing_viewed',
      sessionId: sessionIdRef.current,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    });

    const heartbeat = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      track({
        eventType: 'session_heartbeat',
        sessionId: sessionIdRef.current,
        dwellMs: Date.now() - sessionStartRef.current,
      });
    }, 30000);

    const handleBeforeUnload = () => sendSessionEnd();
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') sendSessionEnd();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [slug]);

  return null;
}
