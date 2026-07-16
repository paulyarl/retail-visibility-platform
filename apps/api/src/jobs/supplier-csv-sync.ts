/**
 * CSV Connector Worker
 *
 * Generic CSV connector for custom suppliers (CSV/SFTP).
 * Reads CSV from supplier API URL or SFTP, normalizes rows to
 * supplier_catalog_item format, and calls SupplierCatalogService.batchIngest.
 *
 * Runs every 6 hours. 10-minute startup delay to avoid firing on nodemon restarts.
 * Can be disabled via DISABLE_SUPPLIER_CSV_SYNC env var.
 */

import { prisma } from '../prisma';
import SupplierCatalogService, { type BatchIngestRow } from '../services/SupplierCatalogService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 10 * 60 * 1000; // 10 minutes
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Parse a CSV text into rows of BatchIngestRow.
 * Expects a header row with columns: supplier_sku, gtin, name, brand, description, category, image_url, msrp_cents
 */
function parseCsv(csvText: string): BatchIngestRow[] {
  const lines = csvText.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: BatchIngestRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    if (!row.supplier_sku || !row.name) continue;

    rows.push({
      supplier_sku: row.supplier_sku,
      gtin: row.gtin || null,
      name: row.name,
      brand: row.brand || null,
      description: row.description || null,
      category: row.category || null,
      image_url: row.image_url || null,
      msrp_cents: row.msrp_cents ? Math.round(parseFloat(row.msrp_cents) * 100) : null,
      attrs: {},
    });
  }

  return rows;
}

/**
 * Fetch CSV content from a URL with exponential backoff.
 */
async function fetchCsvWithBackoff(url: string, maxRetries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'Accept': 'text/csv, text/plain, */*' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      logger.error(`[SupplierCsvSync] Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return null;
}

/**
 * Run CSV sync for all custom CSV-type suppliers.
 */
async function runScheduledSync(): Promise<void> {
  console.log('[SupplierCsvSync] Starting scheduled CSV sync...');

  try {
    const csvSuppliers = await prisma.supplier.findMany({
      where: {
        active: true,
        connection_type: { in: ['CSV', 'SFTP'] },
        api_url: { not: null },
      },
    });

    console.log(`[SupplierCsvSync] Found ${csvSuppliers.length} CSV/SFTP suppliers`);

    for (const supplier of csvSuppliers) {
      try {
        if (!supplier.api_url) continue;

        console.log(`[SupplierCsvSync] Fetching CSV for supplier ${supplier.id} (${supplier.name})`);
        const csvText = await fetchCsvWithBackoff(supplier.api_url);

        if (!csvText) {
          logger.error(`[SupplierCsvSync] Failed to fetch CSV for supplier ${supplier.id}`, undefined);
          continue;
        }

        const rows = parseCsv(csvText);
        if (rows.length === 0) {
          console.warn(`[SupplierCsvSync] No valid rows parsed for supplier ${supplier.id}`);
          continue;
        }

        console.log(`[SupplierCsvSync] Ingesting ${rows.length} rows for supplier ${supplier.id}`);
        const result = await SupplierCatalogService.batchIngest(supplier.id, rows);
        console.log(
          `[SupplierCsvSync] Supplier ${supplier.id}: ${result.inserted} inserted, ` +
          `${result.updated} updated, ${result.quarantined} quarantined`
        );
      } catch (error) {
        logger.error(`[SupplierCsvSync] Error syncing supplier ${supplier.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[SupplierCsvSync] Completed');
  } catch (error) {
    logger.error('[SupplierCsvSync] Scheduled sync failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

/**
 * Start the scheduled CSV sync job.
 */
export async function startSupplierCsvSync(): Promise<void> {
  if (process.env.DISABLE_SUPPLIER_CSV_SYNC === 'true') {
    console.log('[SupplierCsvSync] Disabled via DISABLE_SUPPLIER_CSV_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[SupplierCsvSync] Already running');
    return;
  }

  console.log('[SupplierCsvSync] Starting scheduler (every 6 hours)');

  setTimeout(() => {
    runScheduledSync();
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the scheduled CSV sync job.
 */
export function stopSupplierCsvSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[SupplierCsvSync] Stopped');
  }
}
