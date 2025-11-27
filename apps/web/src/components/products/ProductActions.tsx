import { useState, useEffect, useRef } from 'react';
import { api, apiRequest } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  sku: string;
  brand: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  metadata?: {
    businessName?: string;
  };
}

interface ProductActionsProps {
  product: Product;
  tenant: Tenant;
  productUrl: string;
  variant?: 'product' | 'storefront';
}

export default function ProductActions({ product, tenant, productUrl, variant = 'product' }: ProductActionsProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const productTitle = product.title || product.name;
  const businessName = tenant.metadata?.businessName || tenant.name;
  const shareText = variant === 'product' 
    ? `Check out "${productTitle}" from ${businessName} - $${product.price}`
    : `Check out ${businessName} - great products and deals!`;
  const shareUrl = productUrl;

  const fetchLikeStatus = async () => {
    try {
      const response = await api.get(`api/products/${product.id}/likes`);
      if (response.ok) {
        const data = await response.json();
        setLiked(data.userLiked);
        setLikeCount(data.likes);
      }
    } catch (error) {
      console.error('Failed to fetch like status:', error);
    }
  };

  useEffect(() => {
    if (variant === 'product') {
      fetchLikeStatus();
    }
  }, [product.id, variant]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowShareOptions(false);
      }
    };

    if (showShareOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareOptions]);

  // Handle Share
  const handleShare = async () => {
    if (navigator.share) {
      // Use Web Share API if available (mobile)
      try {
        await navigator.share({
          title: variant === 'product' ? productTitle : businessName,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error, show fallback
        setShowShareOptions(true);
      }
    } else {
      // Fallback to showing share options
      setShowShareOptions(!showShareOptions);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLike = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const method = liked ? 'DELETE' : 'POST';
      const endpoint = `api/products/${product.id}/like`;
      
      let response;
      if (method === 'POST') {
        response = await api.post(endpoint);
      } else {
        response = await apiRequest(endpoint, { method: 'DELETE' });
      }

      if (response.ok) {
        const data = await response.json();
        setLiked(data.userLiked);
        setLikeCount(data.likes);
      } else {
        console.error('Failed to toggle like:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setLoading(false);
    }
  };

  // Social media share URLs
  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(productTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {variant === 'product' && (
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                liked
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
              title={liked ? 'Unlike this product' : 'Like this product'}
            >
              <svg
                className={`h-5 w-5 ${liked ? 'fill-current' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="text-sm font-medium">
                {liked ? 'Liked' : 'Like'} {likeCount > 0 && `(${likeCount})`}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Visit Storefront Link - Only on product pages */}
          {variant === 'product' && (
            <a
              href={`/tenant/${product.tenantId}`}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Visit the full storefront"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="text-sm font-medium hidden sm:inline">Storefront</span>
            </a>
          )}

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
            title="Print this product page"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">Print</span>
          </button>

          {/* Share Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Share this product"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              <span className="text-sm font-medium hidden sm:inline">Share</span>
            </button>

            {/* Share Options Dropdown */}
            {showShareOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 z-10">
                <div className="p-2">
                  <div className="text-xs font-medium text-neutral-500 mb-2 px-2">Share via:</div>
                  <div className="space-y-1">
                    <a
                      href={shareLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded"
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
                      className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded"
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
                      className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded"
                    >
                      <svg className="h-4 w-4 text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </a>
                    <a
                      href={shareLinks.email}
                      className="flex items-center gap-2 px-2 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded"
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
      </div>
    </div>
  );
}
