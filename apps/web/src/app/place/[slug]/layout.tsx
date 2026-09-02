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
    const data = await directoryService.getDirectoryConsolidated(slug);
    const listing = data?.listing;

    if (!listing) {
      return { title: 'Place Not Found' };
    }

    const businessName = listing.businessName || 'Local Business';
    const description =
      listing.description ||
      listing.publicDisclaimer ||
      `${businessName} is listed on VisibleShelf from public information (address and phone). Claim this listing to verify and update details.`;
    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const image = listing.logoUrl || `${baseUrl}/favicon.ico`;
    const title = listing.metaTitle || `${businessName} - VisibleShelf Place`;

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
    return { title: 'VisibleShelf Place' };
  }
}

export default async function PlaceSlugLayout({ params, children }: LayoutProps) {
  const { slug } = await params;

  // Redirect claimed listings to their canonical directory-entry path.
  // /place/{slug} is reserved for directory presence seeds (unclaimed listings
  // seeded from public information). Claimed tenants live at /directory/{slug}.
  try {
    const data = await directoryService.getDirectoryConsolidated(slug);
    const listing = data?.listing;

    if (listing && listing.listingOrigin !== 'directory_seed') {
      permanentRedirect(`/directory/${listing.slug || slug}`);
    }
  } catch {
    // If the lookup fails, fall through to the page which handles not-found.
  }

  return <>{children}</>;
}
