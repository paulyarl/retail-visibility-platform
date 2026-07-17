'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCodeStyling from 'qr-code-styling';
import {
  QR_THEME_LIST,
  buildQROptionsFromSettings,
  applyThemeToSettings,
  DEFAULT_QR_STYLE_SETTINGS,
  type QRThemeName,
  type QrStyleSettings,
} from '@/lib/qr-style-config';
import { Download, Copy, Check, QrCode, Palette, Sparkles, Link2, AlertCircle } from 'lucide-react';

const DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'extra-rounded', label: 'Extra Rounded' },
  { value: 'dots', label: 'Dots' },
  { value: 'classy', label: 'Classy' },
  { value: 'classy-rounded', label: 'Classy Rounded' },
];

const CORNER_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded Square' },
  { value: 'extra-rounded', label: 'Round Square' },
  { value: 'dot', label: 'Round' },
];

const CORNER_DOT_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'dot', label: 'Round' },
];

const SIZE_OPTIONS = [
  { value: 256, label: '256px' },
  { value: 512, label: '512px' },
  { value: 768, label: '768px' },
  { value: 1024, label: '1024px' },
];

export default function QRGeneratorClient() {
  const [targetUrl, setTargetUrl] = useState('');
  const [size, setSize] = useState(512);
  const [styleSettings, setStyleSettings] = useState<QrStyleSettings>(DEFAULT_QR_STYLE_SETTINGS);
  const [copied, setCopied] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return !!parsed.hostname;
    } catch {
      return false;
    }
  };

  const updateStyle = (key: keyof QrStyleSettings, value: string | boolean) => {
    setStyleSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyThemePreset = (theme: QRThemeName) => {
    setStyleSettings(applyThemeToSettings(theme));
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
    if (!effectiveUrl || !isUrlValid || !qrContainerRef.current) return;

    const options = buildQROptionsFromSettings(effectiveUrl, styleSettings, size);

    const qr = new QRCodeStyling(options);
    qrInstanceRef.current = qr;

    qrContainerRef.current.innerHTML = '';
    qr.append(qrContainerRef.current);

    return () => {
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
      }
    };
  }, [effectiveUrl, isUrlValid, styleSettings, size]);

  const handleDownload = useCallback((format: 'png' | 'svg') => {
    if (!qrInstanceRef.current || !effectiveUrl) return;
    const sanitizedName = effectiveUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 40);
    qrInstanceRef.current.download({ name: `qr-${sanitizedName}`, extension: format });
  }, [effectiveUrl]);

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
              <div ref={qrContainerRef} className="rounded-lg overflow-hidden" />
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
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-md border border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700"
              >
                <Download className="w-4 h-4" />
                Download SVG
              </button>
            </div>
          )}
        </div>

        {/* Right: Styling Controls */}
        <div className="space-y-4">
          {/* Theme Presets */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <label className="text-sm font-medium mb-2 block">Theme Presets</label>
            <div className="grid grid-cols-2 gap-2">
              {QR_THEME_LIST.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyThemePreset(t.name)}
                  className="px-3 py-2 text-xs rounded-md border text-left border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700"
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-neutral-400">{t.description}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-2">Click a preset to apply, then customize below</p>
          </div>

          {/* Full QR Styling Controls */}
          <div className="space-y-4 p-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
            <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">
              <Palette className="w-4 h-4" />
              QR Styling
            </div>

            {/* Dot Style */}
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 mb-1.5 block">Dot Style</label>
              <div className="grid grid-cols-3 gap-1.5">
                {DOT_STYLES.map(s => (
                  <div
                    key={s.value}
                    onClick={() => updateStyle('dotType', s.value)}
                    className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                      styleSettings.dotType === s.value
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Corner Style */}
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 mb-1.5 block">Corner Style</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CORNER_STYLES.map(s => (
                  <div
                    key={s.value}
                    onClick={() => updateStyle('cornerType', s.value)}
                    className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                      styleSettings.cornerType === s.value
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Corner Dot Style */}
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 mb-1.5 block">Corner Dot Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNER_DOT_STYLES.map(s => (
                  <div
                    key={s.value}
                    onClick={() => updateStyle('cornerDotType', s.value)}
                    className={`flex items-center justify-center p-2 rounded border text-xs cursor-pointer transition-colors ${
                      styleSettings.cornerDotType === s.value
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 hover:border-gray-300'
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
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Custom Colors</span>
                <button
                  onClick={() => updateStyle('customColorsEnabled', !styleSettings.customColorsEnabled)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    styleSettings.customColorsEnabled ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    styleSettings.customColorsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {styleSettings.customColorsEnabled && (
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-neutral-400">Dots</label>
                    <input type="color" value={styleSettings.dotColor} onChange={(e) => updateStyle('dotColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Corners</label>
                    <input type="color" value={styleSettings.cornerColor} onChange={(e) => updateStyle('cornerColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Corner Dot</label>
                    <input type="color" value={styleSettings.cornerDotColor} onChange={(e) => updateStyle('cornerDotColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">Background</label>
                    <input type="color" value={styleSettings.bgColor} onChange={(e) => updateStyle('bgColor', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                </div>
              )}
            </div>

            {/* Gradient */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">Gradient Effect</span>
                </div>
                <button
                  onClick={() => updateStyle('gradientEnabled', !styleSettings.gradientEnabled)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    styleSettings.gradientEnabled ? 'bg-indigo-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    styleSettings.gradientEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {styleSettings.gradientEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-neutral-400">Start</label>
                    <input type="color" value={styleSettings.gradientStart} onChange={(e) => updateStyle('gradientStart', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400">End</label>
                    <input type="color" value={styleSettings.gradientEnd} onChange={(e) => updateStyle('gradientEnd', e.target.value)} className="w-full h-8 rounded border border-gray-200 dark:border-neutral-600 cursor-pointer" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
