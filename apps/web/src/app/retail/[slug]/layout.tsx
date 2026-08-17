import type { Metadata } from 'next';
import React from 'react';

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  // Private preview — not indexed. Search engines should never discover this.
  return {
    title: 'Business Profile Preview - VisibleShelf',
    description: 'Private preview of a business profile on VisibleShelf.',
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  };
}

export default function RetailSlugLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
