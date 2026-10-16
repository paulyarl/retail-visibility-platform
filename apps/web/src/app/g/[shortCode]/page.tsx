import { redirect, notFound } from 'next/navigation';
import { platformOrigin } from '@/lib/storefront-routing';
import { galleryShortCodeService } from '@/services/GalleryShortCodeService';

export const dynamic = 'force-dynamic';

export default async function GalleryShortCodePage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;

  // Resolve short code → preview token via dedicated gallery-code API
  const resolved = await galleryShortCodeService.resolveShortCode(shortCode);

  if (!resolved) {
    notFound();
  }

  // Multi-gallery tokens append ?prospect=true so the preview page renders
  // MultiGalleryPage instead of the single GalleryClient.
  // The gallery is a `public` surface — platform host only, so the target is
  // absolute and never renders under a tenant's custom domain.
  const target = resolved.isMultiGallery
    ? `${platformOrigin()}/preview/${resolved.token}?prospect=true`
    : `${platformOrigin()}/preview/${resolved.token}`;

  redirect(target);
}
