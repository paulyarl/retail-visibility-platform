import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrEmailPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'email' → qr_scan_events surface 'report_delivery_email'
  return resolveReportQrAndRedirect(shortCode, 'email');
}
