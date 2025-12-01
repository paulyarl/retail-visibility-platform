import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { categoryService } from '../services/CategoryService';

const router = Router();

router.get('/categories', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const categories = await categoryService.getTenantCategories('platform');
    return res.json({ success: true, data: categories });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

router.post('/categories', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = String(req.body?.slug || '').trim();
    if (!name || !slug) return res.status(400).json({ success: false, error: 'invalid_payload' });
    const created = await categoryService.createTenantCategory('platform', { name, slug });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    // Check for unique constraint violation on slug
    if (e?.message?.includes('Unique constraint failed') && e?.message?.includes('slug')) {
      return res.status(409).json({ success: false, error: 'duplicate_slug', message: `A category with slug "${req.body?.slug}" already exists` });
    }
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

router.patch('/categories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'invalid_payload' });
    const updated = await categoryService.updateDirectoryCategory('platform', id, { name });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

router.delete('/categories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await categoryService.softDeleteDirectoryCategory('platform', id);
    return res.status(204).send();
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

// Quick start endpoint for platform categories (for frontend compatibility)
router.post('/categories/quick-start', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { categoryCount = 12 } = req.body;
    
    // Import the quick start logic
    const { generateQuickStartCategories } = await import('../lib/quick-start-categories');
    const { prisma } = await import('../prisma');
    const { generateQsCatId } = await import('../lib/id-generator');
    
    // Get all available categories
    const allCategories = await generateQuickStartCategories();
    
    // Limit to requested count
    const categoriesToCreate = allCategories.slice(0, Math.min(categoryCount, allCategories.length));
    
    // Create categories for the "platform" tenant
    const createdCategories = [];
    for (const category of categoriesToCreate) {
      try {
        // Check if category already exists
        const existing = await prisma.directoryCategory.findFirst({
          where: {
            tenantId: 'platform',
            slug: category.slug,
          },
        });
        
        if (existing) {
          console.log(`[Quick Start] Skipping duplicate category: ${category.name}`);
          continue;
        }
        
        const created = await prisma.directoryCategory.create({
          data: {
            id: generateQsCatId(),
            tenantId: 'platform',
            name: category.name,
            slug: category.slug,
            updatedAt: new Date(),
          },
        });
        createdCategories.push(created);
      } catch (error: any) {
        console.error(`Failed to create category ${category.name}:`, error);
      }
    }
    
    // Fetch all platform categories to return
    const categories = await categoryService.getTenantCategories('platform');
    
    return res.json({ success: true, data: categories, categoriesCreated: createdCategories.length });
  } catch (e: any) {
    console.error('[Quick Start Categories] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
