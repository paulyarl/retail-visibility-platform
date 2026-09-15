'use client';

/**
 * ReportQrDesignerModal — styled QR designer for report delivery artifacts.
 * Mirrors the ClaimQrDesignerModal pattern:
 *
 *   - Modal shell + template picker + style controls + live preview
 *   - Styled QR via qr-code-styling with optional centered platform logo
 *   - Postcard PDF: posts the styled QR data URL to the server so the printed
 *     card carries the same styled code (GET variant stays classic B/W)
 *
 * The QR always encodes the channel's tracked redirect URL — scans still
 * record as report_delivery_{channel} regardless of styling.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Download, QrCode, FileText, Image as ImageIcon } from 'lucide-react';
import {
  QR_TEMPLATE_LIST,
  generateQrInstance,
  generateQrDataUrl,
  type QrTemplateName,
  type QrEngineOptions,
} from '@/lib/qr-engine';
import {
  DOT_STYLES,
  CORNER_STYLES,
  CORNER_DOT_STYLES,
  SIZE_OPTIONS,
} from '@/lib/qr-style-constants';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';

export interface ReportQrDesignerModalProps {
  open: boolean;
  onClose: () => void;
  seedId: string;
  channel: 'phone' | 'email' | 'social' | 'in_person' | 'text';
  title: string;
  /** The channel's tracked redirect URL — what the QR encodes. */
  url: string;
  /** Whether this channel has a postcard artifact. */
  allowPostcard?: boolean;
}

