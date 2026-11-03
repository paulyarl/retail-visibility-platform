/**
 * Inventory Import — POS CSV ingestion (spec §4).
 *
 * POST /api/merchant/inventory-import
 * Tenant-scoped upload of a POS pricebook/catalog export. One ingestion point
 * for every CSV-exporting POS; format registry lives in InventoryImportService.
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { importInventoryCsv, getLastImport, type ImportFormat } from '../services/InventoryImportService';
import { logger } from '../logger';

const router = Router();

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;

router.post('/inventory-import', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId, format = 'generic', csv } = req.body || {};
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId', message: 'tenantId is required' });
    }
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_csv', message: 'csv text is required' });
    }
    if (csv.length > MAX_CSV_BYTES) {
      return res.status(413).json({ success: false, error: 'csv_too_large', message: 'CSV exceeds 10MB limit' });
    }
    const lineCount = csv.split('\n').length;
    if (lineCount > MAX_ROWS + 1) {
      return res.status(413).json({ success: false, error: 'too_many_rows', message: `CSV exceeds ${MAX_ROWS} row limit` });
    }

    const summary = await importInventoryCsv(tenantId, format as ImportFormat, csv);
    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('[InventoryImport] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'import_failed', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// GET /api/merchant/inventory-import/last — the card's freshness label
router.get('/inventory-import/last', authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.query.tenant_id) as string;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }
    res.json({ success: true, data: await getLastImport(tenantId) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'last_import_failed' });
  }
});

export default router;
