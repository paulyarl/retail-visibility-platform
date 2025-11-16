import { Router } from 'express';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { prisma } from '../prisma';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

/**
 * POST /api/v1/tenants/:tenantId/items/:itemId/attach-image
 * Download and attach an image from Unsplash/Pexels to a product
 */
router.post('/:tenantId/items/:itemId/attach-image', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, itemId } = req.params;
    const { imageUrl, source, photographer, photographerUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        error: 'Missing imageUrl',
      });
    }

    // Verify item exists and belongs to tenant
    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        tenantId,
      },
    });

    if (!item) {
      return res.status(404).json({
        error: 'Item not found',
      });
    }

    // Download the image
    console.log(`[Image Attach] Downloading image from ${source}: ${imageUrl}`);
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error('Failed to download image');
    }

    const imageBuffer = await imageResponse.buffer();
    
    // Generate unique filename
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    
    // Save to uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'items');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, imageBuffer);

    // Create photo record
    const photo = await prisma.photoAsset.create({
      data: {
        tenantId,
        inventoryItemId: itemId,
        url: `/uploads/items/${filename}`,
        position: 0, // Set as primary photo
        alt: photographer ? `Photo by ${photographer} on ${source}` : item.name,
      },
    });

    console.log(`[Image Attach] Successfully attached image to item ${itemId} from ${source}`);

    res.json({
      success: true,
      photo: {
        id: photo.id,
        url: photo.url,
        alt: photo.alt,
      },
    });
  } catch (error: any) {
    console.error('[Image Attach] Error:', error);
    res.status(500).json({
      error: 'Failed to attach image',
      message: error.message,
    });
  }
});

export default router;
