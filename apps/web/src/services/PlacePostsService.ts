/**
 * PlacePostsService — public read of directory-entry posts
 * (GET /api/public/tenants/:tenantId/place-posts). Mirrors PublicFlyerService:
 * PublicApiSingleton, no direct fetch().
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface PlacePost {
  id: string;
  body: string;
  media_url: string | null;
  pinned: boolean;
  published_at: string | null;
}

export interface PlacePostsPayload {
  enabled: boolean;
  posts: PlacePost[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

class PlacePostsService extends PublicApiSingleton {
  private static instance: PlacePostsService;

  private constructor() {
    super('place-posts');
    this.cacheTTL = 60 * 1000;
  }

  static getInstance(): PlacePostsService {
    if (!PlacePostsService.instance) PlacePostsService.instance = new PlacePostsService();
    return PlacePostsService.instance;
  }

  async getPosts(tenantId: string): Promise<PlacePostsPayload> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PlacePostsPayload>>(
      `/api/public/tenants/${tenantId}/place-posts`,
      { method: 'GET' },
      `place-posts-${tenantId}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.data ?? { enabled: false, posts: [] };
  }
}

export const placePostsService = PlacePostsService.getInstance();
