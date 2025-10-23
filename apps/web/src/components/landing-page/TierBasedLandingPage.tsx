'use client';

import Image from 'next/image';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';

interface Product {
  id: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  sku: string;
  availability: string;
  // Professional+ tier fields
  marketingDescription?: string;
  imageGallery?: string[];
  customCta?: {
    text: string;
    link: string;
    style?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  // Enterprise tier fields
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customSections?: Array<{
    type: string;
    title: string;
    content: string;
  }>;
  landingPageTheme?: string;
}

interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
}

interface TierBasedLandingPageProps {
  product: Product;
  tenant: Tenant;
}

export function TierBasedLandingPage({ product, tenant }: TierBasedLandingPageProps) {
  const tier = tenant.subscriptionTier || 'trial';
  const features = getLandingPageFeatures(tier);
  const branding = product.customBranding;
  
  // Determine colors
  const primaryColor = features.customColors && branding?.primaryColor ? branding.primaryColor : '#3b82f6';
  const secondaryColor = features.customColors && branding?.secondaryColor ? branding.secondaryColor : '#1e40af';

  // Get logo from tenant business profile (Professional+ tier)
  const businessLogo = tenant.metadata?.logo_url;
  const showLogo = (tier === 'professional' || tier === 'enterprise') && businessLogo;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header with business logo (Professional+ tier) */}
      {showLogo && (
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Image
              src={businessLogo}
              alt={tenant.metadata?.businessName || tenant.name}
              width={150}
              height={50}
              className="h-12 w-auto object-contain"
            />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Product Images */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          {features.imageGallery && product.imageGallery && product.imageGallery.length > 0 ? (
            <ImageGallery images={product.imageGallery} productName={product.name} />
          ) : product.imageUrl ? (
            <div className="relative w-full h-96">
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <div className="w-full h-96 bg-neutral-100 flex items-center justify-center">
              <svg className="h-24 w-24 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{product.title || product.name}</h1>
          <p className="text-sm text-neutral-600 mb-4">by {product.brand}</p>
          
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl font-bold" style={{ color: primaryColor }}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: product.currency || 'USD',
              }).format(product.price)}
            </span>
            <span className="text-sm text-neutral-500">SKU: {product.sku}</span>
          </div>

          {/* Description - Marketing or Standard */}
          {features.customMarketingDescription && product.marketingDescription ? (
            <div className="prose prose-neutral max-w-none mb-6">
              <p className="text-lg text-neutral-700 whitespace-pre-wrap">{product.marketingDescription}</p>
            </div>
          ) : product.description ? (
            <p className="text-neutral-700 mb-6">{product.description}</p>
          ) : null}

          {/* Availability */}
          <div className="mb-6">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              product.availability === 'in_stock' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {product.availability === 'in_stock' ? '✓ In Stock' : '✗ Out of Stock'}
            </span>
          </div>

          {/* Custom CTA */}
          {features.customCta && product.customCta && (
            <div className="mb-6">
              <a
                href={product.customCta.link}
                className="inline-block px-6 py-3 rounded-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                {product.customCta.text}
              </a>
            </div>
          )}

          {/* Social Links */}
          {features.socialLinks && product.socialLinks && (
            <div className="flex gap-4 mb-6">
              {product.socialLinks.facebook && (
                <a href={product.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-blue-600">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {product.socialLinks.instagram && (
                <a href={product.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-pink-600">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              )}
              {product.socialLinks.twitter && (
                <a href={product.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-blue-400">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Custom Sections (Enterprise) */}
        {features.customSections && product.customSections && product.customSections.length > 0 && (
          <div className="space-y-6 mb-6">
            {product.customSections.map((section, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-neutral-900 mb-4">{section.title}</h2>
                <div className="prose prose-neutral max-w-none">
                  <p className="text-neutral-700 whitespace-pre-wrap">{section.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Business Contact Info */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">About {tenant.metadata?.businessName || tenant.name}</h2>
          
          {/* Business Description */}
          {tenant.metadata?.business_description && (
            <div className="mb-6 pb-6 border-b border-neutral-200">
              <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">{tenant.metadata.business_description}</p>
            </div>
          )}

          {/* Contact Information */}
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">Contact Us</h3>
          <div className="space-y-2 text-neutral-700">
            {tenant.metadata?.phone && (
              <p className="flex items-center gap-2">
                <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${tenant.metadata.phone}`} className="hover:underline">{tenant.metadata.phone}</a>
              </p>
            )}
            {tenant.metadata?.email && (
              <p className="flex items-center gap-2">
                <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${tenant.metadata.email}`} className="hover:underline">{tenant.metadata.email}</a>
              </p>
            )}
            {tenant.metadata?.address && (
              <p className="flex items-center gap-2">
                <svg className="h-5 w-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{tenant.metadata.address}</span>
              </p>
            )}
          </div>
        </div>

        {/* Platform Branding (unless Enterprise with removal) */}
        {!features.removePlatformBranding && (
          <div className="mt-8 text-center text-sm text-neutral-500">
            <p>Powered by Retail Visibility Platform ⚡</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Image Gallery Component
function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  return (
    <div className="relative">
      <div className="relative w-full h-96">
        <Image
          src={images[currentIndex]}
          alt={`${productName} - Image ${currentIndex + 1}`}
          fill
          className="object-contain"
          priority
        />
      </div>
      
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((currentIndex - 1 + images.length) % images.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentIndex((currentIndex + 1) % images.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Add React import for useState
import React from 'react';
