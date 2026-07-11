/**
 * Admin Brand Partner Routes
 *
 * Mounted at /api/admin/brand-partners via admin.routes.ts
 * Auth: authenticateToken + requireAdmin at mount level
 */

import { Router } from 'express';
import { prisma } from '../../prisma';
import wholesaleMatchingService from '../../services/WholesaleMatchingService';

const router = Router();

// GET /claims — list all brand partner claims
router.get('/claims', async (req, res) => {
  try {
    const { gtin, brand_name } = req.query;

    const where: any = {};
    if (gtin) where.gtin = String(gtin);
    if (brand_name) where.brand_name = { contains: String(brand_name), mode: 'insensitive' };

    const claims = await prisma.brand_partner_claims.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    res.json({ success: true, claims });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list claims',
    });
  }
});

// POST /claims — create a brand partner claim (admin)
router.post('/claims', async (req, res) => {
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
      error: error instanceof Error ? error.message : 'Failed to create claim',
    });
  }
});

// PUT /claims/:id/approve — approve a brand partner claim
router.put('/claims/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await wholesaleMatchingService.approveBrandPartnerClaim(id);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve claim',
    });
  }
});

export default router;
