import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  // Legacy claim redirect — thin client page, no index value.
  robots: { index: false, follow: false },
};

export default function DirectoryClaimLayout({ children }: { children: ReactNode }) {
  return children;
}
