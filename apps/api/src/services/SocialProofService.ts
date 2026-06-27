/**
 * SocialProofService — Manages social mentions / UGC for tenant storefronts
 * Phase 3B: Social Proof / UGC Display
 *
 * Provides CRUD for social mentions (Instagram, TikTok posts mentioning products),
 * moderation (approve/reject), and public display queries.
 */

import { BaseService } from './BaseService';
import { generateSocialMentionId } from '../lib/id-generator';
import { logger } from '../logger';

export interface SocialMentionInput {
  tenantId: string;
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
  postedAt: Date;
}

export interface SocialMentionUpdate {
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  isFeatured?: boolean;
  adminNotes?: string;
}

class SocialProofService extends BaseService {
  private static instance: SocialProofService;

  private constructor() {
    super();
  }

  static getInstance(): SocialProofService {
    if (!SocialProofService.instance) {
      SocialProofService.instance = new SocialProofService();
    }
    return SocialProofService.instance;
  }

  /**
   * Create a new social mention
   */
  async createMention(input: SocialMentionInput) {
    try {
      const id = generateSocialMentionId(input.tenantId);

      return await this.prisma.social_mentions.create({
        data: {
          id,
          tenant_id: input.tenantId,
          product_id: input.productId || null,
          platform: input.platform,
          mention_id: input.mentionId,
          author_username: input.authorUsername,
          author_display_name: input.authorDisplayName || null,
          author_avatar_url: input.authorAvatarUrl || null,
          content: input.content,
          media_urls: input.mediaUrls || [],
          like_count: input.likeCount || 0,
          comment_count: input.commentCount || 0,
          share_count: input.shareCount || 0,
          view_count: input.viewCount || 0,
          posted_at: input.postedAt,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        logger.info('Social mention already exists', undefined, { platform: input.platform, mentionId: input.mentionId });
        return null;
      }
      logger.warn('SocialProofService.createMention failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get mentions for a tenant (admin view — all statuses)
   */
  async getMentions(
    tenantId: string,
    options?: {
      moderationStatus?: string;
      productId?: string;
      platform?: string;
      isFeatured?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { tenant_id: tenantId };
    if (options?.moderationStatus) where.moderation_status = options.moderationStatus;
    if (options?.productId) where.product_id = options.productId;
    if (options?.platform) where.platform = options.platform;
    if (options?.isFeatured !== undefined) where.is_featured = options.isFeatured;

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const [mentions, total] = await Promise.all([
      this.prisma.social_mentions.findMany({
        where,
        orderBy: { posted_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.social_mentions.count({ where }),
    ]);

    return { mentions, total };
  }

  /**
   * Get approved mentions for public storefront display
   */
  async getPublicMentions(
    tenantId: string,
    options?: {
      productId?: string;
      platform?: string;
      isFeatured?: boolean;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = {
      tenant_id: tenantId,
      moderation_status: 'approved',
    };
    if (options?.productId) where.product_id = options.productId;
    if (options?.platform) where.platform = options.platform;
    if (options?.isFeatured !== undefined) where.is_featured = options.isFeatured;

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [mentions, total] = await Promise.all([
      this.prisma.social_mentions.findMany({
        where,
        orderBy: [
          { is_featured: 'desc' },
          { posted_at: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.social_mentions.count({ where }),
    ]);

    return { mentions, total };
  }

  /**
   * Update moderation status of a mention
   */
  async updateMention(
    tenantId: string,
    mentionId: string,
    update: SocialMentionUpdate,
    moderatedBy?: string
  ) {
    const data: any = { updated_at: new Date() };
    if (update.moderationStatus) {
      data.moderation_status = update.moderationStatus;
      data.moderated_by = moderatedBy || null;
      data.moderated_at = new Date();
    }
    if (update.isFeatured !== undefined) data.is_featured = update.isFeatured;
    if (update.adminNotes !== undefined) data.admin_notes = update.adminNotes;

    return await this.prisma.social_mentions.updateMany({
      where: { id: mentionId, tenant_id: tenantId },
      data,
    });
  }

  /**
   * Delete a mention
   */
  async deleteMention(tenantId: string, mentionId: string) {
    return await this.prisma.social_mentions.deleteMany({
      where: { id: mentionId, tenant_id: tenantId },
    });
  }

  /**
   * Get moderation summary for a tenant
   */
  async getModerationSummary(tenantId: string) {
    const [pending, approved, rejected, featured] = await Promise.all([
      this.prisma.social_mentions.count({ where: { tenant_id: tenantId, moderation_status: 'pending' } }),
      this.prisma.social_mentions.count({ where: { tenant_id: tenantId, moderation_status: 'approved' } }),
      this.prisma.social_mentions.count({ where: { tenant_id: tenantId, moderation_status: 'rejected' } }),
      this.prisma.social_mentions.count({ where: { tenant_id: tenantId, is_featured: true } }),
    ]);

    return { pending, approved, rejected, featured, total: pending + approved + rejected };
  }
}

export const socialProofService = SocialProofService.getInstance();
export default SocialProofService;
