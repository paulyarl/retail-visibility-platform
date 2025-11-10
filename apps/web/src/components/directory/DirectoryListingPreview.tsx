'use client';

import { DirectoryListing } from '@/hooks/directory/useDirectoryListing';
import DirectoryStatusBadge from './DirectoryStatusBadge';

interface DirectoryListingPreviewProps {
  listing: DirectoryListing;
}

export default function DirectoryListingPreview({ listing }: DirectoryListingPreviewProps) {
  const businessName = listing.businessProfile?.businessName || 'Your Business';
  const location = listing.businessProfile?.city && listing.businessProfile?.state
    ? `${listing.businessProfile.city}, ${listing.businessProfile.state}`
    : 'Location not set';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {businessName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {location}
            </p>
          </div>
          {listing.businessProfile?.logoUrl && (
            <img
              src={listing.businessProfile.logoUrl}
              alt={businessName}
              className="w-16 h-16 rounded-lg object-cover ml-4"
            />
          )}
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <DirectoryStatusBadge
            isPublished={listing.isPublished}
            isFeatured={listing.isFeatured}
          />
        </div>

        {/* Categories */}
        {listing.primaryCategory && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {listing.primaryCategory}
              </span>
              {listing.secondaryCategories?.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {listing.seoDescription && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
              {listing.seoDescription}
            </p>
          </div>
        )}

        {/* Keywords */}
        {listing.seoKeywords && listing.seoKeywords.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Keywords:
            </p>
            <div className="flex flex-wrap gap-1">
              {listing.seoKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {listing.isPublished ? (
              <>
                Published • Last updated {new Date(listing.updatedAt).toLocaleDateString()}
              </>
            ) : (
              <>
                Draft • Complete your profile to publish
              </>
            )}
          </p>
        </div>
      </div>

      {/* Preview Note */}
      <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          📋 This is how your listing will appear in the directory
        </p>
      </div>
    </div>
  );
}
