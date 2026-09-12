import { redirect, notFound } from 'next/navigation';
import { claimShortCodeService } from '@/services/ClaimShortCodeService';

export const dynamic = 'force-dynamic';

export default async function ClaimShortCodePage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;

  // Resolve short code → claim token via dedicated claim-code API
  const token = await claimShortCodeService.resolveShortCode(shortCode);

  if (!token) {
    notFound();
  }

  redirect(`/place/claim/${token}`);
}
