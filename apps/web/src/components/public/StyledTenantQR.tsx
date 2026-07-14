'use client';

import { useState, useEffect, useRef } from 'react';
import type { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';

export interface StyledTenantQRProps {
  url: string;
  tenantId: string;
  tenantLogo?: string | null;
  capabilityFlags?: StorefrontOptionFlags | null;
  exportSize?: number;
  errorCorrection?: 'H' | 'M';
  label?: string;
  downloadName?: string;
  showDownload?: boolean;
  className?: string;
  pageType?: 'storefront' | 'directory' | 'product' | 'map';
}

export function StyledTenantQR({
  url,
  tenantId,
  tenantLogo,
  capabilityFlags,
  exportSize,
  errorCorrection = 'H',
  label = 'QR Code',
  downloadName,
  showDownload = true,
  className = '',
  pageType,
}: StyledTenantQRProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const qrInstanceRef = useRef<any>(null);

  const flags = capabilityFlags;
  const resolvedExportSize = exportSize
    || (flags?.qrResolution === '2048' ? 2048
      : flags?.qrResolution === '1024' ? 1024
      : flags?.qrResolution === '512' ? 512
      : 512);

  const generateStyledQR = async (targetSize: number): Promise<string> => {
    const { default: QRCodeStyling } = await import('qr-code-styling');

    const dotType = (flags?.qrDotType || flags?.allowedQRDotStyles?.[0] || 'rounded') as any;
    const cornerType = (flags?.qrCornerType || flags?.allowedQRCornerStyles?.[0] || 'extra-rounded') as any;
    const dotColor = flags?.qrDotColor || '#1a56db';
    const cornerColor = flags?.qrCornerColor || '#1a56db';
    const bgColor = flags?.qrBgColor || '#ffffff';
    const useGradient = flags?.qrGradients && flags?.qrGradientEnabled;
    const gradientStart = flags?.qrGradientStart || '#1a56db';
    const gradientEnd = flags?.qrGradientEnd || '#7c3aed';

    const qr = new QRCodeStyling({
      width: targetSize,
      height: targetSize,
      type: 'svg',
      data: url,
      image: tenantLogo || undefined,
      imageOptions: { crossOrigin: 'anonymous', margin: 10, imageSize: 0.3, hideBackgroundDots: true },
      dotsOptions: {
        color: dotColor,
        type: dotType,
        gradient: useGradient ? {
          type: 'linear', rotation: 45,
          colorStops: [{ offset: 0, color: gradientStart }, { offset: 1, color: gradientEnd }],
        } : undefined,
      },
      cornersSquareOptions: {
        color: cornerColor,
        type: cornerType,
      },
      cornersDotOptions: { color: '#ffffff', type: 'dot' },
      backgroundOptions: { color: bgColor },
      qrOptions: { errorCorrectionLevel: errorCorrection },
    });

    qrInstanceRef.current = qr;

    const blob = await qr.getRawData('png');
    if (blob instanceof Blob) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    throw new Error('Failed to generate styled QR data URL');
  };

  useEffect(() => {
    if (!url || qrImageUrl) return;
    let cancelled = false;

    const generate = async () => {
      setIsGenerating(true);
      try {
        const dataUrl = await generateStyledQR(resolvedExportSize);
        if (!cancelled) setQrImageUrl(dataUrl);
      } catch (error) {
        console.error('[StyledTenantQR] Failed to generate styled QR code:', error);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [url, tenantLogo, resolvedExportSize]);

  const downloadQRCode = async (targetSize: number) => {
    try {
      setIsGenerating(true);
      const dataUrl = await generateStyledQR(targetSize);

      const link = document.createElement('a');
      link.href = dataUrl;

      let baseName = downloadName || url.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      if (pageType) baseName = `${pageType}-${baseName}`;

      link.download = `qr-${baseName}-${targetSize}px.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('[StyledTenantQR] Failed to download QR code:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const sizeOptions = (() => {
    const res = flags?.qrResolutions || [];
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
  })();

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold text-neutral-900">{label}</h3>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          ✨ Styled
        </span>
      </div>

      <div className="flex flex-col items-center">
        {isGenerating ? (
          <div
            className="bg-neutral-100 rounded-lg animate-pulse"
            style={{ width: 256, height: 256 }}
          />
        ) : qrImageUrl ? (
          <img
            src={qrImageUrl}
            alt="Styled QR Code"
            className="rounded-lg border border-neutral-200 shadow-sm"
            style={{ width: 256, height: 'auto' }}
          />
        ) : (
          <div
            className="bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400"
            style={{ width: 256, height: 256 }}
          >
            No QR Code
          </div>
        )}

        {showDownload && qrImageUrl && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2 justify-center">
              {sizeOptions.map(option => (
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
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-neutral-500 text-center">Scan to visit</p>
        {tenantLogo && flags?.showQRLogo && (
          <p className="text-xs text-purple-600 font-medium text-center">✨ Branded with store logo</p>
        )}
      </div>
    </div>
  );
}

export default StyledTenantQR;
