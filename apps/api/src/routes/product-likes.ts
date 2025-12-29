/**
 * Product Likes API Routes
 *
 * Handles product like/unlike functionality with persistence
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/products/:productId/likes
 * Get like status and count for a product
 * Query params: userId, sessionId (optional - for user-specific status)
 */
router.get('/:productId/likes', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId, sessionId } = req.query;

    // For now, we'll use a simple approach with a likes count in metadata
    // In production, you'd want a proper likes table with user tracking
    const product = await prisma.inventory_items.findUnique({
      where: { id: productId },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const metadata = (product.metadata as any) || {};
    const likes = metadata.likes || 0;
    
    // Check if current user/session has liked (if userId/sessionId provided)
    let userLiked = false;
    if ((userId || sessionId) && metadata.likedBy) {
      const likedBy = Array.isArray(metadata.likedBy) ? metadata.likedBy : [];
      userLiked = likedBy.some((entry: any) => {
        if (typeof entry === 'string') {
          // Legacy format - just userId
          return entry === userId;
        } else {
          // New format - { userId, sessionId }
          return entry.userId === userId || entry.sessionId === sessionId;
        }
      });
    }

    res.json({
      productId,
      likes,
      userLiked,
    });
  } catch (error: any) {
    console.error('[GET /api/products/:productId/likes] Error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

/**
 * POST /api/products/:productId/like
 * Like a product (increment count)
 * Request body: { userId?, sessionId? } - for user/session alignment
 */
router.post('/:productId/like', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId, sessionId } = req.body;

    // Require either userId or sessionId for tracking
    if (!userId && !sessionId) {
      return res.status(400).json({ error: 'userId or sessionId required for tracking' });
    }

    // Check if product exists
    const product = await prisma.inventory_items.findUnique({
      where: { id: productId },
      select: { id: true, metadata: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get current metadata
    const metadata = (product.metadata as any) || {};

    // Initialize likes tracking if it doesn't exist
    if (!metadata.likes) {
      metadata.likes = 0;
    }
    if (!metadata.likedBy) {
      metadata.likedBy = [];
    }

    // Check if user/session already liked
    const existingLike = metadata.likedBy.find((entry: any) => {
      if (typeof entry === 'string') {
        // Legacy format - just userId
        return entry === userId;
      } else {
        // New format - { userId, sessionId }
        return entry.userId === userId || entry.sessionId === sessionId;
      }
    });

    if (!existingLike) {
      // User/session hasn't liked yet, add like
      metadata.likes += 1;
      metadata.likedBy.push({ userId, sessionId, timestamp: new Date().toISOString() });

      // Update product metadata
      await prisma.inventory_items.update({
        where: { id: productId },
        data: {
          metadata: metadata,
        },
      });
    }

    res.json({
      productId,
      likes: metadata.likes,
      userLiked: true,
      action: 'liked',
    });
  } catch (error: any) {
    console.error('[POST /api/products/:productId/like] Error:', error);
    res.status(500).json({ error: 'Failed to like product' });
  }
});

/**
 * DELETE /api/products/:productId/like
 * Unlike a product (decrement count)
 * Request body: { userId?, sessionId? } - for user/session alignment
 */
router.delete('/:productId/like', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId, sessionId } = req.body;

    // Require either userId or sessionId for tracking
    if (!userId && !sessionId) {
      return res.status(400).json({ error: 'userId or sessionId required for tracking' });
    }

    // Check if product exists
    const product = await prisma.inventory_items.findUnique({
      where: { id: productId },
      select: { id: true, metadata: true },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get current metadata
    const metadata = (product.metadata as any) || {};

    // Check if user/session has liked
    if (metadata.likedBy && Array.isArray(metadata.likedBy)) {
      const likeIndex = metadata.likedBy.findIndex((entry: any) => {
        if (typeof entry === 'string') {
          // Legacy format - just userId
          return entry === userId;
        } else {
          // New format - { userId, sessionId }
          return entry.userId === userId || entry.sessionId === sessionId;
        }
      });

      if (likeIndex !== -1) {
        // User/session has liked, remove like
        metadata.likes = Math.max(0, (metadata.likes || 0) - 1);
        metadata.likedBy.splice(likeIndex, 1);

        // Update product metadata
        await prisma.inventory_items.update({
          where: { id: productId },
          data: {
            metadata: metadata,
          },
        });
      }
    }

    res.json({
      productId,
      likes: metadata.likes || 0,
      userLiked: false,
      action: 'unliked',
    });
  } catch (error: any) {
    console.error('[DELETE /api/products/:productId/like] Error:', error);
    res.status(500).json({ error: 'Failed to unlike product' });
  }
});

export default router;
