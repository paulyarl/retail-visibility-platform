import { resolveIntakeAndRedirect } from '@/lib/intake-scan-redirect';
import type { IntakeScanSurface } from '@/services/IntakeShortCodeService';

export const dynamic = 'force-dynamic';

const SURFACES: ReadonlySet<string> = new Set(['sms', 'email', 'qr', 'call']);

export default async function IntakeShortLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ shortCode: string }>;
  searchParams: Promise<{ surface?: string }>;
}) {
  const { shortCode } = await params;
  const { surface } = await searchParams;
  // Bare /i/{code} links attribute to 'sms' (the primary outreach channel for
  // these links); templates can override with ?surface=email|qr|call.
  const resolved: IntakeScanSurface = surface && SURFACES.has(surface)
    ? (surface as IntakeScanSurface)
    : 'sms';
  return resolveIntakeAndRedirect(shortCode, resolved);
}
