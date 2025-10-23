'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui';

interface QRCodeGeneratorProps {
  url: string;
  productName: string;
  size?: number;
}

export function QRCodeGenerator({ url, productName, size = 256 }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        url,
        {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('QR Code generation error:', error);
        }
      );
    }
  }, [url, size]);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Generate high-res QR code for download
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

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

    QRCode.toDataURL(url, {
      width: 1024,
      margin: 4,
    }).then((dataUrl) => {
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
    });
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
    </div>
  );
}
