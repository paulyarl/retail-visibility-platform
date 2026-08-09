import { redirect, notFound } from 'next/navigation';
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
  const target = resolved.isMultiGallery
    ? `/preview/${resolved.token}?prospect=true`
    : `/preview/${resolved.token}`;

  redirect(target);
}
