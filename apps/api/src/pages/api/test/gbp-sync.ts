// Test GBP Category Sync via API endpoint
// POST /api/test/gbp-sync

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
    console.log('🧪 Testing GBP Category Sync Service via API...');

    const service = new GBPCategorySyncService();

    // Test token retrieval
    const accessToken = await (service as any).getAccessToken();

    if (!accessToken) {
      return res.status(200).json({
        success: false,
        message: 'No OAuth token found',
        usingFallback: true,
        categories: []
      });
    }

    // Test category fetching
    const result = await service.fetchLatestCategories();

    return res.status(200).json({
      success: true,
      message: `Successfully fetched ${result.categories.length} categories`,
      categoriesCount: result.categories.length,
      totalCount: result.totalCount,
      version: result.version,
      usingGoogleAPI: result.categories.length > 100,
      sampleCategories: result.categories.slice(0, 3)
    });

  } catch (error) {
    console.error('❌ GBP test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
