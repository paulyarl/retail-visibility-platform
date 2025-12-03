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
 */
router.get('/:productId/likes', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

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

    const likes = (product.metadata as any)?.likes || 0;
    const userLiked = false; // TODO: Implement user-specific like tracking

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
 */
router.post('/:productId/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
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

    // Check if user already liked
    const userIndex = metadata.likedBy.indexOf(userId);
    if (userIndex === -1) {
      // User hasn't liked yet, add like
      metadata.likes += 1;
      metadata.likedBy.push(userId);

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
 */
router.delete('/:productId/like', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
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

    // Check if user has liked
    if (metadata.likedBy && Array.isArray(metadata.likedBy)) {
      const userIndex = metadata.likedBy.indexOf(userId);
      if (userIndex !== -1) {
        // User has liked, remove like
        metadata.likes = Math.max(0, (metadata.likes || 0) - 1);
        metadata.likedBy.splice(userIndex, 1);

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
