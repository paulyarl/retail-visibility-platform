'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { getLandingPageFeatures } from '@/lib/landing-page-tiers';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { SafeImage } from '@/components/SafeImage';
import ProductActions from '@/components/products/ProductActions';
import { api } from '@/lib/api';
import Link from 'next/link';

// Public QR Code Section Component
function PublicQRCodeSection({ productUrl, productName, tenantId }: { productUrl: string; productName: string; tenantId: string }) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [isFetchingTierAndLogo, setIsFetchingTierAndLogo] = useState(true);
  
  // Get tenant tier to determine if we should show logo
  const [tenantTier, setTenantTier] = useState<string>('starter');
  
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        setIsFetchingTierAndLogo(true);
        
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        
        // Use public tier endpoint (no auth required for public product page)
        //const tierResponse = await fetch(`${apiUrl}/api/tenants/${tenantId}/tier/public`);
        const tierResponse = await api.get(`${apiUrl}/api/tenants/${tenantId}/tier/public`);
        if (tierResponse.ok) {
          const tierData = await tierResponse.json();
          
          // Use tier_key for clean single-word tier name (e.g., "professional")
          const effectiveTier = tierData.effective?.tier_key || tierData.tier || 'starter';
          setTenantTier(effectiveTier);
          
          // Get tenant profile for logo if professional or above
          if (effectiveTier === 'professional' || effectiveTier === 'enterprise' || effectiveTier === 'organization' || effectiveTier === 'chain_professional' || effectiveTier === 'chain_enterprise') {
            try {
              const profileResponse = await api.get(`${apiUrl}/public/tenant/${tenantId}/profile`);
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                setTenantLogo(profile.logo_url || null);
              } else {
                console.warn('[QR Code] Profile fetch failed:', profileResponse.status);
              }
            } catch (error) {
              console.warn('Failed to fetch tenant logo:', error);
            }
          } else {
            console.log('[QR Code] Tier not professional+, skipping logo fetch');
          }
        } else {
          console.warn('[QR Code] Tier fetch failed:', tierResponse.status);
        }
      } catch (error) {
        console.error('[QR Code] Error fetching tenant info:', error);
      } finally {
        setIsFetchingTierAndLogo(false);
        console.log('[QR Code] Tier and logo fetch complete');
      }
    };
    
    fetchTenantInfo();
  }, [tenantId]);

  const overlayLogoOnQR = async (qrCanvas: HTMLCanvasElement, logoSrc: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Set canvas size to match QR code
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;

        // Draw QR code first
        ctx.drawImage(qrCanvas, 0, 0);

        // Calculate logo size (25% for maximum visibility while maintaining scannability)
        const logoSize = Math.floor(canvas.width * 0.27);
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = (canvas.height - logoSize) / 2;

        // Draw white circular background for logo (for better contrast)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 6, 0, Math.PI * 2);
        ctx.fill();

        // Create circular mask for logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw logo with full opacity
        ctx.globalAlpha = 1.0;
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Add thicker white border around logo for definition
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 3, 0, Math.PI * 2);
        ctx.stroke();

        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load logo image'));
      img.src = logoSrc;
    });
  };

  const generateQRCode = async () => {
    if (qrImageUrl) return; // Already generated

    setIsGenerating(true);
    try {
      // Import QRCode dynamically to avoid SSR issues
      const QRCode = (await import('qrcode')).default;

      // Generate base QR code
      const qrCanvas = document.createElement('canvas');
      const qrCtx = qrCanvas.getContext('2d');
      if (!qrCtx) throw new Error('Could not get canvas context');

      qrCanvas.width = 256;
      qrCanvas.height = 256;

      // Generate QR code with higher error correction if logo will be applied
      const shouldApplyLogo = (
        tenantTier === 'professional' || 
        tenantTier === 'enterprise' || 
        tenantTier === 'organization' ||
        tenantTier === 'chain_professional' ||
        tenantTier === 'chain_enterprise'
      ) && tenantLogo;
      
      console.log('[QR Code] Should apply logo:', shouldApplyLogo, 'tenantTier:', tenantTier, 'tenantLogo:', tenantLogo);
      
      await QRCode.toCanvas(qrCanvas, productUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: shouldApplyLogo ? 'H' : 'M',
      });

      let finalCanvas = qrCanvas;

      // Overlay logo for Professional+ users if they have a logo
      if (shouldApplyLogo) {
        try {
          finalCanvas = await overlayLogoOnQR(qrCanvas, tenantLogo!);
        } catch (logoError) {
          console.warn('Failed to overlay logo, using plain QR code:', logoError);
          // Fall back to plain QR code if logo overlay fails
        }
      }

      // Convert to data URL
      const dataUrl = finalCanvas.toDataURL('image/png');
      setQrImageUrl(dataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrImageUrl) return;

    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `qr-${productName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate QR code only after tier and logo fetch is complete
  useEffect(() => {
    if (!isFetchingTierAndLogo) {
      generateQRCode();
    }
  }, [isFetchingTierAndLogo]); // Generate when fetch completes

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12l4-4m4 4l-4-4m0 0h4.01M12 12v4" />
        </svg>
        <h2 className="text-xl font-semibold text-neutral-900">QR Code</h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* QR Code Display */}
        <div className="flex-shrink-0">
          {qrImageUrl ? (
            <div className="border-2 border-neutral-200 rounded-lg p-4 bg-white">
              <img
                src={qrImageUrl}
                alt={`QR Code for ${productName}`}
                className="w-48 h-48"
              />
            </div>
          ) : (
            <div className="w-48 h-48 border-2 border-neutral-200 rounded-lg p-4 bg-neutral-50 flex items-center justify-center">
              {isGenerating ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-600" />
              ) : (
                <svg className="w-12 h-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12l4-4m4 4l-4-4m0 0h4.01M12 12v4" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-medium text-neutral-900 mb-2">Scan to View Product</h3>
          <p className="text-sm text-neutral-600 mb-4">
            Use your phone's camera or QR scanner to instantly view this product on your mobile device.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={downloadQRCode}
              disabled={!qrImageUrl || isGenerating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR Code
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Product {
  id: string;
  tenantId: string;
  name: string;
  title: string;
  brand: string;
  manufacturer?: string;
  condition?: string;
  description?: string;
  price: number;
  priceCents?: number;
  salePriceCents?: number;
  currency: string;
  imageUrl?: string;
  sku: string;
  availability: string;
  
  // Category assignment
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
    googleCategoryId?: string | null;
  } | null;
  
  // Enriched barcode data
  upc?: string;
  gtin?: string;
  mpn?: string;
  
  // Nutrition & dietary
  nutritionFacts?: {
    servingSize?: string;
    calories?: number;
    totalFat?: string;
    saturatedFat?: string;
    transFat?: string;
    cholesterol?: string;
    sodium?: string;
    totalCarbohydrate?: string;
    dietaryFiber?: string;
    sugars?: string;
    protein?: string;
    [key: string]: any;
  };
  allergens?: string[];
  ingredients?: string;
  dietaryInfo?: string[];
  nutriScore?: string;
  
  // Physical attributes
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
  
  // Additional specs
  specifications?: Record<string, any>;
  environmentalInfo?: string[];
  
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
  hasActivePaymentGateway?: boolean;
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
  storeStatus?: any;
  gallery?: React.ReactNode;
  fulfillmentPane?: React.ReactNode;
}

export function TierBasedLandingPage({ product, tenant, storeStatus, gallery, fulfillmentPane }: TierBasedLandingPageProps) {
  const { settings: platformSettings } = usePlatformSettings();
  const tier = tenant.subscriptionTier || 'trial';
  const features = getLandingPageFeatures(tier);
  const branding = product.customBranding;
  
  // Check if storefront is available (Starter+ tier)
  const hasStorefront = tier !== 'trial' && tier !== 'google_only';
  
  // Determine colors
  const primaryColor = features.customColors && branding?.primaryColor ? branding.primaryColor : '#3b82f6';
  const secondaryColor = features.customColors && branding?.secondaryColor ? branding.secondaryColor : '#1e40af';

  // Get logo - Priority: 1) Enterprise custom branding, 2) Tenant business logo, 3) Platform logo
  const metadata = tenant.metadata as any;
  const enterpriseLogo = features.customLogo && branding?.logo;
  const businessLogo = metadata?.logo_url;
  const platformLogo = platformSettings?.logoUrl;
  
  const displayLogo = enterpriseLogo || businessLogo || (tier !== 'trial' && tier !== 'starter' ? platformLogo : null);
  const displayName = metadata?.businessName || tenant.name || platformSettings?.platformName;
  const showLogo = !!displayLogo;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Product Images */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          {features.imageGallery && product.imageGallery && product.imageGallery.length > 0 ? (
            <ImageGallery images={product.imageGallery} productName={product.name} />
          ) : product.imageUrl ? (
            <div className="relative w-full h-96">
              <SafeImage
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

        {/* Product Actions - Share, Print, Like */}
        <ProductActions 
          product={product} 
          tenant={tenant}
          productUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/products/${product.id}`}
          variant="product"
        />

        {/* Product Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{product.title || product.name}</h1>
          <p className="text-sm text-neutral-600 mb-1">by {product.brand}</p>
          {product.manufacturer && (
            <p className="text-sm text-neutral-500 mb-1">Manufacturer: {product.manufacturer}</p>
          )}
          {product.condition && (
            <p className="text-sm text-neutral-500 mb-1">
              Condition: {product.condition === 'brand_new' ? 'New' : (product.condition === 'new' ? 'New' : product.condition === 'used' ? 'Used' : 'Refurbished')}
            </p>
          )}
          {product.tenantCategory && (
            <div className="mt-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {product.tenantCategory.name}
              </span>
            </div>
          )}
          {!product.manufacturer && !product.tenantCategory && <div className="mb-3" />}
          {(product.manufacturer || product.tenantCategory) && <div className="mb-3" />}
          
          <div className="flex items-baseline gap-2 mb-6">
            <PriceDisplay
              priceCents={product.priceCents || Math.round(product.price * 100)}
              salePriceCents={product.salePriceCents}
              variant="large"
              showSavingsBadge={true}
              className="mb-2"
            />
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

          {/* Add to Cart Button - Only show if tenant has order processing enabled */}
          {tenant.hasActivePaymentGateway && (
            <div className="mb-6">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.title,
                  sku: product.sku,
                  priceCents: product.priceCents || Math.round(product.price * 100),
                  salePriceCents: product.salePriceCents,
                  imageUrl: product.imageUrl,
                  stock: product.availability === 'in_stock' ? 999 : 0,
                  tenantId: product.tenantId,
                }}
                tenantName={tenant.metadata?.businessName || tenant.name}
                tenantLogo={businessLogo}
                className="w-full"
              />
            </div>
          )}

          {/* Product Identifiers */}
          {(product.upc || product.gtin || product.mpn) && (
            <div className="mb-6 p-4 bg-neutral-50 rounded-lg">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Product Identifiers</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {product.upc && (
                  <>
                    <dt className="text-neutral-500">UPC</dt>
                    <dd className="text-neutral-900 font-mono">{product.upc}</dd>
                  </>
                )}
                {product.gtin && (
                  <>
                    <dt className="text-neutral-500">GTIN</dt>
                    <dd className="text-neutral-900 font-mono">{product.gtin}</dd>
                  </>
                )}
                {product.mpn && (
                  <>
                    <dt className="text-neutral-500">MPN</dt>
                    <dd className="text-neutral-900 font-mono">{product.mpn}</dd>
                  </>
                )}
              </dl>
            </div>
          )}

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

        {/* Enriched Product Data - Instant Credibility */}
        {/* Ingredients */}
        {product.ingredients && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-3">Ingredients</h2>
            <p className="text-sm text-neutral-700 leading-relaxed">{product.ingredients}</p>
          </div>
        )}

        {/* Nutrition Facts */}
        {product.nutritionFacts && Object.keys(product.nutritionFacts).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-neutral-900">Nutrition Facts</h2>
              {product.nutriScore && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  Nutri-Score: {product.nutriScore}
                </span>
              )}
            </div>
            <div className="border-2 border-black p-4 space-y-2 max-w-md">
              {product.nutritionFacts.servingSize && (
                <div className="border-b-8 border-black pb-2">
                  <p className="text-sm font-bold">Serving Size: {product.nutritionFacts.servingSize}</p>
                </div>
              )}
              {product.nutritionFacts.calories !== undefined && (
                <div className="border-b-4 border-black pb-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">Calories</span>
                    <span className="font-bold text-2xl">{product.nutritionFacts.calories}</span>
                  </div>
                </div>
              )}
              <div className="space-y-1 text-sm">
                {product.nutritionFacts.totalFat && (
                  <div className="flex justify-between border-b border-neutral-400 py-1">
                    <span className="font-bold">Total Fat</span>
                    <span>{product.nutritionFacts.totalFat}</span>
                  </div>
                )}
                {product.nutritionFacts.saturatedFat && (
                  <div className="flex justify-between pl-4 py-1">
                    <span>Saturated Fat</span>
                    <span>{product.nutritionFacts.saturatedFat}</span>
                  </div>
                )}
                {product.nutritionFacts.cholesterol && (
                  <div className="flex justify-between border-b border-neutral-400 py-1">
                    <span className="font-bold">Cholesterol</span>
                    <span>{product.nutritionFacts.cholesterol}</span>
                  </div>
                )}
                {product.nutritionFacts.sodium && (
                  <div className="flex justify-between border-b border-neutral-400 py-1">
                    <span className="font-bold">Sodium</span>
                    <span>{product.nutritionFacts.sodium}</span>
                  </div>
                )}
                {product.nutritionFacts.totalCarbohydrate && (
                  <div className="flex justify-between border-b border-neutral-400 py-1">
                    <span className="font-bold">Total Carbohydrate</span>
                    <span>{product.nutritionFacts.totalCarbohydrate}</span>
                  </div>
                )}
                {product.nutritionFacts.dietaryFiber && (
                  <div className="flex justify-between pl-4 py-1">
                    <span>Dietary Fiber</span>
                    <span>{product.nutritionFacts.dietaryFiber}</span>
                  </div>
                )}
                {product.nutritionFacts.sugars && (
                  <div className="flex justify-between pl-4 py-1">
                    <span>Sugars</span>
                    <span>{product.nutritionFacts.sugars}</span>
                  </div>
                )}
                {product.nutritionFacts.protein && (
                  <div className="flex justify-between border-t-4 border-black pt-2 mt-2">
                    <span className="font-bold">Protein</span>
                    <span>{product.nutritionFacts.protein}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Allergens & Dietary Info */}
        {((product.allergens && product.allergens.length > 0) || (product.dietaryInfo && product.dietaryInfo.length > 0)) && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">Allergens & Dietary Information</h2>
            {product.allergens && product.allergens.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-red-600 mb-2">⚠️ Contains Allergens:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.allergens.map((allergen, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      {allergen}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {product.dietaryInfo && product.dietaryInfo.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 mb-2">Dietary Information:</h3>
                <div className="flex flex-wrap gap-2">
                  {product.dietaryInfo.map((info, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {info}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key Features - Environmental Info */}
        {product.environmentalInfo && product.environmentalInfo.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">✨ Key Features</h2>
            <ul className="space-y-2">
              {product.environmentalInfo.map((info, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span className="text-neutral-700">{info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Product Specifications */}
        {((product.dimensions || product.weight) || (product.specifications && Object.keys(product.specifications).length > 0)) && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">Product Specifications</h2>
            <dl className="space-y-2 text-sm">
              {product.dimensions && (
                <div className="flex justify-between py-2 border-b border-neutral-200">
                  <dt className="font-medium text-neutral-700">Dimensions</dt>
                  <dd className="text-neutral-900">
                    {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} {product.dimensions.unit}
                  </dd>
                </div>
              )}
              {product.weight && (
                <div className="flex justify-between py-2 border-b border-neutral-200">
                  <dt className="font-medium text-neutral-700">Weight</dt>
                  <dd className="text-neutral-900">{product.weight.value} {product.weight.unit}</dd>
                </div>
              )}
              {product.specifications && Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-neutral-200">
                  <dt className="font-medium text-neutral-700 capitalize">{key.replace(/_/g, ' ')}</dt>
                  <dd className="text-neutral-900">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* QR Code CTA Section - Professional+ Tier */}
        {features.qrCodes && (
          <PublicQRCodeSection
            productUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/products/${product.id}`}
            productName={product.name}
            tenantId={product.tenantId}
          />
        )}

        {/* Fulfillment & Payment Options - After QR Code */}
        {fulfillmentPane && (
          <div className="mb-6">
            {fulfillmentPane}
          </div>
        )}

        {/* Tier-Gated Storefront CTA */}
        {hasStorefront && (
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 mb-6 border border-blue-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">
                  Discover More Products
                </h3>
                <p className="text-sm text-neutral-600">
                  Browse our full catalog at {displayName}
                </p>
              </div>
              <a
                href={`/tenant/${tenant.id}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Browse All Products
              </a>
            </div>
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
        <SafeImage
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
