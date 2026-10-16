/**
 * Report QR short-URL redirect helper
 *
 * Shared resolve + track + redirect logic for the /r/, /rt/, /re/, /rs/,
 * /rp/, /rb/ short-URL pages and the /r/seed/{seedId}/{channel} seed-id
 * variant. Each page is a thin wrapper that passes its delivery
 * surface; the surface is a typed `ReportQrSurface` so per-surface scan
 * tracking can never drift.
 *
 * Flow:
 *   1. Resolve the 6-char short code → seed_id via the combined
 *      /api/public/r/report-scan endpoint (records the qr_scan_events row
 *      with the correct surface in the same request).
 *   2. notFound() if the code is invalid / expired / consumed.
 *   3. redirect() to /seed-report/{seedId} — ABSOLUTE on the platform origin.
 *
 * The seed report is a `public` surface (surface-class table,
 * `lib/storefront-routing.ts`) — platform host only, so the target is emitted
 * absolute and never renders under a tenant's custom domain.
 *
 * `redirect()` and `notFound()` throw Next.js control-flow errors, so they
 * propagate up from this helper to the calling page component.
 */

import { redirect, notFound } from 'next/navigation';
import { platformOrigin } from '@/lib/storefront-routing';
import { reportQrScanService, type ReportQrSurface } from '@/services/ReportQrScanService';

export async function resolveReportQrAndRedirect(
  shortCode: string,
  surface: ReportQrSurface,
): Promise<never> {
  const seedId = await reportQrScanService.resolveAndTrack(shortCode, surface);

  if (!seedId) {
    notFound();
  }

  redirect(`${platformOrigin()}/seed-report/${seedId}`);
}

/**
 * Seed-id variant for /r/seed/{seedId}/{channel} — the frontend mirror of
 * the /api/public/r/seed/:seedId/:channel redirect. No code resolution is
 * needed (the seed id is already the address); the endpoint exists to
 * verify the seed and record the scan under the channel's surface.
 * notFound() when the seed doesn't exist.
 */
export async function trackSeedReportAndRedirect(
  seedId: string,
  surface: ReportQrSurface,
): Promise<never> {
  const resolved = await reportQrScanService.resolveSeedAndTrack(seedId, surface);

  if (!resolved) {
    notFound();
  }

  redirect(`${platformOrigin()}/seed-report/${resolved}`);
}
