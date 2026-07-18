'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, QrCode, Sparkles } from 'lucide-react';
import { tenantPublicService } from '@/services/TenantPublicService';
import { generateQrDataUrl } from '@/lib/qr-engine';

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
  qr_gradient_on_dots: boolean;
  qr_gradient_on_corners: boolean;
  qr_gradient_on_corner_dots: boolean;
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
        const dataUrl = await generateQrDataUrl({
          data: previewUrl,
          exportSize,
          styled: isStyled,
          logoUrl,
          logoShape: settings.qr_logo_shape,
          dotType: settings.qr_dot_type,
          cornerType: settings.qr_corner_type,
          cornerDotType: settings.qr_corner_dot_type,
          dotColor: effectiveDotColor,
          cornerColor: effectiveCornerColor,
          cornerDotColor: effectiveCornerDotColor,
          bgColor: effectiveBgColor,
          gradientEnabled: settings.qr_gradient_enabled,
          gradientStart: settings.qr_gradient_start,
          gradientEnd: settings.qr_gradient_end,
          gradientOnDots: settings.qr_gradient_on_dots,
          gradientOnCorners: settings.qr_gradient_on_corners,
          gradientOnCornerDots: settings.qr_gradient_on_corner_dots,
        });
        if (!cancelled) setQrImageUrl(dataUrl);
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
    settings.qr_gradient_on_dots,
    settings.qr_gradient_on_corners,
    settings.qr_gradient_on_corner_dots,
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
