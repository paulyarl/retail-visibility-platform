import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

router.get('/api/admin/taxonomy/status', requireAdmin, async (req, res) => {
  try {
    const { TaxonomySyncService } = await import('../services/TaxonomySyncService');
    const syncService = new TaxonomySyncService();

    const status = await syncService.checkForUpdates();

    const currentVersion = await prisma.google_taxonomy_list.findFirst({
      select: { version: true },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      currentVersion: currentVersion?.version || 'unknown',
      latestVersion: status.latestVersion,
      hasUpdates: status.hasUpdates,
      changeCount: status.changes.length,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Taxonomy Status] Error:', error);
    res.status(500).json({ error: 'Failed to check taxonomy status' });
  }
});

router.post('/api/admin/taxonomy/sync', requireAdmin, async (req, res) => {
  try {
    const { TaxonomySyncService } = await import('../services/TaxonomySyncService');
    const syncService = new TaxonomySyncService();

    const status = await syncService.checkForUpdates();

    if (!status.hasUpdates) {
      return res.json({
        success: true,
        message: 'Taxonomy is already up to date',
        changes: []
      });
    }

    const migrationResult = await syncService.applySafeUpdates(status.changes);
    const itemMigration = await syncService.migrateAffectedItems(status.changes);

    res.json({
      success: true,
      message: `Applied ${migrationResult.applied} updates, ${migrationResult.needsReview} need review`,
      applied: migrationResult.applied,
      needsReview: migrationResult.needsReview,
      migratedItems: itemMigration.migrated,
      flaggedItems: itemMigration.flagged
    });
  } catch (error) {
    console.error('[Taxonomy Sync] Error:', error);
    res.status(500).json({ error: 'Taxonomy sync failed' });
  }
});

export default router;
