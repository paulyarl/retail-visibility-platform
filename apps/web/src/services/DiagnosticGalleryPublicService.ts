/**
 * DiagnosticGalleryPublicService — zero-auth, token-gated diagnostic gallery
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 *
 * All calls are token-scoped — caching is disabled (ttl 0). Responses follow
 * the double-wrap contract: unwrap with `result.data?.data ?? result.data`.
 *
 * Design doc: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §12 Sprint 5
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface GalleryScreenshot {
  id: string;
  fileName: string;
  signedUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
}

export interface GalleryData {
  expired: boolean;
  // Expired payload
  expiredAt?: string | null;
  businessName?: string | null;
  reactivationUrl?: string;
  // Active payload
  token?: {
    id: string;
    expiresAt: string | null;
    viewedAt: string | null;
  };
  campaign?: {
    id: string;
    businessName: string | null;
  };
  gallery?: {
    archetype: string | null;
    title: string | null;
    subtitle: string | null;
    frictionSummary: Record<string, any> | null;
    ctaLabel: string | null;
    ctaAmountCents: number | null;
  };
  screenshots?: GalleryScreenshot[];
  payUrl?: string;
}

export interface GalleryEventPayload {
  eventType: string;
  sessionId?: string;
  siblingCampaignId?: string;
  screenshotIndex?: number;
  screenshotId?: string;
  dwellMs?: number;
  clientWidth?: number;
  clientHeight?: number;
  referrer?: string;
}

// ─── Multi-Gallery types ─────────────────────────────────────────────────

export interface MultiGallerySiblingSection {
  campaignId: string;
  businessName: string | null;
  archetype: string;
  galleryTitle: string;
  gallerySubtitle: string;
  frictionSummary: Record<string, any>;
  ctaLabel: string;
  ctaAmountCents: number | null;
  estimatedFeeCents: number;
  isPrimarySibling: boolean;
  screenshots: GalleryScreenshot[];
}

export interface CompletedSiblingSection {
  campaignId: string;
  businessName: string | null;
  archetype: string;
  galleryTitle: string;
  campaignCategory: string;
  stage: string;
  dateDelivered: string | null;
  datePaid: string | null;
  isPrimarySibling: boolean;
  engagementCycle: number;
}

export interface MultiGalleryData {
  expired: boolean;
  // Expired payload
  expiredAt?: string | null;
  reactivationUrl?: string;
  // Active payload
  token?: {
    id: string;
    expiresAt: string | null;
    viewedAt: string | null;
  };
  prospectId?: string;
  businessName?: string | null;
  siblings?: MultiGallerySiblingSection[];
  completedSiblings?: CompletedSiblingSection[];
  payUrl?: string;
}

export class DiagnosticGalleryPublicService extends PublicApiSingleton {
  private static instance: DiagnosticGalleryPublicService;

  private constructor() {
    super('diagnostic-gallery-public', { ttl: 0 });
  }

  public static getInstance(): DiagnosticGalleryPublicService {
    if (!DiagnosticGalleryPublicService.instance) {
      DiagnosticGalleryPublicService.instance = new DiagnosticGalleryPublicService();
    }
    return DiagnosticGalleryPublicService.instance;
  }

  /**
   * Resolve a gallery token and return all data needed to render the page.
   */
  async getGallery(token: string): Promise<GalleryData> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/marketing/gallery/${encodeURIComponent(token)}`,
      {},
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to load gallery');
    }
    return result.data?.data ?? result.data;
  }

  /**
   * Track a single engagement event. Fire-and-forget — never throws.
   */
  async trackEvent(token: string, event: GalleryEventPayload): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/marketing/gallery/${encodeURIComponent(token)}/events`,
        {
          method: 'POST',
          body: JSON.stringify(event),
        },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget — analytics must never block UX
    }
  }

  /**
   * Track multiple engagement events in a batch. Fire-and-forget — never throws.
   */
  async trackEventBatch(token: string, events: GalleryEventPayload[]): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/marketing/gallery/${encodeURIComponent(token)}/events/batch`,
        {
          method: 'POST',
          body: JSON.stringify({ events }),
        },
        undefined,
        0,
      );
    } catch {
      // Fire-and-forget
    }
  }

  /**
   * Resolve a multi-gallery token and return all sibling gallery data.
   * Used by the MultiGalleryPage frontend component.
   */
  async getMultiGallery(token: string): Promise<MultiGalleryData> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/marketing/gallery/multi/${encodeURIComponent(token)}`,
      {},
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to load multi-gallery');
    }
    return result.data?.data ?? result.data;
  }
}

export default DiagnosticGalleryPublicService.getInstance();
