import { notFound } from 'next/navigation';
import { trackSeedReportAndRedirect } from '@/lib/report-qr-redirect';
import type { ReportQrSurface } from '@/services/ReportQrScanService';

export const dynamic = 'force-dynamic';

const VALID_CHANNELS = new Set<ReportQrSurface>([
  'in_person',
  'text',
  'email',
  'social',
  'phone',
  'banner',
  'claimed',
]);

/**
 * Seed-id tracked report redirect — /r/seed/{seedId}/{channel}.
 *
 * The frontend mirror of the API's /api/public/r/seed/:seedId/:channel
 * redirect: used by public surfaces that link the seed report but have no
 * claim-token short code to shorten the URL (uninvited seeds' banner CTA,
 * claimed listings' report CTA, delivery-kit QR fallbacks). Records the
 * qr_scan_events row under the channel's surface, then redirects to
 * /seed-report/{seedId}.
 *
 * Static 'seed' segment wins over /r/[shortCode] (same precedent as
 * /r/pr/[code]) — claim/report short codes are 6-char alphanumeric and
 * never collide with the literal 'seed'.
 */
export default async function ReportQrSeedPage({
  params,
}: {
  params: Promise<{ seedId: string; channel: string }>;
}) {
  const { seedId, channel } = await params;
  if (!VALID_CHANNELS.has(channel as ReportQrSurface)) {
    notFound();
  }
  return trackSeedReportAndRedirect(seedId, channel as ReportQrSurface);
}
