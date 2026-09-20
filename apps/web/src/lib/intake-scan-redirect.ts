/**
 * Intake short-URL redirect helper (Profile Repair Fulfillment Sprint W4d)
 *
 * Resolve + track + redirect logic for the /i/{shortCode} page. The surface
 * is a typed `IntakeScanSurface` so per-channel scan tracking can never
 * drift (no free-string surface param to mistype).
 *
 * Flow:
 *   1. Resolve the 6-char short code → current access token via the combined
 *      /api/public/intake-scan endpoint (records the qr_scan_events row
 *      with the correct surface in the same request).
 *   2. Unresolved code → /recovery/intake root, which renders its existing
 *      invalid-token state.
 *   3. Resolved → redirect() to /recovery/intake?token={token}.
 *
 * `redirect()` throws a Next.js control-flow error, so it propagates up from
 * this helper to the calling page component.
 */

import { redirect } from 'next/navigation';
import { intakeShortCodeService, type IntakeScanSurface } from '@/services/IntakeShortCodeService';

export async function resolveIntakeAndRedirect(
  shortCode: string,
  surface: IntakeScanSurface,
): Promise<never> {
  const resolved = await intakeShortCodeService.resolveAndTrack(shortCode, surface);

  if (!resolved?.token) {
    redirect('/recovery/intake');
  }

  redirect(`/recovery/intake?token=${encodeURIComponent(resolved.token)}`);
}
