'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, QrCode, Sparkles } from 'lucide-react';
import { tenantPublicService } from '@/services/TenantPublicService';

export interface QrPreviewSettings {
  qr_enabled: boolean;
  qr_styled_enabled: boolean;
  qr_logo: boolean;
  qr_dot_type: string;
  qr_corner_type: string;
  qr_corner_dot_type: string;
  qr_corner_dot_color: string;
  qr_logo_shape: string;
  qr_dot_color: string;
  qr_corner_color: string;
  qr_bg_color: string;
  qr_custom_colors_enabled: boolean;
  qr_gradient_enabled: boolean;
  qr_gradient_start: string;
  qr_gradient_end: string;
  default_qr_resolution: string;
}

interface QrPreviewPaneProps {
  tenantId: string;
  settings: QrPreviewSettings;
  previewUrl: string;
}

export default function QrPreviewPane({ tenantId, settings, previewUrl }: QrPreviewPaneProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isStyled = settings.qr_styled_enabled;

  const effectiveDotColor = settings.qr_custom_colors_enabled ? settings.qr_dot_color : '#1a56db';
  const effectiveCornerColor = settings.qr_custom_colors_enabled ? settings.qr_corner_color : '#1a56db';
  const effectiveCornerDotColor = settings.qr_custom_colors_enabled ? settings.qr_corner_dot_color : '#ffffff';
  const effectiveBgColor = settings.qr_custom_colors_enabled ? settings.qr_bg_color : '#ffffff';

  const previewSize = 256;
  const exportSize = parseInt(settings.default_qr_resolution, 10) || 1024;

  const logoUrl = useMemo(() => {
    if (!settings.qr_logo) return null;
    return tenantLogo;
  }, [settings.qr_logo, tenantLogo]);

  useEffect(() => {
    let cancelled = false;
    const fetchLogo = async () => {
      if (!settings.qr_logo) {
        setTenantLogo(null);
        return;
      }
      try {
        const profile = await tenantPublicService.getPublicTenantInfo(tenantId);
        if (!cancelled && profile) {
          const data = profile?.profileData || profile;
          setTenantLogo(data.logo_url || null);
        }
      } catch {
        if (!cancelled) setTenantLogo(null);
      }
    };
    fetchLogo();
    return () => { cancelled = true; };
  }, [tenantId, settings.qr_logo]);

  useEffect(() => {
    if (!previewUrl || !settings.qr_enabled) {
      setQrImageUrl(null);
      return;
    }

    let cancelled = false;
    const generate = async () => {
      setIsGenerating(true);
      try {
        if (isStyled) {
          const { default: QRCodeStyling } = await import('qr-code-styling');
          const useGradient = settings.qr_gradient_enabled;
          const qr = new QRCodeStyling({
            width: exportSize,
            height: exportSize,
            type: 'svg',
            data: previewUrl,
            image: logoUrl || undefined,
            imageOptions: { crossOrigin: 'anonymous', margin: 10, imageSize: 0.3, hideBackgroundDots: true, imageShape: settings.qr_logo_shape } as any,
            dotsOptions: {
              color: effectiveDotColor,
              type: settings.qr_dot_type as any,
              gradient: useGradient ? {
                type: 'linear',
                rotation: 45,
                colorStops: [
                  { offset: 0, color: settings.qr_gradient_start },
                  { offset: 1, color: settings.qr_gradient_end },
                ],
              } : undefined,
            },
            cornersSquareOptions: {
              color: effectiveCornerColor,
              type: settings.qr_corner_type as any,
            },
            cornersDotOptions: { color: effectiveCornerDotColor, type: settings.qr_corner_dot_type as any },
            backgroundOptions: { color: effectiveBgColor },
            qrOptions: { errorCorrectionLevel: logoUrl ? 'H' : 'M' },
          });

          const blob = await qr.getRawData('png');
          if (blob instanceof Blob && !cancelled) {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            if (!cancelled) setQrImageUrl(dataUrl);
          }
        } else {
          const QRCode = (await import('qrcode')).default;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          canvas.width = exportSize;
          canvas.height = exportSize;

          await QRCode.toCanvas(canvas, previewUrl, {
            width: exportSize,
            margin: exportSize >= 2048 ? 4 : exportSize >= 1024 ? 3 : 2,
            color: { dark: '#000000', light: '#FFFFFF' },
            errorCorrectionLevel: logoUrl ? 'H' : 'M',
          });

          let finalCanvas = canvas;

          if (logoUrl) {
            try {
              finalCanvas = await overlayLogoOnQR(canvas, logoUrl, settings.qr_logo_shape);
            } catch {
              // fallback to plain QR
            }
          }

          if (!cancelled) {
            setQrImageUrl(finalCanvas.toDataURL('image/png', 1.0));
          }
        }
      } catch {
        if (!cancelled) setQrImageUrl(null);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [
    previewUrl,
    settings.qr_enabled,
    isStyled,
    settings.qr_dot_type,
    settings.qr_corner_type,
    settings.qr_corner_dot_type,
    effectiveCornerDotColor,
    effectiveDotColor,
    effectiveCornerColor,
    effectiveBgColor,
    settings.qr_gradient_enabled,
    settings.qr_gradient_start,
    settings.qr_gradient_end,
    settings.default_qr_resolution,
    settings.qr_logo_shape,
    logoUrl,
    exportSize,
  ]);

  if (!settings.qr_enabled) {
    return (
      <Card className="border-neutral-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-neutral-500" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
            <QrCode className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">QR codes are disabled</p>
            <p className="text-xs mt-1">Enable QR codes to see a preview</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-neutral-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4 text-blue-600" />
          Live Preview
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-1">
          Updates instantly as you change settings. This is what customers will see.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center" ref={containerRef}>
          {isGenerating ? (
            <div
              className="bg-neutral-100 rounded-lg animate-pulse border border-neutral-200"
              style={{ width: previewSize, height: previewSize }}
            />
          ) : qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt="QR Code Preview"
              className="rounded-lg border border-neutral-200 shadow-sm"
              style={{ width: previewSize, height: 'auto' }}
            />
          ) : (
            <div
              className="bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 border border-neutral-200"
              style={{ width: previewSize, height: previewSize }}
            >
              No QR Code
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {isStyled ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                <Sparkles className="h-3 w-3" /> Styled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                <QrCode className="h-3 w-3" /> Classic
              </span>
            )}
            <span className="text-xs text-neutral-400">
              {settings.default_qr_resolution}px export
            </span>
          </div>

          {logoUrl && settings.qr_logo && (
            <p className="text-xs text-purple-600 font-medium text-center mt-2">
              ✨ Branded with store logo
            </p>
          )}

          {settings.qr_gradient_enabled && isStyled && (
            <p className="text-xs text-purple-600 text-center mt-1">
              Gradient: {settings.qr_gradient_start} → {settings.qr_gradient_end}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function overlayLogoOnQR(qrCanvas: HTMLCanvasElement, logoSrc: string, logoShape: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    const isCircle = logoShape === 'circle';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = qrCanvas.width;
      canvas.height = qrCanvas.height;
      ctx.drawImage(qrCanvas, 0, 0);

      const logoSize = Math.floor(canvas.width * 0.30);
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = (canvas.height - logoSize) / 2;

      ctx.fillStyle = '#FFFFFF';
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(logoX - 6, logoY - 6, logoSize + 12, logoSize + 12);
      }

      ctx.save();
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(logoX, logoY, logoSize, logoSize);
        ctx.clip();
      }
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      ctx.restore();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(logoX - 3, logoY - 3, logoSize + 6, logoSize + 6);
      }

      resolve(canvas);
      };
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.src = logoSrc;
  });
}
