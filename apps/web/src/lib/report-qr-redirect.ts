/**
 * Report QR short-URL redirect helper
 *
 * Shared resolve + track + redirect logic for the /r/, /rt/, /re/, /rs/,
 * /rp/ short-URL pages. Each page is a thin wrapper that passes its delivery
 * surface; the surface is a typed `ReportQrSurface` so per-surface scan
 * tracking can never drift.
 *
 * Flow:
 *   1. Resolve the 6-char short code → seed_id via the combined
 *      /api/public/r/report-scan endpoint (records the qr_scan_events row
 *      with the correct surface in the same request).
 *   2. notFound() if the code is invalid / expired / consumed.
 *   3. redirect() to /seed-report/{seedId}.
 *
 * `redirect()` and `notFound()` throw Next.js control-flow errors, so they
 * propagate up from this helper to the calling page component.
 */

import { redirect, notFound } from 'next/navigation';
import { reportQrScanService, type ReportQrSurface } from '@/services/ReportQrScanService';

export async function resolveReportQrAndRedirect(
  shortCode: string,
  surface: ReportQrSurface,
): Promise<never> {
  const seedId = await reportQrScanService.resolveAndTrack(shortCode, surface);

  if (!seedId) {
    notFound();
  }

  redirect(`/seed-report/${seedId}`);
}
