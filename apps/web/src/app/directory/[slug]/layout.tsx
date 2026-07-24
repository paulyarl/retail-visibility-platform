import type { Metadata } from 'next';
import React from 'react';
import { publicDirectoryService } from '@/services/PublicDirectoryService';

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const item = await publicDirectoryService.getDirectoryItem(slug);

    if (!item) {
      return {
        title: 'Store Not Found',
      };
    }

    const businessName = item.businessName || item.name || 'Local Business';
    const description =
      item.description ||
      `Visit ${businessName} on VisibleShelf to browse products, hours, and contact information.`;
    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const image = item.logoUrl || item.bannerUrl || `${baseUrl}/favicon.ico`;

    return {
      metadataBase: new URL(baseUrl),
      title: `${businessName} - VisibleShelf Directory`,
      description,
      openGraph: {
        title: businessName,
        description,
        type: 'website',
        images: [image],
      },
      twitter: {
        card: 'summary_large_image',
        title: businessName,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: 'Store Directory',
    };
  }
}

export default function DirectorySlugLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
