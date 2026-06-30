/**
 * Tenant Supplier Routes
 *
 * Tenant-scoped endpoints for catalog search, import, and mapping management.
 * All routes require authentication + tenant access.
 *
 * Routes:
 *   GET    /api/tenants/:tenantId/suppliers                    — list active suppliers
 *   GET    /api/tenants/:tenantId/suppliers/catalog/search     — search catalog items
 *   GET    /api/tenants/:tenantId/suppliers/catalog/lookup     — lookup by barcode/GTIN
 *   POST   /api/tenants/:tenantId/suppliers/import/check       — pre-flight conflict check
 *   POST   /api/tenants/:tenantId/suppliers/import             — execute import
 *   GET    /api/tenants/:tenantId/suppliers/mappings           — list supplier mappings
 *   PUT    /api/tenants/:tenantId/suppliers/mappings/:mid      — update sync mode
 *   DELETE /api/tenants/:tenantId/suppliers/mappings/:mid      — unlink mapping
 */

import express from 'express';
import { authenticateToken, checkTenantAccess } from '../../middleware/auth';
import SupplierService from '../../services/SupplierService';
import SupplierCatalogService from '../../services/SupplierCatalogService';
import SupplierImportService from '../../services/SupplierImportService';

const router = express.Router();

router.use(authenticateToken, checkTenantAccess);

// Helper to safely extract tenantId from route params
function getTenantId(req: express.Request): string {
  return req.params.tenantId as string;
}

// List active suppliers (for tenant dropdown)
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await SupplierService.listSuppliers(true);
    res.json({ suppliers });
  } catch (error) {
    console.error('[tenant/suppliers] List error:', error);
    res.status(500).json({ error: 'Failed to list suppliers' });
  }
});

// Search catalog items
router.get('/suppliers/catalog/search', async (req, res) => {
  try {
    const result = await SupplierCatalogService.searchCatalog({
      supplierId: req.query.supplierId as string | undefined,
      query: req.query.query as string | undefined,
      brand: req.query.brand as string | undefined,
      gtin: req.query.gtin as string | undefined,
      category: req.query.category as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('[tenant/suppliers] Catalog search error:', error);
    res.status(500).json({ error: 'Failed to search catalog' });
  }
});

// Lookup by barcode/GTIN (used by ItemCreationWizard Step 0)
router.get('/suppliers/catalog/lookup', async (req, res) => {
  try {
    const gtin = req.query.gtin as string;
    if (!gtin) {
      return res.status(400).json({ error: 'gtin query parameter is required' });
    }
    const supplierId = req.query.supplierId as string | undefined;
    const items = await SupplierCatalogService.lookupByBarcode(gtin, supplierId);
    res.json({ items });
  } catch (error) {
    console.error('[tenant/suppliers] Barcode lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup by barcode' });
  }
});

// Pre-flight conflict check
router.post('/suppliers/import/check', async (req, res) => {
  try {
    const { selections } = req.body;
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'selections array is required' });
    }
    const result = await SupplierImportService.checkConflicts(getTenantId(req), selections);
    res.json(result);
  } catch (error) {
    console.error('[tenant/suppliers] Import check error:', error);
    res.status(500).json({ error: 'Failed to check import conflicts' });
  }
});

// Execute import
router.post('/suppliers/import', async (req, res) => {
  try {
    const { selections } = req.body;
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'selections array is required' });
    }
    const result = await SupplierImportService.executeImport(getTenantId(req), selections);
    res.json(result);
  } catch (error) {
    console.error('[tenant/suppliers] Import error:', error);
    res.status(500).json({ error: 'Failed to execute import' });
  }
});

// List supplier mappings
router.get('/suppliers/mappings', async (req, res) => {
  try {
    const supplierId = req.query.supplierId as string | undefined;
    const mappings = await SupplierImportService.getMappings(getTenantId(req), supplierId);
    res.json({ mappings });
  } catch (error) {
    console.error('[tenant/suppliers] Mappings list error:', error);
    res.status(500).json({ error: 'Failed to list mappings' });
  }
});

// Update sync mode
router.put('/suppliers/mappings/:mid', async (req, res) => {
  try {
    const { sync_mode } = req.body;
    if (!sync_mode || !['manual', 'auto'].includes(sync_mode)) {
      return res.status(400).json({ error: 'sync_mode must be "manual" or "auto"' });
    }
    const mapping = await SupplierImportService.updateSyncMode(req.params.mid, sync_mode);
    res.json({ mapping });
  } catch (error) {
    console.error('[tenant/suppliers] Update mapping error:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// Unlink mapping
router.delete('/suppliers/mappings/:mid', async (req, res) => {
  try {
    await SupplierImportService.unlinkMapping(req.params.mid);
    res.json({ success: true });
  } catch (error) {
    console.error('[tenant/suppliers] Unlink mapping error:', error);
    const message = error instanceof Error ? error.message : 'Failed to unlink mapping';
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

export default router;
