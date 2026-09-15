import { resolveReportQrAndRedirect } from '@/lib/report-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ReportQrInPersonPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'in_person' → qr_scan_events surface 'report_delivery_in_person'
  return resolveReportQrAndRedirect(shortCode, 'in_person');
}