export default function ReportQrDesignerModal({
  open,
  onClose,
  seedId,
  channel,
  title,
  url,
  allowPostcard = false,
}: ReportQrDesignerModalProps) {
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
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [logoShape, setLogoShape] = useState('square');
  const [platformLogoUrl, setPlatformLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(512);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qrInstanceRef = useRef<any>(null);

  const applyTemplate = (name: QrTemplateName) => {
    setSelectedTemplate(name);
    const tpl = QR_TEMPLATE_LIST.find((t) => t.name === name);
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
    }
  };

  const buildOpts = (exportSize: number): QrEngineOptions => ({
    data: url,
    exportSize,
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
    logoUrl: logoEnabled ? (customLogoDataUrl ?? platformLogoUrl) : null,
    logoShape,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogoLoading(true);
    setLogoLoadFailed(false);
    (async () => {
      try {
        const s = await platformSettingsService.getPlatformSettings();
        const url = s?.logoUrl ?? null;
        if (!url) {
          if (!cancelled) setPlatformLogoUrl(null);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const probe = new Image();
          probe.crossOrigin = 'anonymous';
          probe.onload = () => resolve();
          probe.onerror = () => reject(new Error('logo probe failed'));
          probe.src = url;
        });
        if (!cancelled) setPlatformLogoUrl(url);
      } catch {
        if (!cancelled) {
          setPlatformLogoUrl(null);
          setLogoLoadFailed(true);
        }
      } finally {
        if (!cancelled) setLogoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setQrDataUrl(null);
    generateQrDataUrl(buildOpts(512))
      .then((d) => {
        if (!cancelled) setQrDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open, url, selectedTemplate, dotType, cornerType, cornerDotType,
    customColorsEnabled, dotColor, cornerColor, cornerDotColor, bgColor,
    gradientEnabled, gradientStart, gradientEnd,
    gradientOnDots, gradientOnCorners, gradientOnCornerDots,
    logoEnabled, logoShape, platformLogoUrl, customLogoDataUrl,
  ]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogoDataUrl(typeof reader.result === 'string' ? reader.result : null);
      setError(null);
    };
    reader.onerror = () => setError('Failed to read logo file');
    reader.readAsDataURL(file);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPng = async () => {
    try {
      setDownloading('png');
      const dataUrl = await generateQrDataUrl(buildOpts(size));
      downloadDataUrl(dataUrl, `report-qr-${channel}-${size}px.png`);
    } catch {
      setError('Failed to generate PNG');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      setDownloading('svg');
      const qr = await generateQrInstance(buildOpts(size));
      qrInstanceRef.current = qr;
      qr.download({ name: `report-qr-${channel}-${size}px`, extension: 'svg' });
    } catch {
      setError('Failed to generate SVG');
    } finally {
      setDownloading(null);
    }
  };

  const handleStyledPostcard = async () => {
    try {
      setDownloading('postcard');
      const dataUrl = await generateQrDataUrl(buildOpts(1024));
      const blob = await directoryPresenceAdminService.downloadReportPostcardStyled(
        seedId,
        channel,
        dataUrl,
      );
      if (!blob) throw new Error('Download failed');
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `report-postcard-${channel}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Failed to generate postcard');
    } finally {
      setDownloading(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-lg font-semibold">{title}</h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Template picker */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">Template</label>
          <div className="flex flex-wrap gap-2">
            {QR_TEMPLATE_LIST.map((t) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(t.name)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  selectedTemplate === t.name
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style controls */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dot Style</label>
            <select
              value={dotType}
              onChange={(e) => setDotType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {DOT_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Corner Style</label>
            <select
              value={cornerType}
              onChange={(e) => setCornerType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {CORNER_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Corner Dot Style</label>
            <select
              value={cornerDotType}
              onChange={(e) => setCornerDotType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {CORNER_DOT_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Size</label>
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {SIZE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom colors toggle */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="report-custom-colors"
            checked={customColorsEnabled}
            onChange={(e) => setCustomColorsEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="report-custom-colors" className="text-sm text-gray-700">
            Custom colors
          </label>
        </div>

        {customColorsEnabled && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Dots</label>
              <input
                type="color"
                value={dotColor}
                onChange={(e) => setDotColor(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Corners</label>
              <input
                type="color"
                value={cornerColor}
                onChange={(e) => setCornerColor(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Corner Dots</label>
              <input
                type="color"
                value={cornerDotColor}
                onChange={(e) => setCornerDotColor(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Background</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
          </div>
        )}

        {/* Gradient */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="report-gradient"
            checked={gradientEnabled}
            onChange={(e) => setGradientEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="report-gradient" className="text-sm text-gray-700">
            Gradient
          </label>
        </div>

        {gradientEnabled && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Start</label>
              <input
                type="color"
                value={gradientStart}
                onChange={(e) => setGradientStart(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">End</label>
              <input
                type="color"
                value={gradientEnd}
                onChange={(e) => setGradientEnd(e.target.value)}
                className="h-8 w-full rounded border border-gray-300"
              />
            </div>
            <div className="col-span-2 flex gap-4 text-xs text-gray-600">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={gradientOnDots} onChange={(e) => setGradientOnDots(e.target.checked)} />
                Dots
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={gradientOnCorners} onChange={(e) => setGradientOnCorners(e.target.checked)} />
                Corners
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={gradientOnCornerDots} onChange={(e) => setGradientOnCornerDots(e.target.checked)} />
                Corner dots
              </label>
            </div>
          </div>
        )}

        {/* Logo */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="report-logo"
              checked={logoEnabled}
              onChange={(e) => setLogoEnabled(e.target.checked)}
              className="rounded border-gray-300"
            />
            <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
            <label htmlFor="report-logo" className="text-sm text-gray-700">
              Center logo
            </label>
          </div>
          {logoEnabled && (
            <div className="mt-2 space-y-2">
              {customLogoDataUrl ? (
                <div className="flex items-center gap-2">
                  <img
                    src={customLogoDataUrl}
                    alt="Custom logo"
                    className="h-8 w-8 object-contain rounded border border-gray-200 bg-white"
                  />
                  <span className="text-[11px] text-gray-600">Prospect logo</span>
                  <button
                    onClick={() => setCustomLogoDataUrl(null)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => logoFileRef.current?.click()}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Upload prospect logo instead
                </button>
              )}
              <input
                ref={logoFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFile}
                className="hidden"
              />
            </div>
          )}
          {logoEnabled && !customLogoDataUrl && !logoLoading && !platformLogoUrl && (
            <p className="text-[11px] text-amber-600 mt-1">
              {logoLoadFailed
                ? 'The configured platform logo could not be loaded (CORS or unreachable URL) — the QR renders without one.'
                : 'No platform logo is configured in platform settings — the QR renders without one.'}
            </p>
          )}
          {logoEnabled && (
            <div className="flex gap-2 mt-2">
              {(['square', 'circle'] as const).map((shape) => (
                <button
                  key={shape}
                  onClick={() => setLogoShape(shape)}
                  className={`px-3 py-1.5 text-xs rounded-md border capitalize ${
                    logoShape === shape
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="mb-4 flex justify-center rounded-md border border-gray-200 bg-gray-50 p-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR preview" className="max-w-full rounded" style={{ width: 200, height: 200 }} />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center text-sm text-gray-400">
              Generating preview...
            </div>
          )}
        </div>

        {/* Encoded URL (debug) */}
        <div className="mb-4 rounded-md bg-gray-50 p-2">
          <p className="text-xs text-gray-500">
            Encodes: <code className="break-all text-xs">{url}</code>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadPng}
            disabled={downloading === 'png'}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'png' ? 'Generating...' : 'PNG'}
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={downloading === 'svg'}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading === 'svg' ? 'Generating...' : 'SVG'}
          </button>
          {allowPostcard && (
            <button
              onClick={handleStyledPostcard}
              disabled={downloading === 'postcard'}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {downloading === 'postcard' ? 'Generating...' : 'Styled Postcard'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
