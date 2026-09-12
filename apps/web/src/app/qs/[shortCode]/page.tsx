import { resolveClaimQrAndRedirect } from '@/lib/claim-qr-redirect';

export const dynamic = 'force-dynamic';

export default async function ClaimQrSocialPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  // Surface 'social' → qr_scan_events surface 'claim_invite_social'
  return resolveClaimQrAndRedirect(shortCode, 'social');
}
