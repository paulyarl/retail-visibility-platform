import { Router } from 'express';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY, CategoryNode } from '../lib/google/taxonomy';

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

async function upsertInBatches(items: any[], batchSize = 200) {
  console.log(`[upsertInBatches] Processing ${items.length} items in batches of ${batchSize}`);
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`[upsertInBatches] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)} with ${batch.length} items`);
    
    try {
      await prisma.$transaction(
        batch.map((it) =>
          prisma.googleTaxonomy.upsert({
            where: { categoryId: it.categoryId },
            create: {
              categoryId: it.categoryId,
              categoryPath: it.categoryPath,
              parentId: it.parentId,
              level: it.level,
              isActive: true,
              version: '2024-09',
            } as any,
            update: {
              categoryPath: it.categoryPath,
              parentId: it.parentId,
              level: it.level,
              isActive: true,
              version: '2024-09',
            },
          })
        )
      );
      console.log(`[upsertInBatches] Batch ${Math.floor(i/batchSize) + 1} completed successfully`);
    } catch (error) {
      console.error(`[upsertInBatches] Batch ${Math.floor(i/batchSize) + 1} failed:`, error);
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

    const total = await prisma.googleTaxonomy.count();
    console.log(`[POST /admin/taxonomy/sync] Total records after sync: ${total}`);
    const versions = await prisma.googleTaxonomy.groupBy({ by: ['version'], _count: { version: true } });

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
    console.error('[POST /admin/taxonomy/sync] Error:', error);
    res.status(500).json({ success: false, error: 'failed_to_sync_taxonomy' });
  }
});

export default router;
