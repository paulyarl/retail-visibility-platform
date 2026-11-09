import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  // Internal product-discovery tool — a client-rendered shell with no index
  // contract. Keep it out of the index explicitly.
  robots: { index: false, follow: false },
};

export default function CrossTenantLayout({ children }: { children: ReactNode }) {
  return children;
}
