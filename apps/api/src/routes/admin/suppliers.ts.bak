/**
 * Admin Supplier Routes
 *
 * Platform admin endpoints for managing suppliers and browsing catalogs.
 * All routes require platform admin authentication.
 *
 * Routes:
 *   GET    /api/admin/suppliers              — list all suppliers
 *   GET    /api/admin/suppliers/:id          — get supplier by ID
 *   POST   /api/admin/suppliers              — create custom supplier
 *   PUT    /api/admin/suppliers/:id          — update supplier
 *   DELETE /api/admin/suppliers/:id          — delete custom supplier
 *   GET    /api/admin/suppliers/:id/health   — supplier health metrics
 *   GET    /api/admin/suppliers/:id/catalog  — browse supplier catalog items
 *   POST   /api/admin/suppliers/:id/ingest   — batch ingest catalog rows
 *   GET    /api/admin/suppliers/:id/quarantine — list quarantined items
 *   POST   /api/admin/suppliers/:id/quarantine/:qid/replay — replay quarantined item
 */

import express from 'express';
import SupplierService from '../../services/SupplierService';
import SupplierCatalogService from '../../services/SupplierCatalogService';

const router = express.Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

// List all suppliers
router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const suppliers = await SupplierService.listSuppliers(activeOnly);
    res.json({ suppliers });
  } catch (error) {
    console.error('[admin/suppliers] List error:', error);
    res.status(500).json({ error: 'Failed to list suppliers' });
  }
});

// Health dashboard — aggregated metrics for all suppliers (must be before /:id)
router.get('/health/dashboard', async (req, res) => {
  try {
    const dashboard = await SupplierService.getHealthDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('[admin/suppliers] Health dashboard error:', error);
    res.status(500).json({ error: 'Failed to get health dashboard' });
  }
});

// Get supplier by ID
router.get('/:id', async (req, res) => {
  try {
    const supplier = await SupplierService.getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json({ supplier });
  } catch (error) {
    console.error('[admin/suppliers] Get error:', error);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
});

// Create custom supplier
router.post('/', async (req, res) => {
  try {
    const { name, connection_type, api_url, api_key_env, metadata } = req.body;
    if (!name || !connection_type) {
      return res.status(400).json({ error: 'name and connection_type are required' });
    }
    const supplier = await SupplierService.createSupplier({
      name,
      connection_type,
      api_url,
      api_key_env,
      metadata,
    });
    res.status(201).json({ supplier });
  } catch (error) {
    console.error('[admin/suppliers] Create error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, connection_type, api_url, api_key_env, active, metadata } = req.body;
    const supplier = await SupplierService.updateSupplier(req.params.id, {
      name,
      connection_type,
      api_url,
      api_key_env,
      active,
      metadata,
    });
    res.json({ supplier });
  } catch (error) {
    console.error('[admin/suppliers] Update error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

// Delete custom supplier
router.delete('/:id', async (req, res) => {
  try {
    await SupplierService.deleteSupplier(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[admin/suppliers] Delete error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete supplier';
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('cannot be deleted')) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

// Supplier health metrics
router.get('/:id/health', async (req, res) => {
  try {
    const health = await SupplierService.getSupplierHealth(req.params.id);
    if (!health) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json({ health });
  } catch (error) {
    console.error('[admin/suppliers] Health error:', error);
    res.status(500).json({ error: 'Failed to get supplier health' });
  }
});

// Browse supplier catalog items
router.get('/:id/catalog', async (req, res) => {
  try {
    const result = await SupplierCatalogService.searchCatalog({
      supplierId: req.params.id,
      query: req.query.query as string | undefined,
      brand: req.query.brand as string | undefined,
      gtin: req.query.gtin as string | undefined,
      category: req.query.category as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('[admin/suppliers] Catalog browse error:', error);
    res.status(500).json({ error: 'Failed to browse catalog' });
  }
});

// Batch ingest catalog rows
router.post('/:id/ingest', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows array is required' });
    }
    const result = await SupplierCatalogService.batchIngest(req.params.id, rows);
    res.json(result);
  } catch (error) {
    console.error('[admin/suppliers] Ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest catalog rows' });
  }
});

// List quarantined items
router.get('/:id/quarantine', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const items = await SupplierCatalogService.getQuarantinedItems(req.params.id, limit);
    res.json({ items });
  } catch (error) {
    console.error('[admin/suppliers] Quarantine list error:', error);
    res.status(500).json({ error: 'Failed to list quarantined items' });
  }
});

// Replay quarantined item — re-attempts ingestion
router.post('/:id/quarantine/:qid/replay', async (req, res) => {
  try {
    const result = await SupplierCatalogService.replayQuarantine(req.params.qid);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Replay failed' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[admin/suppliers] Quarantine replay error:', error);
    res.status(500).json({ error: 'Failed to replay quarantined item' });
  }
});

export default router;
