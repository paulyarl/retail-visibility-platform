'use client';

import { useState, useEffect } from 'react';
import { storefrontService } from '@/services/StorefrontService';
import { tenantPublicService } from '@/services/TenantPublicService';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

export interface TenantQRCodeProps {
  /** The URL to encode in the QR code */
  url: string;
  /** Tenant ID to fetch tier and logo */
  tenantId: string;
  /** Optional label for the QR code section */
  label?: string;
  /** Optional filename for download (without extension) */
  downloadName?: string;
  /** Size of the QR code in pixels */
  size?: number;
  /** Show download button */
  showDownload?: boolean;
  /** Additional container classes */
  className?: string;
  /** Page type for filename differentiation */
  pageType?: 'storefront' | 'directory' | 'product' | 'map';
  /** Pre-resolved capability flags (skips tier fetch if provided) */
  capabilityFlags?: StorefrontOptionFlags | null;
}

/**
 * Tier-aware QR code component with logo overlay for higher tiers.
 * Can be used on product pages, storefront, and directory listings.
 */
export function TenantQRCode({
  url,
  tenantId,
  label = 'QR Code',
  downloadName,
  size = 256,
  showDownload = true,
  className = '',
  pageType,
  capabilityFlags,
}: TenantQRCodeProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantTier, setTenantTier] = useState<string>('discovery');
  const [isFetchingTierAndLogo, setIsFetchingTierAndLogo] = useState(true);
  // Capability-aware flags (resolved from API or passed as prop)
  const [resolvedFlags, setResolvedFlags] = useState<StorefrontOptionFlags | null>(capabilityFlags || null);

  // Fetch tenant tier, logo, and capability flags
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        setIsFetchingTierAndLogo(true);

        // Fetch tier data and capability flags in parallel
        const [tierData, flagsResult] = await Promise.all([
          storefrontService.getPublicTier(tenantId),
          capabilityFlags
            ? Promise.resolve(capabilityFlags)
            : unifiedCapabilityService.getStorefrontOptionFlags(tenantId),
        ]);

        // Set capability flags if not provided as prop
        if (!capabilityFlags && flagsResult) {
          setResolvedFlags(flagsResult);
        }

        if (tierData) {
          const data = tierData.data || tierData;

          // Determine effective tier (still needed for logo fetch and color palette)
          const individualTier = data.tenantTier?.tier_key || null;
          const organizationTier = data.organizationTier?.tier_key || null;

          let effectiveTier: string;
          if (individualTier && (!organizationTier || individualTier >= organizationTier)) {
            effectiveTier = individualTier;
          } else if (organizationTier) {
            effectiveTier = organizationTier;
          } else {
            effectiveTier = data.effective?.tier_key || data.tier || 'discovery';
          }

          // Strip 'trial_' prefix if present
          let effectiveTierPart = effectiveTier;
          const tierParts = effectiveTier.split('_');
          if (tierParts.length >= 2 && tierParts[0] === 'trial') {
            effectiveTierPart = tierParts[1];
          }

          setTenantTier(effectiveTierPart);

          // Fetch logo if QR logo capability is enabled (capability-aware)
          const shouldFetchLogo = flagsResult?.showQRLogo
            || ['professional', 'commitment', 'enterprise', 'organization', 'ecommerce', 'omnichannel',
              'chain_professional', 'chain_enterprise', 'chain_starter'].includes(effectiveTierPart);

          if (shouldFetchLogo) {
            try {
              const profile = await tenantPublicService.getPublicTenantInfo(tenantId);
              if (profile) {
                const profileData = profile?.profileData || profile;
                setTenantLogo(profileData.logo_url || null);
              }
            } catch (profileError) {
              console.error('Error fetching tenant profile:', profileError);
            }
          }
        }
      } catch (error) {
        console.error('[TenantQRCode] Error fetching tenant info:', error);
      } finally {
        setIsFetchingTierAndLogo(false);
      }
    };

    if (tenantId) {
      fetchTenantInfo();
    }
  }, [tenantId, capabilityFlags]);

  // Overlay logo on QR code
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
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;

        ctx.drawImage(qrCanvas, 0, 0);

        const logoSize = Math.floor(canvas.width * 0.30);
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = (canvas.height - logoSize) / 2;

        // White circular background
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
        ctx.fill();

        // Circular mask for logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.globalAlpha = 1.0;
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Border around logo
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();

        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load logo image'));
      img.src = logoSrc;
    });
  };

  // Shared tier utility functions (aligned with TierGainsWelcome)
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
    } else if (tier === 'omnichannel') {
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
    } else if (tier === 'ecommerce') {
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

  // Get capability-aware QR code quality settings
  // Uses resolvedFlags (from storefront_options capability) when available,
  // falls back to tier-based logic for backward compatibility
  const getCapabilityQRSettings = (tier: string, organizationTier?: string | undefined) => {
    const baseSize = size;
    const colors = getTierColorPalette(tier, organizationTier);

    // Capability-aware: use resolved QR resolution from flags
    if (resolvedFlags?.showQRCodes && resolvedFlags.qrResolution) {
      const res = resolvedFlags.qrResolution;
      const exportSize = res === '2048' ? 2048 : res === '1024' ? 1024 : res === '512' ? 512 : baseSize;
      const needsLogo = resolvedFlags.showQRLogo && !!tenantLogo;
      return {
        renderSize: Math.min(baseSize * (exportSize / baseSize), exportSize),
        exportSize,
        errorCorrection: (needsLogo || exportSize >= 1024 ? 'H' : 'M') as 'H' | 'M',
        margin: exportSize >= 2048 ? 4 : exportSize >= 1024 ? 3 : 2,
        quality: exportSize >= 2048 ? 'enterprise' : exportSize >= 1024 ? 'premium' : exportSize >= 512 ? 'enhanced' : 'standard',
        colors,
      };
    }

    // Fallback: tier-based logic (backward compatibility)
    const effectiveTier = organizationTier || tier;
    switch (effectiveTier) {
      case 'discovery':
      case 'starter':
      case 'chain_starter':
        return { renderSize: baseSize, exportSize: baseSize, errorCorrection: 'M' as const, margin: 2, quality: 'standard', colors };
      case 'storefront':
      case 'chain_storefront':
        return { renderSize: Math.min(baseSize * 1.5, 512), exportSize: 512, errorCorrection: 'M' as const, margin: 2, quality: 'enhanced', colors };
      case 'commitment':
      case 'chain_commitment':
        return { renderSize: Math.min(baseSize * 2, 1024), exportSize: 1024, errorCorrection: 'H' as const, margin: 3, quality: 'premium', colors };
      case 'professional':
      case 'ecommerce':
      case 'omnichannel':
      case 'chain_professional':
        return { renderSize: Math.min(baseSize * 3, 2048), exportSize: 2048, errorCorrection: 'H' as const, margin: 3, quality: 'professional', colors };
      case 'enterprise':
      case 'organization':
      case 'chain_enterprise':
        return { renderSize: Math.min(baseSize * 4, 2048), exportSize: 2048, errorCorrection: 'H' as const, margin: 4, quality: 'enterprise', colors };
      default:
        return { renderSize: baseSize, exportSize: baseSize, errorCorrection: 'M' as const, margin: 2, quality: 'standard', colors };
    }
  };

  // Generate QR code
  const generateQRCode = async () => {
    if (qrImageUrl || !url) return;

    setIsGenerating(true);
    try {
      const QRCode = (await import('qrcode')).default;

      // Extract organization tier from effective tier logic (same as TierGainsWelcome)
      const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') :
        tenantTier === 'organization' ? 'enterprise' : undefined;

      // Get capability-aware QR settings
      const qrSettings = getCapabilityQRSettings(tenantTier, organizationTier);

      // Create high-resolution canvas for export
      const exportCanvas = document.createElement('canvas');
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) throw new Error('Could not get canvas context');

      exportCanvas.width = qrSettings.exportSize;
      exportCanvas.height = qrSettings.exportSize;

      // Generate high-quality QR code
      await QRCode.toCanvas(exportCanvas, url, {
        width: qrSettings.exportSize,
        margin: qrSettings.margin,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: qrSettings.errorCorrection,
      });

      let finalCanvas = exportCanvas;

      // Logo eligibility: capability-aware (showQRLogo flag) with tier fallback
      const shouldApplyLogo = resolvedFlags
        ? resolvedFlags.showQRLogo && !!tenantLogo
        : (() => {
          const effectiveTier = organizationTier || tenantTier;
          return (
            effectiveTier === 'commitment' ||
            effectiveTier === 'professional' ||
            effectiveTier === 'ecommerce' ||
            effectiveTier === 'omnichannel' ||
            effectiveTier === 'enterprise' ||
            effectiveTier === 'organization' ||
            tenantTier === 'chain_professional' ||
            tenantTier === 'chain_enterprise'
          ) && !!tenantLogo;
        })();

      if (shouldApplyLogo) {
        try {
          finalCanvas = await overlayLogoOnQR(exportCanvas, tenantLogo!);
        } catch (logoError) {
          console.warn('Failed to overlay logo, using plain QR code:', logoError);
        }
      }

      // Generate high-quality PNG with maximum quality
      const dataUrl = finalCanvas.toDataURL('image/png', 1.0);
      setQrImageUrl(dataUrl);

      // Log quality level for debugging
      // console.log(`[TenantQRCode] Generated ${qrSettings.quality} quality QR code at ${qrSettings.exportSize}px for tier: ${tenantTier}${organizationTier ? ` (org: ${organizationTier})` : ''}`);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate QR code when tier and logo fetch is complete
  useEffect(() => {
    if (!isFetchingTierAndLogo && url) {
      generateQRCode();
    }
  }, [isFetchingTierAndLogo, url]);

  // Generate QR code at specific size for download
  const generateQRCodeAtSize = async (targetSize: number): Promise<string> => {
    const QRCode = (await import('qrcode')).default;

    // Extract organization tier from effective tier logic (same as TierGainsWelcome)
    const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') :
      tenantTier === 'organization' ? 'enterprise' : undefined;

    // Get capability-aware QR settings
    const qrSettings = getCapabilityQRSettings(tenantTier, organizationTier);

    // Create canvas for requested size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = targetSize;
    canvas.height = targetSize;

    // Generate QR code with tier-appropriate settings
    await QRCode.toCanvas(canvas, url, {
      width: targetSize,
      margin: qrSettings.margin,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: qrSettings.errorCorrection,
    });

    let finalCanvas = canvas;

    // Logo eligibility: capability-aware with tier fallback
    const shouldApplyLogo = resolvedFlags
      ? resolvedFlags.showQRLogo && !!tenantLogo
      : (() => {
        const effectiveTier = organizationTier || tenantTier;
        return (
          effectiveTier === 'commitment' ||
          effectiveTier === 'professional' ||
          effectiveTier === 'ecommerce' ||
          effectiveTier === 'omnichannel' ||
          effectiveTier === 'enterprise' ||
          effectiveTier === 'organization' ||
          tenantTier === 'chain_professional' ||
          tenantTier === 'chain_enterprise'
        ) && !!tenantLogo;
      })();

    // Logo minimum size: capability-aware (256px if QR logo allowed, 512px otherwise)
    const logoMinSize = resolvedFlags?.showQRLogo ? 256 : 512;

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

  const downloadQRCode = async (targetSize: number) => {
    try {
      setIsGenerating(true);
      const dataUrl = await generateQRCodeAtSize(targetSize);

      const link = document.createElement('a');
      link.href = dataUrl;

      // Create filename with page type prefix for better organization
      let baseName = downloadName || url.replace(/[^a-z0-9]/gi, '-').toLowerCase();

      // Add page type prefix if specified
      if (pageType) {
        baseName = `${pageType}-${baseName}`;
      }

      link.download = `qr-${baseName}-${targetSize}px.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Capability gate: if flags resolved and QR codes not allowed for this page type, render nothing
  if (resolvedFlags) {
    const pageSpecificFlag =
      pageType === 'product'
        ? resolvedFlags.showQRProduct
        : pageType === 'directory'
          ? resolvedFlags.showQRDirectory
          : pageType === 'storefront'
            ? resolvedFlags.showQRStore
            : resolvedFlags.showQRCodes;
    if (!pageSpecificFlag) {
      return null;
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-neutral-900">{label}</h3>
      </div>

      <div className="flex flex-col items-center">
        {isGenerating || isFetchingTierAndLogo ? (
          <div
            className="bg-neutral-100 rounded-lg animate-pulse"
            style={{ width: size, height: size }}
          />
        ) : qrImageUrl ? (
          <img
            src={qrImageUrl}
            alt="QR Code"
            className="rounded-lg border border-neutral-200 shadow-sm"
            style={{ width: size, height: 'auto' }}
          />
        ) : (
          <div
            className="bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400"
            style={{ width: size, height: size }}
          >
            No QR Code
          </div>
        )}

        {showDownload && qrImageUrl && (
          <div className="mt-3 space-y-2">
            {(() => {
              // Capability-aware download size options
              const sizeOptions = (() => {
                // Use resolved flags when available
                if (resolvedFlags?.showQRCodes && resolvedFlags.qrResolutions.length > 0) {
                  const res = resolvedFlags.qrResolutions;
                  const options = [{ size: 256, label: 'Small (256px)', description: 'Mobile friendly' }];
                  if (res.includes('qr_codes_512') || res.includes('qr_codes_1024') || res.includes('qr_codes_2048')) {
                    options.push({ size: 512, label: 'Medium (512px)', description: 'Web quality' });
                  }
                  if (res.includes('qr_codes_1024') || res.includes('qr_codes_2048')) {
                    options.push({ size: 1024, label: 'Large (1024px)', description: 'Print quality' });
                  }
                  if (res.includes('qr_codes_2048')) {
                    options.push({ size: 2048, label: 'Extra Large (2048px)', description: 'Professional print' });
                  }
                  return options;
                }
                // Fallback: tier-based
                const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') :
                  tenantTier === 'organization' ? 'enterprise' : undefined;
                const effectiveTier = organizationTier || tenantTier;
                switch (effectiveTier) {
                  case 'discovery':
                  case 'starter':
                  case 'chain_starter':
                    return [{ size: 256, label: 'Small (256px)', description: 'Mobile friendly' }];
                  case 'storefront':
                  case 'chain_storefront':
                    return [
                      { size: 256, label: 'Small (256px)', description: 'Mobile friendly' },
                      { size: 512, label: 'Medium (512px)', description: 'Web quality' }
                    ];
                  case 'commitment':
                  case 'chain_commitment':
                    return [
                      { size: 256, label: 'Small (256px)', description: 'Mobile friendly' },
                      { size: 512, label: 'Medium (512px)', description: 'Web quality' },
                      { size: 1024, label: 'Large (1024px)', description: 'Print quality' }
                    ];
                  case 'ecommerce':
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
                    return [{ size: 256, label: 'Small (256px)', description: 'Mobile friendly' }];
                }
              })();

              return (
                <>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {sizeOptions.map((option) => (
                      <button
                        key={option.size}
                        onClick={() => downloadQRCode(option.size)}
                        disabled={isGenerating}
                        className="px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        )}
      </div>

      {tenantTier && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-neutral-500 text-center">
            Scan to visit
          </p>

          {/* Capability-aware feature indicators */}
          <div className="text-center">
            {(() => {
              const organizationTier = tenantTier.includes('chain_') ? tenantTier.replace('chain_', '') :
                tenantTier === 'organization' ? 'enterprise' : undefined;
              const colors = getTierColorPalette(tenantTier, organizationTier);

              // Logo eligibility: capability-aware with tier fallback
              const shouldShowLogo = resolvedFlags
                ? resolvedFlags.showQRLogo && !!tenantLogo
                : (() => {
                  const effectiveTier = organizationTier || tenantTier;
                  return (
                    effectiveTier === 'commitment' ||
                    effectiveTier === 'professional' ||
                    effectiveTier === 'ecommerce' ||
                    effectiveTier === 'omnichannel' ||
                    effectiveTier === 'enterprise' ||
                    effectiveTier === 'organization' ||
                    tenantTier === 'chain_professional' ||
                    tenantTier === 'chain_enterprise'
                  ) && !!tenantLogo;
                })();

              return (
                <>
                  {shouldShowLogo && (
                    <span className={`block text-xs ${colors.primaryIcon} font-medium`}>✨ Branded with store logo</span>
                  )}

                  {/* Quality indicator */}
                  {(() => {
                    const settings = getCapabilityQRSettings(tenantTier, organizationTier);
                    const qualityLabels = {
                      'standard': 'Standard Quality',
                      'enhanced': 'Enhanced Quality',
                      'premium': 'Premium Quality',
                      'professional': 'Professional Quality',
                      'enterprise': 'Enterprise Quality'
                    };

                    return settings.exportSize > size ? (
                      <span className={`block text-xs mt-1 ${colors.secondaryIcon}`}>
                        📏 {settings.exportSize}px export • {qualityLabels[settings.quality as keyof typeof qualityLabels] || settings.quality}
                      </span>
                    ) : null;
                  })()}

                  {/* Organization tier indicator */}
                  {organizationTier && (
                    <span className={`block text-xs mt-1 ${colors.primaryIcon}`}>
                      🏢 Organization: {organizationTier.charAt(0).toUpperCase() + organizationTier.slice(1)} tier
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantQRCode;
