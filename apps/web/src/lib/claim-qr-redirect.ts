/**
 * Claim QR short-URL redirect helper
 *
 * Shared resolve + track + redirect logic for the /q/, /qw/, /qs/ short-URL
 * pages. Each page is a thin wrapper that passes its delivery surface; the
 * surface is a typed `ClaimQrSurface` so per-surface scan tracking can never
 * drift (no free-string surface param to mistype).
 *
 * Flow:
 *   1. Resolve the 6-char short code → claim token via the combined
 *      /api/public/qr/claim-scan endpoint (records the qr_scan_events row
 *      with the correct surface in the same request).
 *   2. notFound() if the code is invalid / expired / consumed.
 *   3. redirect() to /place/claim/{token}.
 *
 * `redirect()` and `notFound()` throw Next.js control-flow errors, so they
 * propagate up from this helper to the calling page component.
 */

import { redirect, notFound } from 'next/navigation';
import { claimQrScanService, type ClaimQrSurface } from '@/services/ClaimQrScanService';

export async function resolveClaimQrAndRedirect(
  shortCode: string,
  surface: ClaimQrSurface,
): Promise<never> {
  const token = await claimQrScanService.resolveAndTrack(shortCode, surface);

  if (!token) {
    notFound();
  }

  redirect(`/place/claim/${token}`);
}
