import { Router } from 'express';
import { GBPCategorySyncService } from '../services/GBPCategorySyncService';
import { logger } from '../logger';

const router = Router();

/**
 * Test GBP Category Sync Service
 * POST /test/sync-gbp-categories
 * Public endpoint for testing GBP category sync (no auth required)
 */
router.post('/sync-gbp-categories', async (req, res) => {
  try {
    console.log('🔄 Testing GBP category sync (public endpoint)...');

    const service = new GBPCategorySyncService();

    // First test: Can we fetch categories?
    console.log('1. Testing category fetch...');
    const fetchResult = await service.fetchLatestCategories();

    console.log(`   Fetched ${fetchResult.categories.length} categories`);
    console.log(`   Version: ${fetchResult.version}`);

    // Second test: Check for updates
    console.log('2. Checking for database updates...');
    const updateCheck = await service.checkForUpdates();

    if (!updateCheck.hasUpdates) {
      return res.status(200).json({
        success: true,
        message: 'Categories are already up to date',
        fetchCount: fetchResult.categories.length,
        usingGoogleAPI: fetchResult.categories.length > 100,
        changes: 0
      });
    }

    // Third test: Apply updates
    console.log(`3. Applying ${updateCheck.changes.length} updates...`);
    const result = await service.applyUpdates(updateCheck.changes);

    console.log('✅ Sync test completed!');

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${result.applied} categories`,
      fetchCount: fetchResult.categories.length,
      usingGoogleAPI: fetchResult.categories.length > 100,
      applied: result.applied,
      failed: result.failed,
      totalChanges: updateCheck.changes.length
    });

  } catch (error) {
    logger.error('❌ Sync test failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });

    // Try fallback: just fetch categories without updating DB
    try {
      console.log('🔄 Trying fallback: fetch only...');
      const service = new GBPCategorySyncService();
      const fetchResult = await service.fetchLatestCategories();

      return res.status(200).json({
        success: false,
        message: 'Sync failed, but fetch succeeded',
        error: error instanceof Error ? error.message : String(error),
        fetchCount: fetchResult.categories.length,
        usingGoogleAPI: fetchResult.categories.length > 100,
        usingFallback: fetchResult.categories.length <= 100
      });
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        message: 'Both sync and fetch failed',
        error: error instanceof Error ? error.message : String(error),
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      });
    }
  }
});

/**
 * Test GBP OAuth token retrieval
 * GET /test/gbp-oauth
 * Public endpoint for testing GBP OAuth token retrieval
 */
router.get('/gbp-oauth', async (req, res) => {
  try {
    console.log('🔄 Testing GBP OAuth token retrieval...');

    const service = new GBPCategorySyncService();
    const accessToken = await (service as any).getAccessToken();

    if (!accessToken) {
      return res.status(200).json({
        success: false,
        message: 'No OAuth token found in database',
        tokenExists: false
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OAuth token retrieved successfully',
      tokenExists: true,
      tokenPreview: accessToken.substring(0, 20) + '...'
    });

  } catch (error) {
    logger.error('❌ OAuth test failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      success: false,
      message: 'OAuth token test failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
