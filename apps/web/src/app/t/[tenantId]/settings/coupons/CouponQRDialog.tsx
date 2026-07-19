'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Download, Copy, Check, QrCode, Loader2 } from 'lucide-react';
import { QR_TEMPLATE_LIST, generateQrInstance, type QrTemplateName } from '@/lib/qr-engine';
import { CouponService } from '@/services/CouponService';

const COUPON_TEMPLATES: QrTemplateName[] = ['merchant-promo', 'coupon-flash', 'coupon-free-ship', 'coupon-bogo'];

interface CouponQRDialogProps {
  tenantId: string;
  couponId: string;
  couponCode: string;
  open: boolean;
  onClose: () => void;
  defaultTheme?: QrTemplateName;
}

export default function CouponQRDialog({
  tenantId,
  couponId,
  couponCode,
  open,
  onClose,
  defaultTheme = 'merchant-promo',
}: CouponQRDialogProps) {
  const [qrData, setQrData] = useState<{ shortCodeUrl: string; fullUrl: string; autoId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<QrTemplateName>(defaultTheme);
  const [useShortCode, setUseShortCode] = useState(true);
  const [copied, setCopied] = useState<'url' | 'code' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<any>(null);

  const fetchQRData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await CouponService.getInstance().getCouponQR(tenantId, couponId);
      setQrData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load QR data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, couponId]);

  useEffect(() => {
    if (open) {
      fetchQRData();
    }
  }, [open, fetchQRData]);

  const qrUrl = qrData ? (useShortCode ? qrData.shortCodeUrl : qrData.fullUrl) : '';
  const fullQrUrl = qrUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${qrUrl}` : '';

  useEffect(() => {
    if (!qrData || !qrContainerRef.current || !fullQrUrl) return;

    let cancelled = false;
    const renderQr = async () => {
      const qr = await generateQrInstance({
        data: fullQrUrl,
        exportSize: 512,
        styled: true,
        template: selectedTheme,
      });
      if (cancelled || !qrContainerRef.current) return;
      qrInstanceRef.current = qr;
      qrContainerRef.current.innerHTML = '';
      qr.append(qrContainerRef.current);
    };
    renderQr();

    return () => {
      cancelled = true;
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
      }
    };
  }, [qrData, selectedTheme, useShortCode, fullQrUrl]);

  const handleDownload = (format: 'png' | 'svg') => {
    if (!qrInstanceRef.current) return;
    qrInstanceRef.current.download({ name: `coupon-${couponCode}`, extension: format });
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
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold">QR Code for {couponCode}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {qrData && !loading && (
            <>
              <div className="flex justify-center">
                <div ref={qrContainerRef} className="rounded-lg overflow-hidden" />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">QR Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {QR_TEMPLATE_LIST.filter(t => COUPON_TEMPLATES.includes(t.name)).map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTheme(t.name)}
                      className={`px-3 py-2 text-xs rounded-md border text-left ${
                        selectedTheme === t.name
                          ? 'border-amber-600 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-neutral-400">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">URL Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUseShortCode(true)}
                    className={`px-3 py-1.5 text-xs rounded-md border ${
                      useShortCode ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Short Code ({qrData.shortCodeUrl})
                  </button>
                  <button
                    onClick={() => setUseShortCode(false)}
                    className={`px-3 py-1.5 text-xs rounded-md border ${
                      !useShortCode ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Full URL
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Coupon Code</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 rounded-md border border-gray-200">
                    {couponCode}
                  </code>
                  <button
                    onClick={() => handleCopy(couponCode, 'code')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy code"
                  >
                    {copied === 'code' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">QR URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 rounded-md border border-gray-200 truncate">
                    {fullQrUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(fullQrUrl, 'url')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy URL"
                  >
                    {copied === 'url' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {qrData && !loading && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
            <button
              onClick={() => handleDownload('png')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700"
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
