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
import {
  QR_TEMPLATE_LIST,
  generateQrInstance,
  type QrTemplateName,
} from '@/lib/qr-engine';
import {
  adminBsaasPromotionsService,
  type PromoQRData,
} from '@/services/AdminBsaasPromotionsService';
import { X, Download, Copy, Check, QrCode, Loader2, Palette, Sparkles } from 'lucide-react';
import { DOT_STYLES, CORNER_STYLES, CORNER_DOT_STYLES } from '@/lib/qr-style-constants';
import { SectionBadge } from '@/components/qr/SectionBadge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

interface PromoCodeQRDialogProps {
  promotionCodeId: string;
  promotionCode: string;
  open: boolean;
  onClose: () => void;
  defaultTheme?: QrTemplateName;
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
  const [selectedTheme, setSelectedTheme] = useState<QrTemplateName>(defaultTheme);
  const [dotType, setDotType] = useState('rounded');
  const [cornerType, setCornerType] = useState('extra-rounded');
  const [cornerDotType, setCornerDotType] = useState('dot');
  const [customColorsEnabled, setCustomColorsEnabled] = useState(false);
  const [dotColor, setDotColor] = useState('#1a56db');
  const [cornerColor, setCornerColor] = useState('#1a56db');
  const [cornerDotColor, setCornerDotColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientStart, setGradientStart] = useState('#1a56db');
  const [gradientEnd, setGradientEnd] = useState('#7c3aed');
  const [gradientOnDots, setGradientOnDots] = useState(true);
  const [gradientOnCorners, setGradientOnCorners] = useState(true);
  const [gradientOnCornerDots, setGradientOnCornerDots] = useState(true);
  const [copied, setCopied] = useState<'url' | 'code' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<any>(null);

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

    let cancelled = false;
    const renderQr = async () => {
      const qr = await generateQrInstance({
        data: qrData.qr_url,
        exportSize: 512,
        styled: true,
        template: selectedTheme,
        dotType,
        cornerType,
        cornerDotType,
        dotColor: customColorsEnabled ? dotColor : undefined,
        cornerColor: customColorsEnabled ? cornerColor : undefined,
        cornerDotColor: customColorsEnabled ? cornerDotColor : undefined,
        bgColor: customColorsEnabled ? bgColor : undefined,
        gradientEnabled,
        gradientStart,
        gradientEnd,
        gradientOnDots,
        gradientOnCorners,
        gradientOnCornerDots,
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
  }, [qrData, selectedTheme, dotType, cornerType, cornerDotType, customColorsEnabled, dotColor, cornerColor, cornerDotColor, bgColor, gradientEnabled, gradientStart, gradientEnd, gradientOnDots, gradientOnCorners, gradientOnCornerDots]);

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
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">QR Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {QR_TEMPLATE_LIST.filter(t => t.name !== 'default').map((t) => (
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

              {/* Collapsible Customize Styling */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="customize-styling" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      <Palette className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-medium text-neutral-900">Customize Styling</span>
                      <SectionBadge>{customColorsEnabled || gradientEnabled ? 'Custom' : 'Default'}</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="space-y-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                      {/* Dot Style */}
                      <div>
                        <label className="text-xs text-neutral-600 mb-1 block">Dot Style</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {DOT_STYLES.map(s => (
                            <div
                              key={s.value}
                              onClick={() => setDotType(s.value)}
                              className={`flex items-center justify-center p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                                dotType === s.value
                                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Corner Style */}
                      <div>
                        <label className="text-xs text-neutral-600 mb-1 block">Corner Style</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {CORNER_STYLES.map(s => (
                            <div
                              key={s.value}
                              onClick={() => setCornerType(s.value)}
                              className={`flex items-center justify-center p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                                cornerType === s.value
                                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Corner Dot Style */}
                      <div>
                        <label className="text-xs text-neutral-600 mb-1 block">Corner Dot Style</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CORNER_DOT_STYLES.map(s => (
                            <div
                              key={s.value}
                              onClick={() => setCornerDotType(s.value)}
                              className={`flex items-center justify-center p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                                cornerDotType === s.value
                                  ? 'border-purple-400 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                              }`}
                            >
                              {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Custom Colors */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-neutral-700">Custom Colors</span>
                          <button
                            onClick={() => setCustomColorsEnabled(!customColorsEnabled)}
                            className={`relative w-8 h-4 rounded-full transition-colors ${
                              customColorsEnabled ? 'bg-purple-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              customColorsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                        {customColorsEnabled && (
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-neutral-400">Dots</label>
                              <input type="color" value={dotColor} onChange={(e) => setDotColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                            <div>
                              <label className="text-xs text-neutral-400">Corners</label>
                              <input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                            <div>
                              <label className="text-xs text-neutral-400">Corner Dot</label>
                              <input type="color" value={cornerDotColor} onChange={(e) => setCornerDotColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                            <div>
                              <label className="text-xs text-neutral-400">Background</label>
                              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Gradient */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-500" />
                            <span className="text-xs font-medium text-neutral-700">Gradient Effect</span>
                          </div>
                          <button
                            onClick={() => setGradientEnabled(!gradientEnabled)}
                            className={`relative w-8 h-4 rounded-full transition-colors ${
                              gradientEnabled ? 'bg-purple-500' : 'bg-gray-300'
                            }`}
                          >
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              gradientEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                        {gradientEnabled && (
                          <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-neutral-400">Start</label>
                              <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                            <div>
                              <label className="text-xs text-neutral-400">End</label>
                              <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                              <input type="checkbox" checked={gradientOnDots} onChange={(e) => setGradientOnDots(e.target.checked)} className="rounded border-gray-300" />
                              Dots
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                              <input type="checkbox" checked={gradientOnCorners} onChange={(e) => setGradientOnCorners(e.target.checked)} className="rounded border-gray-300" />
                              Corners
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                              <input type="checkbox" checked={gradientOnCornerDots} onChange={(e) => setGradientOnCornerDots(e.target.checked)} className="rounded border-gray-300" />
                              Corner Dots
                            </label>
                          </div>
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

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
