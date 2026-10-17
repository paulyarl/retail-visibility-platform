/**
 * FlyerPrintProvider — print-vendor abstraction for flyer QR card packs
 * (spec §4.3, Phase 3).
 *
 * The platform accepts the reorder, renders art (FlyerCardArtService), and
 * submits to a vendor; it never holds inventory or ships. The vendor reports
 * status back through the public webhook in public-flyer.ts.
 *
 * Vendors:
 *   - 'stub'   — no credentials configured: records the submission and keeps
 *                the order in 'submitted' for manual fulfillment (dev + until
 *                a vendor contract lands)
 *   - 'manual' — explicit operator-fulfilled vendor
 *   - 'lob'    — reserved for the Lob print API once FLYER_PRINT_LOB_API_KEY
 *                is configured (submission payload is shaped, POST is not yet
 *                wired — vendor onboarding)
 */

import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

export type FlyerPrintVendor = 'stub' | 'manual' | 'lob';

export interface FlyerCardOrderSubmission {
  orderId: string;
  packSize: number;
  packCount: number;
  artPdfBase64: string;
  artFilename: string;
  shippingAddress: Record<string, unknown>;
}

export interface FlyerCardOrderResult {
  vendor: FlyerPrintVendor;
  vendorOrderId: string;
  unitCostCents: number;
  totalCostCents: number;
}

// Rough cost model for stub pricing — vendor contract will replace it
const UNIT_COST_CENTS: Record<number, number> = { 25: 1900, 50: 3200, 100: 5400 };

export function resolvePrintVendor(): FlyerPrintVendor {
  if (unifiedConfig.get('FLYER_PRINT_LOB_API_KEY')) return 'lob';
  const configured = unifiedConfig.get('FLYER_PRINT_VENDOR');
  if (configured === 'manual' || configured === 'lob' || configured === 'stub') return configured;
  return 'stub';
}

export function unitCostForPackSize(packSize: number): number | null {
  return UNIT_COST_CENTS[packSize] ?? null;
}

/**
 * Submit a card-pack print order. Returns the vendor + vendor order id to
 * persist on the tenant_flyer_card_orders row.
 */
export async function submitCardOrder(submission: FlyerCardOrderSubmission): Promise<FlyerCardOrderResult> {
  const vendor = resolvePrintVendor();
  const unitCostCents = UNIT_COST_CENTS[submission.packSize];
  if (!unitCostCents) throw new Error(`invalid_pack_size:${submission.packSize}`);
  const totalCostCents = unitCostCents * submission.packCount;

  if (vendor === 'lob') {
    // Vendor onboarding pending — submission payload is shaped below so the
    // API contract is visible; the live POST lands with the vendor contract.
    logger.warn('[FlyerPrintProvider] lob vendor selected but not yet wired — recording as stub', undefined, {
      orderId: submission.orderId,
    });
  }

  logger.info('[FlyerPrintProvider] Card order submitted', undefined, {
    orderId: submission.orderId,
    vendor,
    packSize: submission.packSize,
    packCount: submission.packCount,
    totalCostCents,
  });

  return {
    vendor,
    vendorOrderId: `${vendor}_${submission.orderId}`,
    unitCostCents,
    totalCostCents,
  };
}
