/**
 * Wholesale Matching Routes (tenant sub-resource)
 *
 * Mounted at /:tenantId/wholesale via tenant.routes.ts
 * Per-route auth: authenticateToken
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import wholesaleMatchingService from '../services/WholesaleMatchingService';

const router = Router();

// GET /:tenantId/wholesale/check?gtin=... — check supplier match
router.get('/:tenantId/wholesale/check', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { gtin } = req.query;

    if (!gtin || typeof gtin !== 'string') {
      return res.status(400).json({ success: false, error: 'gtin query parameter required' });
    }

    const matches = await wholesaleMatchingService.checkSupplierMatch(gtin);
    res.json({ success: true, matches });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check supplier match',
    });
  }
});

// POST /:tenantId/wholesale/search — Faire supplier search
router.post('/:tenantId/wholesale/search', authenticateToken, async (req, res) => {
  try {
    const { query, page } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query body field required' });
    }

    const results = await wholesaleMatchingService.searchFaireSuppliers(query, page || 1);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search Faire suppliers',
    });
  }
});

// GET /:tenantId/wholesale/suppliers — list known suppliers for tenant products
router.get('/:tenantId/wholesale/suppliers', authenticateToken, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const result = await wholesaleMatchingService.getAllSuppliers(
      limit ? parseInt(limit as string, 10) : 50,
      offset ? parseInt(offset as string, 10) : 0
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list suppliers',
    });
  }
});

// GET /:tenantId/wholesale/dashboard — distributor dashboard data
router.get('/:tenantId/wholesale/dashboard', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const [analytics, suppliers] = await Promise.all([
      wholesaleMatchingService.getAffiliateAnalytics(tenantId),
      wholesaleMatchingService.getAllSuppliers(10, 0),
    ]);
    res.json({ success: true, analytics, recentSuppliers: suppliers.items });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dashboard data',
    });
  }
});

// POST /:tenantId/wholesale/affiliate-link — build affiliate link for a supplier
router.post('/:tenantId/wholesale/affiliate-link', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { supplierId, gtin } = req.body;

    if (!supplierId || !gtin) {
      return res.status(400).json({ success: false, error: 'supplierId and gtin required' });
    }

    const matches = await wholesaleMatchingService.checkSupplierMatch(gtin);
    const supplier = matches.find((m) => m.id === supplierId);

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found for GTIN' });
    }

    const result = await wholesaleMatchingService.buildAffiliateLink(supplier, tenantId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build affiliate link',
    });
  }
});

export default router;
