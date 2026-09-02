import type { Metadata } from 'next';
import React from 'react';
import { permanentRedirect } from 'next/navigation';
import { directoryService } from '@/services/DirectorySingletonService';

interface LayoutProps {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  try {
    // Use the consolidated route (same as /place) so we get the seed-scoped
    // meta_title and composed description. Falls back to publicDirectoryService
    // for claimed tenants whose listing_origin is not 'directory_seed'.
    const data = await directoryService.getDirectoryConsolidated(slug);
    const listing = data?.listing;

    if (!listing) {
      return { title: 'Store Not Found' };
    }

    const businessName = listing.businessName || 'Local Business';
    const description =
      listing.description ||
      listing.publicDisclaimer ||
      `Visit ${businessName} on VisibleShelf to browse products, hours, and contact information.`;
    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const image = listing.logoUrl || `${baseUrl}/favicon.ico`;
    const title = listing.metaTitle || `${businessName} - VisibleShelf Directory`;

    return {
      metadataBase: new URL(baseUrl),
      title,
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
