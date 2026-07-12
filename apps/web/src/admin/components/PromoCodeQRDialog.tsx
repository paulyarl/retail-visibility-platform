/**
 * PromoCodeQRDialog
 *
 * Reusable dialog for generating styled QR codes for BSaaS promotion codes.
 * Uses qr-code-styling for visually distinct, branded QR codes with
 * target-aware icon embedding.
 *
 * Reused in Phase 4 for private grant QR codes (with "private-grant" theme).
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCodeStyling from 'qr-code-styling';
import {
  adminBsaasPromotionsService,
  type PromoQRData,
} from '@/services/AdminBsaasPromotionsService';
import {
  QR_THEMES,
  QR_THEME_LIST,
  buildQROptions,
  type QRThemeName,
} from '@/lib/qr-style-config';
import { X, Download, Copy, Check, QrCode, Loader2 } from 'lucide-react';

interface PromoCodeQRDialogProps {
  promotionCodeId: string;
  promotionCode: string;
  open: boolean;
  onClose: () => void;
  defaultTheme?: QRThemeName;
}

export default function PromoCodeQRDialog({
  promotionCodeId,
  promotionCode,
  open,
  onClose,
  defaultTheme = 'promo',
}: PromoCodeQRDialogProps) {
  const [qrData, setQrData] = useState<PromoQRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<QRThemeName>(defaultTheme);
  const [copied, setCopied] = useState<'url' | 'code' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const fetchQRData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminBsaasPromotionsService.getQRData(promotionCodeId);
      setQrData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load QR data');
    } finally {
      setLoading(false);
    }
  }, [promotionCodeId]);

  useEffect(() => {
    if (open) {
      fetchQRData();
    }
  }, [open, fetchQRData]);

  // Render QR code when data or theme changes
  useEffect(() => {
    if (!qrData || !qrContainerRef.current) return;

    const theme = QR_THEMES[selectedTheme];
    const options = buildQROptions(
      qrData.qr_url,
      qrData.target_icon?.icon_name ? undefined : '/icons/visibleshelf-logo.svg',
      theme,
    );

    const qr = new QRCodeStyling(options);
    qrInstanceRef.current = qr;

    // Clear previous content and append
    qrContainerRef.current.innerHTML = '';
    qr.append(qrContainerRef.current);

    return () => {
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
      }
    };
  }, [qrData, selectedTheme]);

  const handleDownload = (format: 'png' | 'svg') => {
    if (!qrInstanceRef.current) return;
    qrInstanceRef.current.download({ name: `promo-${promotionCode}`, extension: format });
  };

  const handleCopy = (text: string, type: 'url' | 'code') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold">QR Code for {promotionCode}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {qrData && !loading && (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                <div ref={qrContainerRef} className="rounded-lg overflow-hidden" />
              </div>

              {/* Theme Selector */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">QR Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {QR_THEME_LIST.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTheme(t.name)}
                      className={`px-3 py-2 text-xs rounded-md border text-left ${
                        selectedTheme === t.name
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-neutral-400">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo Code */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Promo Code</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 rounded-md border border-gray-200">
                    {qrData.promotion_code}
                  </code>
                  <button
                    onClick={() => handleCopy(qrData.promotion_code, 'code')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy code"
                  >
                    {copied === 'code' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Deep Link URL */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Deep Link URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 rounded-md border border-gray-200 truncate">
                    {qrData.qr_url}
                  </code>
                  <button
                    onClick={() => handleCopy(qrData.qr_url, 'url')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy URL"
                  >
                    {copied === 'url' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Target Info */}
              {qrData.target_icon && (
                <div className="p-3 rounded-md bg-blue-50 border border-blue-100 text-sm">
                  <span className="text-xs font-medium text-neutral-600">Valid for: </span>
                  <span className="font-medium text-blue-700">
                    {qrData.target_icon.marketing_name}
                  </span>
                  {qrData.target_icon.type === 'feature' && qrData.target_icon.feature_key && (
                    <div className="text-xs text-neutral-500 mt-0.5">
                      Feature: {qrData.target_icon.feature_key}
                    </div>
                  )}
                </div>
              )}

              {/* Discount Info */}
              <div className="flex items-center gap-3 text-sm">
                {qrData.percent_off && (
                  <span className="px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                    {qrData.percent_off}% off
                  </span>
                )}
                {qrData.amount_off && (
                  <span className="px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                    ${(qrData.amount_off / 100).toFixed(2)} off
                  </span>
                )}
                <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs">
                  {qrData.duration === 'once' ? 'Once' : qrData.duration === 'forever' ? 'Forever' : `Repeating (${qrData.duration_in_months}mo)`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {qrData && !loading && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
            <button
              onClick={() => handleDownload('png')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => handleDownload('svg')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
