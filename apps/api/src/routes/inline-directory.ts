import { Router } from 'express';
import { logger } from '../logger';

const router = Router();

router.get('/api/directory/simple-test', (req, res) => {
  console.log('[SIMPLE-TEST] Route hit!');
  res.json({ message: 'Simple test working!' });
});

router.get('/api/directory/store-types/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

router.get('/api/directory/store-types', async (req, res) => {
  console.log('[STORE-TYPES] Direct route hit - fetching store types');
  try {
    const { storeTypeDirectoryService } = await import('../services/store-type-directory.service');
    const { lat, lng, radius } = req.query;

    const location = lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : undefined;
    const radiusMiles = radius ? parseFloat(radius as string) : 25;

    const storeTypes = await storeTypeDirectoryService.getStoreTypes(location, radiusMiles);

    res.json({
      success: true,
      data: { storeTypes, totalCount: storeTypes.length }
    });
  } catch (error: any) {
    logger.error('[STORE-TYPES] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'Failed to fetch store types' });
  }
});

export default router;
