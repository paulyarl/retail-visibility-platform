/**
 * Admin Brand Partner Routes
 *
 * Mounted at /api/admin/brand-partners via admin.routes.ts
 * Auth: authenticateToken + requireAdmin at mount level
 */

import { Router } from 'express';
import wholesaleMatchingService from '../../services/WholesaleMatchingService';

const router = Router();

// GET /claims — list all brand partner claims with filtering and pagination
router.get('/claims', async (req, res) => {
  try {
    const { gtin, brand_name, claim_type, approved } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const filters: any = {};
    if (gtin) filters.gtin = String(gtin);
    if (brand_name) filters.brandName = String(brand_name);
    if (claim_type) filters.claimType = String(claim_type);
    if (approved !== undefined) filters.approved = approved === 'true';

    const result = await wholesaleMatchingService.listAllBrandPartnerClaims(filters, limit, offset);
    res.json({ success: true, claims: result.items, total: result.total });
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

// DELETE /claims/:id — reject (delete) a brand partner claim
router.delete('/claims/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await wholesaleMatchingService.rejectBrandPartnerClaim(id);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject claim',
    });
  }
});

export default router;
