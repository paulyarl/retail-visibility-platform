// ============================================================================
// MANUAL GBP CATEGORY SYNC
// ============================================================================
// Run this to manually sync GBP categories from Google API to database
// POST /api/admin/sync-gbp-categories
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
    console.log('🔄 Starting manual GBP category sync...');

    const service = new GBPCategorySyncService();

    // Check for updates
    console.log('1. Checking for category updates...');
    const updateCheck = await service.checkForUpdates();

    if (!updateCheck.hasUpdates) {
      return res.status(200).json({
        success: true,
        message: 'Categories are already up to date',
        changes: 0
      });
    }

    // Apply updates
    console.log(`2. Applying ${updateCheck.changes.length} category updates...`);
    const result = await service.applyUpdates(updateCheck.changes);

    console.log('✅ Manual sync completed!');

    return res.status(200).json({
      success: true,
      message: `Successfully synced ${result.applied} categories (${result.failed} failed)`,
      applied: result.applied,
      failed: result.failed,
      totalChanges: updateCheck.changes.length
    });

  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check OAuth token validity and try again'
    });
  }
}
