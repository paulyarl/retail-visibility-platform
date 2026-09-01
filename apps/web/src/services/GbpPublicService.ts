/**
 * GbpPublicService — public Google Business Profile data for directory pages.
 * Extends PublicApiSingleton (no auth required).
 *
 * Wraps:
 *   - GET /api/public/directory/:slug/gbp-photos
 *   - GET /api/public/directory/:slug/gbp-posts
 *   - GET /api/public/directory/:slug/gbp-reviews
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface GbpPhoto {
  id: string;
  category: string | null;
  sourceUrl: string | null;
  googleUrl: string | null;
  description: string | null;
}

export interface GbpPhotosData {
  enabled: boolean;
  photos: GbpPhoto[];
}

export interface GbpPost {
  id: string;
  topicType: string | null;
  summary: string;
  mediaUrl: string | null;
  callToActionType: string | null;
  callToActionUrl: string | null;
  eventTitle: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  offerCouponCode: string | null;
  offerRedeemUrl: string | null;
  offerTerms: string | null;
  publishedAt: string | null;
}

export interface GbpPostsData {
  enabled: boolean;
  posts: GbpPost[];
}

export interface GbpReview {
  id: string;
  reviewerName: string;
  starRating: number;
  comment: string | null;
  reviewReply: string | null;
  createTime: string | null;
}

export interface GbpReviewsData {
  enabled: boolean;
  aggregateRating: number | null;
  totalReviewCount: number;
  businessName: string | null;
  reviews: GbpReview[];
}

class GbpPublicService extends PublicApiSingleton {
  private static instance: GbpPublicService;

  private constructor() {
    super('gbp-public', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): GbpPublicService {
    if (!GbpPublicService.instance) {
      GbpPublicService.instance = new GbpPublicService();
    }
    return GbpPublicService.instance;
  }

  /** GET /api/public/directory/:slug/gbp-photos */
  async getGbpPhotos(slug: string): Promise<GbpPhotosData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/${encodeURIComponent(slug)}/gbp-photos`,
        { method: 'GET' }
      );
      if (!result.success) return null;
      return result.data?.data ?? result.data;
    } catch {
      return null;
    }
  }

  /** GET /api/public/directory/:slug/gbp-posts */
  async getGbpPosts(slug: string): Promise<GbpPostsData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/${encodeURIComponent(slug)}/gbp-posts`,
        { method: 'GET' }
      );
      if (!result.success) return null;
      return result.data?.data ?? result.data;
    } catch {
      return null;
    }
  }

  /** GET /api/public/directory/:slug/gbp-reviews */
  async getGbpReviews(slug: string): Promise<GbpReviewsData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/${encodeURIComponent(slug)}/gbp-reviews`,
        { method: 'GET' }
      );
      if (!result.success) return null;
      return result.data?.data ?? result.data;
    } catch {
      return null;
    }
  }
}

const gbpPublicService = GbpPublicService.getInstance();
export default gbpPublicService;
