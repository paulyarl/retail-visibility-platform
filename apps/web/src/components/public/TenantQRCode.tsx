'use client';

import { useState, useEffect } from 'react';
import { storefrontService } from '@/services/StorefrontService';
import { tenantPublicService } from '@/services/TenantPublicService';

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
}: TenantQRCodeProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantTier, setTenantTier] = useState<string>('discovery');
  const [isFetchingTierAndLogo, setIsFetchingTierAndLogo] = useState(true);

  // Fetch tenant tier and logo
  useEffect(() => {
    const fetchTenantInfo = async () => {
      try {
        setIsFetchingTierAndLogo(true);
        
        const tierData = await storefrontService.getPublicTier(tenantId);
        
        if (tierData) {
          const data = tierData.data || tierData;
          
          // Determine effective tier
          const individualTier = data.tenantTier?.tier_key || null;
          const organizationTier = data.organizationTier?.tier_key || null;
          
          const getQRCodeLevel = (tierKey: string): number => {
            if (!tierKey) return 0;
            if (tierKey.includes('enterprise') || tierKey.includes('professional')) return 3;
            if (tierKey === 'commitment') return 2;
            if (tierKey === 'chain_starter' || tierKey === 'storefront') return 1;
            if (tierKey === 'starter' || tierKey === 'discovery') return 0;
            return 2;
          };
          
          let effectiveTier: string;
          const individualLevel = getQRCodeLevel(individualTier || '');
          const orgLevel = getQRCodeLevel(organizationTier || '');
          
          if (individualTier && (!organizationTier || individualLevel >= orgLevel)) {
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
          
          // Get tenant logo for higher tiers
          const tiersWithLogo = [
            'professional', 'commitment', 'enterprise', 'organization',
            'chain_professional', 'chain_enterprise', 'chain_starter',
            'trial_professional', 'trial_commitment', 'trial_enterprise'
          ];
          
          if (tiersWithLogo.includes(effectiveTierPart)) {
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
  }, [tenantId]);

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
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 6, 0, Math.PI * 2);
        ctx.fill();

        // Circular mask for logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.globalAlpha = 1.0;
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Border around logo
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

  // Get tier-aware QR code quality settings (aligned with TierGainsWelcome logic)
  const getTierQRSettings = (tier: string, organizationTier?: string | undefined) => {
    const baseSize = size;
    const colors = getTierColorPalette(tier, organizationTier);
    
    // Use organization tier logic if present
    const effectiveTier = organizationTier || tier;
    
    switch (effectiveTier) {
      case 'discovery':
      case 'starter':
      case 'chain_starter':
        return {
          renderSize: baseSize,           // 256px default
          exportSize: baseSize,           // 256px export
          errorCorrection: 'M' as const,
          margin: 2,
          quality: 'standard',
          colors: colors
        };
        
      case 'storefront':
      case 'chain_storefront':
        return {
          renderSize: Math.min(baseSize * 1.5, 512),  // Up to 512px
          exportSize: 512,                           // 512px export
          errorCorrection: 'M' as const,
          margin: 2,
          quality: 'enhanced',
          colors: colors
        };
        
      case 'commitment':
      case 'chain_commitment':
        return {
          renderSize: Math.min(baseSize * 2, 1024),   // Up to 1024px
          exportSize: 1024,                          // 1024px export
          errorCorrection: 'H' as const,              // Higher error correction for logo
          margin: 3,
          quality: 'premium',
          colors: colors
        };
        
      case 'professional':
      case 'chain_professional':
        return {
          renderSize: Math.min(baseSize * 3, 2048),   // Up to 2048px
          exportSize: 2048,                          // 2048px export
          errorCorrection: 'H' as const,              // Higher error correction for logo
          margin: 3,
          quality: 'professional',
          colors: colors
        };
        
      case 'enterprise':
      case 'organization':
      case 'chain_enterprise':
        return {
          renderSize: Math.min(baseSize * 4, 2048),   // Up to 2048px
          exportSize: 2048,                          // 2048px export
          errorCorrection: 'H' as const,              // Highest error correction
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

  // Generate QR code
  const generateQRCode = async () => {
    if (qrImageUrl || !url) return;

    setIsGenerating(true);
    try {
      const QRCode = (await import('qrcode')).default;
      
      // Extract organization tier from effective tier logic (same as TierGainsWelcome)
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
      
      // Logo eligibility logic (aligned with TierGainsWelcome)
      const effectiveTier = organizationTier || tenantTier;
      const shouldApplyLogo = (
        effectiveTier === 'commitment' ||
        effectiveTier === 'professional' ||
        effectiveTier === 'enterprise' ||
        effectiveTier === 'organization' ||
        tenantTier === 'chain_professional' ||
        tenantTier === 'chain_enterprise'
      ) && tenantLogo;

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
      console.log(`[TenantQRCode] Generated ${qrSettings.quality} quality QR code at ${qrSettings.exportSize}px for tier: ${tenantTier}${organizationTier ? ` (org: ${organizationTier})` : ''}`);
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

  const downloadQRCode = () => {
    if (!qrImageUrl) return;

    const link = document.createElement('a');
    link.href = qrImageUrl;
    const name = downloadName || url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    link.download = `qr-${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12l4-4m4 4l-4-4m0 0h4.01M12 12v4" />
        </svg>
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
          <button
            onClick={downloadQRCode}
            className="mt-3 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
          >
            Download QR Code
          </button>
        )}
      </div>
      
      {tenantTier && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-neutral-500 text-center">
            Scan to visit page
          </p>
          
          {/* Tier-specific features */}
          <div className="text-center">
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
                effectiveTier === 'enterprise' ||
                effectiveTier === 'organization' ||
                tenantTier === 'chain_professional' ||
                tenantTier === 'chain_enterprise'
              ) && tenantLogo;
              
              return (
                <>
                  {shouldShowLogo && (
                    <span className={`block text-xs ${colors.primaryIcon} font-medium`}>✨ Branded with store logo</span>
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
