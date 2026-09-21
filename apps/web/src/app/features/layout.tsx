import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Features: Make Your Physical Shelves Visible | VisibleShelf',
  description:
    'Discover how VisibleShelf brings physical retail shelves online: POS sync, item-level Google search, branded mobile storefronts, and deposit-backed counter pickup. Zero delivery logistics, zero commissions.',
  openGraph: {
    title: 'VisibleShelf Features: Make Physical Shelves Visible',
    description:
      'Everything your physical store needs to turn local search into foot traffic: POS sync, item-level Google search, branded mobile storefronts, and in-store pickup.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VisibleShelf Features: Make Physical Shelves Visible',
    description:
      'Everything your physical store needs to turn local search into foot traffic: POS sync, item-level Google search, branded mobile storefronts, and in-store pickup.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
