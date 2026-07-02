/**
 * Tenant Supplier Routes
 *
 * Tenant-scoped endpoints for catalog search, import, and mapping management.
 * All routes require authentication + tenant access + FF_SUPPLIER_CATALOG_IMPORT enabled.
 *
 * RBAC:
 *   - Read endpoints (list, search, lookup, mappings list): checkTenantAccess (any tenant member)
 *   - Write endpoints (import, update sync mode, unlink): requireTenantOwner (OWNER/ADMIN)
 *
 * Routes:
 *   GET    /api/tenants/:tenantId/suppliers                    — list active suppliers
 *   GET    /api/tenants/:tenantId/suppliers/catalog/search     — search catalog items
 *   GET    /api/tenants/:tenantId/suppliers/catalog/lookup     — lookup by barcode/GTIN
 *   POST   /api/tenants/:tenantId/suppliers/import/check       — pre-flight conflict check
 *   POST   /api/tenants/:tenantId/suppliers/import             — execute import (emits audit_log)
 *   GET    /api/tenants/:tenantId/suppliers/mappings           — list supplier mappings
 *   PUT    /api/tenants/:tenantId/suppliers/mappings/:mid      — update sync mode (emits audit_log)
 *   DELETE /api/tenants/:tenantId/suppliers/mappings/:mid      — unlink mapping (emits audit_log)
 */

import express from 'express';
import { authenticateToken, checkTenantAccess, requireTenantOwner } from '../../middleware/auth';
import { requireFlag } from '../../middleware/flags';
import { prisma } from '../../prisma';
import SupplierService from '../../services/SupplierService';
import SupplierCatalogService from '../../services/SupplierCatalogService';
import SupplierImportService from '../../services/SupplierImportService';

// mergeParams: true is required because this router is mounted at /api/tenants/:tenantId
// and its global middleware (checkTenantAccess, requireFlag) needs req.params.tenantId.
// Without it, the router intercepts all /api/tenants/:tenantId/* requests and fails
// with tenantId_required before the intended FAQ/bot/faq-options routers are reached.
const router = express.Router({ mergeParams: true });

// Helper to safely extract tenantId from route params
function getTenantId(req: express.Request): string {
  return req.params.tenantId as string;
}

// All supplier routes require auth + tenant access + feature flag.
// Scope the middleware to '/suppliers' so this router (mounted at /api/tenants/:tenantId)
// does not intercept unrelated /api/tenants/:tenantId/* requests like /faqs, /faq-options, /bot/*.
router.use(
  '/suppliers',
  authenticateToken,
  checkTenantAccess,
  requireFlag({ flag: 'FF_SUPPLIER_CATALOG_IMPORT', scope: 'tenant', tenantParam: 'tenantId' }),
);

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

// Pre-flight conflict check (any tenant member)
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

// Execute import (OWNER/ADMIN only — emits audit_log domain event)
router.post('/suppliers/import', requireTenantOwner, async (req, res) => {
  try {
    const { selections } = req.body;
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'selections array is required' });
    }
    const tenantId = getTenantId(req);
    const result = await SupplierImportService.executeImport(tenantId, selections);

    // Emit domain event: inventory.upserted_from_supplier
    if (result.imported > 0 && req.user) {
      try {
        await prisma.audit_log.create({
          data: {
            id: `audit-supplier-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tenant_id: tenantId,
            actor_id: req.user.userId || req.user.id || 'system',
            actor_type: 'user',
            action: 'create',
            entity_type: 'inventory_item',
            entity_id: result.created_item_ids[0] || 'bulk',
            diff: {
              event: 'inventory.upserted_from_supplier',
              imported_count: result.imported,
              skipped_count: result.skipped,
              created_item_ids: result.created_item_ids,
              selection_count: selections.length,
            },
            metadata: {
              source: 'supplier_catalog_import',
              flag: 'FF_SUPPLIER_CATALOG_IMPORT',
            },
          },
        });
      } catch (auditError) {
        console.error('[tenant/suppliers] Audit log error:', auditError);
      }
    }

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

// Update sync mode (OWNER/ADMIN only — emits audit_log)
router.put('/suppliers/mappings/:mid', requireTenantOwner, async (req, res) => {
  try {
    const { sync_mode } = req.body;
    if (!sync_mode || !['manual', 'auto'].includes(sync_mode)) {
      return res.status(400).json({ error: 'sync_mode must be "manual" or "auto"' });
    }
    const mapping = await SupplierImportService.updateSyncMode(req.params.mid, sync_mode);

    // Emit audit log
    if (req.user) {
      try {
        await prisma.audit_log.create({
          data: {
            id: `audit-supplier-mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tenant_id: getTenantId(req),
            actor_id: req.user.userId || req.user.id || 'system',
            actor_type: 'user',
            action: 'update',
            entity_type: 'inventory_item',
            entity_id: req.params.mid,
            diff: { event: 'supplier_mapping_sync_mode_changed', mapping_id: req.params.mid, sync_mode },
            metadata: { source: 'supplier_catalog_import', flag: 'FF_SUPPLIER_CATALOG_IMPORT' },
          },
        });
      } catch (auditError) {
        console.error('[tenant/suppliers] Audit log error:', auditError);
      }
    }

    res.json({ mapping });
  } catch (error) {
    console.error('[tenant/suppliers] Update mapping error:', error);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
});

// Unlink mapping (OWNER/ADMIN only — emits audit_log)
router.delete('/suppliers/mappings/:mid', requireTenantOwner, async (req, res) => {
  try {
    await SupplierImportService.unlinkMapping(req.params.mid);

    // Emit audit log
    if (req.user) {
      try {
        await prisma.audit_log.create({
          data: {
            id: `audit-supplier-unlink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tenant_id: getTenantId(req),
            actor_id: req.user.userId || req.user.id || 'system',
            actor_type: 'user',
            action: 'delete',
            entity_type: 'inventory_item',
            entity_id: req.params.mid,
            diff: { event: 'supplier_mapping_unlinked', mapping_id: req.params.mid },
            metadata: { source: 'supplier_catalog_import', flag: 'FF_SUPPLIER_CATALOG_IMPORT' },
          },
        });
      } catch (auditError) {
        console.error('[tenant/suppliers] Audit log error:', auditError);
      }
    }

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
