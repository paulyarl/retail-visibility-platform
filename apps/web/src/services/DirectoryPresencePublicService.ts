/**
 * DirectoryPresencePublicService — zero-auth, slug-gated engagement tracking
 * for public seed listings (/place/[slug]).
 *
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials). Caching is
 * disabled on every method (ttl 0). All calls are fire-and-forget — analytics
 * must never block UX.
 *
 * Wraps:
 *   - POST /api/public/directory/places/:slug/events
 *   - POST /api/public/directory/places/:slug/events/batch
 *
 * Design doc: docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §8.4
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export type DirectoryPresenceEventType =
  | 'listing_viewed'
  | 'claim_clicked'
  | 'call_clicked'
  | 'directions_clicked'
  /** Claimed-entry CTA — /directory/[slug] "Visit Storefront". */
  | 'storefront_clicked'
  /** Reserved / forward-compatibility only — real QR scans are recorded
   *  server-side in `qr_scan_events` via the /qr/claim and /r/seed redirects. */
  | 'qr_scanned'
  | 'session_heartbeat'
  | 'session_end';

export interface DirectoryPresenceEventPayload {
  eventType: DirectoryPresenceEventType;
  sessionId?: string;
  dwellMs?: number;
  referrer?: string;
}

export class DirectoryPresencePublicService extends PublicApiSingleton {
  private static instance: DirectoryPresencePublicService;

  private constructor() {
    super('directory-presence-public', { ttl: 0 });
  }

  public static getInstance(): DirectoryPresencePublicService {
    if (!DirectoryPresencePublicService.instance) {
      DirectoryPresencePublicService.instance = new DirectoryPresencePublicService();
    }
    return DirectoryPresencePublicService.instance;
  }

  /** Track a single engagement event. Fire-and-forget — never throws. */
  async trackEvent(slug: string, event: DirectoryPresenceEventPayload): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/places/${encodeURIComponent(slug)}/events`,
        { method: 'POST', body: JSON.stringify(event) },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget — analytics must never block UX
    }
  }

  /** Track multiple engagement events in a batch. Fire-and-forget. */
  async trackEventBatch(slug: string, events: DirectoryPresenceEventPayload[]): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/places/${encodeURIComponent(slug)}/events/batch`,
        { method: 'POST', body: JSON.stringify({ events }) },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget
    }
  }

  /** Track batch with keepalive for page-unload beacons. */
  async trackEventBatchKeepalive(slug: string, events: DirectoryPresenceEventPayload[]): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/places/${encodeURIComponent(slug)}/events/batch`,
        { method: 'POST', body: JSON.stringify({ events }), keepalive: true },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget
    }
  }
}

const directoryPresencePublicService = DirectoryPresencePublicService.getInstance();
export default directoryPresencePublicService;
