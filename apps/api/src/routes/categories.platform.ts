import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { categoryService } from '../services/CategoryService';
import { generateDsCatId } from '../lib/id-generator';
import * as path from 'path';
import * as fs from 'fs';

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
    const { prisma } = await import('../prisma');
    let name = String(req.body?.name || '').trim();
    const slug = String(req.body?.slug || '').trim();
    const googleCategoryId = String(req.body?.googleCategoryId || '').trim();
    let description = String(req.body?.description || '').trim();
    const iconEmoji = String(req.body?.icon_emoji || req.body?.iconEmoji || '').trim();
    
    if (!name || !slug) return res.status(400).json({ success: false, error: 'invalid_payload' });
    
    // Helper function to format slug-like text to Title Case
    const formatToTitleCase = (text: string) => {
      return text
        .replace(/_/g, ' ')      // Replace underscores with spaces
        .replace(/-/g, ' ')      // Replace hyphens with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    // If name looks like a slug (has underscores or is all lowercase with hyphens), format it properly
    if (name.includes('_') || (name === name.toLowerCase() && name.includes('-'))) {
      name = formatToTitleCase(name);
    }
    
    // If description looks like a slug (e.g., "cabinet_store business"), format it
    if (description) {
      // Check if description contains underscores or slug-like patterns
      if (description.includes('_') || /^[a-z_-]+\s+business$/i.test(description)) {
        // Extract the category part before " business"
        const categoryPart = description.replace(/\s+business$/i, '');
        const formattedCategory = formatToTitleCase(categoryPart);
        description = `${formattedCategory} - Business category for ${formattedCategory.toLowerCase()}`;
      }
    }
    
    // Create in platform_categories table
    const created = await prisma.platform_categories.create({
      data: {
        name,
        slug,
        google_category_id: googleCategoryId || slug,
        description: description || `Business category for ${name.toLowerCase()}`,
        icon_emoji: iconEmoji || '📦',  // Use provided emoji or default to box
        sort_order: 0,
        level: 0,
        is_active: true,
      },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    // Check for unique constraint violation on slug
    if (e?.code === 'P2002' || e?.message?.includes('Unique constraint')) {
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
        const existing = await prisma.directory_category.findFirst({
          where: {
            tenantId: 'platform',
            slug: category.slug,
          },
        });
        
        if (existing) {
          console.log(`[Quick Start] Skipping duplicate category: ${category.name}`);
          continue;
        }
        
        const created = await prisma.directory_category.create({
          data: {
            id: generateQsCatId(),
            tenantId: 'platform',
            name: category.name,
            slug: category.slug,
            updatedAt: new Date(),
            createdAt: new Date(),
          } as any,
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

// Bulk import endpoint for platform categories from external source
router.post('/categories/bulk-import', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source = 'default', categories: externalCategories } = req.body;
    const { prisma } = await import('../prisma');
    const { generateQsCatId } = await import('../lib/id-generator');
    
    let categoriesToImport: any[] = [];
    
    // Load from different sources
    if (source === 'default' || source === 'file') {
      // Load from seed file
      const seedData = await import('../data/platform-categories-seed.json');
      const rawData: any = seedData.default || seedData;
      // Handle both array format (old) and object format (new)
      categoriesToImport = Array.isArray(rawData) ? rawData : (rawData.categories || []);
    } else if (source === 'custom' && externalCategories) {
      // Use provided categories from request body
      categoriesToImport = externalCategories;
    } else {
      return res.status(400).json({ success: false, error: 'invalid_source' });
    }
    
    const results = {
      total: categoriesToImport.length,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };
    
    // Import categories
    for (const category of categoriesToImport) {
      try {
        // Check if category already exists
        const existing = await prisma.directory_category.findFirst({
          where: {
            tenantId: 'platform',
            slug: category.slug,
          },
        });
        
        if (existing) {
          console.log(`[Bulk Import] Skipping duplicate category: ${category.name}`);
          results.skipped++;
          results.details.push({
            name: category.name,
            status: 'skipped',
            reason: 'duplicate_slug',
          });
          continue;
        }
        
        // Create category
        const created = await prisma.directory_category.create({
          data: {
            id: generateQsCatId(),
            tenantId: 'platform',
            name: category.name,
            slug: category.slug,
            updatedAt: new Date(),
            createdAt: new Date(),
          } as any,
        });
        
        results.created++;
        results.details.push({
          name: category.name,
          status: 'created',
          id: created.id,
        });
      } catch (error: any) {
        console.error(`[Bulk Import] Failed to create category ${category.name}:`, error);
        results.errors++;
        results.details.push({
          name: category.name,
          status: 'error',
          error: error.message,
        });
      }
    }
    
    // Fetch all platform categories to return
    const allCategories = await categoryService.getTenantCategories('platform');
    
    return res.json({
      success: true,
      data: allCategories,
      import_results: results,
    });
  } catch (e: any) {
    console.error('[Bulk Import] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

// GET /api/platform/categories/gbp-seed - Get GBP seed data for search
// Note: Requires authentication but not admin - any logged-in user can search categories
router.get('/categories/gbp-seed', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[GBP Seed] Request received from user:', (req.user as any)?.id);
    
    // Load the seed file
    const seedPath = path.join(__dirname, '../data/platform-categories-seed.json');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
    
    const categories = Array.isArray(seedData) ? seedData : (seedData.categories || []);
    console.log('[GBP Seed] Returning', categories.length, 'categories');
    
    return res.json({
      success: true,
      categories,
    });
  } catch (e: any) {
    console.error('[GBP Seed] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
