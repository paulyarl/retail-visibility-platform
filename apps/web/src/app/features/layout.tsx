import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Features - VisibleShelf',
  description:
    'Explore VisibleShelf features: Clover POS sync, Google visibility, storefront, commerce, QR codes, and growth tools built for local retailers.',
  openGraph: {
    title: 'VisibleShelf Features for Local Retailers',
    description:
      'Everything your store needs to compete online: Clover POS sync, Google Shopping, storefront, QR codes, and more.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VisibleShelf Features for Local Retailers',
    description:
      'Everything your store needs to compete online: Clover POS sync, Google Shopping, storefront, QR codes, and more.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
