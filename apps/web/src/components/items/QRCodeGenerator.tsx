'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useStorefrontQrCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { generateQrDataUrl } from '@/lib/qr-engine';
import { Download, Copy, RefreshCw } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface QRCodeGeneratorProps {
  url: string;
  productName: string;
  size?: number;
  tenantId: string;
  logoUrl?: string; // Logo URL for enterprise users
}

export function QRCodeGenerator({ url, productName, size = 256, tenantId, logoUrl }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTierInfo, setShowTierInfo] = useState(false);

  const { data: qrCapability } = useStorefrontQrCapability(tenantId);
  const isTierEnabled = qrCapability?.enabled ?? false;
  const tierStyledEnabled = qrCapability?.qrStyledEnabled ?? false;
  const tierQrResolutions = qrCapability?.allowedQRResolutions ?? [];
  const tierQrContentTypes = qrCapability?.allowedQRContentTypes ?? [];
  const canUseQrAnalytics = qrCapability?.canUseQrAnalytics ?? false;
  const isTierFlexible = qrCapability?.isFlexible ?? false;
  
  
  const features = {
    enabled: isTierEnabled,
    maxResolution: isTierFlexible || tierQrResolutions.includes('qr_codes_2048') ? 2048 : (isTierFlexible || tierQrResolutions.includes('qr_codes_1024') ? 1024 : 512),
    customColors: isTierFlexible || tierQrContentTypes.includes('qr_logo'),
    customLogo: isTierFlexible || tierQrContentTypes.includes('qr_logo'),
    bulkDownload: isTierEnabled,
    analytics: canUseQrAnalytics,
    printTemplates: isTierEnabled,
    whiteLabel: false,
    dynamicQR: false,
  };

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return;

      const prefs = qrCapability?.merchantPreferences as any;

      try {
        const dataUrl = await generateQrDataUrl({
          data: url,
          exportSize: size,
          styled: tierStyledEnabled,
          dotType: tierStyledEnabled ? (prefs?.qr_dot_type || 'rounded') : undefined,
          cornerType: tierStyledEnabled ? (prefs?.qr_corner_type || 'extra-rounded') : undefined,
          cornerDotType: tierStyledEnabled ? (prefs?.qr_corner_dot_type || 'dot') : undefined,
          dotColor: prefs?.qr_dot_color || '#1a56db',
          cornerColor: prefs?.qr_corner_color || '#1a56db',
          cornerDotColor: prefs?.qr_corner_dot_color || '#ffffff',
          bgColor: prefs?.qr_bg_color || '#ffffff',
          gradientEnabled: tierStyledEnabled && qrCapability?.qrGradients && prefs?.qr_gradient_enabled,
          gradientStart: prefs?.qr_gradient_start || '#1a56db',
          gradientEnd: prefs?.qr_gradient_end || '#7c3aed',
          gradientOnDots: prefs?.qr_gradient_on_dots ?? true,
          gradientOnCorners: prefs?.qr_gradient_on_corners ?? true,
          gradientOnCornerDots: prefs?.qr_gradient_on_corner_dots ?? true,
          logoUrl: features.customLogo && logoUrl ? logoUrl : null,
          logoShape: prefs?.qr_logo_shape || 'circle',
          errorCorrection: features.customLogo && logoUrl ? 'H' : 'M',
        });

        const img = new Image();
        img.onload = () => {
          if (!canvasRef.current) return;
          const displayCtx = canvasRef.current.getContext('2d');
          if (displayCtx) {
            canvasRef.current.width = img.width;
            canvasRef.current.height = img.height;
            displayCtx.drawImage(img, 0, 0);
          }
        };
        img.src = dataUrl;
      } catch (error) {
        clientLogger.error('QR Code generation error:', { detail: error });
      }
    };

    generateQR();
  }, [url, size, features.customLogo, logoUrl, qrCapability]);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const prefs = qrCapability?.merchantPreferences as any;
      const dataUrl = await generateQrDataUrl({
        data: url,
        exportSize: features.maxResolution,
        styled: tierStyledEnabled,
        dotType: tierStyledEnabled ? (prefs?.qr_dot_type || 'rounded') : undefined,
        cornerType: tierStyledEnabled ? (prefs?.qr_corner_type || 'extra-rounded') : undefined,
        cornerDotType: tierStyledEnabled ? (prefs?.qr_corner_dot_type || 'dot') : undefined,
        dotColor: prefs?.qr_dot_color || '#1a56db',
        cornerColor: prefs?.qr_corner_color || '#1a56db',
        cornerDotColor: prefs?.qr_corner_dot_color || '#ffffff',
        bgColor: prefs?.qr_bg_color || '#ffffff',
        gradientEnabled: tierStyledEnabled && qrCapability?.qrGradients && prefs?.qr_gradient_enabled,
        gradientStart: prefs?.qr_gradient_start || '#1a56db',
        gradientEnd: prefs?.qr_gradient_end || '#7c3aed',
        gradientOnDots: prefs?.qr_gradient_on_dots ?? true,
        gradientOnCorners: prefs?.qr_gradient_on_corners ?? true,
        gradientOnCornerDots: prefs?.qr_gradient_on_corner_dots ?? true,
        logoUrl: features.customLogo && logoUrl ? logoUrl : null,
        logoShape: prefs?.qr_logo_shape || 'circle',
        errorCorrection: features.customLogo && logoUrl ? 'H' : 'M',
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${productName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      clientLogger.error('Download error:', { detail: error });
      alert('Failed to download QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print QR code');
      return;
    }

    // Generate high-res QR code for printing
    const generatePrintQR = async () => {
      try {
        const prefs = qrCapability?.merchantPreferences as any;
        const dataUrl = await generateQrDataUrl({
          data: url,
          exportSize: 1024,
          styled: tierStyledEnabled,
          dotType: tierStyledEnabled ? (prefs?.qr_dot_type || 'rounded') : undefined,
          cornerType: tierStyledEnabled ? (prefs?.qr_corner_type || 'extra-rounded') : undefined,
          cornerDotType: tierStyledEnabled ? (prefs?.qr_corner_dot_type || 'dot') : undefined,
          dotColor: prefs?.qr_dot_color || '#1a56db',
          cornerColor: prefs?.qr_corner_color || '#1a56db',
          cornerDotColor: prefs?.qr_corner_dot_color || '#ffffff',
          bgColor: prefs?.qr_bg_color || '#ffffff',
          gradientEnabled: tierStyledEnabled && qrCapability?.qrGradients && prefs?.qr_gradient_enabled,
          gradientStart: prefs?.qr_gradient_start || '#1a56db',
          gradientEnd: prefs?.qr_gradient_end || '#7c3aed',
          gradientOnDots: prefs?.qr_gradient_on_dots ?? true,
          gradientOnCorners: prefs?.qr_gradient_on_corners ?? true,
          gradientOnCornerDots: prefs?.qr_gradient_on_corner_dots ?? true,
          logoUrl: features.customLogo && logoUrl ? logoUrl : null,
          logoShape: prefs?.qr_logo_shape || 'circle',
          errorCorrection: features.customLogo && logoUrl ? 'H' : 'M',
        });

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code - ${productName}</title>
              <style>
                @media print {
                  @page { margin: 0; }
                  body { margin: 1cm; }
                }
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 20px;
                }
                .container {
                  text-align: center;
                  max-width: 600px;
                }
                h1 {
                  font-size: 24px;
                  margin-bottom: 10px;
                  color: #333;
                }
                .url {
                  font-size: 12px;
                  color: #666;
                  margin-bottom: 20px;
                  word-break: break-all;
                }
                img {
                  max-width: 100%;
                  height: auto;
                  border: 2px solid #000;
                  padding: 20px;
                  background: white;
                }
                .instructions {
                  margin-top: 20px;
                  font-size: 14px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${productName}</h1>
                <div class="url">${url}</div>
                <img src="${dataUrl}" alt="QR Code for ${productName}" />
                <div class="instructions">
                  Scan this QR code to view product details
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        
        // Auto-print after a short delay
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } catch (error) {
        clientLogger.error('Print generation error:', { detail: error });
        printWindow.close();
        alert('Failed to generate QR code for printing');
      }
    };

    generatePrintQR();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="border-2 border-neutral-200 rounded-lg p-4 bg-white">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
      
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          disabled={isGenerating}
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {isGenerating ? 'Generating...' : 'Download'}
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePrint}
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
        </Button>
      </div>
      
      <p className="text-xs text-neutral-500 text-center max-w-xs">
        Use this QR code on flyers, business cards, or in-store displays to let customers scan and view product details
      </p>

      {/* Collapsible Tier information */}
      <div className="text-xs text-neutral-400 text-center">
        <button
          onClick={() => setShowTierInfo(!showTierInfo)}
          className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
        >
          {showTierInfo ? 'Hide tier info' : 'Show tier info'}
        </button>
        {showTierInfo && (
          <div className="mt-2 space-y-1">
            <p>Resolution: {features.maxResolution}x{features.maxResolution}px</p>
            {!features.customColors && (
              <p className="text-primary-600 mt-1">
                💎 Upgrade to Professional for branded QR codes with custom colors
              </p>
            )}
            {!features.bulkDownload && (
              <p className="text-primary-600">
                💎 Upgrade to Professional for bulk download of all products
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
