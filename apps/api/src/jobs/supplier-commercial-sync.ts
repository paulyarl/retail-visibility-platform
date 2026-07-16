/**
 * Commercial Supplier Sync Job
 *
 * Scheduled sync for commercial barcode lookup suppliers:
 * - BarcodeLookup.com: nightly full backfill (has text search)
 * - Go-UPC: skipped (barcode-only API, no text search)
 * - Kroger: nightly full backfill + OAuth2 token refresh
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_SUPPLIER_COMMERCIAL_SYNC env var.
 */

import { prisma } from '../prisma';
import SupplierCatalogService from '../services/SupplierCatalogService';
import {
  BarcodeLookupConnector,
  KrogerConnector,
  type SupplierConnector,
} from '../services/SupplierConnectors';
import { logger } from '../logger';

const NIGHTLY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 30 * 60 * 1000; // 30 minutes (after open-source nightly)

let nightlyIntervalId: NodeJS.Timeout | null = null;

/**
 * Ensure the supplier record exists in the database before ingesting data.
 */
async function ensureSupplierExists(supplierId: string, name: string, apiUrl: string): Promise<void> {
  await prisma.supplier.upsert({
    where: { id: supplierId },
    update: { name, api_url: apiUrl, is_builtin: true, active: true },
    create: { id: supplierId, name, api_url: apiUrl, is_builtin: true, active: true },
  });
}

/**
 * Run nightly backfill for a connector.
 * Fetches multiple pages of products via searchByText to build a comprehensive catalog.
 */
async function runNightlyBackfillForConnector(
  connector: SupplierConnector,
  supplierId: string,
  name: string,
  apiUrl: string,
  searchTerms: string[]
): Promise<void> {
  try {
    await ensureSupplierExists(supplierId, name, apiUrl);

    logger.info('Commercial supplier nightly backfill starting', undefined, { supplierId });

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalQuarantined = 0;
    const maxPages = 10;

    for (const term of searchTerms) {
      for (let page = 1; page <= maxPages; page++) {
        const rows = await connector.searchByText(term, page);
        if (rows.length === 0) break;

        const result = await SupplierCatalogService.batchIngest(supplierId, rows);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalQuarantined += result.quarantined;

        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('Commercial supplier nightly backfill completed', undefined, {
      supplierId,
      totalInserted,
      totalUpdated,
      totalQuarantined,
    });
  } catch (error: any) {
    logger.error('Commercial supplier nightly backfill failed', undefined, {
      supplierId,
      error: { name: (error as any)?.name, message: (error as any)?.message },
    });
  }
}

/**
 * Refresh Kroger OAuth2 token to ensure it's valid for the next period.
 */
async function refreshKrogerToken(): Promise<void> {
  const clientId = process.env.KROGER_CLIENT_ID;
  if (!clientId) return;

  try {
    const connector = new KrogerConnector();
    // Trigger token acquisition by calling fetchByBarcode with a dummy barcode
    // The connector caches the token internally
    await connector.fetchByBarcode('000000000000');
    logger.info('Kroger OAuth2 token refreshed', undefined);
  } catch (error: any) {
    logger.warn('Kroger OAuth2 token refresh failed', undefined, {
      error: { name: (error as any)?.name, message: (error as any)?.message },
    });
  }
}

/**
 * Run nightly backfill for all commercial suppliers.
 */
async function runNightlyBackfill(): Promise<void> {
  logger.info('Commercial supplier nightly backfill starting');

  // BarcodeLookup.com — has text search, run backfill with common search terms
  if (process.env.BARCODELOOKUP_API_KEY) {
    const blConnector = new BarcodeLookupConnector();
    await runNightlyBackfillForConnector(
      blConnector,
      'supplier-off-barcodelookup',
      'BarcodeLookup.com',
      'https://api.barcodelookup.com/v3',
      ['beverage', 'snack', 'household', 'personal care', 'dairy']
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Go-UPC — skipped (barcode-only API, no text search)

  // Kroger — has text search, run backfill with grocery-relevant terms
  if (process.env.KROGER_CLIENT_ID) {
    await refreshKrogerToken();

    const krogerConnector = new KrogerConnector();
    await runNightlyBackfillForConnector(
      krogerConnector,
      'supplier-off-kroger',
      'Kroger Developer API',
      'https://api.kroger.com/v1',
      ['milk', 'bread', 'cereal', 'snacks', 'beverages']
    );
  }

  logger.info('Commercial supplier nightly backfill completed');
}

/**
 * Start the scheduled commercial supplier sync jobs.
 */
export async function startSupplierCommercialSync(): Promise<void> {
  if (process.env.DISABLE_SUPPLIER_COMMERCIAL_SYNC === 'true') {
    logger.info('Commercial supplier sync disabled via DISABLE_SUPPLIER_COMMERCIAL_SYNC env var');
    return;
  }

  if (nightlyIntervalId) {
    logger.info('Commercial supplier sync already running');
    return;
  }

  logger.info('Commercial supplier sync scheduler starting (nightly backfill)');

  // Delay first run to avoid firing on nodemon restarts
  setTimeout(() => {
    runNightlyBackfill();
  }, STARTUP_DELAY_MS);

  nightlyIntervalId = setInterval(() => {
    runNightlyBackfill();
  }, NIGHTLY_INTERVAL_MS);
}

/**
 * Stop the scheduled commercial supplier sync jobs.
 */
export function stopSupplierCommercialSync(): void {
  if (nightlyIntervalId) {
    clearInterval(nightlyIntervalId);
    nightlyIntervalId = null;
  }
  logger.info('Commercial supplier sync stopped');
}
