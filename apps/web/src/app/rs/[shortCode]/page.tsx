import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrSocialPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'social' → qr_scan_events surface 'report_delivery_social'
  return resolveReportQrAndRedirect(shortCode, 'social');
}
