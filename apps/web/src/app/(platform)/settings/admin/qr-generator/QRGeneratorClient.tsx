'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QR_TEMPLATE_LIST,
  generateQrInstance,
  generateQrDataUrl,
  type QrTemplateName,
} from '@/lib/qr-engine';
import { Download, Copy, Check, QrCode, Palette, Sparkles, Link2, AlertCircle, Image as ImageIcon } from 'lucide-react';

import { DOT_STYLES, CORNER_STYLES, CORNER_DOT_STYLES, SIZE_OPTIONS } from '@/lib/qr-style-constants';
import { SectionBadge } from '@/components/qr/SectionBadge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';

export default function QRGeneratorClient() {
  const [targetUrl, setTargetUrl] = useState('');
  const [size, setSize] = useState(512);
  const [selectedTemplate, setSelectedTemplate] = useState<QrTemplateName>('default');
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
  const [logoUrl, setLogoUrl] = useState('');
  const [logoShape, setLogoShape] = useState('square');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<any>(null);

  const trimmedLogoUrl = logoUrl.trim() || undefined;

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return !!parsed.hostname;
    } catch {
      return false;
    }
  };

  const applyTemplate = (name: QrTemplateName) => {
    setSelectedTemplate(name);
    const tpl = QR_TEMPLATE_LIST.find(t => t.name === name);
    if (tpl?.defaults) {
      const d = tpl.defaults;
      if (d.dotType) setDotType(d.dotType);
      if (d.cornerType) setCornerType(d.cornerType);
      if (d.cornerDotType) setCornerDotType(d.cornerDotType);
      if (d.dotColor) setDotColor(d.dotColor);
      if (d.cornerColor) setCornerColor(d.cornerColor);
      if (d.cornerDotColor) setCornerDotColor(d.cornerDotColor);
      if (d.bgColor) setBgColor(d.bgColor);
      if (d.gradientEnabled !== undefined) setGradientEnabled(d.gradientEnabled);
      if (d.gradientStart) setGradientStart(d.gradientStart);
      if (d.gradientEnd) setGradientEnd(d.gradientEnd);
      if (d.gradientOnDots !== undefined) setGradientOnDots(d.gradientOnDots);
      if (d.gradientOnCorners !== undefined) setGradientOnCorners(d.gradientOnCorners);
      if (d.gradientOnCornerDots !== undefined) setGradientOnCornerDots(d.gradientOnCornerDots);
    }
  };

  const handleUrlChange = (value: string) => {
    setTargetUrl(value);
    setUrlError(null);
  };

  const effectiveUrl = targetUrl.trim()
    ? (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))
      ? targetUrl.trim()
      : `https://${targetUrl.trim()}`
    : '';

  const isUrlValid = !targetUrl.trim() || validateUrl(targetUrl);

  useEffect(() => {
    if (!effectiveUrl || !isUrlValid) return;

    let cancelled = false;

    // When a logo URL is provided, use generateQrDataUrl (canvas-based logo overlay)
    // Otherwise, use generateQrInstance for live SVG DOM preview (supports SVG download)
    if (trimmedLogoUrl) {
      setQrDataUrl(null);
      const renderQrWithDataUrl = async () => {
        const dataUrl = await generateQrDataUrl({
          data: effectiveUrl,
          exportSize: size,
          styled: true,
          template: selectedTemplate,
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
          logoUrl: trimmedLogoUrl,
          logoShape,
        });
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      };
      renderQrWithDataUrl();
    } else {
      setQrDataUrl(null);
      if (!qrContainerRef.current) return;
      const renderQrInstance = async () => {
        const qr = await generateQrInstance({
          data: effectiveUrl,
          exportSize: size,
          styled: true,
          template: selectedTemplate,
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
      renderQrInstance();
    }

    return () => {
      cancelled = true;
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
      }
    };
  }, [effectiveUrl, isUrlValid, selectedTemplate, dotType, cornerType, cornerDotType, customColorsEnabled, dotColor, cornerColor, cornerDotColor, bgColor, gradientEnabled, gradientStart, gradientEnd, gradientOnDots, gradientOnCorners, gradientOnCornerDots, size, trimmedLogoUrl, logoShape]);

  const handleDownload = useCallback(async (format: 'png' | 'svg') => {
    if (!effectiveUrl) return;
    const sanitizedName = effectiveUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 40);

    // When logo is present, PNG download uses the composited data URL (includes logo)
    // SVG download via QRCodeStyling instance does not include logo overlay
    if (trimmedLogoUrl && format === 'png') {
      const dataUrl = await generateQrDataUrl({
        data: effectiveUrl,
        exportSize: size,
        styled: true,
        template: selectedTemplate,
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
        logoUrl: trimmedLogoUrl,
        logoShape,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${sanitizedName}.png`;
      link.click();
      return;
    }

    if (!qrInstanceRef.current) return;
    qrInstanceRef.current.download({ name: `qr-${sanitizedName}`, extension: format });
  }, [effectiveUrl, trimmedLogoUrl, size, selectedTemplate, dotType, cornerType, cornerDotType, customColorsEnabled, dotColor, cornerColor, cornerDotColor, bgColor, gradientEnabled, gradientStart, gradientEnd, gradientOnDots, gradientOnCorners, gradientOnCornerDots, logoShape]);

  const handleCopy = () => {
    navigator.clipboard.writeText(effectiveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
          <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">QR Code Generator</h1>
          <p className="text-sm text-neutral-500">
            Design styled QR codes for any target URL — marketing, events, print materials
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: URL Input + QR Preview */}
        <div className="space-y-4">
          {/* URL Input */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-neutral-500" />
              Target URL
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/landing-page"
              className="w-full px-3 py-2.5 text-sm rounded-md border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {urlError && (
              <div className="flex items-start gap-2 mt-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>{urlError}</p>
              </div>
            )}
            {!targetUrl.trim() && (
              <p className="text-xs text-neutral-400 mt-2">
                Enter any URL to generate a styled QR code
              </p>
            )}
            {targetUrl.trim() && !isUrlValid && (
              <p className="text-xs text-red-500 mt-2">
                Please enter a valid URL
              </p>
            )}
          </div>

          {/* QR Preview */}
          <div className="p-6 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex flex-col items-center">
            <div className="text-xs font-medium text-neutral-500 mb-3">Live Preview</div>
            {effectiveUrl && isUrlValid ? (
              qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code Preview" className="rounded-lg" style={{ width: 256, height: 256 }} />
              ) : (
                <div ref={qrContainerRef} className="rounded-lg overflow-hidden" />
              )
            ) : (
              <div className="w-[256px] h-[256px] flex items-center justify-center bg-gray-50 dark:bg-neutral-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700">
                <QrCode className="w-12 h-12 text-gray-300 dark:text-neutral-600" />
              </div>
            )}

            {/* Size selector */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-neutral-500">Size:</span>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSize(opt.value)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      size === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* URL Display + Copy */}
          {effectiveUrl && isUrlValid && (
            <div className="p-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
              <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Encoded URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-neutral-900 rounded-md border border-gray-200 dark:border-neutral-600 truncate">
                  {effectiveUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-md border border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Download buttons */}
          {effectiveUrl && isUrlValid && (
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload('png')}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <button
                onClick={() => handleDownload('svg')}
                disabled={!!trimmedLogoUrl}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-md border ${trimmedLogoUrl ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-neutral-600' : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'}`}
                title={trimmedLogoUrl ? 'SVG download not available with logo overlay' : ''}
              >
                <Download className="w-4 h-4" />
                Download SVG{trimmedLogoUrl ? ' (N/A)' : ''}
              </button>
            </div>
          )}
        </div>

        {/* Right: Styling Controls */}
        <div className="space-y-4">
          {/* Accordion Styling Controls */}
          <div className="space-y-4 p-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
            <Accordion type="multiple" defaultValue={["templates"]} className="w-full">

              {/* Section: Templates */}
              <AccordionItem value="templates" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 text-indigo-600" />
                    <span className="font-medium text-neutral-900">Templates</span>
                    <SectionBadge>{selectedTemplate}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {QR_TEMPLATE_LIST.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => applyTemplate(t.name)}
                        className="px-3 py-2 text-xs rounded-md border text-left border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700"
                      >
                        <div className="font-medium">{t.label}</div>
                        <div className="text-neutral-400">{t.description}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">Click a template to apply, then customize below</p>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Dot Style */}
              <AccordionItem value="dot" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Dot Style</span>
                    <SectionBadge>{DOT_STYLES.find(s => s.value === dotType)?.label}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {DOT_STYLES.map(s => (
                      <div
                        key={s.value}
                        onClick={() => setDotType(s.value)}
                        className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                          dotType === s.value
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
                        }`}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Corner Style */}
              <AccordionItem value="corner" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Corner Style</span>
                    <SectionBadge>{CORNER_STYLES.find(s => s.value === cornerType)?.label}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {CORNER_STYLES.map(s => (
                      <div
                        key={s.value}
                        onClick={() => setCornerType(s.value)}
                        className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                          cornerType === s.value
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
                        }`}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Corner Dot Style */}
              <AccordionItem value="corner-dot" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Corner Dot Style</span>
                    <SectionBadge>{CORNER_DOT_STYLES.find(s => s.value === cornerDotType)?.label}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {CORNER_DOT_STYLES.map(s => (
                      <div
                        key={s.value}
                        onClick={() => setCornerDotType(s.value)}
                        className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                          cornerDotType === s.value
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
                        }`}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Custom Colors */}
              <AccordionItem value="colors" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Custom Colors</span>
                    <SectionBadge>{customColorsEnabled ? 'On' : 'Off'}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Custom Colors</span>
                      <button
                        onClick={() => setCustomColorsEnabled(!customColorsEnabled)}
                        className={`relative w-8 h-4 rounded-full transition-colors ${
                          customColorsEnabled ? 'bg-indigo-500' : 'bg-gray-300'
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
                          <input type="color" value={dotColor} onChange={(e) => setDotColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400">Corners</label>
                          <input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400">Corner Dot</label>
                          <input type="color" value={cornerDotColor} onChange={(e) => setCornerDotColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400">Background</label>
                          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Gradient */}
              <AccordionItem value="gradient" className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Gradient</span>
                    <SectionBadge>{gradientEnabled ? 'On' : 'Off'}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Gradient Effect</span>
                      </div>
                      <button
                        onClick={() => setGradientEnabled(!gradientEnabled)}
                        className={`relative w-8 h-4 rounded-full transition-colors ${
                          gradientEnabled ? 'bg-indigo-500' : 'bg-gray-300'
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
                          <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-400">End</label>
                          <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <input type="checkbox" checked={gradientOnDots} onChange={(e) => setGradientOnDots(e.target.checked)} className="rounded border-gray-300" />
                          Dots
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <input type="checkbox" checked={gradientOnCorners} onChange={(e) => setGradientOnCorners(e.target.checked)} className="rounded border-gray-300" />
                          Corners
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <input type="checkbox" checked={gradientOnCornerDots} onChange={(e) => setGradientOnCornerDots(e.target.checked)} className="rounded border-gray-300" />
                          Corner Dots
                        </label>
                      </div>
                      </>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section: Logo */}
              <AccordionItem value="logo" className="border-b-0">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">Logo</span>
                    <SectionBadge>{trimmedLogoUrl ? 'Set' : 'None'}</SectionBadge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      Logo Overlay
                    </div>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png (optional)"
                      className="w-full px-3 py-2 text-xs rounded-md border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {trimmedLogoUrl && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-neutral-500">Shape:</span>
                          <div className="flex gap-1">
                            {(['square', 'circle'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => setLogoShape(s)}
                                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                                  logoShape === s
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                    : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'
                                }`}
                              >
                                {s === 'square' ? 'Square' : 'Circle'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setLogoUrl('')}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {trimmedLogoUrl && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Logo overlay uses error correction level H. PNG download includes logo; SVG download is not available with logo.
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
