/**
 * Social Proof / UGC Routes
 * Phase 3B: Social Proof / UGC Display
 *
 * - GET  /api/public/social-proof/:tenantId          — public approved mentions
 * - GET  /api/tenants/:tenantId/social-proof          — admin list (all statuses)
 * - POST /api/tenants/:tenantId/social-proof           — create mention
 * - PUT  /api/tenants/:tenantId/social-proof/:id       — update moderation
 * - DELETE /api/tenants/:tenantId/social-proof/:id     — delete mention
 * - GET  /api/tenants/:tenantId/social-proof/summary   — moderation summary
 */

import { Router } from 'express';
import { socialProofService } from '../services/SocialProofService';
import { logger } from '../logger';

const router = Router();

/**
 * Get public approved mentions for storefront display
 */
router.get('/public/social-proof/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { productId, platform, featured, limit, offset } = req.query;

    const result = await socialProofService.getPublicMentions(tenantId, {
      productId: productId as string | undefined,
      platform: platform as string | undefined,
      isFeatured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Social proof public list error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'fetch_failed', message: 'Failed to fetch social proof' });
  }
});

/**
 * Get all mentions for a tenant (admin view)
 */
router.get('/:tenantId/social-proof', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, productId, platform, featured, limit, offset } = req.query;

    const result = await socialProofService.getMentions(tenantId, {
      moderationStatus: status as string | undefined,
      productId: productId as string | undefined,
      platform: platform as string | undefined,
      isFeatured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Social proof admin list error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'fetch_failed', message: 'Failed to fetch mentions' });
  }
});

/**
 * Create a new social mention
 */
router.post('/:tenantId/social-proof', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      productId, platform, mentionId, authorUsername, authorDisplayName,
      authorAvatarUrl, content, mediaUrls, likeCount, commentCount,
      shareCount, viewCount, postedAt,
    } = req.body;

    if (!platform || !mentionId || !authorUsername || !content) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'platform, mentionId, authorUsername, and content are required',
      });
    }

    const mention = await socialProofService.createMention({
      tenantId,
      productId,
      platform,
      mentionId,
      authorUsername,
      authorDisplayName,
      authorAvatarUrl,
      content,
      mediaUrls,
      likeCount,
      commentCount,
      shareCount,
      viewCount,
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    });

    if (!mention) {
      return res.status(409).json({ success: false, error: 'duplicate', message: 'Mention already exists' });
    }

    res.json({ success: true, data: mention });
  } catch (error) {
    logger.error('Social proof create error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'create_failed', message: 'Failed to create mention' });
  }
});

/**
 * Update moderation status of a mention
 */
router.put('/:tenantId/social-proof/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { moderationStatus, isFeatured, adminNotes } = req.body;

    const result = await socialProofService.updateMention(tenantId, id, {
      moderationStatus,
      isFeatured,
      adminNotes,
    }, (req as any).user?.sub);

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Mention not found' });
    }

    res.json({ success: true, message: 'Mention updated' });
  } catch (error) {
    logger.error('Social proof update error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'update_failed', message: 'Failed to update mention' });
  }
});

/**
 * Delete a mention
 */
router.delete('/:tenantId/social-proof/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const result = await socialProofService.deleteMention(tenantId, id);

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Mention not found' });
    }

    res.json({ success: true, message: 'Mention deleted' });
  } catch (error) {
    logger.error('Social proof delete error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'delete_failed', message: 'Failed to delete mention' });
  }
});

/**
 * Get moderation summary
 */
router.get('/:tenantId/social-proof/summary', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const summary = await socialProofService.getModerationSummary(tenantId);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Social proof summary error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'summary_failed', message: 'Failed to get summary' });
  }
});

export default router;
