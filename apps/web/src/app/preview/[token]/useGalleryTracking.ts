/**
 * useGalleryTracking — engagement tracking hook for the diagnostic gallery.
 *
 * Fires engagement events to the gallery tracking API:
 * - gallery_opened on mount
 * - screenshot_viewed on slide change (with dwell on previous slide)
 * - carousel_next / carousel_prev on navigation
 * - cta_clicked on CTA click
 * - cta_hovered on CTA hover > 500ms
 * - session_heartbeat every 30s while visible (cumulative dwellMs)
 * - session_end via sendBeacon on beforeunload + visibilitychange
 *
 * Session ID: crypto.randomUUID() with fallback for non-secure contexts (G31).
 * sendBeacon payload matches batch endpoint schema (G19).
 * Fallback: fetch with keepalive: true if sendBeacon unavailable.
 *
 * Design doc: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §12 Sprint 5
 */

import { useEffect, useRef, useCallback } from 'react';
import diagnosticGalleryPublicService, {
  type GalleryEventPayload,
} from '@/services/DiagnosticGalleryPublicService';

interface UseGalleryTrackingOptions {
  token: string;
  active: boolean; // only track when gallery is active (not expired/invalid)
  totalScreenshots: number;
}

export function useGalleryTracking({ token, active, totalScreenshots }: UseGalleryTrackingOptions) {
  // Session ID — stable for the lifetime of the page mount.
  // crypto.randomUUID() requires a secure context (HTTPS); fall back to a
  // timestamp+random ID for HTTP (G31).
  const sessionIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  );

  // Track cumulative dwell time (ms) since session start — heartbeats carry
  // cumulative dwell, not per-interval (G27).
  const sessionStartRef = useRef<number>(Date.now());
  const currentSlideRef = useRef<number>(0);
  const slideStartRef = useRef<number>(Date.now());
  const ctaHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track event helper — fire-and-forget
  const trackEvent = useCallback(
    (event: GalleryEventPayload) => {
      if (!active) return;
      diagnosticGalleryPublicService.trackEvent(token, event).catch(() => {
        // fire-and-forget
      });
    },
    [token, active]
  );

  // Track batch helper — for sendBeacon fallback
  const trackBatch = useCallback(
    (events: GalleryEventPayload[]) => {
      if (!active || events.length === 0) return;
      diagnosticGalleryPublicService.trackEventBatch(token, events).catch(() => {
        // fire-and-forget
      });
    },
    [token, active]
  );

  // Send session_end via sendBeacon (or fetch keepalive fallback)
  const sendSessionEnd = useCallback(() => {
    if (!active) return;
    const dwell = Date.now() - sessionStartRef.current;
    const events = [
      {
        sessionId: sessionIdRef.current,
        eventType: 'session_end',
        dwellMs: dwell,
        clientWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
        clientHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
      },
    ];
    const payload = JSON.stringify({ events });

    const url = `/api/public/marketing/gallery/${encodeURIComponent(token)}/events/batch`;

    // Try sendBeacon first (works on tab close / page unload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    // Fallback: singleton-backed keepalive request
    diagnosticGalleryPublicService.trackEventBatchKeepalive(token, events).catch(() => {
      // fire-and-forget
    });
  }, [token, active]);

  // gallery_opened on mount
  useEffect(() => {
    if (!active) return;
    sessionStartRef.current = Date.now();
    slideStartRef.current = Date.now();

    trackEvent({
      eventType: 'gallery_opened',
      sessionId: sessionIdRef.current,
      clientWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
      clientHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    });

    // session_heartbeat every 30s while visible
    heartbeatIntervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const dwell = Date.now() - sessionStartRef.current;
      trackEvent({
        eventType: 'session_heartbeat',
        sessionId: sessionIdRef.current,
        dwellMs: dwell,
        clientWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
        clientHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
      });
    }, 30000);

    // session_end on beforeunload + visibilitychange (hidden)
    const handleBeforeUnload = () => sendSessionEnd();
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        sendSessionEnd();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (ctaHoverTimerRef.current) {
        clearTimeout(ctaHoverTimerRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Screenshot navigation — call this when the carousel slide changes
  const onSlideChange = useCallback(
    (newSlide: number, direction: 'next' | 'prev') => {
      if (!active) return;
      const now = Date.now();
      const dwellOnPrevious = now - slideStartRef.current;

      // Track screenshot_viewed for the previous slide (with dwell)
      if (currentSlideRef.current !== newSlide) {
        trackEvent({
          eventType: 'screenshot_viewed',
          sessionId: sessionIdRef.current,
          screenshotIndex: currentSlideRef.current,
          dwellMs: dwellOnPrevious,
        });

        // Track carousel navigation
        trackEvent({
          eventType: direction === 'next' ? 'carousel_next' : 'carousel_prev',
          sessionId: sessionIdRef.current,
          screenshotIndex: newSlide,
        });
      }

      currentSlideRef.current = newSlide;
      slideStartRef.current = now;
    },
    [active, trackEvent]
  );

  // CTA click
  const onCtaClick = useCallback(() => {
    trackEvent({
      eventType: 'cta_clicked',
      sessionId: sessionIdRef.current,
    });
  }, [trackEvent]);

  // CTA hover — fires after 500ms of hovering
  const onCtaHoverStart = useCallback(() => {
    if (ctaHoverTimerRef.current) {
      clearTimeout(ctaHoverTimerRef.current);
    }
    ctaHoverTimerRef.current = setTimeout(() => {
      trackEvent({
        eventType: 'cta_hovered',
        sessionId: sessionIdRef.current,
      });
    }, 500);
  }, [trackEvent]);

  const onCtaHoverEnd = useCallback(() => {
    if (ctaHoverTimerRef.current) {
      clearTimeout(ctaHoverTimerRef.current);
      ctaHoverTimerRef.current = null;
    }
  }, []);

  return {
    onSlideChange,
    onCtaClick,
    onCtaHoverStart,
    onCtaHoverEnd,
  };
}
