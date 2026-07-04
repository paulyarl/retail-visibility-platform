import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface SocialMention {
  id: string;
  tenant_id: string;
  product_id: string | null;
  platform: string;
  mention_id: string;
  author_username: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content: string;
  media_urls: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  posted_at: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  is_featured: boolean;
  admin_notes: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModerationSummary {
  pending: number;
  approved: number;
  rejected: number;
  featured: number;
  total: number;
}

class SocialProofServiceClass extends TenantApiSingleton {
  private static instance: SocialProofServiceClass;

  private constructor() {
    super('social-proof-singleton', { ttl: 2 * 60 * 1000 });
  }

  public static getInstance(): SocialProofServiceClass {
    if (!SocialProofServiceClass.instance) {
      SocialProofServiceClass.instance = new SocialProofServiceClass();
    }
    return SocialProofServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['social-proof-list-*', 'social-proof-summary-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`social-proof-list-${tenantId}`);
      this.invalidateCache(`social-proof-summary-${tenantId}`);
    }
  }

  async listMentions(
    tenantId: string,
    options?: { status?: string; platform?: string; featured?: boolean; limit?: number; offset?: number }
  ): Promise<{ mentions: SocialMention[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.platform) params.set('platform', options.platform);
    if (options?.featured !== undefined) params.set('featured', String(options.featured));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const qs = params.toString();
    const result = await this.makeDefaultRequest<{ mentions: SocialMention[]; total: number }>(
      `/api/tenants/${tenantId}/social-proof${qs ? `?${qs}` : ''}`,
      {},
      `social-proof-list-${tenantId}-${qs}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return { mentions: [], total: 0 };
    }
    const payload = (result.data as any).data ?? result.data;
    return { mentions: payload.mentions ?? [], total: payload.total ?? 0 };
  }

  async getSummary(tenantId: string): Promise<ModerationSummary | null> {
    const result = await this.makeDefaultRequest<ModerationSummary>(
      `/api/tenants/${tenantId}/social-proof/summary`,
      {},
      `social-proof-summary-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return null;
    }
    const payload = (result.data as any).data ?? result.data;
    return payload;
  }

  async createMention(
    tenantId: string,
    data: {
      productId?: string;
      platform: string;
      mentionId: string;
      authorUsername: string;
      authorDisplayName?: string;
      authorAvatarUrl?: string;
      content: string;
      mediaUrls?: string[];
      likeCount?: number;
      commentCount?: number;
      shareCount?: number;
      viewCount?: number;
      postedAt?: string;
    }
  ): Promise<SocialMention | null> {
    const result = await this.makeDefaultRequest<SocialMention>(
      `/api/tenants/${tenantId}/social-proof`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to create mention');
    }
    await this.invalidateServiceCaches(tenantId);
    const payload = (result.data as any).data ?? result.data;
    return payload;
  }

  async updateMention(
    tenantId: string,
    mentionId: string,
    data: {
      moderationStatus?: 'pending' | 'approved' | 'rejected';
      isFeatured?: boolean;
      adminNotes?: string;
    }
  ): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/social-proof/${mentionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to update mention');
    }
    await this.invalidateServiceCaches(tenantId);
    return true;
  }

  async deleteMention(tenantId: string, mentionId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/social-proof/${mentionId}`,
      {
        method: 'DELETE',
      },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to delete mention');
    }
    await this.invalidateServiceCaches(tenantId);
    return true;
  }
}

export const SocialProofService = SocialProofServiceClass.getInstance();
export default SocialProofService;
