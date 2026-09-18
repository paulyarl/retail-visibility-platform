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

/** Shelf surfaces — public browse pages with no listing row (migration 295). */
export type DirectoryShelfSurface =
  | 'place_category'
  | 'place_city'
  | 'directory_category'
  | 'directory_location'
  | 'directory_store_type'
  | 'directory_home';

export type DirectoryShelfEventType =
  | 'shelf_viewed'
  | 'listing_clicked'
  | 'filter_applied'
  | 'session_heartbeat'
  | 'session_end';

export interface DirectoryShelfEventPayload {
  eventType: DirectoryShelfEventType;
  sessionId?: string;
  dwellMs?: number;
  referrer?: string;
  /** Event-specific detail — e.g. the filter key for `filter_applied`. */
  detail?: string;
}

/** Map a `?shelf=` ref (`<surface>/<type>/<slug>`) to an event surface key.
 *  e.g. `place/category/indian-grocery` → `place_category`,
 *       `directory/store-type/grocery` → `directory_store_type`,
 *       `directory/home` → `directory_home` (home has no slug). */
export function shelfRefToSurface(shelfRef: string): { surface: DirectoryShelfSurface; ref: string } | null {
  const parts = shelfRef.split('/');
  if (parts.length < 2) return null;
  const [surface, type, ...rest] = parts;
  if (surface !== 'place' && surface !== 'directory') return null;
  const key = `${surface}_${type.replace(/-/g, '_')}`;
  const allowed: DirectoryShelfSurface[] = [
    'place_category',
    'place_city',
    'directory_category',
    'directory_location',
    'directory_store_type',
    'directory_home',
  ];
  if (!allowed.includes(key as DirectoryShelfSurface)) return null;
  // Home has no slug — fall back to a stable sentinel ref.
  const ref = rest.join('/') || (key === 'directory_home' ? 'home' : '');
  if (!ref) return null;
  return { surface: key as DirectoryShelfSurface, ref };
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

  // ─── Shelf surface events (migration 295) ──────────────────────────────

  /** Track a single shelf engagement event. Fire-and-forget — never throws. */
  async trackShelfEvent(
    surface: DirectoryShelfSurface,
    ref: string,
    event: DirectoryShelfEventPayload,
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/surfaces/${surface}/${encodeURIComponent(ref)}/events`,
        { method: 'POST', body: JSON.stringify(event) },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget
    }
  }

  /** Track multiple shelf engagement events in a batch. Fire-and-forget. */
  async trackShelfEventBatch(
    surface: DirectoryShelfSurface,
    ref: string,
    events: DirectoryShelfEventPayload[],
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/surfaces/${surface}/${encodeURIComponent(ref)}/events/batch`,
        { method: 'POST', body: JSON.stringify({ events }) },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget
    }
  }

  /** Track a shelf batch with keepalive for page-unload beacons. */
  async trackShelfEventBatchKeepalive(
    surface: DirectoryShelfSurface,
    ref: string,
    events: DirectoryShelfEventPayload[],
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/directory/surfaces/${surface}/${encodeURIComponent(ref)}/events/batch`,
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

/**
 * Report a shelf → entry click-through. Cards already carry the shelf ref they
 * were rendered with (`shelfRef`), so they can self-report `listing_clicked`
 * without any callback plumbing. Fire-and-forget; no-ops without a valid ref.
 */
export function reportShelfListingClick(shelfRef: string | null | undefined): void {
  if (!shelfRef) return;
  const mapped = shelfRefToSurface(shelfRef);
  if (!mapped) return;
  void directoryPresencePublicService.trackShelfEvent(mapped.surface, mapped.ref, {
    eventType: 'listing_clicked',
  });
}
