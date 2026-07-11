/**
 * Brand Partner Self-Service Routes
 *
 * Mounted at /api/brand-partners via routeRegistry.ts
 * Auth: authenticateToken (brand partners submit their own claims)
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import wholesaleMatchingService from '../services/WholesaleMatchingService';

const router = Router();

// POST /claims — brand self-service claim submission
router.post('/claims', authenticateToken, async (req, res) => {
  try {
    const { brand_name, gtin, claim_type, contact_email } = req.body;

    if (!brand_name || !gtin) {
      return res.status(400).json({ success: false, error: 'brand_name and gtin required' });
    }

    const claim = await wholesaleMatchingService.createBrandPartnerClaim(
      brand_name,
      gtin,
      claim_type || 'verified',
      contact_email
    );

    if (!claim) {
      return res.status(500).json({ success: false, error: 'Failed to create claim' });
    }

    res.json({ success: true, claim });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit claim',
    });
  }
});

// GET /claims?gtin=... — public lookup of brand partner claims for a GTIN
router.get('/claims', async (req, res) => {
  try {
    const { gtin } = req.query;

    if (!gtin || typeof gtin !== 'string') {
      return res.status(400).json({ success: false, error: 'gtin query parameter required' });
    }

    const claims = await wholesaleMatchingService.getBrandPartnerClaims(gtin);
    res.json({ success: true, claims });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get claims',
    });
  }
});

export default router;
