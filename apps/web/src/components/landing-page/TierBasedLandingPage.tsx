'use client';

// Dynamic tier-based landing page component
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Simple hook to detect screen width for responsive layouts
function useResponsiveLayout() {
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.outerWidth);
    
    // Set initial width
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Return layout based on screen width
  return screenWidth <= 475 ? 'stacked' : 'horizontal';
}

import QRCode from 'qrcode';
import { TenantQRCode } from '@/components/public/TenantQRCode';
import { AddToCartButton } from '@/components/products/AddToCartButton';
import { useCommerceCapability, usePaymentGatewayCapability, useStorefrontCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { storefrontService } from '@/services/StorefrontService';
import { SafeImage } from '@/components/SafeImage';
import ProductActions from '@/components/products/ProductActions';
import ProductVariantSelector from '@/components/products/ProductVariantSelector';
import ProductGallery from '@/components/products/ProductGallery';
import BasicProductGallery from '@/components/products/BasicProductGallery';
import { LocationAvailabilitySection } from '@/components/products/LocationAvailabilitySection';
import Link from 'next/link';
import { TenantPaymentProvider, useTenantPaymentOptional } from '@/contexts/TenantPaymentContext';
import { Card, Group, Text, ActionIcon, Button, Badge as MantineBadge } from '@mantine/core';
import { Package, Download, Globe, ThumbsUp } from 'lucide-react';
import { Sparkles, TrendingUp, Star, Tag, Clock, Award, Zap, Flame, Calendar, DollarSign } from 'lucide-react';
// Store status
import { useStoreStatus } from '@/hooks/useStoreStatus';
import DirectoryActions from '@/components/directory/DirectoryActions';
import {TenantInfo} from '@/services/PublicTenantInfoService';

import { StorefrontStatusPanel, useStorefrontStatus } from '@/components/storefront/StorefrontStatusPanel';
import { tenantPublicService, PublicTenantInfo, LocationStatusInfo } from '@/services/TenantPublicService';

// Landing page features interface
interface LandingPageFeatures {
  customMarketingDescription: boolean;
  imageGallery: boolean;
  maxGalleryImages: number;
  customCta: boolean;
  socialLinks: boolean;
  qrCodes: boolean;
  showBusinessLogo: boolean;
  removePlatformBranding: boolean;
  customLogo: boolean;
  customColors: boolean;
  customSections: boolean;
  maxCustomSections: number;
  customTheme: boolean;
  customDomain: boolean;
  abTesting: boolean;
  advancedAnalytics: boolean;
}

// Featured Type Badge Component with icons only (subtle display)
// Aligned with StorefrontFeaturedProducts.tsx featuredTypeConfig
function FeaturedTypeBadges({ featuredTypes, bucketCounts }: { featuredTypes: string[]; bucketCounts?: Record<string, number> }) {
  // Map featured types to icons, colors, and descriptions - matches shops page
  const typeConfig: Record<string, { icon: React.ReactNode; bgColor: string; textColor: string; label: string; description: string }> = {
    store_selection: { 
      icon: <Star className="w-4 h-4" />, 
      bgColor: 'bg-amber-100', 
      textColor: 'text-amber-700',
      label: 'Featured Product', 
      description: 'Hand-picked favorite from our collection' 
    },
    new_arrival: { 
      icon: <Package className="w-4 h-4" />, 
      bgColor: 'bg-green-100', 
      textColor: 'text-green-700',
      label: 'New Arrival', 
      description: 'Fresh product just added to our store' 
    },
    seasonal: { 
      icon: <Calendar className="w-4 h-4" />, 
      bgColor: 'bg-orange-100', 
      textColor: 'text-orange-700',
      label: 'Seasonal Special', 
      description: 'Perfect for this time of year' 
    },
    sale: { 
      icon: <DollarSign className="w-4 h-4" />, 
      bgColor: 'bg-red-100', 
      textColor: 'text-red-700',
      label: 'Sale Item', 
      description: 'Great deal on this product' 
    },
    staff_pick: { 
      icon: <ThumbsUp className="w-4 h-4" />, 
      bgColor: 'bg-purple-100', 
      textColor: 'text-purple-700',
      label: 'Staff Pick', 
      description: 'Hand-picked favorite by our team' 
    },
    bestseller: { 
      icon: <Award className="w-4 h-4" />, 
      bgColor: 'bg-yellow-100', 
      textColor: 'text-yellow-700',
      label: 'Bestseller', 
      description: 'Our most popular products' 
    },
    clearance: { 
      icon: <Zap className="w-4 h-4" />, 
      bgColor: 'bg-pink-100', 
      textColor: 'text-pink-700',
      label: 'Clearance', 
      description: 'Last chance to grab these deals' 
    },
    trending: { 
      icon: <TrendingUp className="w-4 h-4" />, 
      bgColor: 'bg-cyan-100', 
      textColor: 'text-cyan-700',
      label: 'Trending', 
      description: 'Hot products everyone is viewing' 
    },
    recommended: { 
      icon: <Sparkles className="w-4 h-4" />, 
      bgColor: 'bg-indigo-100', 
      textColor: 'text-indigo-700',
      label: 'Recommended', 
      description: 'Products we think you\'ll love' 
    },
    featured: { 
      icon: <Flame className="w-4 h-4" />, 
      bgColor: 'bg-rose-100', 
      textColor: 'text-rose-700',
      label: 'Featured', 
      description: 'Spotlight on special products' 
    },
  };

  // If we have bucket counts, show all types with counts
  if (bucketCounts && Object.keys(bucketCounts).length > 0) {
    const allTypes = Object.keys(bucketCounts).filter(type => (bucketCounts[type] || 0) > 0);
    
    return (
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {allTypes.map((type, index) => {
          const config = typeConfig[type] || { 
            icon: <Sparkles className="w-4 h-4" />, 
            bgColor: 'bg-gray-100', 
            textColor: 'text-gray-600',
            label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
            description: '' 
          };
          const isProductType = featuredTypes.includes(type);
          const count = bucketCounts[type] || 0;
          
          return (
            <a
              key={index}
              href={`#featured-${type}`}
              className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-full ${config.bgColor} ${config.textColor} ${isProductType ? 'ring-2 ring-offset-1 ring-current font-semibold' : 'opacity-70'} hover:opacity-100 transition-opacity cursor-pointer no-underline`}
              title={`Jump to ${config.label} products`}
            >
              {config.icon}
              <span className="text-xs">{count}</span>
              {/* Mouse-over caption with description */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs font-medium text-white bg-gray-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
                <span className="font-semibold">{config.label}</span>
                {config.description && (
                  <span className="block text-gray-300 font-normal mt-0.5">{config.description}</span>
                )}
                {isProductType && (
                  <span className="block text-green-300 font-normal mt-0.5">✓ This product</span>
                )}
                <span className="block text-blue-300 font-normal mt-0.5">Click to view →</span>
              </span>
            </a>
          );
        })}
      </div>
    );
  }

  // Fallback: show only types the product belongs to (original behavior)
  return (
    <div className="flex items-center gap-2 mb-4">
      {featuredTypes.map((type, index) => {
        const config = typeConfig[type] || { 
          icon: <Sparkles className="w-4 h-4" />, 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-600',
          label: type, 
          description: '' 
        };
        return (
          <a
            key={index}
            href={`#featured-${type}`}
            className={`group relative inline-flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor} ${config.textColor} hover:opacity-80 transition-opacity cursor-pointer no-underline`}
          >
            {config.icon}
            {/* Mouse-over caption with description */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs font-medium text-white bg-gray-800 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
              <span className="font-semibold">{config.label}</span>
              {config.description && (
                <span className="block text-gray-300 font-normal mt-0.5">{config.description}</span>
              )}
              <span className="block text-blue-300 font-normal mt-0.5">Click to view →</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

// Public QR Code Section Component
function PublicQRCodeSection({ productUrl, productName, tenantId }: { productUrl: string; productName: string; tenantId: string }) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [isFetchingTierAndLogo, setIsFetchingTierAndLogo] = useState(true);
  
  // Get tenant tier to determine if we should show logo
  const [tenantTier, setTenantTier] = useState<string>('discovery');
  // console.log('[TierBasedLandingPage] tenantTier: ', tenantTier);
  // console.log('[TierBasedLandingPage] tenantId: ', tenantId);
  // console.log('[TierBasedLandingPage] tenantLogo: ', tenantLogo);
  // console.log('[TierBasedLandingPage] isFetchingTierAndLogo: ', isFetchingTierAndLogo);
  
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        setIsFetchingTierAndLogo(true);
        
        // Use public tier endpoint (no auth required for public product page)
        const tierData = await storefrontService.getPublicTier(tenantId);
        // console.log(`[QR Code] Tier data: ${JSON.stringify(tierData)}`);
        if (tierData) {
          // Extract data from wrapper (API returns {success, data: {...}})
          const data = tierData.data || tierData;
          
          // Determine effective tier for QR code features
          // Compare individual tenant tier vs organization tier and pick the higher one
          const individualTier = data.tenantTier?.tier_key || null;
          const organizationTier = data.organizationTier?.tier_key || null;
          
          // Helper to get QR code level from tier key
          const getQRCodeLevel = (tierKey: string): number => {
            if (!tierKey) return 0;
            if (tierKey.includes('enterprise') || tierKey.includes('professional') || tierKey.includes('omnichannel') ) return 3; // qr_codes_2048
            if (tierKey.includes('commitment' )||(tierKey.includes('ecommerce' ))) return 2; // qr_codes_1024
            if (tierKey === 'chain_starter'|| tierKey === 'storefront') return 1; // qr_codes_512 only
            if (tierKey === 'starter' || tierKey === 'discovery') return 0;
            return 2; // default for professional/chain_professional
          };
          
          // Pick the tier with higher QR code features
          let effectiveTier: string;
          const individualLevel = getQRCodeLevel(individualTier || '');
          const orgLevel = getQRCodeLevel(organizationTier || '');
          
          if (individualTier && (!organizationTier || individualLevel >= orgLevel)) {
            // Use individual tier if it's higher or equal to org tier
            effectiveTier = individualTier;
          } else if (organizationTier) {
            // Use organization tier if it's higher
            effectiveTier = organizationTier;
          } else {
            // Fallback to effective or tier field
            effectiveTier = data.effective?.tier_key || data.tier || 'discovery';
          }
          let effectiveTierPart = effectiveTier;
          const tierParts = effectiveTier.split('_');
          if (tierParts.length >= 2 && tierParts[0]=='trial') {
            effectiveTierPart = tierParts[1];
          }
          // console.log(`[QR Code] Individual tier: ${effectiveTierPart} (level ${individualLevel}), Org tier: ${organizationTier} (level ${orgLevel}), Effective: ${effectiveTier}`);
          setTenantTier(effectiveTierPart);
          
          // Get tenant profile for logo if commitment or above (or chain tiers)
          if (effectiveTierPart === 'professional' 
            || effectiveTierPart === 'commitment' 
            || effectiveTierPart === 'ecommerce'
            || effectiveTierPart === 'omnichannel'
            || effectiveTierPart === 'enterprise' 
            || effectiveTierPart === 'organization' 
            || effectiveTierPart === 'chain_professional' 
            || effectiveTierPart === 'chain_enterprise' 
            || effectiveTierPart === 'chain_starter' 
            || effectiveTierPart === 'trial_professional'
            || effectiveTierPart === 'trial_commitment'
            || effectiveTierPart === 'trial_enterprise'
            || effectiveTierPart === 'trial_ecommerce'
            || effectiveTierPart === 'trial_omnichannel') {
            try {
              // const profile = await storefrontService.getPublicTenantProfile(tenantId);
              const profile = await tenantPublicService.getPublicTenantInfo(tenantId)


              // console.log(`[QR Code] Fetching tenant profile for tenant ${tenantId}`);
              // console.log('[QR Code] Tenant profile:', profile);
              if (profile) {
                // Extract data from wrapper (API returns {success, data: {...}})
                const profileData = profile?.profileData || profile;
                setTenantLogo(profileData.logo_url || null);
              } else {
                console.error('Failed to fetch tenant profile');
              }
            } catch (profileError) {
              console.error('Error fetching tenant profile:', profileError);
            }
          }
        } else {
          console.error('Failed to fetch tier information');
        }
      } catch (error) {
        console.error('[QR Code] Error fetching tenant info:', error);
      } finally {
        setIsFetchingTierAndLogo(false);
//        console.log('[QR Code] Tier and logo fetch complete');
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
        const logoSize = Math.floor(canvas.width * 0.30);
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

  // Shared tier utility functions (aligned with TenantQRCode and TierGainsWelcome)
  const getTierColorPalette = (tier: string, organizationTier?: string | undefined) => {
    if (organizationTier) {
      // Organization tiers get purple/indigo theme
      return {
        primary: 'purple',
        secondary: 'blue',
        border: 'from-purple-300 to-indigo-300',
        bg: 'from-purple-50 to-indigo-50',
        dark: 'from-purple-900/20 to-indigo-900/20',
        icon: 'from-purple-500 to-indigo-600',
        primaryIcon: 'text-purple-600 dark:purple-800',
        secondaryIcon: 'text-blue-600 dark:blue-800',
        primaryButton: 'bg-purple-600 hover:bg-purple-700',
        secondaryButton: 'text-purple-600 hover:text-purple-700'
      };
    } else if (tier === 'enterprise') {
      // Enterprise gets red/purple theme
      return {
        primary: 'red',
        secondary: 'purple',
        border: 'from-red-300 to-purple-300',
        bg: 'from-red-50 to-purple-50',
        dark: 'from-red-900/20 to-purple-900/20',
        icon: 'from-red-500 to-purple-600',
        primaryIcon: 'text-red-600 dark:red-800',
        secondaryIcon: 'text-purple-600 dark:purple-800',
        primaryButton: 'bg-red-600 hover:bg-red-700',
        secondaryButton: 'text-red-600 hover:text-red-700'
      };
    } else if (tier === 'professional') {
      // Professional gets amber/orange theme
      return {
        primary: 'amber',
        secondary: 'orange',
        border: 'from-amber-300 to-orange-300',
        bg: 'from-amber-50 to-orange-50',
        dark: 'from-amber-900/20 to-orange-900/20',
        icon: 'from-amber-500 to-orange-600',
        primaryIcon: 'text-amber-600 dark:amber-800',
        secondaryIcon: 'text-orange-600 dark:orange-800',
        primaryButton: 'bg-amber-600 hover:bg-amber-700',
        secondaryButton: 'text-amber-600 hover:text-amber-700'
      };
    } else if (tier === 'commitment') {
      // Commitment gets green/emerald theme
      return {
        primary: 'green',
        secondary: 'emerald',
        border: 'from-green-300 to-emerald-300',
        bg: 'from-green-50 to-emerald-50',
        dark: 'from-green-900/20 to-emerald-900/20',
        icon: 'from-green-500 to-emerald-600',
        primaryIcon: 'text-green-600 dark:green-800',
        secondaryIcon: 'text-emerald-600 dark:emerald-800',
        primaryButton: 'bg-green-600 hover:bg-green-700',
        secondaryButton: 'text-green-600 hover:text-green-700'
      }; 
    } else if (tier === 'omnichannel') {
      // Omnichannel gets green/emerald theme
      return {
        primary: 'indigo',
        secondary: 'purple',
        border: 'from-indigo-300 to-purple-300',
        bg: 'from-indigo-50 to-purple-50',
        dark: 'from-indigo-900/20 to-purple-900/20',
        icon: 'from-indigo-500 to-purple-600',
        primaryIcon: 'text-indigo-600 dark:indigo-800',
        secondaryIcon: 'text-purple-600 dark:purple-800',
        primaryButton: 'bg-indigo-600 hover:bg-indigo-700',
        secondaryButton: 'text-indigo-600 hover:text-indigo-700'
      };  
     } else if (tier === 'ecommerce') {
      // Ecommerce gets green/emerald theme
      return {
        primary: 'indigo',
        secondary: 'cyan',
        border: 'from-indigo-300 to-cyan-300',
        bg: 'from-indigo-50 to-cyan-50',
        dark: 'from-indigo-900/20 to-cyan-900/20',
        icon: 'from-indigo-500 to-cyan-600',
        primaryIcon: 'text-indigo-600 dark:indigo-800',
        secondaryIcon: 'text-cyan-600 dark:cyan-800',
        primaryButton: 'bg-indigo-600 hover:bg-indigo-700',
        secondaryButton: 'text-indigo-600 hover:text-indigo-700'
      };
    } else if (tier === 'storefront') {
      // Storefront gets purple/indigo theme
      return {
        primary: 'purple',
        secondary: 'indigo',
        border: 'from-purple-300 to-indigo-300',
        bg: 'from-purple-50 to-indigo-50',
        dark: 'from-purple-900/20 to-indigo-900/20',
        icon: 'from-purple-500 to-indigo-600',
        primaryIcon: 'text-purple-600 dark:purple-800',
        secondaryIcon: 'text-indigo-600 dark:indigo-800',
        primaryButton: 'bg-purple-600 hover:bg-purple-700',
        secondaryButton: 'text-purple-600 hover:text-purple-700'
      };
    } else if (tier === 'discovery') {
      // Discovery gets blue/purple theme
      return {
        primary: 'blue',
        secondary: 'purple',
        border: 'from-blue-300 to-purple-300',
        bg: 'from-blue-50 to-purple-50',
        dark: 'from-blue-900/20 to-purple-900/20',
        icon: 'from-blue-500 to-purple-600',
        primaryIcon: 'text-blue-600 dark:blue-800',
        secondaryIcon: 'text-purple-600 dark:purple-800',
        primaryButton: 'bg-blue-600 hover:bg-blue-700',
        secondaryButton: 'text-blue-600 hover:text-blue-700'
      };
    } else {
      // Default gets rose/pink theme (for any unrecognized tiers)
      return {
        primary: 'rose',
        secondary: 'pink',
        border: 'from-rose-300 to-pink-300',
        bg: 'from-rose-50 to-pink-50',
        dark: 'from-rose-900/20 to-pink-900/20',
        icon: 'from-rose-500 to-pink-600',
        primaryIcon: 'text-rose-600 dark:rose-800',
        secondaryIcon: 'text-pink-600 dark:pink-800',
        primaryButton: 'bg-rose-600 hover:bg-rose-700',
        secondaryButton: 'text-rose-600 hover:text-rose-700'
      };
    }
  };

  // Get tier-aware QR code quality settings (aligned with TenantQRCode)
  const getTierQRSettings = (tier: string, organizationTier?: string | undefined) => {
    const baseSize = 256; // Fixed display size for product page
    const colors = getTierColorPalette(tier, organizationTier);
    
    // Use organization tier logic if present
    const effectiveTier = organizationTier || tier;
    
    switch (effectiveTier) {
      case 'discovery':
      case 'starter':
      case 'chain_starter':
        return {
          renderSize: baseSize,           // 256px display
          exportSize: baseSize,           // 256px export
          errorCorrection: 'M' as const,
          margin: 2,
          quality: 'standard',
          colors: colors
        };
        
      case 'storefront':
      case 'chain_storefront':
        return {
          renderSize: baseSize,           // 256px display
          exportSize: 512,                // 512px export
          errorCorrection: 'M' as const,
          margin: 2,
          quality: 'enhanced',
          colors: colors
        };
        
      case 'commitment':
      case 'ecommerce':
      case 'chain_commitment':
        return {
          renderSize: baseSize,           // 256px display
          exportSize: 1024,               // 1024px export
          errorCorrection: 'H' as const,  // Higher error correction for logo
          margin: 3,
          quality: 'premium',
          colors: colors
        };
        
      case 'professional':
      case 'omnichannel':
      case 'chain_professional':
        return {
          renderSize: baseSize,           // 256px display
          exportSize: 2048,               // 2048px export
          errorCorrection: 'H' as const,  // Higher error correction for logo
          margin: 3,
          quality: 'professional',
          colors: colors
        };
        
      case 'enterprise':
      case 'organization':
      case 'chain_enterprise':
        return {
          renderSize: baseSize,           // 256px display
          exportSize: 2048,               // 2048px export
          errorCorrection: 'H' as const,  // Highest error correction
          margin: 4,
          quality: 'enterprise',
          colors: colors
        };
        
      default:
        return {
          renderSize: baseSize,
          exportSize: baseSize,
          errorCorrection: 'M' as const,
          margin: 2,
          quality: 'standard',
          colors: colors
        };
    }
  };

  const generateQRCode = async () => {
    if (qrImageUrl) return; // Already generated

    setIsGenerating(true);
    try {
      // Import QRCode dynamically to avoid SSR issues
      const QRCode = (await import('qrcode')).default;
      
      // Extract organization tier from effective tier logic (same as TenantQRCode)
      const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') : 
                             tenantTier === 'organization' ? 'enterprise' : undefined;
      
      // Get tier-specific settings with organization tier support
      const qrSettings = getTierQRSettings(tenantTier, organizationTier);
      
      // Create high-resolution canvas for export
      const exportCanvas = document.createElement('canvas');
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Could not get canvas context');

      exportCanvas.width = qrSettings.exportSize;
      exportCanvas.height = qrSettings.exportSize;

      // Generate high-quality QR code
      await QRCode.toCanvas(exportCanvas, productUrl, {
        width: qrSettings.exportSize,
        margin: qrSettings.margin,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: qrSettings.errorCorrection,
      });

      let finalCanvas = exportCanvas;
      
      // Logo eligibility logic (aligned with TenantQRCode)
      const effectiveTier = organizationTier || tenantTier;
      const shouldApplyLogo = (
        effectiveTier === 'commitment' ||
        effectiveTier === 'professional' ||
        effectiveTier === 'ecommerce' || 
        effectiveTier === 'omnichannel' || 
        effectiveTier === 'enterprise' ||
        effectiveTier === 'organization' ||
        tenantTier === 'chain_professional' ||
        tenantTier === 'chain_enterprise'
      ) && tenantLogo;

      // Overlay logo for eligible tiers
      if (shouldApplyLogo) {
        try {
          finalCanvas = await overlayLogoOnQR(exportCanvas, tenantLogo!);
        } catch (logoError) {
          console.warn('Failed to overlay logo, using plain QR code:', logoError);
          // Fall back to plain QR code if logo overlay fails
        }
      }

      // Generate high-quality PNG with maximum quality
      const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
      setQrImageUrl(dataUrl);
      
      // Log quality level for debugging
      // console.log(`[ProductQRCode] Generated ${qrSettings.quality} quality QR code at ${qrSettings.exportSize}px for tier: ${tenantTier}${organizationTier ? ` (org: ${organizationTier})` : ''}`);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate QR code at specific size for download
  const generateQRCodeAtSize = async (targetSize: number): Promise<string> => {
    const QRCode = (await import('qrcode')).default;
    
    // Extract organization tier from effective tier logic (same as TenantQRCode)
    const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') : 
                           tenantTier === 'organization' ? 'enterprise' : undefined;
    
    // Get tier-specific settings with organization tier support
    const qrSettings = getTierQRSettings(tenantTier, organizationTier);
    
    // Create canvas for requested size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = targetSize;
    canvas.height = targetSize;

    // Generate QR code with tier-appropriate settings
    await QRCode.toCanvas(canvas, productUrl, {
      width: targetSize,
      margin: qrSettings.margin,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: qrSettings.errorCorrection,
    });

    let finalCanvas = canvas;
    
    // Logo eligibility logic (aligned with TenantQRCode)
    const effectiveTier = organizationTier || tenantTier;
    const shouldApplyLogo = (
      effectiveTier === 'commitment' ||
      effectiveTier === 'professional' ||
      effectiveTier === 'ecommerce' ||
      effectiveTier === 'omnichannel' ||
      effectiveTier === 'enterprise' ||
      effectiveTier === 'organization' ||
      tenantTier === 'chain_professional' ||
      tenantTier === 'chain_enterprise'
    ) && tenantLogo;

    // Apply logo if eligible (all sizes for higher tiers, 512px+ for lower tiers)
    const logoMinSize = (
      effectiveTier === 'commitment' ||
      effectiveTier === 'professional' ||
      effectiveTier === 'ecommerce' ||
      effectiveTier === 'omnichannel' ||
      effectiveTier === 'enterprise' ||
      effectiveTier === 'organization' ||
      tenantTier === 'chain_professional' ||
      tenantTier === 'chain_enterprise'
    ) ? 256 : 512;
    
    if (shouldApplyLogo && targetSize >= logoMinSize) {
      try {
        finalCanvas = await overlayLogoOnQR(canvas, tenantLogo!);
      } catch (logoError) {
        console.warn('Failed to overlay logo, using plain QR code:', logoError);
      }
    }

    // Generate data URL
    return finalCanvas.toDataURL('image/png', 1.0);
  };

  const downloadQRCode = async (size: number) => {
    try {
      setIsGenerating(true);
      const dataUrl = await generateQRCodeAtSize(size);
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-code-${productName.replace(/[^a-zA-Z0-9]/g, '-')}-${size}px.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download QR code:', error);
    } finally {
      setIsGenerating(false);
    }
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

          {/* Tier-specific features */}
          {tenantTier && (
            <div className="mb-4 space-y-1">
              {(() => {
                // Extract organization tier for display logic
                const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') : 
                                       tenantTier === 'organization' ? 'enterprise' : undefined;
                const effectiveTier = organizationTier || tenantTier;
                const colors = getTierColorPalette(tenantTier, organizationTier);
                
                // Logo eligibility
                const shouldShowLogo = (
                  effectiveTier === 'commitment' ||
                  effectiveTier === 'professional' ||
                  effectiveTier === 'ecommerce' ||
                  effectiveTier === 'omnichannel' ||
                  effectiveTier === 'enterprise' ||
                  effectiveTier === 'organization' ||
                  tenantTier === 'chain_professional' ||
                  tenantTier === 'chain_enterprise'
                ) && tenantLogo;
                
                return (
                  <>
                    {shouldShowLogo && (
                      <span className={`inline-block text-xs ${colors.primaryIcon} font-medium mb-2`}>✨ Branded with store logo</span>
                    )}
                    
                    {/* Quality indicator */}
                    {(() => {
                      const settings = getTierQRSettings(tenantTier, organizationTier);
                      const qualityLabels = {
                        'standard': 'Standard Quality',
                        'enhanced': 'Enhanced Quality',
                        'premium': 'Premium Quality',
                        'professional': 'Professional Quality',
                        'enterprise': 'Enterprise Quality'
                      };
                      
                      return settings.exportSize > 256 ? (
                        <span className={`inline-block text-xs ${colors.secondaryIcon} mb-2`}>
                          📏 {settings.exportSize}px export • {qualityLabels[settings.quality as keyof typeof qualityLabels] || settings.quality}
                        </span>
                      ) : null;
                    })()}
                    
                    {/* Organization tier indicator */}
                    {organizationTier && (
                      <span className={`inline-block text-xs ${colors.primaryIcon} mb-2`}>
                        🏢 Organization: {organizationTier.charAt(0).toUpperCase() + organizationTier.slice(1)} tier
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Download Options */}
            <div className="flex flex-col sm:flex-row gap-2">
              {(() => {
                // Extract organization tier for download options
                const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') : 
                                       tenantTier === 'organization' ? 'enterprise' : undefined;
                const effectiveTier = organizationTier || tenantTier;
                
                // Define available sizes based on tier
                const sizeOptions = (() => {
                  switch (effectiveTier) {
                    case 'discovery':
                    case 'starter':
                    case 'chain_starter':
                      return [
                        { size: 256, label: 'Small (256px)', description: 'Mobile friendly' }
                      ];
                    case 'storefront':
                    case 'chain_storefront':
                      return [
                        { size: 256, label: 'Small (256px)', description: 'Mobile friendly' },
                        { size: 512, label: 'Medium (512px)', description: 'Web quality' }
                      ];
                    case 'ecommerce':
                    case 'commitment':
                    case 'chain_commitment':
                      return [
                        { size: 256, label: 'Small (256px)', description: 'Mobile friendly' },
                        { size: 512, label: 'Medium (512px)', description: 'Web quality' },
                        { size: 1024, label: 'Large (1024px)', description: 'Print quality' }
                      ];
                    case 'omnichannel':
                    case 'professional':
                    case 'chain_professional':
                    case 'enterprise':
                    case 'organization':
                    case 'chain_enterprise':
                      return [
                        { size: 256, label: 'Small (256px)', description: 'Mobile friendly' },
                        { size: 512, label: 'Medium (512px)', description: 'Web quality' },
                        { size: 1024, label: 'Large (1024px)', description: 'Print quality' },
                        { size: 2048, label: 'Extra Large (2048px)', description: 'Professional print' }
                      ];
                    default:
                      return [
                        { size: 256, label: 'Small (256px)', description: 'Mobile friendly' }
                      ];
                  }
                })();
                
                return (
                  <>
                    <div className="flex items-center gap-2 text-sm text-neutral-600 font-medium">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sizeOptions.map((option) => (
                        <button
                          key={option.size}
                          onClick={() => downloadQRCode(option.size)}
                          disabled={!qrImageUrl || isGenerating}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Print Button */}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors self-start"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-12h2a2 2 0 012 2v4a2 2 0 01-2 2h-2m-4-4h10a2 2 0 012 2v4a2 2 0 01-2 2h-2" />
              </svg>
              Print
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
  listPriceCents?: number;  // Add list price for sale display
  salePriceCents?: number;
  currency: string;
  imageUrl?: string;
  sku: string;
  availability: string;
  stock?: number;  // Add stock property
  productType?: 'physical' | 'digital' | 'hybrid';  // Add product type
  
  // Featured types
  featuredTypes?: string[];
  bucketCounts?: Record<string, number>; // All featured type counts for the tenant
  
  // Product variants
  variants?: any[];
  
  // Product image gallery with captions
  imageGallery?: Array<{
    url: string;
    alt?: string;
    caption?: string;
    position: number;
  }>;
  
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
  product_slug?: string; // New product slug field for simplified availability
  productSlug?: string;
  
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
  features?: string[];
  environmentalInfo?: string[];
  
  // Professional+ tier fields
  marketingDescription?: string;
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

interface Tenant extends PublicTenantInfo{
  id: string;
  name: string;
  subscriptionTier?: string;
  hasActivePaymentGateway?: boolean;
}

interface TierBasedLandingPageProps {
  product: Product;
  tenant: Tenant;
  storeStatus?: any;
  gallery?: React.ReactNode;
  fulfillmentPane?: React.ReactNode;
  slug?: string;
  currentUrl?: string;
  productSlug?: string;
  slugType?: string;
  disableQRCode?: boolean; // Override to disable QR code section
  initialOptFlags?: StorefrontOptionFlags | null; // Server-side resolved flags
}

export function TierBasedLandingPage({ product, tenant, storeStatus, gallery, fulfillmentPane, slug, currentUrl, productSlug, slugType, disableQRCode, initialOptFlags }: TierBasedLandingPageProps) {
  const { settings: platformSettings } = usePlatformSettings();
  const [features, setFeatures] = useState<LandingPageFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const productFeatures = product.features;
  // console.log(`[TierBasedLandingPage] productFeatures: `, productFeatures);
  
  // Move all hooks to the top - Rules of Hooks
  const { status: hoursStatus } = useStoreStatus(tenant.id, true); // Public scope
  
  // Responsive layout for AddToCartButton
  const layout = useResponsiveLayout();
  
  // Get fresh payment gateway status from context
  const contextPayment = useTenantPaymentOptional();
  const contextCanPurchase = contextPayment && !contextPayment.loading ? contextPayment.canPurchase : undefined;
  const contextGatewayType = contextPayment && !contextPayment.loading ? contextPayment.defaultGatewayType : undefined;
  const effectiveCanPurchaseLegacy = contextCanPurchase ?? tenant.hasActivePaymentGateway ?? false;
  const effectiveGatewayType = contextGatewayType ?? (product as any).defaultGatewayType;

  // Capability-aware commerce and payment gateway resolution
  const commerceCap = useCommerceCapability(product.tenantId);
  const paymentCap = usePaymentGatewayCapability(product.tenantId);
  const commerceEnabled = commerceCap.data?.enabled ?? true;
  const gatewayCapEnabled = paymentCap.data?.enabled ?? true;
  const commerceDisabled = !!((commerceCap.data && !commerceCap.data.enabled) || (paymentCap.data && !paymentCap.data.enabled));
  const effectiveCanPurchase = effectiveCanPurchaseLegacy && commerceEnabled && gatewayCapEnabled;

  // Storefront capability-driven content control
  const storefrontCap = useStorefrontCapability(product.tenantId);
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'both';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'both';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'both';
  // showsHours/showsMap/showsLocation now come from storefront_options (merchant-controlled)
  // storefront_type (platform-controlled) still determines isRetailStore/isOnlineStore/isServiceStore

  // Storefront options capability flags — initialized from server-side fetch (no waterfall)
  const [optFlags] = useState<StorefrontOptionFlags | null>(initialOptFlags ?? null);
  // console.log(`product storefront_options optFlags: ${JSON.stringify(optFlags, null, 2)}`);

  const showsLocation = optFlags?.showLocationDisplay ?? true;
  const showsMap = optFlags?.showMapDisplay ?? true;
  const showsHours = optFlags?.showHoursDisplay ?? true;
  // console.log(`[TierBasedLandingPage] Effective can purchase: ${effectiveCanPurchase}`);
  // console.log(`[TierBasedLandingPage] Effective gateway type: ${effectiveGatewayType}`);
  // console.log(`[TierBasedLandingPage] Context payment: ${JSON.stringify(contextPayment, null, 2)}`);

  // Debug logging for variants
  // console.log('[TierBasedLandingPage] Product:', product);
  // console.log('[TierBasedLandingPage] Tenant:', tenant);
  // console.log('[TierBasedLandingPage] Product variants:', product.variants);
  // console.log('[TierBasedLandingPage] Variants length:', product.variants?.length);
  // console.log('[TierBasedLandingPage] Variants type:', typeof product.variants);
  // console.log('[TierBasedLandingPage] Product object keys:', Object.keys(product));
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : process.env.WEB_URL) || 'http://localhost:3000';
  const resolvedCurrentUrl = currentUrl || `${baseUrl}/products/${product.id}`;
  // console.log('[TierBasedLandingPage] Current URL:', resolvedCurrentUrl);
  

  // Calculate current pricing based on selected variant
// ... (rest of the code remains the same)
  const currentPrice = selectedVariant?.price_cents ? selectedVariant.price_cents / 100 : product.price;
  const currentPriceCents = selectedVariant?.price_cents || product.priceCents;
  const currentListPriceCents = selectedVariant?.price_cents || product.listPriceCents;
  const getStock = (v: any) => v?.inventory_quantity ?? v?.stock ?? v?.variant_stock ?? v?.variant_inventory_quantity ?? 0;
  const currentStock = getStock(selectedVariant) || product.stock;
  const currentSku = selectedVariant?.sku || product.sku;
  // Treat 'limited' as in_stock since it means stock > 0
  const currentAvailability = selectedVariant 
    ? (getStock(selectedVariant) > 0 ? 'in_stock' : 'out_of_stock') 
    : (product.availability === 'in_stock' || product.availability === 'limited' ? 'in_stock' : product.availability);
  // console.log(`[TierBasedLandingPage] Current availability: ${currentAvailability}`);
  
  // Calculate variant price range and stock for display when no variant is selected
  const hasVariants = product.variants && product.variants.length > 0;
  const variantPriceRange = hasVariants && !selectedVariant ? (() => {
    const variantPrices = product.variants!.map((v: any) => 
      v.sale_price_cents && v.sale_price_cents < v.price_cents ? v.sale_price_cents : v.price_cents
    );
    const minPrice = Math.min(...variantPrices);
    const hasSale = product.variants!.some((v: any) => v.sale_price_cents && v.sale_price_cents < v.price_cents);
    return { minPrice, hasSale };
  })() : null;
  
  // Calculate aggregate stock from all variants when no variant selected
  const variantStockInfo = hasVariants && !selectedVariant ? (() => {
    // Try multiple possible field names for stock
    const getStock = (v: any) => v?.inventory_quantity ?? v?.stock ?? v?.variant_stock ?? v?.variant_inventory_quantity ?? 0;
    const totalStock = product.variants!.reduce((sum: number, v: any) => sum + getStock(v), 0);
    const inStockCount = product.variants!.filter((v: any) => getStock(v) > 0).length;
    return { totalStock, inStockCount, isAvailable: totalStock > 0 };
  })() : null;

  // Convert tenant tier features to landing page features
  const mapTierToFeatures = useCallback((tierData: any): LandingPageFeatures => {
    // Handle nested API response structure
    const actualTierData = tierData.data || tierData;
    // Features are nested in tenantTier.features
    const tenantTier = actualTierData.tenantTier || actualTierData;
    const featureMap = new Map(
      tenantTier.features?.map((f: any) => [f.feature_key, f.is_enabled]) || []
    );

    // Determine gallery level based on enabled features
    let maxGalleryImages = 0; // Default: no gallery
    let hasGalleryFeature = false;
    
    if (featureMap.get('image_gallery_10')) {
      maxGalleryImages = 10;
      hasGalleryFeature = true;
    } else if (featureMap.get('image_gallery_5')) {
      maxGalleryImages = 5;
      hasGalleryFeature = true;
    }
    // If neither feature is enabled, maxGalleryImages stays 0 (no gallery)

    return {
      customMarketingDescription: Boolean(featureMap.get('custom_marketing_copy')),
      imageGallery: hasGalleryFeature,
      maxGalleryImages,
      customCta: Boolean(featureMap.get('custom_cta')),
      socialLinks: Boolean(featureMap.get('social_links')),
      qrCodes: Boolean(featureMap.get('qr_codes_1024') || featureMap.get('qr_codes_512')),
      showBusinessLogo: Boolean(featureMap.get('business_logo')),
      removePlatformBranding: Boolean(featureMap.get('remove_platform_branding')),
      customLogo: Boolean(featureMap.get('custom_logo')),
      customColors: Boolean(featureMap.get('custom_colors')),
      customSections: Boolean(featureMap.get('custom_sections')),
      maxCustomSections: 0, // Will be implemented later
      customTheme: Boolean(featureMap.get('custom_theme')),
      customDomain: Boolean(featureMap.get('custom_domain')),
      abTesting: Boolean(featureMap.get('ab_testing')),
      advancedAnalytics: Boolean(featureMap.get('advanced_analytics')),
    };
  }, []);

  useEffect(() => {
    async function loadFeatures() {
      try {
        const tierData = await storefrontService.getPublicTier(tenant.id);
        if (tierData) {
          const mappedFeatures = mapTierToFeatures(tierData);
          setFeatures(mappedFeatures);
        }
      } catch (error) {
        console.error('[TierBasedLandingPage] Failed to load features:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFeatures();
  }, [tenant.id]);

  const branding = product.customBranding;

  const tenantSlug = tenant?.slug || tenant?.id;
  
  // Show loading state while features are loading
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-96 bg-gray-200 rounded-lg mb-6"></div>
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Use fallback features if not available
  const safeFeatures = features || {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 10,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: false,
    customLogo: true,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  };

  // Check if storefront is available (has features and not trial)
  const hasStorefront = features && !loading;
  
  // Determine colors
  const primaryColor = safeFeatures.customColors && branding?.primaryColor ? branding.primaryColor : '#3b82f6';
  const secondaryColor = safeFeatures.customColors && branding?.secondaryColor ? branding.secondaryColor : '#1e40af';

  // Get logo - Priority: 1) Enterprise custom branding, 2) Tenant business logo, 3) Platform logo
  const metadata = tenant.metadata as any;
  const enterpriseLogo = safeFeatures.customLogo && branding?.logo;
  const businessLogo = metadata?.logo_url;
  const platformLogo = platformSettings?.logoUrl;
  
  const displayLogo = enterpriseLogo || businessLogo || (features && !loading ? platformLogo : null);
  const displayName = metadata?.businessName || tenant.name || platformSettings?.platformName;
  const showLogo = !!displayLogo;

  
  let effectiveTierPart = tenant.subscriptionTier || 'discovery';
  const tierParts = effectiveTierPart.split('_');
  if (tierParts.length >= 2 && tierParts[0]=='trial') {
    effectiveTierPart = tierParts[1];
  }
          
  
  // console.log(`[TierBasedLandingPage] effectiveTierPart: ${effectiveTierPart}`)
   // Server-side check: show panel for google_only and discovery tier, non-active status, or subscription issues
   
  const showStatusPanel = tenant ? (
    effectiveTierPart === 'google_only' || effectiveTierPart === 'discovery' ||
    (tenant.locationStatus && tenant.locationStatus !== 'active') ||
    (tenant.statusInfo && !tenant.statusInfo.showStorefront) ||
    tenant.showSubscriptionPanel === true
  ) : false;

  // Status indicator color
  const getStatusColor = () => {
    if (!hoursStatus) return 'bg-gray-400';
    switch (hoursStatus.status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-red-500';
      case 'opening-soon': return 'bg-blue-500';
      case 'closing-soon': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };


  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="w-full max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Product Images */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          {safeFeatures.imageGallery && product.imageGallery && product.imageGallery.length > 0 ? (
            safeFeatures.maxGalleryImages === 10 ? (
              <ProductGallery 
                gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)} 
                productTitle={product.name} 
              />
            ) : (
              <BasicProductGallery 
                gallery={product.imageGallery.slice(0, safeFeatures.maxGalleryImages)} 
                productTitle={product.name} 
              />
            )
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

        {/* Featured Type Badges - Prominent display below hero */}
        {product.featuredTypes && product.featuredTypes.length > 0 && (
          <FeaturedTypeBadges featuredTypes={product.featuredTypes} bucketCounts={product.bucketCounts} />
        )}

        {/* Product Actions - Share, Print, Like */}
        <ProductActions 
          product={product} 
          tenant={tenant}
          productUrl={resolvedCurrentUrl}
          variant="product"
          showHours={showsHours}
          showLocation={showsLocation}
          showMap={showsMap}
          isRetailStore={isRetailStore}
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
              <a title={`Browse to store's ${product.tenantCategory?.name} products`} className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-full hover:opacity-100 transition-opacity cursor-pointer no-underline`}
              href={`/tenant/${product.tenantId}?category=${product.tenantCategory?.slug}`}>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {typeof product.tenantCategory === 'string' ? product.tenantCategory : product.tenantCategory?.name || ''}
              </span>
              </a>
            </div>
          )}
          {!product.manufacturer && !product.tenantCategory && <div className="mb-3" />}
          {(product.manufacturer || product.tenantCategory) && <div className="mb-3" />}
          
          {/* 1. Availability Status - First thing customers see */}
          {(() => {
            if (product.variants && product.variants.length > 0) {
              return (
                <div className="mb-6">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-lg font-medium ${
                    (selectedVariant ? currentAvailability : (variantStockInfo?.isAvailable ? 'in_stock' : 'out_of_stock')) === 'in_stock' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {(selectedVariant ? currentAvailability : (variantStockInfo?.isAvailable ? 'in_stock' : 'out_of_stock')) === 'in_stock' ? '✓ In Stock' : '✗ Out of Stock'}
                  </span>
                  {((selectedVariant ? currentAvailability : (variantStockInfo?.isAvailable ? 'in_stock' : 'out_of_stock')) === 'in_stock') && (
                    <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {selectedVariant 
                        ? (currentStock !== undefined && currentStock !== null ? `${currentStock} units available` : '')
                        : (variantStockInfo ? `${variantStockInfo.totalStock} units across ${variantStockInfo.inStockCount} variant(s)` : '')
                      }
                    </span>
                  )}
                </div>
              );
            } else {
              return (
                <div className="mb-6">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    currentAvailability === 'in_stock' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {currentAvailability === 'in_stock' 
                      ? `✓ In Stock (${currentStock} available)` 
                      : '✗ Out of Stock'}
                  </span>
                </div>
              );
            }
          })()}

          {/* 2. Product Type Badge */}
          {product.productType && (
            <div className="mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-lg font-medium bg-gray-100 text-gray-800">
                {product.productType === 'physical' && <Package size={20} className="mr-2" />}
                {product.productType === 'digital' && <Download size={20} className="mr-2" />}
                {product.productType === 'hybrid' && <Globe size={20} className="mr-2" />}
                {product.productType.charAt(0).toUpperCase() + product.productType.slice(1)}
              </span>
            </div>
          )}

          {/* 3. Standard Description - Basic product information */}
          {product.description && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-3">
                {safeFeatures.customMarketingDescription && product.marketingDescription ? 'Product Details' : 'Product Description'}
              </h3>
              <p className="text-neutral-700 whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* 4. Marketing Description - Enhanced marketing copy */}
          {safeFeatures.customMarketingDescription && product.marketingDescription && (
            <div className="prose prose-neutral max-w-none mb-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-3">Marketing</h3>
              <p className="text-lg text-neutral-700 whitespace-pre-wrap">{product.marketingDescription}</p>
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
                    <span style={{ textDecoration: 'line-through' }}>{product.nutritionFacts.totalCarbohydrate}</span>
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

        {/* Key Features - from product_metadata.features */}
        {product.features && product.features.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">✨ Key Features</h2>
            <ul className="space-y-2">
              {product.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span className="text-neutral-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Environmental Info */}
        {product.environmentalInfo && product.environmentalInfo.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">🌱 Environmental Information</h2>
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
                <div key={key} className="py-2 border-b border-neutral-200">
                  <dt className="font-medium text-neutral-700 capitalize">{key.replace(/_/g, ' ')}</dt>
                  <dd className="text-neutral-900 mt-1">
                    {typeof value === 'object' && value !== null ? (
                      <dl className="pl-4 space-y-1">
                        {Object.entries(value as Record<string, any>).map(([subKey, subValue]) => (
                          <div key={subKey} className="flex justify-between text-sm">
                            <dt className="text-neutral-600 capitalize">{subKey.replace(/_/g, ' ')}</dt>
                            <dd className="text-neutral-800">{String(subValue)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      String(value)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        
          {/* 5. Variant Selector - After product info, before price */}
          {(() => {
            if (product.variants && product.variants.length > 0) {
              return (
                <div className="mb-6 p-4 bg-gradient-to-r from-rose-50 to-indigo-50 border border-rose-200 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-rose-600" />
                    <span className="text-sm font-semibold text-rose-900">Select Options</span>
                  </div>
                  <ProductVariantSelector
                    variants={product.variants || []}
                    onVariantChange={setSelectedVariant}
                    selectedVariant={selectedVariant}
                  />
                </div>
              );
            } else {
              return null;
            }
          })()}

          {/* 6. Price Display */}
          <div className="mb-6">
            {/* Show variant price range if has variants and no variant selected */}
            {variantPriceRange ? (
              <div className="mb-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  From ${(variantPriceRange.minPrice / 100).toFixed(2)}
                </span>
                {variantPriceRange.hasSale && (
                  <span className="ml-2 text-sm text-gray-500">(Sale available)</span>
                )}
              </div>
            ) : (
              <PriceDisplay
                priceCents={currentListPriceCents}
                salePriceCents={selectedVariant?.sale_price_cents || product.salePriceCents}
                variant="large"
                showSavingsBadge={true}
                className="mb-1"
              />
            )}
            <span className="text-sm text-neutral-500">SKU: {currentSku}</span>
          </div>

          {/* 7. Add to Cart Button - Final purchase action */}
          {!showStatusPanel && (effectiveCanPurchase || commerceDisabled) && (
            <div className="mb-6 p-5 bg-gradient-to-br from-green-50 to-indigo-50 dark:from-green-950/50 dark:to-indigo-950/50 rounded-xl border-2 border-green-200 dark:border-green-800 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Package className="flex items-center justify-center h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">Add to Cart</span>
              </div>
              
              {/* Quantity Selector */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-gray-600">Quantity:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={currentStock || 999}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const max = currentStock || 999;
                      setQuantity(Math.min(Math.max(1, val), max));
                    }}
                    className="w-16 h-8 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(quantity + 1, currentStock || 999))}
                    disabled={quantity >= (currentStock || 999)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                {currentStock > 0 && (
                  <span className="text-xs text-gray-400">max {currentStock}</span>
                )}
              </div>
              
              <AddToCartButton
                product={{
                  id: selectedVariant?.id || product.id,
                  name: selectedVariant?.variant_name ? `${product.title} - ${selectedVariant.variant_name}` : product.title,
                  sku: currentSku,
                  priceCents: currentPriceCents,
                  salePriceCents: selectedVariant?.sale_price_cents || product.salePriceCents,
                  imageUrl: selectedVariant?.image_url || product.imageUrl,
                  stock: currentAvailability === 'in_stock' ? (currentStock || 999) : 0,
                  tenantId: product.tenantId,
                  has_variants: hasVariants,
                }}
                variant={selectedVariant}
                quantity={quantity}
                tenantName={tenant.metadata?.businessName || tenant.name}
                tenantLogo={businessLogo}
                hasActivePaymentGateway={effectiveCanPurchase}
                defaultGatewayType={effectiveGatewayType}
                commerceDisabled={commerceDisabled}
                layout={layout}
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

          {/* Multi-Location Availability - only for retail/both storefronts */}
          {isRetailStore && tenant.organizationId && (
            <div className="mb-6">
              <LocationAvailabilitySection
                productSlug={productSlug || product.product_slug || product.productSlug || product.sku || product.id}
                slugType={slugType}
                productName={product.name}
                organizationId={tenant.organizationId}
                preferredTenantId={product.tenantId}
                maxDistance={50}
                maxResults={5}
                useSmartFallback={true} // Enable slug -> SKU fallback
              />
            </div>
          )}

          {/* Custom CTA */}
          {!showStatusPanel && safeFeatures.customCta && product.customCta && (
            <div className="mb-6">
              <a
                href={product.customCta.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                {product.customCta.text || 'Learn More'}
              </a>
            </div>
          )}
 

        {/* QR Code CTA Section - capability-aware */}
        {!showStatusPanel && !disableQRCode && (
          <TenantQRCode
            url={resolvedCurrentUrl}
            tenantId={product.tenantId}
            label="Scan to Share"
            pageType="product"
            capabilityFlags={optFlags}
          />
        )}

        {/* Fulfillment & Payment Options - After QR Code */}
        {!showStatusPanel && fulfillmentPane && (
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
              <Button
                onClick={() => window.location.href = `/tenant/${tenantSlug ? tenantSlug : tenant.id}`}
                variant="gradient" style={{ color: 'white' }} size='lg'
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm whitespace-nowrap"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Browse All Products
              </Button>
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
          key={images[currentIndex]} // Force re-render when image changes
          src={images[currentIndex]}
          alt={`${productName} - Image ${currentIndex + 1}`}
          fill
          className="object-contain"
          priority={currentIndex === 0} // Only priority for first image
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
