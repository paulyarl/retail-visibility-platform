'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
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

  const { tier, loading: tierLoading, canAccess } = useTenantTier(tenantId);
  const tierId = tier?.effective?.id || null;
  const hasQRAccess = canAccess('qr_codes', 'canView');
  
  // Map tier to QR features (similar to old getQRFeatures logic)
  const getQRFeatures = (tier: string | null) => {
    switch (tier) {
      case 'enterprise':
      case 'organization':
      case 'chain_enterprise': // Chain enterprise gets same features as individual enterprise
        return {
          enabled: true,
          maxResolution: 2048,
          customColors: true,
          customLogo: true,
          bulkDownload: true,
          analytics: true,
          printTemplates: true,
          whiteLabel: true,
          dynamicQR: true
        };
      case 'commitment':
      case 'professional':
      case 'ecommerce':
      case 'omnichannel':
      case 'chain_professional': // Chain professional gets same features as individual professional
        return {
          enabled: true,
          maxResolution: 1024,
          customColors: true,
          customLogo: true, // Enable logo for professional tier (both individual and chain)
          bulkDownload: true,
          analytics: false,
          printTemplates: true,
          whiteLabel: false,
          dynamicQR: false
        };
      case 'discovery':
      case 'storefront':
      case 'starter':
      case 'chain_starter': // Chain starter gets same features as individual starter
      default:
        return {
          enabled: true,
          maxResolution: 512,
          customColors: false,
          customLogo: false,
          bulkDownload: false,
          analytics: false,
          printTemplates: false,
          whiteLabel: false,
          dynamicQR: false
        };
    }
  };
  
  const features = getQRFeatures(tierId);

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return;

      try {
        const dataUrl = await generateQrDataUrl({
          data: url,
          exportSize: size,
          styled: false,
          logoUrl: features.customLogo && logoUrl ? logoUrl : null,
          logoShape: 'circle',
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
  }, [url, size, features.customLogo, logoUrl]);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateQrDataUrl({
        data: url,
        exportSize: features.maxResolution,
        styled: false,
        logoUrl: features.customLogo && logoUrl ? logoUrl : null,
        logoShape: 'circle',
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
        const dataUrl = await generateQrDataUrl({
          data: url,
          exportSize: 1024,
          styled: false,
          logoUrl: features.customLogo && logoUrl ? logoUrl : null,
          logoShape: 'circle',
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

      {/* Tier information */}
      <div className="text-xs text-neutral-400 text-center">
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
    </div>
  );
}
