import { Router } from 'express';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY, CategoryNode } from '../lib/google/taxonomy';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

function collectNodes(nodes: CategoryNode[], opts?: { parentId?: string; level?: number }) {
  const out: Array<{ categoryId: string; categoryPath: string; parentId: string | null; level: number }>= [];
  const level = (opts?.level ?? 0);
  for (const node of nodes) {
    const parentId = opts?.parentId ?? null;
    out.push({
      categoryId: node.id,
      categoryPath: node.path.join(' > '),
      parentId,
      level,
    });
    // Taxonomy is flat - no children property
  }
  return out;
}

/**
 * GET /admin/taxonomy
 * Get all Google Product Taxonomy categories from google_taxonomy_list table
 * Used by /settings/admin/categories page
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, level, limit = '1000', offset = '0' } = req.query;
    
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    
    let where: any = { is_active: true };
    
    // Filter by level if provided
    if (level) {
      where.level = parseInt(level as string, 10);
    }
    
    // Search by category_path if provided
    if (search && typeof search === 'string') {
      where.category_path = { contains: search, mode: 'insensitive' };
    }
    
    const categories = await prisma.google_taxonomy_list.findMany({
      where,
      orderBy: [
        { level: 'asc' },
        { category_path: 'asc' },
      ],
      take: limitNum,
      skip: offsetNum,
    });
    
    const total = await prisma.google_taxonomy_list.count({ where });
    
    res.json({
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        category_id: cat.category_id,
        name: cat.category_path.split(' > ').pop() || cat.category_path,
        full_path: cat.category_path,
        level: cat.level,
        parent_id: cat.parent_id,
        is_active: cat.is_active,
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    logger.error('[GET /admin/taxonomy] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'failed_to_get_taxonomy' });
  }
});

/**
 * GET /admin/taxonomy/:id
 * Get a single Google taxonomy category by ID
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await prisma.google_taxonomy_list.findFirst({
      where: {
        OR: [
          { id },
          { category_id: id },
        ],
      },
    });
    
    if (!category) {
      return res.status(404).json({ success: false, error: 'category_not_found' });
    }
    
    res.json({
      success: true,
      data: {
        id: category.id,
        category_id: category.category_id,
        name: category.category_path.split(' > ').pop() || category.category_path,
        full_path: category.category_path,
        level: category.level,
        parent_id: category.parent_id,
        is_active: category.is_active,
      },
    });
  } catch (error) {
    logger.error('[GET /admin/taxonomy/:id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'failed_to_get_taxonomy_category' });
  }
});

async function upsertInBatches(items: any[], batchSize = 200) {
  console.log(`[upsertInBatches] Processing ${items.length} items in batches of ${batchSize}`);
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`[upsertInBatches] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)} with ${batch.length} items`);
    
    try {
      await prisma.$transaction(
        batch.map((it) =>
          prisma.google_taxonomy_list.upsert({
            where: { category_id: it.categoryId },
            create: {
              category_id: it.categoryId,
              category_path: it.categoryPath,
              parent_id: it.parentId,
              level: it.level,
              is_active: true,
              version: '2024-09',
            } as any,
            update: {
              category_path: it.categoryPath,
              parent_id: it.parentId,
              level: it.level,
              is_active: true,
              version: '2024-09',
            },
          })
        )
      );
      console.log(`[upsertInBatches] Batch ${Math.floor(i/batchSize) + 1} completed successfully`);
    } catch (error) {
      logger.error(`[upsertInBatches] Batch ${Math.floor(i/batchSize) + 1} failed:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }
  
  console.log('[upsertInBatches] All batches completed');
}

/**
 * POST /admin/taxonomy/sync
 * Seeds/updates the google_taxonomy table from the in-repo GOOGLE_PRODUCT_TAXONOMY
 */
router.post('/sync', async (_req, res) => {
  try {
    console.log('[POST /admin/taxonomy/sync] Starting taxonomy sync...');
    const flat = collectNodes(GOOGLE_PRODUCT_TAXONOMY);
    console.log(`[POST /admin/taxonomy/sync] Processing ${flat.length} categories`);

    // Upsert in batches
    await upsertInBatches(flat, 200);

    const total = await prisma.google_taxonomy_list.count();
    console.log(`[POST /admin/taxonomy/sync] Total records after sync: ${total}`);
    const versions = await prisma.google_taxonomy_list.groupBy({ by: ['version'], _count: { version: true } });

    res.status(201).json({
      success: true,
      message: `Applied ${flat.length} updates, 0 need review`,
      applied: flat.length,
      needsReview: 0,
      migratedItems: 0,
      flaggedItems: 0,
      needs_review: 0,
      migrated_items: 0,
      flagged_items: 0,
    });
  } catch (error) {
    logger.error('[POST /admin/taxonomy/sync] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'failed_to_sync_taxonomy' });
  }
});

export default router;
