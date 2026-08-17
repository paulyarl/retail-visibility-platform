'use client';

import { redirect, useParams } from 'next/navigation';

/**
 * Legacy redirect — claim flow moved from /directory/claim/[token] to
 * /place/claim/[token] to align with the /place/{slug} presence path.
 * Existing shared claim links are preserved via this redirect.
 */
export default function DirectoryClaimPage() {
  const params = useParams<{ token: string }>();
  redirect(`/place/claim/${params.token}`);
}
