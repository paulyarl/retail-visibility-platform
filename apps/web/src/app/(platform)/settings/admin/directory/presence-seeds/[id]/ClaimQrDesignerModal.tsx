'use client';

/**
 * ClaimQrDesignerModal — styled QR designer for directory claim-invite
 * artifacts. Mirrors the platform's QR patterns:
 *
 *   - Modal shell + template picker: CouponQRDialog
 *   - Style controls + size/download: QRGeneratorClient (admin QR generator)
 *   - Live preview: generateQrDataUrl from the shared qr-engine (styled path
 *     via qr-code-styling) with an optional centered platform logo
 *   - Postcard PDF: posts the styled QR data URL to the server so the printed
 *     card carries the same styled code (GET variant stays classic B/W)
 *
 * The QR always encodes the variant's tracked redirect URL — scans still
 * record as claim_invite / _walkin / _social / _email regardless of styling.
 *
 * "Save design" PERSISTS one shared design for the seed's claim variants
 * (directory_presence_seeds.claim_qr_style), so every claim card's preview,
 * QR PNG, and Postcard PDF render it. The designer prefills from that saved
 * design when one exists.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Download, QrCode, FileText, Image as ImageIcon, Save } from 'lucide-react';
import {
  QR_TEMPLATE_LIST,
  generateQrInstance,
  generateQrDataUrl,
  type QrTemplateName,
  type QrEngineOptions,
  type PersistedQrStyle,
} from '@/lib/qr-engine';
import {
  DOT_STYLES,
  CORNER_STYLES,
  CORNER_DOT_STYLES,
  SIZE_OPTIONS,
} from '@/lib/qr-style-constants';
import { clientLogger } from '@/lib/client-logger';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';

export interface ClaimQrDesignerModalProps {
  open: boolean;
  onClose: () => void;
  seedId: string;
  variant: 'mail' | 'walkin' | 'social' | 'email';
  title: string;
  /** The variant's tracked redirect URL — what the QR encodes. */
  url: string;
  /** Whether this variant has a postcard artifact (mail + walkin). */
  allowPostcard?: boolean;
  /** Surface-scoped template subset (the COUPON_TEMPLATES pattern) — when set,
   *  the picker only offers these. */
  templates?: QrTemplateName[];
  /** Template applied on open. Defaults to 'default'. */
  defaultTemplate?: QrTemplateName;
  /** The seed's saved shared claim design — used to prefill the designer so the
   *  operator edits the live card design. Null/absent → the default template. */
  initialStyle?: PersistedQrStyle | null;
  /** Called after a successful save so the page can re-render the claim cards
   *  with the new design. */
  onSaved?: (style: PersistedQrStyle) => void;
}

