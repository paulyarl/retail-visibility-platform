import { redirect, notFound } from 'next/navigation';
import { claimQrScanService } from '@/services/ClaimQrScanService';

export const dynamic = 'force-dynamic';

export default async function ClaimQrWalkinPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;

  // Resolve short code → claim token AND record a QR scan event (surface:
  // claim_invite_walkin) in one API call, then redirect to the claim page.
  const token = await claimQrScanService.resolveAndTrack(shortCode, 'walkin');

  if (!token) {
    notFound();
  }

  redirect(`/place/claim/${token}`);
}
