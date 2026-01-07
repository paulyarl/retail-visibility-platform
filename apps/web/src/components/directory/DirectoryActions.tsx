"use client";

import { useState, useEffect } from 'react';
import { Heart, Printer, Share2, MessageSquare } from 'lucide-react';

interface DirectoryActionsProps {
  listing: {
    business_name: string;
    slug: string;
    tenantId?: string;
    description?: string;
    id?: string;
  };
  currentUrl: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function DirectoryActions({ listing, currentUrl }: DirectoryActionsProps) {
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const shareText = `Check out ${listing.business_name} in our business directory!`;
  const shareUrl = currentUrl;

  // Load favorite status from localStorage
  useEffect(() => {
    const favorites = JSON.parse(localStorage.getItem('directory_favorites') || '{}');
    setFavorited(!!favorites[listing.slug]);
    
    // Load favorite count (mock for now - could be from API)
    const counts = JSON.parse(localStorage.getItem('directory_favorite_counts') || '{}');
    setFavoriteCount(counts[listing.slug] || 0);
  }, [listing.slug]);

  const handleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('directory_favorites') || '{}');
    const counts = JSON.parse(localStorage.getItem('directory_favorite_counts') || '{}');
    
    if (favorited) {
      delete favorites[listing.slug];
      counts[listing.slug] = Math.max(0, (counts[listing.slug] || 0) - 1);
      setFavorited(false);
      setFavoriteCount(counts[listing.slug]);
    } else {
      favorites[listing.slug] = true;
      counts[listing.slug] = (counts[listing.slug] || 0) + 1;
      setFavorited(true);
      setFavoriteCount(counts[listing.slug]);
    }
    
    localStorage.setItem('directory_favorites', JSON.stringify(favorites));
    localStorage.setItem('directory_favorite_counts', JSON.stringify(counts));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.business_name,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        setShowShareOptions(true);
      }
    } else {
      setShowShareOptions(!showShareOptions);
    }
  };

  const handleReview = () => {
    const reviewsSection = document.getElementById('reviews-section');
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(listing.business_name)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
  };

  return (
    <div className="flex items-center gap-2">
      {/* Review Button */}
      <button
        onClick={handleReview}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
        title="Read and write reviews"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">Review</span>
      </button>

      {/* Favorite Button with Count */}
      <button
        onClick={handleFavorite}
        className="flex items-center gap-1 p-2 hover:bg-gray-100 rounded-lg transition-colors group"
        title={favorited ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart 
          className={`w-5 h-5 transition-colors ${
            favorited 
              ? 'fill-red-500 text-red-500' 
              : 'text-gray-600 group-hover:text-red-500'
          }`}
        />
        {favoriteCount > 0 && (
          <span className="text-xs font-medium text-gray-600">{favoriteCount}</span>
        )}
      </button>

      {/* Print Button */}
      <button
        onClick={handlePrint}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        title="Print this page"
      >
        <Printer className="w-5 h-5 text-gray-600" />
      </button>

      {/* Share Button */}
      <div className="relative">
        <button
          onClick={handleShare}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Share this business"
        >
          <Share2 className="w-5 h-5 text-gray-600" />
        </button>

      {showShareOptions && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 mb-2 px-2">Share via:</div>
            <div className="space-y-1">
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
              <a
                href={shareLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
                Twitter
              </a>
              <a
                href={shareLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <svg className="h-4 w-4 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href={shareLinks.email}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <svg className="h-4 w-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
