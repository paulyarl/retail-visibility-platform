import { resolveClaimQrAndRedirect } from '@/lib/claim-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ClaimQrMailPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'mail' → qr_scan_events surface 'claim_invite'
  return resolveClaimQrAndRedirect(shortCode, 'mail');
}
