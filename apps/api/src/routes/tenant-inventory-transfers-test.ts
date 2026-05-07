/**
 * Tenant Inventory Transfer Routes - Simplified Test Version
 */

import { Router, Request, Response } from 'express';

console.log('🔥 [DEBUG] Tenant inventory transfer routes file loading...');

const router = Router();

console.log('🔥 [DEBUG] Tenant inventory transfer router created...');

// Simple test route
router.get('/transfers', async (req: Request, res: Response) => {
  console.log('🔥 [DEBUG] Tenant transfers route called!');
  res.json({
    success: true,
    message: 'Tenant inventory transfers working!',
    data: []
  });
});

console.log('🔥 [DEBUG] Tenant inventory transfer routes file loaded and exported...');

export default router;
