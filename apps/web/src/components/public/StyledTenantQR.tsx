'use client';

import { useState, useEffect } from 'react';
import type { StorefrontQrState } from '@/services/CapabilityResolutionService';
import { clientLogger } from '@/lib/client-logger';
import { generateQrDataUrl } from '@/lib/qr-engine';

export interface StyledTenantQRProps {
  url: string;
  tenantId: string;
  tenantLogo?: string | null;
  qrState?: StorefrontQrState | null;
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
  qrState,
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

  const prefs = qrState?.merchantPreferences as any;
  const resolvedExportSize = exportSize
    || (prefs?.default_qr_resolution === '2048' ? 2048
      : prefs?.default_qr_resolution === '1024' ? 1024
      : prefs?.default_qr_resolution === '512' ? 512
      : 512);

  const generateStyledQR = async (targetSize: number): Promise<string> => {
    const trackingUrl = url.includes('source=qr') ? url : `${url}${url.includes('?') ? '&' : '?'}source=qr`;
    return generateQrDataUrl({
      data: trackingUrl,
      exportSize: targetSize,
      styled: true,
      logoUrl: prefs?.qr_logo ? tenantLogo : null,
      logoShape: prefs?.qr_logo_shape || 'square',
      errorCorrection,
      dotType: prefs?.qr_dot_type || qrState?.allowedQRDotStyles?.[0] || 'rounded',
      cornerType: prefs?.qr_corner_type || qrState?.allowedQRCornerStyles?.[0] || 'extra-rounded',
      cornerDotType: prefs?.qr_corner_dot_type || 'dot',
      dotColor: prefs?.qr_dot_color || '#1a56db',
      cornerColor: prefs?.qr_corner_color || '#1a56db',
      cornerDotColor: prefs?.qr_corner_dot_color || '#ffffff',
      bgColor: prefs?.qr_bg_color || '#ffffff',
      gradientEnabled: qrState?.qrGradients && prefs?.qr_gradient_enabled,
      gradientStart: prefs?.qr_gradient_start || '#1a56db',
      gradientEnd: prefs?.qr_gradient_end || '#7c3aed',
      gradientOnDots: prefs?.qr_gradient_on_dots ?? true,
      gradientOnCorners: prefs?.qr_gradient_on_corners ?? true,
      gradientOnCornerDots: prefs?.qr_gradient_on_corner_dots ?? true,
    });
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
        clientLogger.error('[StyledTenantQR] Failed to generate styled QR code:', { detail: error });
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
      clientLogger.error('[StyledTenantQR] Failed to download QR code:', { detail: error });
    } finally {
      setIsGenerating(false);
    }
  };

  const sizeOptions = (() => {
    const res = qrState?.allowedQRResolutions || [];
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
        {tenantLogo && prefs?.qr_logo && (
          <p className="text-xs text-purple-600 font-medium text-center">✨ Branded with store logo</p>
        )}
      </div>
    </div>
  );
}

export default StyledTenantQR;
