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
  const [tenantTier, setTenantTier] = useState<string>('starter');
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
            effectiveTier = data.effective?.tier_key || data.tier || 'starter';
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

  // Generate QR code
  const generateQRCode = async () => {
    if (qrImageUrl || !url) return;

    setIsGenerating(true);
    try {
      const QRCode = (await import('qrcode')).default;

      const qrCanvas = document.createElement('canvas');
      const qrCtx = qrCanvas.getContext('2d');
      if (!qrCtx) throw new Error('Could not get canvas context');

      qrCanvas.width = size;
      qrCanvas.height = size;

      const shouldApplyLogo = (
        tenantTier === 'professional' ||
        tenantTier === 'enterprise' ||
        tenantTier === 'organization' ||
        tenantTier === 'chain_professional' ||
        tenantTier === 'chain_enterprise'
      ) && tenantLogo;

      await QRCode.toCanvas(qrCanvas, url, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: shouldApplyLogo ? 'H' : 'M',
      });

      let finalCanvas = qrCanvas;

      if (shouldApplyLogo) {
        try {
          finalCanvas = await overlayLogoOnQR(qrCanvas, tenantLogo!);
        } catch (logoError) {
          console.warn('Failed to overlay logo, using plain QR code:', logoError);
        }
      }

      const dataUrl = finalCanvas.toDataURL('image/png');
      setQrImageUrl(dataUrl);
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
            className="rounded-lg border border-neutral-200"
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
      
      {tenantLogo && tenantTier && (
        <p className="text-xs text-neutral-500 mt-2 text-center">
          Scan to visit page
          {['professional', 'enterprise', 'organization', 'chain_professional', 'chain_enterprise'].includes(tenantTier) && (
            <span className="block mt-1">✨ Branded with store logo</span>
          )}
        </p>
      )}
    </div>
  );
}

export default TenantQRCode;
