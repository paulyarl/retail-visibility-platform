'use client';

import { redirect, use } from 'next/navigation';

interface LegacyClaimPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Legacy redirect — claim flow moved from /directory/claim/[token] to
 * /place/claim/[token] to align with the /place/{slug} presence path.
 * Existing shared claim links are preserved via this redirect.
 */
export default function DirectoryClaimPage({ params }: LegacyClaimPageProps) {
  const { token } = use(params);
  redirect(`/place/claim/${token}`);
}
