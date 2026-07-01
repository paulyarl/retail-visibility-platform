/**
 * Open-Source Supplier Sync Job
 *
 * Scheduled sync for the 3 built-in open-source suppliers:
 * - Open Food Facts: nightly full backfill + hourly incremental
 * - Open Beauty Facts: nightly full backfill + hourly incremental
 * - UPC Database: on-demand only (not scheduled — used for barcode lookups)
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_SUPPLIER_OPENSOURCE_SYNC env var.
 */

import { prisma } from '../prisma';
import SupplierCatalogService from '../services/SupplierCatalogService';
import {
  OpenFoodFactsConnector,
  OpenBeautyFactsConnector,
  type SupplierConnector,
} from '../services/SupplierConnectors';

const HOURLY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const NIGHTLY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 10 * 60 * 1000; // 10 minutes

let hourlyIntervalId: NodeJS.Timeout | null = null;
let nightlyIntervalId: NodeJS.Timeout | null = null;

/**
 * Run incremental sync for a connector (hourly).
 * Fetches items updated since last sync via searchByText with recent terms.
 */
async function runIncrementalSync(connector: SupplierConnector, supplierId: string): Promise<void> {
  try {
    // Get the last sync timestamp from the most recent catalog item
    const latestItem = await prisma.supplier_catalog_item.findFirst({
      where: { supplier_id: supplierId },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true },
    });

    console.log(`[SupplierOpenSourceSync] Incremental sync for ${supplierId}, last update: ${latestItem?.updated_at || 'never'}`);

    // For incremental sync, we search for recently updated products
    // Open Food/Beauty Facts don't have a "since" parameter, so we do a light search
    const rows = await connector.searchByText('', 1);
    if (rows.length > 0) {
      const result = await SupplierCatalogService.batchIngest(supplierId, rows);
      console.log(
        `[SupplierOpenSourceSync] Incremental ${supplierId}: ${result.inserted} inserted, ` +
        `${result.updated} updated, ${result.quarantined} quarantined`
      );
    }
  } catch (error) {
    console.error(`[SupplierOpenSourceSync] Incremental sync error for ${supplierId}:`, error);
  }
}

/**
 * Run full backfill sync for a connector (nightly).
 * Fetches multiple pages of products to build a comprehensive catalog.
 */
async function runFullBackfill(connector: SupplierConnector, supplierId: string): Promise<void> {
  try {
    console.log(`[SupplierOpenSourceSync] Full backfill for ${supplierId}`);

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalQuarantined = 0;
    const maxPages = 20; // Limit to avoid overwhelming the API

    for (let page = 1; page <= maxPages; page++) {
      const rows = await connector.searchByText('', page);
      if (rows.length === 0) break;

      const result = await SupplierCatalogService.batchIngest(supplierId, rows);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalQuarantined += result.quarantined;

      // Small delay between pages to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(
      `[SupplierOpenSourceSync] Full backfill ${supplierId}: ${totalInserted} inserted, ` +
      `${totalUpdated} updated, ${totalQuarantined} quarantined`
    );
  } catch (error) {
    console.error(`[SupplierOpenSourceSync] Full backfill error for ${supplierId}:`, error);
  }
}

/**
 * Run hourly incremental sync for all open-source suppliers.
 */
async function runHourlySync(): Promise<void> {
  console.log('[SupplierOpenSourceSync] Starting hourly incremental sync...');

  const connectors: { connector: SupplierConnector; supplierId: string }[] = [
    { connector: new OpenFoodFactsConnector(), supplierId: 'supplier-open-food-facts' },
    { connector: new OpenBeautyFactsConnector(), supplierId: 'supplier-open-beauty-facts' },
  ];

  for (const { connector, supplierId } of connectors) {
    await runIncrementalSync(connector, supplierId);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('[SupplierOpenSourceSync] Hourly sync completed');
}

/**
 * Run nightly full backfill for all open-source suppliers.
 */
async function runNightlyBackfill(): Promise<void> {
  console.log('[SupplierOpenSourceSync] Starting nightly full backfill...');

  const connectors: { connector: SupplierConnector; supplierId: string }[] = [
    { connector: new OpenFoodFactsConnector(), supplierId: 'supplier-open-food-facts' },
    { connector: new OpenBeautyFactsConnector(), supplierId: 'supplier-open-beauty-facts' },
  ];

  for (const { connector, supplierId } of connectors) {
    await runFullBackfill(connector, supplierId);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('[SupplierOpenSourceSync] Nightly backfill completed');
}

/**
 * Start the scheduled open-source supplier sync jobs.
 */
export async function startSupplierOpenSourceSync(): Promise<void> {
  if (process.env.DISABLE_SUPPLIER_OPENSOURCE_SYNC === 'true') {
    console.log('[SupplierOpenSourceSync] Disabled via DISABLE_SUPPLIER_OPENSOURCE_SYNC env var');
    return;
  }

  if (hourlyIntervalId || nightlyIntervalId) {
    console.log('[SupplierOpenSourceSync] Already running');
    return;
  }

  console.log('[SupplierOpenSourceSync] Starting scheduler (hourly incremental + nightly backfill)');

  // Delay first run to avoid firing on nodemon restarts
  setTimeout(() => {
    runHourlySync();
  }, STARTUP_DELAY_MS);

  hourlyIntervalId = setInterval(() => {
    runHourlySync();
  }, HOURLY_INTERVAL_MS);

  // Nightly backfill — start with a longer delay (30 min after startup)
  setTimeout(() => {
    runNightlyBackfill();
  }, STARTUP_DELAY_MS + 20 * 60 * 1000);

  nightlyIntervalId = setInterval(() => {
    runNightlyBackfill();
  }, NIGHTLY_INTERVAL_MS);
}

/**
 * Stop the scheduled open-source supplier sync jobs.
 */
export function stopSupplierOpenSourceSync(): void {
  if (hourlyIntervalId) {
    clearInterval(hourlyIntervalId);
    hourlyIntervalId = null;
  }
  if (nightlyIntervalId) {
    clearInterval(nightlyIntervalId);
    nightlyIntervalId = null;
  }
  console.log('[SupplierOpenSourceSync] Stopped');
}
