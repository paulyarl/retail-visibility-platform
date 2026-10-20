import { redirect, notFound } from 'next/navigation';
import { platformOrigin } from '@/lib/storefront-routing';
import { cascadeShortCodeService, type CascadeQrSurface } from '@/services/CascadeShortCodeService';

export const dynamic = 'force-dynamic';

const SURFACES = new Set<CascadeQrSurface>([
  'cascade_postcard',
  'cascade_confirm',
  'cascade_gallery',
]);

/**
 * /cf/[code] — Four-Act cascade tagged short link.
 *
 * Records the scan on the requested cascade surface, then redirects to the
 * underlying gallery/confirm token. The surface is part of the QR URL so a
 * postcard scan, a confirm-page scan, and a gallery scan stay distinguishable.
 */
export default async function CascadeShortCodePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ surface?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const requested = sp?.surface as CascadeQrSurface | undefined;
  const surface = requested && SURFACES.has(requested) ? requested : 'cascade_postcard';

  const url = await cascadeShortCodeService.resolveAndTrack(code, surface);
  if (!url) notFound();

  redirect(url.startsWith('http') ? url : `${platformOrigin()}${url}`);
}
