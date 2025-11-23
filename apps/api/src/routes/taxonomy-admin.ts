import { Router } from 'express';
import { prisma } from '../prisma';
import { GOOGLE_PRODUCT_TAXONOMY, CategoryNode } from '../lib/google/taxonomy';

const router = Router();

function collectNodes(nodes: CategoryNode[], opts?: { parentId?: string; level?: number }) {
  const out: Array<{ categoryId: string; category_path: string; parentId: string | null; level: number }>= [];
  const level = (opts?.level ?? 0);
  for (const node of nodes) {
    const parentId = opts?.parentId ?? null;
    out.push({
      categoryId: node.id,
      category_path: node.path.join(' > '),
      parentId,
      level,
    });
    // Taxonomy is flat - no children property
  }
  return out;
}

async function upsertInBatches(items: any[], batchSize = 200) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
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
  }
}

/**
 * POST /admin/taxonomy/sync
 * Seeds/updates the google_taxonomy table from the in-repo GOOGLE_PRODUCT_TAXONOMY
 */
router.post('/sync', async (_req, res) => {
  try {
    const flat = collectNodes(GOOGLE_PRODUCT_TAXONOMY);

    // Upsert in batches
    await upsertInBatches(flat, 200);

    const total = await prisma.googleTaxonomy.count();
    const versions = await prisma.googleTaxonomy.groupBy({ by: ['version'], _count: { version: true } });

    res.status(201).json({
      success: true,
      message: 'Google taxonomy synced',
      counts: {
        insertedOrUpdated: flat.length,
        total,
      },
      versions,
      sample: flat.slice(0, 5),
    });
  } catch (error) {
    console.error('[POST /admin/taxonomy/sync] Error:', error);
    res.status(500).json({ success: false, error: 'failed_to_sync_taxonomy' });
  }
});

export default router;