export default function ClaimQrDesignerModal({
  open,
  onClose,
  seedId,
  variant,
  title,
  url,
  allowPostcard = false,
  templates,
  defaultTemplate = 'default',
  initialStyle = null,
  onSaved,
}: ClaimQrDesignerModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<QrTemplateName>(defaultTemplate);
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFallback, setPreviewFallback] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const qrInstanceRef = useRef<any>(null);
  const previewRunRef = useRef(0);

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
    // the prospect's own logo on the artifact. Data URLs are same-origin so
    // overlayLogoOnQRAsync draws them without CORS risk.
    logoUrl: logoEnabled ? (customLogoDataUrl ?? platformLogoUrl) : null,
    logoShape,
  });

  // Platform logo — same pattern as BotConfigPage: the logo lives in
  // platform_settings_list.logo_url, served via /api/platform-settings
  // (cached 15min by the singleton). Not a static file under /public.
  // Preload with crossOrigin='anonymous' to mirror overlayLogoOnQRAsync —
  // a URL the canvas can't read (missing CORS headers) would otherwise
  // fail silently and render a plain QR.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogoLoading(true);
    setLogoLoadFailed(false);
    (async () => {
      try {
        const s = await platformSettingsService.getPlatformSettings();
        const url = s?.logoUrl ?? null;
        // eslint-disable-next-line no-console
        console.info('[ClaimDesignerLogo] settings resolved', { hasUrl: !!url, head: url?.slice(0, 48) ?? null });
        if (!url) {
          if (!cancelled) setPlatformLogoUrl(null);
          return;
        }
        await new Promise<void>((resolve, reject) => {
          const probe = new Image();
          if (/^https?:/i.test(url)) probe.crossOrigin = 'anonymous';
          probe.onload = () => resolve();
          probe.onerror = () => reject(new Error('logo probe failed'));
          probe.src = url;
        });
        // eslint-disable-next-line no-console
        console.info('[ClaimDesignerLogo] platform logo probe ok', { head: url.slice(0, 48) });
        if (!cancelled) setPlatformLogoUrl(url);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ClaimDesignerLogo] platform logo unavailable', String((err as Error)?.message ?? err));
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

  // Prefill from the seed's saved shared claim design so the operator edits the
  // live card design; with no design saved, apply the surface's default template
  // (resolveOptions alone never overrides the always-defined option fields).
  useEffect(() => {
    if (!open) return;
    if (!initialStyle) {
      applyTemplate(defaultTemplate);
      return;
    }
    if (initialStyle.dotType) setDotType(initialStyle.dotType);
    if (initialStyle.cornerType) setCornerType(initialStyle.cornerType);
    if (initialStyle.cornerDotType) setCornerDotType(initialStyle.cornerDotType);
    if (initialStyle.customColorsEnabled !== undefined) setCustomColorsEnabled(initialStyle.customColorsEnabled);
    if (initialStyle.dotColor) setDotColor(initialStyle.dotColor);
    if (initialStyle.cornerColor) setCornerColor(initialStyle.cornerColor);
    if (initialStyle.cornerDotColor) setCornerDotColor(initialStyle.cornerDotColor);
    if (initialStyle.bgColor) setBgColor(initialStyle.bgColor);
    if (initialStyle.gradientEnabled !== undefined) setGradientEnabled(initialStyle.gradientEnabled);
    if (initialStyle.gradientStart) setGradientStart(initialStyle.gradientStart);
    if (initialStyle.gradientEnd) setGradientEnd(initialStyle.gradientEnd);
    if (initialStyle.gradientOnDots !== undefined) setGradientOnDots(initialStyle.gradientOnDots);
    if (initialStyle.gradientOnCorners !== undefined) setGradientOnCorners(initialStyle.gradientOnCorners);
    if (initialStyle.gradientOnCornerDots !== undefined) setGradientOnCornerDots(initialStyle.gradientOnCornerDots);
    if (initialStyle.logo !== undefined) setLogoEnabled(initialStyle.logo);
    if (initialStyle.logoShape) setLogoShape(initialStyle.logoShape);
    // Persisted designs are concrete — no template identity survives the save,
    // so keep the surface default selected as a display label only.
    setSelectedTemplate(defaultTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStyle, defaultTemplate]);

  // Live preview — always via generateQrDataUrl so the logo overlay shows.
  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setQrDataUrl(null);
    setPreviewFallback(false);
    setPreviewFailed(false);
    const runId = ++previewRunRef.current;
    const dbg = (stage: string, extra?: Record<string, unknown>) =>
      // eslint-disable-next-line no-console
      console.info(`[ClaimDesignerPreview #${runId}] ${stage}`, extra ?? '');
    const logoKind = !logoEnabled
      ? 'disabled'
      : (customLogoDataUrl ? 'custom' : platformLogoUrl ? 'platform' : 'none');
    dbg('start', { logoKind, logoLoading });
    const opts = buildOpts(512);
    generateQrDataUrl(opts)
      .then((d) => {
        dbg('styled resolved', { cancelled, bytes: d.length, head: d.slice(0, 32) });
        if (!cancelled) setQrDataUrl(d);
      })
      .catch(async (err) => {
        dbg('styled rejected', { cancelled, err: String((err as Error)?.message ?? err) });
        clientLogger.error('[ClaimQrDesignerModal] styled QR preview failed — falling back to classic:', { detail: err });
        try {
          const d = await generateQrDataUrl({
            data: url,
            exportSize: 512,
            styled: false,
            errorCorrection: 'H',
            logoUrl: opts.logoUrl,
            logoShape: opts.logoShape,
          });
          dbg('classic resolved', { cancelled, bytes: d.length });
          if (!cancelled) {
            setQrDataUrl(d);
            setPreviewFallback(true);
          }
        } catch (err2) {
          dbg('classic rejected', { err: String((err2 as Error)?.message ?? err2) });
          clientLogger.error('[ClaimQrDesignerModal] classic QR preview fallback failed:', { detail: err2 });
          if (!cancelled) setPreviewFailed(true);
        }
      });
    return () => {
      cancelled = true;
      dbg('cleanup');
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
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      // eslint-disable-next-line no-console
      console.info('[ClaimDesignerLogo] upload read', { type: file.type, size: file.size, head: dataUrl?.slice(0, 48) ?? null });
      setCustomLogoDataUrl(dataUrl);
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
      downloadDataUrl(dataUrl, `claim-qr-${variant}-${size}px.png`);
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
      qr.download({ name: `claim-qr-${variant}-${size}px`, extension: 'svg' });
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
      const blob = await directoryPresenceAdminService.downloadClaimInvitePostcardStyled(
        seedId,
        variant,
        dataUrl,
      );
      if (!blob) throw new Error('Download failed');
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `claim-postcard-${variant}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Failed to generate styled postcard');
    } finally {
      setDownloading(null);
    }
  };

  // Persist the shared claim design on the seed so every variant card's preview,
  // QR PNG, and Postcard PDF render it.
  const buildPersistedStyle = (): PersistedQrStyle => ({
    dotType,
    cornerType,
    cornerDotType,
    dotColor,
    cornerColor,
    cornerDotColor,
    bgColor,
    customColorsEnabled,
    gradientEnabled,
    gradientStart,
    gradientEnd,
    gradientOnDots,
    gradientOnCorners,
    gradientOnCornerDots,
    logo: logoEnabled,
    logoShape,
  });

  const handleSaveDesign = async () => {
    try {
      setSaving(true);
      setSaved(false);
      const style = buildPersistedStyle();
      const ok = await directoryPresenceAdminService.updateClaimQrStyle(seedId, style);
      if (!ok) throw new Error('Save failed');
      setSaved(true);
      setError(null);
      onSaved?.(style);
    } catch {
      setError('Failed to save the QR design');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
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
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Live preview */}
          <div className="flex justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Styled claim QR preview"
                className="rounded-lg border border-gray-200 shadow-sm"
                style={{ width: 256, height: 256 }}
                onLoad={() => {
                  // eslint-disable-next-line no-console
                  console.info(`[ClaimDesignerPreview #${previewRunRef.current}] img decoded`);
                }}
                onError={() => {
                  // eslint-disable-next-line no-console
                  console.warn(`[ClaimDesignerPreview #${previewRunRef.current}] img decode failed`);
                }}
              />
            ) : (
              <div className="w-64 h-64 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1">
                <QrCode className="w-10 h-10 text-gray-300" />
                {previewFailed && (
                  <span className="text-xs text-gray-400">Preview unavailable</span>
                )}
              </div>
            )}
          </div>
          {previewFallback && qrDataUrl && (
            <p className="text-center text-[11px] text-amber-600">
              Styled preview unavailable — showing the standard QR.
            </p>
          )}
          <p className="text-xs font-mono text-gray-500 break-all text-center">{url}</p>

          {/* Templates */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Template</label>
            <div className="grid grid-cols-3 gap-2">
              {(templates ? QR_TEMPLATE_LIST.filter((t) => templates.includes(t.name)) : QR_TEMPLATE_LIST).map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t.name)}
                  className={`px-3 py-2 text-xs rounded-md border text-left ${
                    selectedTemplate === t.name
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

          {/* Dot style */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Dot Style</label>
            <div className="grid grid-cols-3 gap-1.5">
              {DOT_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setDotType(s.value)}
                  className={`p-2 rounded border text-xs ${
                    dotType === s.value
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300'
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
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Corner Style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNER_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setCornerType(s.value)}
                    className={`p-2 rounded border text-xs ${
                      cornerType === s.value
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Corner Dot</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CORNER_DOT_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setCornerDotType(s.value)}
                    className={`p-2 rounded border text-xs ${
                      cornerDotType === s.value
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Platform logo */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={logoEnabled}
                onChange={(e) => setLogoEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <ImageIcon className="w-3.5 h-3.5 text-neutral-400" />
              Center platform logo
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
                    <span className="text-[11px] text-neutral-600">Prospect logo</span>
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

          {/* Custom colors */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
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
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
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
                <div className="flex gap-4 text-xs text-neutral-600">
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
            <span className="text-xs font-medium text-neutral-600">Export size:</span>
            <div className="flex gap-1">
              {SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSize(opt.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border ${
                    size === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end items-center">
          {saved && (
            <span className="mr-auto text-xs text-emerald-600">
              Saved — the cards render this design
            </span>
          )}
          <button
            onClick={handleSaveDesign}
            disabled={saving}
            title="Save this design — every claim card's preview, QR PNG, and Postcard PDF renders it"
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save design'}
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading === 'png' ? 'Generating…' : 'PNG'}
          </button>
          <button
            onClick={handleDownloadSvg}
            disabled={downloading !== null || logoEnabled}
            title={logoEnabled ? 'SVG download not available with logo overlay' : ''}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {downloading === 'svg' ? 'Generating…' : 'SVG'}
          </button>
          {allowPostcard && (
            <button
              onClick={handleStyledPostcard}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              {downloading === 'postcard' ? 'Generating…' : 'Styled postcard PDF'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
