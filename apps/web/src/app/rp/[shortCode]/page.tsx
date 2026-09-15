import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrPhonePage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'phone' → qr_scan_events surface 'report_delivery_phone'
  return resolveReportQrAndRedirect(shortCode, 'phone');
}
