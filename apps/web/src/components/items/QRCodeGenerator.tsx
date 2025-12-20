'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import QRCode from 'qrcode';
import { Download, Copy, RefreshCw } from 'lucide-react';

interface QRCodeGeneratorProps {
  url: string;
  productName: string;
  size?: number;
  tenantId: string;
  logoUrl?: string; // Logo URL for enterprise users
}

export function QRCodeGenerator({ url, productName, size = 256, tenantId, logoUrl }: QRCodeGeneratorProps) {
  console.log('[QRCodeGenerator] Function called with props:', { url, productName, size, tenantId });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { tier, loading: tierLoading, canAccess } = useTenantTier(tenantId);
  const tierId = tier?.effective?.id || null;
  const hasQRAccess = canAccess('qr_codes', 'canView');
  
  console.log('[QR Generator] Received tier:', tier, 'tierId:', tierId, 'hasQRAccess:', hasQRAccess);
  
  // Logo overlay function for enterprise tier
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

        // Calculate logo size (should be 15-20% of QR code size for readability)
        const logoSize = Math.floor(canvas.width * 0.18); // 18% of QR size
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = (canvas.height - logoSize) / 2;

        // Create circular mask for logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw logo
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        ctx.restore();

        // Add white border around logo
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2, 0, Math.PI * 2);
        ctx.stroke();

        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load logo image'));
      img.src = logoSrc;
    });
  };
  
  // Map tier to QR features (similar to old getQRFeatures logic)
  const getQRFeatures = (tier: string | null) => {
    switch (tier) {
      case 'enterprise':
      case 'organization':
        return {
          enabled: true,
          maxResolution: 1024,
          customColors: true,
          customLogo: true,
          bulkDownload: true,
          analytics: true,
          printTemplates: true,
          whiteLabel: true,
          dynamicQR: true
        };
      case 'professional':
        return {
          enabled: true,
          maxResolution: 1024,
          customColors: true,
          customLogo: true, // Enable logo for professional tier
          bulkDownload: true,
          analytics: false,
          printTemplates: true,
          whiteLabel: false,
          dynamicQR: false
        };
      case 'starter':
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
  console.log('[QR Generator] Features:', features);
  console.log('[QR Generator] Custom colors enabled:', features.customColors);
  console.log('[QR Generator] Bulk download enabled:', features.bulkDownload);

  useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return;

      try {
        // Generate base QR code
        const qrCanvas = document.createElement('canvas');
        const qrCtx = qrCanvas.getContext('2d');
        if (!qrCtx) return;

        qrCanvas.width = size;
        qrCanvas.height = size;

        // Generate QR code with higher error correction for logo overlay
        await QRCode.toCanvas(qrCanvas, url, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: features.customLogo && logoUrl ? 'H' : 'M', // Higher error correction for logos
        });

        let finalCanvas = qrCanvas;

        // Overlay logo for enterprise users if logo is provided
        if (features.customLogo && logoUrl) {
          try {
            finalCanvas = await overlayLogoOnQR(qrCanvas, logoUrl);
          } catch (logoError) {
            console.warn('Failed to overlay logo, using plain QR code:', logoError);
            // Fall back to plain QR code if logo overlay fails
          }
        }

        // Draw final result to display canvas
        const displayCtx = canvasRef.current.getContext('2d');
        if (displayCtx) {
          canvasRef.current.width = finalCanvas.width;
          canvasRef.current.height = finalCanvas.height;
          displayCtx.drawImage(finalCanvas, 0, 0);
        }
      } catch (error) {
        console.error('QR Code generation error:', error);
      }
    };

    generateQR();
  }, [url, size, features.customLogo, logoUrl]);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Generate high-res QR code for download (respects tier limits)
      const qrCanvas = document.createElement('canvas');
      const qrCtx = qrCanvas.getContext('2d');
      if (!qrCtx) throw new Error('Could not get canvas context');

      qrCanvas.width = features.maxResolution;
      qrCanvas.height = features.maxResolution;

      // Generate QR code with higher error correction for logo overlay
      await QRCode.toCanvas(qrCanvas, url, {
        width: features.maxResolution,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: features.customLogo && logoUrl ? 'H' : 'M',
      });

      let finalCanvas = qrCanvas;

      // Overlay logo for enterprise users if logo is provided
      if (features.customLogo && logoUrl) {
        try {
          finalCanvas = await overlayLogoOnQR(qrCanvas, logoUrl);
        } catch (logoError) {
          console.warn('Failed to overlay logo on download, using plain QR code:', logoError);
          // Fall back to plain QR code if logo overlay fails
        }
      }

      // Convert to data URL for download
      const dataUrl = finalCanvas.toDataURL('image/png');

      // Create download link
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${productName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
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
        const qrCanvas = document.createElement('canvas');
        const qrCtx = qrCanvas.getContext('2d');
        if (!qrCtx) throw new Error('Could not get canvas context');

        qrCanvas.width = 1024;
        qrCanvas.height = 1024;

        // Generate QR code with higher error correction for logo overlay
        await QRCode.toCanvas(qrCanvas, url, {
          width: 1024,
          margin: 4,
          errorCorrectionLevel: features.customLogo && logoUrl ? 'H' : 'M',
        });

        let finalCanvas = qrCanvas;

        // Overlay logo for enterprise users if logo is provided
        if (features.customLogo && logoUrl) {
          try {
            finalCanvas = await overlayLogoOnQR(qrCanvas, logoUrl);
          } catch (logoError) {
            console.warn('Failed to overlay logo on print, using plain QR code:', logoError);
            // Fall back to plain QR code if logo overlay fails
          }
        }

        const dataUrl = finalCanvas.toDataURL('image/png');

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
        console.error('Print generation error:', error);
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
