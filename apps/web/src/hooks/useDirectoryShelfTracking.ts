/**
 * useDirectoryShelfTracking — Layer 3 engagement tracking hook for directory
 * SHELF surfaces (category / location / store-type / home browse pages).
 *
 * Mirrors useDirectoryPresenceTracking (which is entry-scoped) but posts to the
 * shelf event route: `POST /api/public/directory/surfaces/:surface/:ref/events`.
 *
 * Fires:
 * - shelf_viewed on mount
 * - session_heartbeat every 30s while visible (cumulative dwellMs)
 * - session_end via sendBeacon on beforeunload + visibilitychange
 *
 * Exposes CTA trackers:
 * - trackListingClick(detail?)  — shelf → entry click-through
 * - trackFilterApplied(detail)  — filter/sort/search change (detail = filter key)
 *
 * Migration 295 / AGENTS.md → "Directory Presence Traffic Surface".
 */

import { useCallback, useEffect, useRef } from 'react';
import directoryPresencePublicService, {
  type DirectoryShelfEventPayload,
  type DirectoryShelfSurface,
} from '@/services/DirectoryPresencePublicService';

interface UseDirectoryShelfTrackingOptions {
  surface: DirectoryShelfSurface;
  ref: string;
  active?: boolean;
  /** Serialized filter/sort state (e.g. `searchParams.toString()`). When it
   *  changes after mount, a `filter_applied` event is fired with it as detail. */
  filterSignature?: string;
}

export function useDirectoryShelfTracking({
  surface,
  ref,
  active = true,
  filterSignature,
}: UseDirectoryShelfTrackingOptions) {
  // Stable session id for the lifetime of the page mount.
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  );

  const sessionStartRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackEvent = useCallback(
    (event: DirectoryShelfEventPayload) => {
      if (!active || !ref) return;
      directoryPresencePublicService.trackShelfEvent(surface, ref, event).catch(() => {
        // fire-and-forget
      });
    },
    [surface, ref, active],
  );

  const sendSessionEnd = useCallback(() => {
    if (!active || !ref) return;
    const dwell = Date.now() - sessionStartRef.current;
    const events: DirectoryShelfEventPayload[] = [
      { sessionId: sessionIdRef.current, eventType: 'session_end', dwellMs: dwell },
    ];
    const url = `/api/public/directory/surfaces/${surface}/${encodeURIComponent(ref)}/events/batch`;

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    directoryPresencePublicService.trackShelfEventBatchKeepalive(surface, ref, events).catch(() => {
      // fire-and-forget
    });
  }, [surface, ref, active]);

  useEffect(() => {
    if (!active || !ref) return;
    sessionStartRef.current = Date.now();

    trackEvent({
      eventType: 'shelf_viewed',
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
  }, [surface, ref, active]);

  // filter_applied — fire when the serialized filter/sort state changes after
  // mount (the first value is the baseline, not a user action).
  const initialFilterRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !ref || filterSignature === undefined) return;
    if (initialFilterRef.current === null) {
      initialFilterRef.current = filterSignature;
      return;
    }
    if (initialFilterRef.current === filterSignature) return;
    initialFilterRef.current = filterSignature;
    trackEvent({
      eventType: 'filter_applied',
      sessionId: sessionIdRef.current,
      detail: (filterSignature || 'cleared').slice(0, 255),
    });
  }, [filterSignature, active, ref, trackEvent]);

  return {
    trackListingClick: useCallback(
      (detail?: string) =>
        trackEvent({ eventType: 'listing_clicked', sessionId: sessionIdRef.current, detail }),
      [trackEvent],
    ),
    trackFilterApplied: useCallback(
      (detail: string) =>
        trackEvent({ eventType: 'filter_applied', sessionId: sessionIdRef.current, detail }),
      [trackEvent],
    ),
  };
}