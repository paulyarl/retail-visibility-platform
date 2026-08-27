import type { Metadata } from 'next';
import React from 'react';
import { permanentRedirect } from 'next/navigation';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { directoryService } from '@/services/DirectorySingletonService';

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

export default async function DirectorySlugLayout({ params, children }: LayoutProps) {
  const { slug } = await params;

  // Directory presence seeds (unclaimed listings seeded from public information)
  // live at /place/{slug}. /directory/{slug} is the canonical path for claimed
  // tenants (listing_origin != 'directory_seed'). Redirect seeds away so
  // there is a single canonical URL per listing.
  try {
    const data = await directoryService.getDirectoryConsolidated(slug);
    const listing = data?.listing;

    if (listing && listing.listingOrigin === 'directory_seed') {
      permanentRedirect(`/place/${listing.slug || slug}`);
    }
  } catch {
    // If the lookup fails, fall through to the page which handles not-found.
  }

  return <>{children}</>;
}
