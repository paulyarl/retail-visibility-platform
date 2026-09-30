import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrBannerPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'banner' → qr_scan_events surface 'report_banner'
  return resolveReportQrAndRedirect(shortCode, 'banner');
}
