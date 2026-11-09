import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  // Claim-token flow — linked from every shelf's claim CTAs but a thin client
  // page with no index value.
  robots: { index: false, follow: false },
};

export default function PlaceClaimLayout({ children }: { children: ReactNode }) {
  return children;
}
