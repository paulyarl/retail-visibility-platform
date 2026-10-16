'use client';

/**
 * MailerQrDesignerModal — styled QR designer for the postal mailer composer
 * (Outreach Kit tab). Adapted from the seed-page QR kits
 * (ClaimQrDesignerModal): same shared qr-engine (qr-code-styling), template
 * picker, dot/corner styles, custom colors + gradient, centered logo
 * (platform logo or uploaded prospect logo), live preview, PNG/SVG export.
 *
 * Difference: instead of posting to a seed-scoped postcard endpoint, the
 * modal hands the styled PNG data URL back via onApply — the composer then
 * ships it with POST /campaigns/:id/mailer so the printed card carries the
 * styled code (omitting it yields the classic B/W render).
 */

import { useEffect, useRef, useState } from 'react';
import { X, Download, QrCode, Image as ImageIcon, Check } from 'lucide-react';
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
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';

/** Curated subset — prospect-facing diagnostic/report surfaces. */
const MAILER_TEMPLATES: QrTemplateName[] = ['default', 'report-audit', 'claim-invite', 'promo'];

export interface MailerQrDesignerModalProps {
  open: boolean;
  onClose: () => void;
  /** The resolved QR landing URL — what the code encodes. */
  url: string;
  title: string;
  /** Receives the styled QR PNG data URL (1024px) for the postcard PDF. */
  onApply: (dataUrl: string) => void;
}

export default function MailerQrDesignerModal({
  open,
  onClose,
  url,
  title,
  onApply,
}: MailerQrDesignerModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<QrTemplateName>('report-audit');
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    // Custom upload wins over the platform logo — lets the operator center
    // the prospect's own logo on the card.
    logoUrl: logoEnabled ? (customLogoDataUrl ?? platformLogoUrl) : null,
    logoShape,
  });

  // Platform logo — same pattern as the seed QR designer: the logo lives in
  // platform_settings_list.logo_url, served via /api/platform-settings.
  // Preload with crossOrigin='anonymous' to mirror overlayLogoOnQRAsync —
  // a URL the canvas can't read would otherwise fail silently.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogoLoading(true);
    setLogoLoadFailed(false);
    (async () => {
      try {
        const s = await platformSettingsService.getPlatformSettings();
        const logoUrl = s?.logoUrl ?? null;
        if (!logoUrl) {
          if (!cancelled) setPlatformLogoUrl(null);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const probe = new Image();
          probe.crossOrigin = 'anonymous';
          probe.onload = () => resolve();
          probe.onerror = () => reject(new Error('logo probe failed'));
          probe.src = logoUrl;
        });
        if (!cancelled) setPlatformLogoUrl(logoUrl);
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

  // Apply the default template on open so its concrete values land in state.
  useEffect(() => {
    if (!open) return;
    applyTemplate('report-audit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live preview — always via generateQrDataUrl so the logo overlay shows.
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
      setBusy('png');
      const dataUrl = await generateQrDataUrl(buildOpts(size));
      downloadDataUrl(dataUrl, `mailer-qr-${size}px.png`);
    } catch {
      setError('Failed to generate PNG');
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      setBusy('svg');
      const qr = await generateQrInstance(buildOpts(size));
      qr.download({ name: `mailer-qr-${size}px`, extension: 'svg' });
    } catch {
      setError('Failed to generate SVG');
    } finally {
      setBusy(null);
    }
  };

  const handleApply = async () => {
    try {
      setBusy('apply');
      const dataUrl = await generateQrDataUrl(buildOpts(1024));
      onApply(dataUrl);
      onClose();
    } catch {
      setError('Failed to render QR');
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold">Design QR — {title}</h3>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Live preview */}
          <div className="flex justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Styled mailer QR preview"
                className="rounded-lg border border-gray-200 dark:border-neutral-600 shadow-sm"
                style={{ width: 256, height: 256 }}
              />
            ) : (
              <div className="w-64 h-64 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-700/50 flex items-center justify-center">
                <QrCode className="w-10 h-10 text-gray-300" />
              </div>
            )}
          </div>
          <p className="text-xs font-mono text-gray-500 break-all text-center">{url}</p>

          {/* Templates */}
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5 block">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {QR_TEMPLATE_LIST.filter((t) => MAILER_TEMPLATES.includes(t.name)).map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t.name)}
                  className={`px-3 py-2 text-xs rounded-md border text-left ${
                    selectedTemplate === t.name
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className="text-neutral-400">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dot style */}
          <div>
            <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5 block">Dot Style</label>
            <div className="grid grid-cols-3 gap-1.5">
              {DOT_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setDotType(s.value)}
                  className={`p-2 rounded border text-xs ${
                    dotType === s.value
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Corner style + corner dot */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5 block">Corner Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNER_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setCornerType(s.value)}
                    className={`p-2 rounded border text-xs ${
                      cornerType === s.value
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5 block">Corner Dot</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNER_DOT_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setCornerDotType(s.value)}
                    className={`p-2 rounded border text-xs ${
                      cornerDotType === s.value
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logo — platform default or uploaded prospect logo */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={logoEnabled}
                onChange={(e) => setLogoEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              Center logo
            </label>
            {logoEnabled && (
              <div className="mt-2 space-y-2">
                {customLogoDataUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={customLogoDataUrl}
                      alt="Custom logo"
                      className="h-8 w-8 object-contain rounded border border-neutral-200 bg-white"
                    />
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-300">Custom logo</span>
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
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Upload a different logo instead
                  </button>
                )}
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoFile}
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
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom colors */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={customColorsEnabled}
                onChange={(e) => setCustomColorsEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              Custom colors
            </label>
            {customColorsEnabled && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {(
                  [
                    ['Dots', dotColor, setDotColor],
                    ['Corners', cornerColor, setCornerColor],
                    ['Corner dots', cornerDotColor, setCornerDotColor],
                    ['Background', bgColor, setBgColor],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className="text-xs text-neutral-500">
                    {label}
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Gradient */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={gradientEnabled}
                onChange={(e) => setGradientEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              Gradient
            </label>
            {gradientEnabled && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-neutral-500">
                    Start
                    <input
                      type="color"
                      value={gradientStart}
                      onChange={(e) => setGradientStart(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </label>
                  <label className="text-xs text-neutral-500">
                    End
                    <input
                      type="color"
                      value={gradientEnd}
                      onChange={(e) => setGradientEnd(e.target.value)}
                      className="mt-1 w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </label>
                </div>
                <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-300">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={gradientOnDots}
                      onChange={(e) => setGradientOnDots(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Dots
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={gradientOnCorners}
                      onChange={(e) => setGradientOnCorners(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Corners
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={gradientOnCornerDots}
                      onChange={(e) => setGradientOnCornerDots(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Corner dots
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Export size */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Export size:</span>
            <div className="flex gap-1">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSize(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border ${
                    size === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-700 flex flex-wrap gap-2 justify-end">
          <button
            onClick={handleDownloadPng}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {busy === 'png' ? 'Generating…' : 'PNG'}
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={busy !== null || logoEnabled}
            title={logoEnabled ? 'SVG download not available with logo overlay' : ''}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {busy === 'svg' ? 'Generating…' : 'SVG'}
          </button>
          <button
            onClick={handleApply}
            disabled={busy !== null || !url}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {busy === 'apply' ? 'Rendering…' : 'Use this QR on the postcard'}
          </button>
        </div>
      </div>
    </div>
  );
}
