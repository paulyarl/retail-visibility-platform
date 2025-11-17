// ============================================================================
// PUBLIC GBP CATEGORY SYNC TEST
// ============================================================================
// Public endpoint for testing GBP category sync (no auth required)
// POST /api/test/sync-gbp-categories
// ============================================================================

import { NextApiRequest, NextApiResponse } from 'next';
import { GBPCategorySyncService } from '../../../services/GBPCategorySyncService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    console.error('❌ Sync test failed:', error);

    // Try fallback: just fetch categories without updating DB
    try {
      console.log('🔄 Trying fallback: fetch only...');
      const service = new GBPCategorySyncService();
      const fetchResult = await service.fetchLatestCategories();

      return res.status(200).json({
        success: false,
        message: 'Sync failed, but fetch succeeded',
        error: error.message,
        fetchCount: fetchResult.categories.length,
        usingGoogleAPI: fetchResult.categories.length > 100,
        usingFallback: fetchResult.categories.length <= 100
      });
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        message: 'Both sync and fetch failed',
        error: error.message,
        fallbackError: fallbackError.message
      });
    }
  }
}
