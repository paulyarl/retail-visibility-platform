/**
 * useDirectoryPresenceTracking — Layer 3 engagement tracking hook for public
 * directory entry listings.
 *
 * Fires:
 * - listing_viewed on mount
 * - session_heartbeat every 30s while visible (cumulative dwellMs)
 * - session_end via sendBeacon on beforeunload + visibilitychange
 *
 * Exposes CTA trackers: claim_clicked, call_clicked, directions_clicked,
 * storefront_clicked, qr_scanned.
 *
 * Serves both entry surfaces:
 * - unclaimed seeds — /place/[slug] (claim_clicked)
 * - claimed tenants — /directory/[slug] (storefront_clicked / call_clicked)
 *
 * Mirrors useGalleryTracking (apps/web/src/app/preview/[token]/useGalleryTracking.ts).
 * Session ID: crypto.randomUUID() with a non-secure-context fallback.
 *
 * Design doc: docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §8.4
 */

import { useCallback, useEffect, useRef } from 'react';
import directoryPresencePublicService, {
  type DirectoryPresenceEventPayload,
} from '@/services/DirectoryPresencePublicService';

interface UseDirectoryPresenceTrackingOptions {
  slug: string;
  active: boolean;
}

export function useDirectoryPresenceTracking({ slug, active }: UseDirectoryPresenceTrackingOptions) {
  // Stable session id for the lifetime of the page mount. crypto.randomUUID()
  // requires a secure context (HTTPS); fall back for HTTP.
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  );

  // Cumulative dwell since session start — heartbeats carry cumulative dwell.
  const sessionStartRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackEvent = useCallback(
    (event: DirectoryPresenceEventPayload) => {
      if (!active || !slug) return;
      directoryPresencePublicService.trackEvent(slug, event).catch(() => {
        // fire-and-forget
      });
    },
    [slug, active],
  );

  const sendSessionEnd = useCallback(() => {
    if (!active || !slug) return;
    const dwell = Date.now() - sessionStartRef.current;
    const events: DirectoryPresenceEventPayload[] = [
      { sessionId: sessionIdRef.current, eventType: 'session_end', dwellMs: dwell },
    ];
    const url = `/api/public/directory/places/${encodeURIComponent(slug)}/events/batch`;

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    directoryPresencePublicService.trackEventBatchKeepalive(slug, events).catch(() => {
      // fire-and-forget
    });
  }, [slug, active]);

  useEffect(() => {
    if (!active || !slug) return;
    sessionStartRef.current = Date.now();

    trackEvent({
      eventType: 'listing_viewed',
      sessionId: sessionIdRef.current,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    });

    heartbeatIntervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      trackEvent({
        eventType: 'session_heartbeat',
        sessionId: sessionIdRef.current,
        dwellMs: Date.now() - sessionStartRef.current,
      });
    }, 30000);

    const handleBeforeUnload = () => sendSessionEnd();
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        sendSessionEnd();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slug]);

  return {
    trackClaimClick: useCallback(
      () => trackEvent({ eventType: 'claim_clicked', sessionId: sessionIdRef.current }),
      [trackEvent],
    ),
    trackCallClick: useCallback(
      () => trackEvent({ eventType: 'call_clicked', sessionId: sessionIdRef.current }),
      [trackEvent],
    ),
    trackDirectionsClick: useCallback(
      () => trackEvent({ eventType: 'directions_clicked', sessionId: sessionIdRef.current }),
      [trackEvent],
    ),
    trackStorefrontClick: useCallback(
      () => trackEvent({ eventType: 'storefront_clicked', sessionId: sessionIdRef.current }),
      [trackEvent],
    ),
    trackQrScan: useCallback(
      () => trackEvent({ eventType: 'qr_scanned', sessionId: sessionIdRef.current }),
      [trackEvent],
    ),
  };
}
