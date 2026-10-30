/**
 * SocialPostingService — frontend service for the Social Posting Suite
 * customer portal (SOCIAL_POSTING_SUITE_SPEC.md §7).
 * Wraps /api/customer/marketing/social/* endpoints.
 */
import { CustomerApiSingleton } from '../providers/base/CustomerApiSingleton';

export interface SocialSurface {
  id: string;
  targetRef: string;
  displayName: string | null;
  connectedAt: string;
  tokenExpired: boolean;
}

export interface SocialStatus {
  meta: {
    connected: boolean;
    reauthorizationRequired: boolean;
    scopesGranted: string[];
    scopesMissing: string[];
    surfaces: Record<string, SocialSurface>;
  };
}

export interface SocialPost {
  id: string;
  platform: string;
  body: string;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  permalink: string | null;
  last_error: string | null;
  created_at: string;
}

class SocialPostingService extends CustomerApiSingleton {
  private static instance: SocialPostingService;

  private constructor() {
    super('social-posting-service', { ttl: 60 * 1000 });
  }

  static getInstance(): SocialPostingService {
    if (!SocialPostingService.instance) {
      SocialPostingService.instance = new SocialPostingService();
    }
    return SocialPostingService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['social-posting-status', 'social-posting-posts', 'social-posting-media'];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  private errMsg(result: any, fallback: string): string {
    if (!result.error) return fallback;
    if (typeof result.error === 'string') return result.error;
    if (result.error?.message) return result.error.message;
    return fallback;
  }

  async getStatus(): Promise<SocialStatus> {
    const result = await this.makeDefaultRequest<any>('/api/customer/marketing/social/status', {}, 'social-posting-status');
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load status'));
    return result.data?.data ?? result.data;
  }

  async getPosts(): Promise<SocialPost[]> {
    const result = await this.makeDefaultRequest<any>('/api/customer/marketing/social/posts', {}, 'social-posting-posts');
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load posts'));
    return result.data?.data?.posts ?? [];
  }

  async createPost(input: {
    platform: string;
    body: string;
    linkUrl?: string;
    scheduledFor?: string;
    media?: Array<{ url: string; type: 'photo' | 'video'; alt?: string }>;
  }): Promise<SocialPost> {
    const result = await this.makeDefaultRequest<any>('/api/customer/marketing/social/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }, 'social-posting-create');
    if (!result.success) throw new Error(this.errMsg(result, 'Publish failed'));
    return result.data?.data?.post ?? result.data?.post;
  }

  async deletePost(id: string): Promise<void> {
    await this.makeDefaultRequest(`/api/customer/marketing/social/posts/${id}`, { method: 'DELETE' }, 'social-posting-delete');
  }

  async disconnectSurface(id: string): Promise<void> {
    await this.makeDefaultRequest(`/api/customer/marketing/social/meta/surfaces/${id}`, { method: 'DELETE' }, 'social-surface-delete');
  }
}

const socialPostingService = SocialPostingService.getInstance();
export default socialPostingService;
