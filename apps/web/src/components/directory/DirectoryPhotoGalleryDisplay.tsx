"use client";

import { useState, useEffect } from "react";
import { directoryListingService } from '@/services/DirectoryListingSingletonService';
import { clientLogger } from '@/lib/client-logger';
import ZoomableImageCarousel, { type CarouselPhoto } from '@/components/directory/ZoomableImageCarousel';

type DirectoryListing = {
  id: string;
  business_name?: string;
  is_directory_published?: boolean;
};

interface DirectoryPhotoGalleryDisplayProps {
  listing: DirectoryListing;
  isPublished: boolean;
}



export default function DirectoryPhotoGalleryDisplay({ listing, isPublished }: DirectoryPhotoGalleryDisplayProps) {
  const [photos, setPhotos] = useState<CarouselPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true);
        // console.log(`Checking if listing is published: ${listing.id}`);
        // console.log(`Checking if listing is published: ${JSON.stringify(listing)}`);
        // console.log(`Listing published status: ${listing.is_directory_published}`);
        if (!isPublished) {
          console.log(`Listing is not published, skipping photo loading`);
          return;
        }
        const photoAssets = await directoryListingService.getDirectoryListingPhotos(listing.id);
        // console.log(`Loaded ${photoAssets.length} photos`);
        setPhotos(photoAssets.sort((a, b) => a.position - b.position));
      } catch (e) {
        clientLogger.error("Failed to load directory photos:", { detail: e });
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [listing.id]);

  if (loading) {
    return null; // Don't show loading state on public pages
  }

  if (photos.length === 0) {
    return null; // Don't render if no photos
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Store Gallery</h2>
      <ZoomableImageCarousel photos={photos} fallbackAlt={listing.business_name || "Business photo"} />
    </div>
  );
}
