import { redirect, notFound } from 'next/navigation';
import { platformOrigin } from '@/lib/storefront-routing';
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

  // The claim flow is a `public` surface — platform host only, so the target
  // is absolute and never renders under a tenant's custom domain.
  redirect(`${platformOrigin()}/place/claim/${token}`);
}
