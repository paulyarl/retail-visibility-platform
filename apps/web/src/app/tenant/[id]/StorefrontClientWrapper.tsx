"use client";

import React, { useState, useEffect } from 'react';
import { featuredProductsSingleton } from '@/providers/data/FeaturedProductsSingleton';
import { FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';
import StorefrontViewTracker from '@/components/tracking/StorefrontViewTracker';
import ContactInformationCollapsible from '@/components/storefront/ContactInformationCollapsible';
import BusinessHoursCollapsible from '@/components/storefront/BusinessHoursCollapsible';
import GoogleMapEmbed from '@/components/shared/GoogleMapEmbed';
import StorefrontMap from '@/components/storefront/StorefrontMap';
import EnhancedProductDisplay from '@/components/storefront/EnhancedProductDisplay';
import FeaturedProductsSection from '@/components/storefront/FeaturedProductsSection';
import SmartProductCard from '@/components/products/SmartProductCard';
import FeaturedBucketSimple from '@/components/storefront/FeaturedBucketSimple';
import StorefrontActions from '@/components/storefront/StorefrontActions';
import StoreStatusIndicator from '@/components/storefront/StoreStatusIndicator';
import Image from 'next/image';
import Link from 'next/link';
import { Pagination } from '@/components/ui';
import { StoreRatingDisplay } from '@/components/reviews/StoreRatingDisplay';
// import { useStoreContactData } from '@/hooks/useStoreContactData';

import { computeStoreStatus } from '@/lib/hours-utils';
import { directoryService } from '@/services/DirectorySingletonService';

interface StorefrontClientWrapperProps {
  tenantId: string;
  tenant: any;
  platformSettings: any;
  mapLocation: any;
  hasBranding: boolean;
  storeStatus: any;
  categories: any[];
  productCategories: any[];
  storeCategories: any[];
  uncategorizedCount: number;
  paymentGateways?: any[];
  businessName: string;
  businessHours?: any;
  search?: string;
  category?: string;
  featured?: string;
  view?: string;
  isProductsOnly: boolean; 
  directoryPublished: boolean;
  tenantSlug: string;
  primaryGBPCategory: any;
  secondaryGBPCategories: any[];
  tier: string;
  features: any;
  totalAllProducts: number;
  fullWidthLayout?: boolean;
  products?: any[]; // Add products prop
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
}

export default function StorefrontClientWrapper({
  tenantId,
  tenant,
  platformSettings,
  mapLocation,
  hasBranding,
  storeStatus: initialStoreStatus,
  categories,
  productCategories,
  storeCategories,
  uncategorizedCount,
  paymentGateways,
  businessName,
  businessHours,
  search,
  category,
  featured,
  view,
  isProductsOnly, 
  directoryPublished,
  tenantSlug,
  primaryGBPCategory,
  secondaryGBPCategories,
  tier,
  features,
  totalAllProducts,
  fullWidthLayout = false,
  products = [],
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
}: StorefrontClientWrapperProps) {
  // Extract contact information from tenant metadata
  const contactInfo = {
    phone: tenant.metadata?.phone,
    email: tenant.metadata?.email,
    address: tenant.metadata?.address,
    website: tenant.metadata?.website
  };
  
  // Log what data StorefrontClientWrapper received
  console.log('[StorefrontClientWrapper] Received tenant metadata:', tenant.metadata);
  console.log('[StorefrontClientWrapper] Extracted contact info:', contactInfo);
  console.log('[StorefrontClientWrapper] Initial store status:', initialStoreStatus);
  
  // console.log('[StorefrontClientWrapper] Contact data:', contactData.listing);
  // console.log('[StorefrontClientWrapper] Tenant metadata phone:', tenant.metadata?.phone);
  // console.log('[StorefrontClientWrapper] Tenant metadata email:', tenant.metadata?.email);
  
  const [featuredCounts, setFeaturedCounts] = useState({
    staffPick: 0,
    seasonal: 0,
    sale: 0,
    newArrival: 0,
    storeSelection: 0,
  });

  const [isFullWidth, setIsFullWidth] = useState(fullWidthLayout);
  const [featuredData, setFeaturedData] = useState<any>(null);

  // Fetch featured data on mount
  useEffect(() => {
    const loadFeaturedCounts = async () => {
      try {
        let data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
        
        // Validate cache: if data is empty, force a fresh fetch
        if (data && data.totalCount === 0 && (!data.buckets || data.buckets.length === 0)) {
          console.warn('[StorefrontClientWrapper] Detected empty cached data, forcing fresh fetch');
          // Clear cache and fetch fresh data
          await featuredProductsSingleton.clearCache();
          data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
        }
        
        if (data) {
          // console.log('Featured data response:', data);
          // console.log('Buckets:', data.buckets);
          
          // Debug each bucket
          /* data.buckets?.forEach((bucket: any) => {
            console.log(`Bucket ${bucket.bucketType}:`, {
              totalCount: bucket.totalCount,
              productsCount: bucket.products?.length || 0,
              products: bucket.products?.slice(0, 2).map((p: any) => ({ id: p.id, name: p.name }))
            });
          }); */
          
          // Transform bucket data into the expected format
          const transformedData = {
            totalCount: data.totalCount,
            staffPick: data.buckets?.find((b: any) => b.bucketType === 'staff_pick')?.products || [],
            seasonal: data.buckets?.find((b: any) => b.bucketType === 'seasonal')?.products || [],
            sale: data.buckets?.find((b: any) => b.bucketType === 'sale')?.products || [],
            newArrival: data.buckets?.find((b: any) => b.bucketType === 'new_arrival')?.products || [],
            storeSelection: data.buckets?.find((b: any) => b.bucketType === 'store_selection')?.products || [],
            bucketCounts: {
              staff_pick: data.buckets?.find((b: any) => b.bucketType === 'staff_pick')?.totalCount || 0,
              seasonal: data.buckets?.find((b: any) => b.bucketType === 'seasonal')?.totalCount || 0,
              sale: data.buckets?.find((b: any) => b.bucketType === 'sale')?.totalCount || 0,
              new_arrival: data.buckets?.find((b: any) => b.bucketType === 'new_arrival')?.totalCount || 0,
              store_selection: data.buckets?.find((b: any) => b.bucketType === 'store_selection')?.totalCount || 0,
            }
          };
          
          setFeaturedData(transformedData);
          
          // Set featured counts
          setFeaturedCounts({
            staffPick: transformedData.bucketCounts.staff_pick,
            seasonal: transformedData.bucketCounts.seasonal,
            sale: transformedData.bucketCounts.sale,
            newArrival: transformedData.bucketCounts.new_arrival,
            storeSelection: transformedData.bucketCounts.store_selection,
          });
        }
      } catch (err) {
        console.error('Failed to load featured counts:', err);
      }
    };

    if (tenantId) {
      loadFeaturedCounts();
    }
  }, [tenantId]);

  // Helper function to get featured type display name
  const getFeaturedTypeName = (type: string) => {
    switch (type) {
      case 'store_selection': return 'Featured Products';
      case 'new_arrival': return 'New Arrivals';
      case 'seasonal': return 'Seasonal Specials';
      case 'sale': return 'Sale Items';
      case 'staff_pick': return 'Staff Picks';
      default: return 'Products';
    }
  };

  const getCategoryUrl = (category: any, basePath: string) => {
    if (!category) return basePath;
    const categoryName = category.name?.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-') || 'uncategorized';
    return `${basePath}/${categoryName}`;
  };

  return (
    <>
      {/* Simplified Header - Brand Identity and Actions */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Mobile: Stacked layout, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Brand Identity */}
            <div className="flex items-center gap-4">
              {/* Store Logo */}
              <div className="flex-shrink-0">
                {tenant.metadata?.logo_url ? (
                  <div className="relative w-12 h-12">
                    <Image
                      src={tenant.metadata.logo_url}
                      alt={businessName}
                      fill
                      className="object-contain rounded-lg shadow-sm"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center shadow-sm">
                    <svg className="w-6 h-6 text-primary-600 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Store Name and Category */}
              <div>
                <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
                  {businessName || 'Store Name Not Available'}
                </h1>
                {primaryGBPCategory && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {primaryGBPCategory.name}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-2">
              {/* Review Button */}
              <button 
                onClick={() => {
                  const reviewsSection = document.getElementById('reviews-section');
                  if (reviewsSection) {
                    reviewsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" 
                title="Reviews"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              {/* Contact Button */}
              <button 
                onClick={() => {
                  const contactSection = document.getElementById('contact-section');
                  if (contactSection) {
                    contactSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" 
                title="Contact Us"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Cart Button */}
              <button className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" title="Cart">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 014 4z" />
                </svg>
              </button>

              {/* Heart/Favorite Button */}
              <button className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" title="Favorite">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>

              {/* Print Button */}
              <button className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" title="Print">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>

              {/* Share Button */}
              <button className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors" title="Share">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

            {/* Store Open/Closed Status */}
            <StoreStatusIndicator tenantId={tenantId} />
      </header>

      {/* Contact Information & Business Hours - Top Priority */}
      <div className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div>
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Information
                </h2>
                <ContactInformationCollapsible 
                  tenant={tenant} 
                  contactData={{
                    phone: tenant.metadata?.phone,
                    email: tenant.metadata?.email,
                    address: tenant.metadata?.address
                  }}
                />
              </div>
            </div>

            {/* Business Hours */}
            <div>
              <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Business Hours
                </h2>
                <BusinessHoursCollapsible businessHours={businessHours} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Description & Gallery - About the Store */}
      <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Shop Description */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">About {businessName}</h2>
                  <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {tenant.metadata?.businessDescription || 
                       `${businessName} is your trusted local store offering quality products and exceptional service. We're committed to providing the best shopping experience for our customers.`}
                    </p>
                  </div>
                </div>

                {/* Social Links */}
                {tenant.metadata?.social_links && (
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">Connect With Us</h3>
                    <div className="flex flex-wrap gap-3">
                      {tenant.metadata.social_links.facebook && (
                        <a 
                          href={tenant.metadata.social_links.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-1.58 1.036-2.683 2.499-2.683h2.09v3.47h-2.09c-.247 0-.447.22-.447.49v2.46h2.53v3.47h-2.53c-.246 0-.447.22-.447.49v4.354C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                          Facebook
                        </a>
                      )}
                      {tenant.metadata.social_links.instagram && (
                        <a 
                          href={tenant.metadata.social_links.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 2.165.045.12.12.259.12.424 0 .165-.046.349-.12.424-.049-.104-.4-.15-.852-.15-.656.02-1.305.08-1.917.161-.425.084-.849.262-1.165.516-.316.253-.58.598-.734.976-.154.378-.258.771-.316 1.165-.058.394-.08.8-.08 1.165 0 1.495.145 2.842.145 3.204v3.92h-3.25v-2.928c0-.656-.145-1.12-.425-1.495a1.59 1.59 0 0 0-1.12-.425H8.25v-3.92h3.25c.065 0 .13-.003.195-.008V8.4c-.065.005-.13.008-.195.008-3.626 0-6.562 2.936-6.562 6.562 0 1.686.629 3.215 1.658 4.386a1.59 1.59 0 0 0 .425 1.12c.375.28.839.425 1.495.425h3.92v2.928h-3.92c-.065 0-.13-.003-.195-.008v3.92c0 3.626 2.936 6.562 6.562 6.562 1.686 0 3.215-.629 4.386-1.658a1.59 1.59 0 0 0 1.12-.425c.28-.375.425-.839.425-1.495v-2.928h3.92v-3.92c0-.065.003-.13.008-.195z"/>
                          </svg>
                          Instagram
                        </a>
                      )}
                      {tenant.metadata.social_links.twitter && (
                        <a 
                          href={tenant.metadata.social_links.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 00-2.143-2.714c0-.054.008-.108.008-.163a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191a6.938 6.938 0 01-2.825-.775 4.918 4.918 0 001.625 6.496 4.918 4.918 0 00-2.143-2.714c-.054 0-.108-.008-.163-.008a4.936 4.936 0 00-4.895-4.895c-2.714 0-4.916 2.202-4.916 4.916 0 .064.008.128.008.191z"/>
                          </svg>
                          Twitter
                        </a>
                      )}
                      {tenant.metadata.social_links.linkedin && (
                        <a 
                          href={tenant.metadata.social_links.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Store Image/Logo Display */}
            <div>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden">
                {tenant.metadata?.logo_url ? (
                  <div className="relative aspect-square">
                    <Image
                      src={tenant.metadata.logo_url}
                      alt={`${businessName} logo`}
                      fill
                      className="object-contain p-8"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-primary-600 dark:text-primary-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <p className="text-primary-600 dark:text-primary-300 font-medium">{businessName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Navigation Controls - Top of Page */}
      {featuredData && (featuredCounts.staffPick > 0 || featuredCounts.newArrival > 0 || featuredCounts.sale > 0 || featuredCounts.seasonal > 0 || featuredCounts.storeSelection > 0) && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-4 border-b border-neutral-200 dark:border-neutral-700">
            {/* First Row - Product Categories */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Quick Jump:</span>
              
              {/* Staff Picks */}
              {featuredCounts.staffPick > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('staff_pick-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Staff Picks"
                >
                  <span>⭐</span>
                  <span>Staff Picks ({featuredCounts.staffPick})</span>
                </button>
              )}

              {/* New Arrivals */}
              {featuredCounts.newArrival > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('new_arrival-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                  title="Jump to New Arrivals"
                >
                  <span>✨</span>
                  <span>New Arrivals ({featuredCounts.newArrival})</span>
                </button>
              )}

              {/* Sale Items */}
              {featuredCounts.sale > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('sale-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Sale Items"
                >
                  <span>💰</span>
                  <span>Sale Items ({featuredCounts.sale})</span>
                </button>
              )}

              {/* Seasonal Specials */}
              {featuredCounts.seasonal > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('seasonal-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-600 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Seasonal Specials"
                >
                  <span>�</span>
                  <span>Seasonal ({featuredCounts.seasonal})</span>
                </button>
              )}

              {/* Store Selection */}
              {featuredCounts.storeSelection > 0 && (
                <button
                  onClick={() => {
                    const element = document.getElementById('store_selection-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Store Selection"
                >
                  <span>🏪</span>
                  <span>Store Selection ({featuredCounts.storeSelection})</span>
                </button>
              )}
            </div>

            {/* Second Row - Store Information */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Store Info:</span>
              
              {/* Reviews - Always Show */}
              <button
                onClick={() => {
                  const element = document.getElementById('reviews-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors whitespace-nowrap"
                title="Jump to Customer Reviews"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h1.519l1.519-4.674a1 1 0 00-.95-.69zM11.049 4.927l1.519 4.674a1 1 0 001.519-.69l1.519-4.674a1 1 0 00-1.519.69l-1.519 4.674a1 1 0 00-.95.69z" />
                </svg>
                <span>Customer Reviews</span>
              </button>

              {/* Map/Directions - Show if address available */}
              {contactInfo.address && (
                <button
                  onClick={() => {
                    const element = document.getElementById('map-section');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap"
                  title="Jump to Map & Directions"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Map & Directions</span>
                </button>
              )}

              {/* Directory - Browse All Stores */}
              <a
                href="/directory"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-600 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap"
                title="Browse Directory"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Browse Directory</span>
              </a>

              {/* Shops - Browse All Shops */}
              <a
                href="/shops"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-600 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
                title="Browse All Shops"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 110-4 2 2 0 000 4zm0 0v10a2 2 0 002 2h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4z" />
                </svg>
                <span>Browse All Shops</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Featured Products Section - Conditional Width */}
      {featuredData && featuredData.totalCount > 0 && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="featured-products-section mb-12">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">
                Featured Products
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Discover our hand-picked selection of featured items
              </p>
            </div>

            <div className="space-y-8">
              {/* Staff Picks Bucket */}
              {featuredData.staffPick.length > 0 && (
                <div id="staff_pick-section">
                  <FeaturedBucketSimple
                    title="⭐ Staff Picks"
                    description="Our team's favorite picks"
                    products={featuredData.staffPick}
                    totalCount={featuredData.bucketCounts.staff_pick}
                    bucketType="staff_pick"
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantLogo={tenant?.branding?.logoUrl}
                    showLayoutSelector={true}
                  />
                </div>
              )}

              {/* New Arrivals Bucket */}
              {featuredData.newArrival.length > 0 && (
                <div id="new_arrival-section">
                  <FeaturedBucketSimple
                    title="✨ New Arrivals"
                    description="Fresh additions to our collection"
                    products={featuredData.newArrival}
                    totalCount={featuredData.bucketCounts.new_arrival}
                    bucketType="new_arrival"
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantLogo={tenant?.branding?.logoUrl}
                    showLayoutSelector={false}
                  />
                </div>
              )}

              {/* Sale Bucket */}
              {featuredData.sale.length > 0 && (
                <div id="sale-section">
                  <FeaturedBucketSimple
                    title="💰 Sale"
                    description="Great deals on selected items"
                    products={featuredData.sale}
                    totalCount={featuredData.bucketCounts.sale}
                    bucketType="sale"
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantLogo={tenant?.branding?.logoUrl}
                    showLayoutSelector={false}
                  />
                </div>
              )}

              {/* Seasonal Bucket */}
              {featuredData.seasonal.length > 0 && (
                <div id="seasonal-section">
                  <FeaturedBucketSimple
                    title="🍂 Seasonal"
                    description="Perfect for the current season"
                    products={featuredData.seasonal}
                    totalCount={featuredData.bucketCounts.seasonal}
                    bucketType="seasonal"
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantLogo={tenant?.branding?.logoUrl}
                    showLayoutSelector={false}
                  />
                </div>
              )}

              {/* Store Selection Bucket */}
              {featuredData.storeSelection.length > 0 && (
                <div id="store_selection-section">
                  <FeaturedBucketSimple
                    title="🏪 Store Selection"
                    description="Curated by our store experts"
                    products={featuredData.storeSelection}
                    totalCount={featuredData.bucketCounts.store_selection}
                    bucketType="store_selection"
                    tenantId={tenantId}
                    tenantName={businessName}
                    tenantLogo={tenant?.branding?.logoUrl}
                    showLayoutSelector={false}
                  />
                </div>
              )}
            </div>

            {/* Visual Separator Banner */}
            <div className="relative my-16">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-primary-100 to-primary-50 dark:from-primary-950 dark:via-primary-900 dark:to-primary-950" />
              <div className="relative px-8 py-12 text-center">
                <div className="max-w-3xl mx-auto">
                  <h3 className="text-2xl font-bold text-primary-900 dark:text-primary-100 mb-3">
                    Discover Our Complete Collection
                  </h3>
                  <p className="text-primary-700 dark:text-primary-300 text-lg mb-6">
                    Browse our entire catalog of {totalAllProducts > 0 ? `${totalAllProducts}+ ` : ''}products with advanced search and filtering
                  </p>
                  <Link
                    href={`/shops/${tenantId}`}
                    className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-lg hover:shadow-xl"
                  >
                    Browse Full Catalog
                    <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Product Catalog Section - Only show if not in products_only mode and we have products */}
      {!isProductsOnly && products.length > 0 && (
        <div className={isFullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
          <div className="py-12">
            {/* Section Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                Our Products
              </h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400">
                Browse our complete catalog of {totalItems} products
                {search && ` matching "${search}"`}
                {category && ` in ${categories.find((c: any) => c.slug === category)?.name || category}`}
              </p>
            </div>

            {/* Enhanced Product Display */}
            <EnhancedProductDisplay
              products={products}
              tenantId={tenantId}
              tenantName={businessName}
              tenantLogo={tenant.metadata?.logo_url}
              hasActivePaymentGateway={tenant.metadata?.hasActivePaymentGateway}
              defaultGatewayType={tenant.metadata?.defaultGatewayType}
              useSingletonData={true}
              showFeaturedBadges={true}
              initialPageSize={12}
              showPageSizeControl={true}
            />

            {/* Pagination Info */}
            {totalPages > 1 && (
              <div className="mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
                Page {currentPage} of {totalPages} • {totalItems} total products
              </div>
            )}

            {/* Pagination Component */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems || 0}
                  pageSize={12} // Fixed page size of 12 products
                  onPageChange={(page) => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', page.toString());
                    // Preserve other parameters
                    if (search) params.set('search', search);
                    if (category) params.set('category', category);
                    if (featured) params.set('featured', featured);
                    if (view) params.set('view', view);
                    const newUrl = `${window.location.pathname}?${params.toString()}`;
                    window.location.href = newUrl;
                  }}
                  onPageSizeChange={(size) => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', '1'); // Reset to first page when changing page size
                    params.set('limit', size.toString());
                    const newUrl = `${window.location.pathname}?${params.toString()}`;
                    window.location.href = newUrl;
                  }}
                  pageSizeOptions={[12, 24, 48]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Store Ratings and Reviews - Social Proof */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div id="reviews-section" className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
          <StoreRatingDisplay tenantId={tenantId} showWriteReview={true} isPublic={true} />
        </div>
      </div>

      {/* Map Section - How to Get There */}
      {contactInfo.address && (
        <div id="map-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">Find Us</h2>
            <GoogleMapEmbed address={contactInfo.address} height="h-64 sm:h-80" />
          </div>
        </div>
      )}

      {/* Tier-Based Footer */}
      <footer className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 mb-4">
                <div className="space-y-3 text-sm">
                  {/* Directory Entry Link */}
                  {directoryPublished && tenantSlug && (
                    <Link
                      href={`/directory/${tenantSlug}`}
                      className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      View Store in Directory
                    </Link>
                  )}

                </div>
              </div>

            </div>

            {/* Store Location Map */}
            <StorefrontMap
              tenant={{
                id: tenant.id,
                businessName: businessName,
                slug: tenantSlug,
                metadata: tenant.metadata
              }}
              primaryCategory={primaryGBPCategory?.name}
              productCount={totalAllProducts}
            />
          </div>

          {/* Platform Branding (unless Enterprise with removal) */}
          {!features.removePlatformBranding && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500">
              <Link href="/" title={platformSettings?.platformName || 'Visible Shelf'} style={{ textDecoration: 'none' }} ><div className="flex items-center justify-center gap-2" >
                <span>⚡Powered by</span>
                <img 
                  src={platformSettings?.logoUrl} 
                  alt={platformSettings?.platformName || 'Platform Logo'} 
                  className="h-8 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  width="32"
                  height="32"
                />
                <span>{platformSettings?.platformName || 'Visible Shelf'}</span>
              </div>
              </Link>
            </div>
          )}
        </div>
      </footer>
    </>
  );
}

