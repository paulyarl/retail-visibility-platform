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

// Quick start endpoint for platform categories (aligned with tenant quick-start)
router.post('/categories/quick-start', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { businessType = 'general', categoryCount = 15 } = req.body;
    const { prisma } = await import('../prisma');
    const { generateQsCatId } = await import('../lib/id-generator');
    
    // Use the same taxonomy branches as tenant quick-start
    const taxonomyBranches: Record<string, string[][]> = {
      grocery: [
        ['Food, Beverages & Tobacco', 'Food Items'],
        ['Food, Beverages & Tobacco', 'Beverages'],
      ],
      fashion: [
        ['Apparel & Accessories', 'Clothing'],
        ['Apparel & Accessories', 'Shoes'],
        ['Apparel & Accessories', 'Clothing Accessories'],
      ],
      electronics: [
        ['Electronics', 'Computers'],
        ['Electronics', 'Audio'],
        ['Electronics', 'Cameras & Optics'],
        ['Electronics', 'Communications'],
      ],
      home_garden: [
        ['Home & Garden', 'Home Decor'],
        ['Home & Garden', 'Kitchen & Dining'],
        ['Home & Garden', 'Furniture'],
        ['Home & Garden', 'Lawn & Garden'],
      ],
      health_beauty: [
        ['Health & Beauty', 'Personal Care'],
        ['Health & Beauty', 'Health Care'],
        ['Health & Beauty', 'Bath & Body'],
      ],
      sports_outdoors: [
        ['Sporting Goods', 'Exercise & Fitness'],
        ['Sporting Goods', 'Outdoor Recreation'],
        ['Sporting Goods', 'Athletics'],
      ],
      toys_games: [
        ['Toys & Games', 'Toys'],
        ['Toys & Games', 'Games'],
        ['Toys & Games', 'Puzzles'],
      ],
      automotive: [
        ['Vehicles & Parts', 'Vehicle Parts & Accessories'],
        ['Vehicles & Parts', 'Motor Vehicle Care & Cleaning'],
      ],
      books_media: [
        ['Media', 'Books'],
        ['Media', 'Music & Sound Recordings'],
        ['Media', 'DVDs & Videos'],
      ],
      pet_supplies: [
        ['Animals & Pet Supplies', 'Pet Supplies'],
        ['Animals & Pet Supplies', 'Pet Food'],
      ],
      office_supplies: [
        ['Office Supplies', 'General Office Supplies'],
        ['Office Supplies', 'Paper Products'],
        ['Office Supplies', 'Presentation Supplies'],
      ],
      jewelry: [
        ['Apparel & Accessories', 'Jewelry'],
        ['Apparel & Accessories', 'Watches'],
      ],
      baby_kids: [
        ['Baby & Toddler', 'Baby Care'],
        ['Baby & Toddler', 'Baby Toys & Activity Equipment'],
        ['Baby & Toddler', 'Baby Transport'],
      ],
      arts_crafts: [
        ['Arts & Entertainment', 'Hobbies & Creative Arts'],
        ['Arts & Entertainment', 'Party & Celebration'],
      ],
      hardware_tools: [
        ['Hardware', 'Building Materials'],
        ['Hardware', 'Power & Hand Tools'],
        ['Hardware', 'Plumbing'],
      ],
      furniture: [
        ['Furniture', 'Living Room Furniture'],
        ['Furniture', 'Bedroom Furniture'],
        ['Furniture', 'Office Furniture'],
      ],
      restaurant: [
        ['Food, Beverages & Tobacco', 'Food Items', 'Prepared Foods'],
        ['Food, Beverages & Tobacco', 'Beverages'],
      ],
      pharmacy: [
        ['Health & Beauty', 'Health Care'],
        ['Health & Beauty', 'Personal Care'],
        ['Health & Beauty', 'Vitamins & Supplements'],
      ],
      general: [
        ['Home & Garden'],
        ['Health & Beauty'],
        ['Sporting Goods'],
        ['Toys & Games'],
        ['Office Supplies'],
        ['Arts & Entertainment'],
      ],
    };
    
    // Fetch existing categories to avoid duplicates
    const existingCategories = await prisma.directory_category.findMany({
      where: { tenantId: 'platform' },
      select: { name: true, slug: true },
    });
    
    const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
    
    // Import Google taxonomy functions
    const { selectRandomFromBranch, getCategoryById } = await import('../lib/google/taxonomy');
    
    // Use hierarchical branch-based generation
    const branches = taxonomyBranches[businessType] || taxonomyBranches.general;
    let hierarchicalCategories: Array<{ node: any; name: string }> = [];
    
    console.log(`[Platform Quick Start] Using hierarchical branch generation for ${businessType}`);
    
    // Distribute category count across branches
    const perBranch = Math.ceil(categoryCount / branches.length);
    
    for (const branch of branches) {
      const branchCategories = selectRandomFromBranch(branch, perBranch, {
        minDepth: 1,
        maxDepth: 3,
        diversify: true,
      });
      
      // Use the last part of the path as the friendly name
      hierarchicalCategories.push(...branchCategories.map(node => ({
        node,
        name: node.path[node.path.length - 1],
      })));
    }
    
    // Trim to requested count
    hierarchicalCategories = hierarchicalCategories.slice(0, categoryCount);
    
    // Filter out duplicates
    const categoriesToCreate = hierarchicalCategories.filter(cat => {
      const nameExists = existingNames.has(cat.name.toLowerCase());
      if (nameExists) {
        console.log(`[Platform Quick Start] Skipping duplicate category: "${cat.name}"`);
      }
      return !nameExists;
    });
    
    if (categoriesToCreate.length === 0) {
      const categories = await categoryService.getTenantCategories('platform');
      return res.json({
        success: true,
        data: categories,
        categoriesCreated: 0,
        duplicatesSkipped: hierarchicalCategories.length,
        message: 'All categories already exist. No new categories were created.',
      });
    }
    
    console.log(`[Platform Quick Start] Creating ${categoriesToCreate.length} new categories (${hierarchicalCategories.length - categoriesToCreate.length} duplicates skipped)`);
    
    // Create categories with Google taxonomy alignment
    const createdCategories = [];
    for (const cat of categoriesToCreate) {
      try {
        const googleCategoryId = cat.node.id;
        const categoryName = cat.name;
        
        console.log(`[Platform Quick Start] Creating category: "${categoryName}" (${cat.node.path.join(' > ')})`);
        
        const created = await prisma.directory_category.create({
          data: {
            id: generateQsCatId(),
            tenantId: 'platform',
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            googleCategoryId,
            isActive: true,
            updatedAt: new Date(),
            createdAt: new Date(),
          } as any,
        });
        createdCategories.push(created);
      } catch (error: any) {
        console.error(`[Platform Quick Start] Failed to create category ${cat.name}:`, error);
      }
    }
    
    console.log(`[Platform Quick Start] Created ${createdCategories.length} categories for platform`);
    
    // Fetch all platform categories to return
    const categories = await categoryService.getTenantCategories('platform');
    
    const duplicatesSkipped = hierarchicalCategories.length - categoriesToCreate.length;
    const responseMessage = duplicatesSkipped > 0
      ? `Created ${createdCategories.length} new categories. Skipped ${duplicatesSkipped} duplicate${duplicatesSkipped === 1 ? '' : 's'}.`
      : undefined;
    
    return res.json({
      success: true,
      data: categories,
      categoriesCreated: createdCategories.length,
      duplicatesSkipped,
      ...(responseMessage && { message: responseMessage }),
    });
  } catch (e: any) {
    console.error('[Platform Quick Start] Error:', e);
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
