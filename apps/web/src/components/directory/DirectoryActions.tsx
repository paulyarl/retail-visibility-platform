"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Printer, Share2, MessageSquare, ShoppingCart } from 'lucide-react';
import { useMultiCart } from '@/hooks/useMultiCart';

interface DirectoryActionsProps {
  listing: {
    business_name: string;
    slug: string;
    tenantId?: string;
    description?: string;
    id?: string;
  };
  currentUrl: string;
  variant?: 'directory' | 'product';
  entity_name?: string;
}



export default function DirectoryActions({ listing, currentUrl, variant = 'directory', entity_name }: DirectoryActionsProps) {
  const router = useRouter();
  const { totalItems } = useMultiCart(); // Show total items across ALL carts, not just this tenant
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const shareText = `Check out ${entity_name || listing.business_name} in our ${variant === 'product' ? 'product' : 'business'} directory!`;
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
          title: entity_name || listing.business_name,
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

  const handleViewCart = () => {
    router.push('/carts');
  };

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(entity_name || listing.business_name)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
  };

  return (
    <div className="flex items-center gap-2">
      {/* Review Button */}
     
        <a
                     onClick={handleReview}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
                    title="View and write reviews"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg><MessageSquare className="w-4 h-4" />
                    <span className="hidden lg:inline">Review</span>
                  </a>

      {/* Cart Button */}
     
       <a
                     onClick={handleViewCart}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
                    title="View your shopping cart"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 014 4z" />
                  </svg>
				 
                    <span className="hidden lg:inline">Cart</span> {totalItems > 0 && (
                    <span className="flex items-center justify-center -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white">
                      {totalItems > 99 ? '99+' : totalItems}
                    </span>
                  )}
                  </a>

      {/* Favorite Button with Count */}
     
      <a
                    onClick={handleFavorite}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
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
                  </a>
                   {/* Print Button */}
      <a               onClick={handlePrint}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
        title="Print this page"
      
                  >
                    <Printer className="w-5 h-5 text-gray-600" />
				 
                     
                  

                   
                  </a>
 
 {/* Share Button */}
      <a                 onClick={handleShare}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
       
          title="Share this business"
      
                  >
                    <Share2 className="w-5 h-5 text-gray-600" />
					</a>
                     
      {showShareOptions && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 mb-2 px-2">Share via:</div>
            <div className="space-y-1">
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-indigo-100 rounded"
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
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-indigo-100 rounded"
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
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-indigo-100 rounded"
              >
                <svg className="h-4 w-4 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href={shareLinks.email}
                className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 hover:bg-indigo-100 rounded"
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
  );
}
