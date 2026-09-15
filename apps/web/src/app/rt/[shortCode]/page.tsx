import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrTextPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'text' → qr_scan_events surface 'report_delivery_text'
  return resolveReportQrAndRedirect(shortCode, 'text');
}
