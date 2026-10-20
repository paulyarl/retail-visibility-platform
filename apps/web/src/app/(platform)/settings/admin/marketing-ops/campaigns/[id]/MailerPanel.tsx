'use client';

/**
 * MailerPanel — postcard composer on the Outreach Kit tab. The mailer is the
 * print front-end to the diagnostic gallery backend: the operator bundles
 * the headline/body copy with an explicit QR destination (auto / gallery /
 * claim / portal / site / custom) and can style the QR via the shared
 * qr-engine designer (MailerQrDesignerModal) before generating the PDF.
 *
 * QR resolution is lazy — "Design QR" is the only client-side trigger for
 * resolveQrTarget, since resolving mints/reuses the destination token. The
 * resolved URL is re-resolved server-side at generate time with reuse-or-mint
 * semantics, so the styled QR and the PDF always encode the same landing.
 *
 * The gallery destination is token-aware: minting a fresh link needs gallery
 * eligibility, but encoding an existing one doesn't, so a seek/seed campaign
 * that minted at preview_built can still print that link.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, QrCode, AlertCircle, ExternalLink, Palette } from 'lucide-react';
import marketingOpsService, {
  CampaignDetail,
  GalleryEligibility,
  GalleryToken,
  MailerQrDestination,
  MailerQrTarget,
} from '@/services/MarketingOpsService';
import { generateQrDataUrl } from '@/lib/qr-engine';
import {
  canMintGalleryLink,
  defaultGalleryTokenId,
  filterLiveGalleryTokens,
  galleryTokenLabel,
  resolveMailerDestinations,
} from '@/lib/mailer-qr-destinations';
import MailerQrDesignerModal from './MailerQrDesignerModal';

const MAILER_STAGES = ['seek', 'seed', 'preview_built'];

interface MailerPanelProps {
  campaignId: string;
  campaign: CampaignDetail;
}

export default function MailerPanel({ campaignId, campaign }: MailerPanelProps) {
  const mailerAllowed =
    campaign.scope === 'business' && MAILER_STAGES.includes(campaign.stage ?? '');

  const [mailerMode, setMailerMode] = useState<'ai' | 'import'>('ai');
  const [importHeadline, setImportHeadline] = useState('');
  const [importBody, setImportBody] = useState('');
  const [qrDestination, setQrDestination] = useState<MailerQrDestination>('auto');
  const [customUrl, setCustomUrl] = useState('');
  const [styledQrDataUrl, setStyledQrDataUrl] = useState<string | null>(null);
  const [resolvedTarget, setResolvedTarget] = useState<MailerQrTarget | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [resolvingQr, setResolvingQr] = useState(false);
  const [plainPreviewUrl, setPlainPreviewUrl] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<GalleryEligibility | null>(null);
  const [galleryTokens, setGalleryTokens] = useState<GalleryToken[]>([]);
  const [galleryTokenId, setGalleryTokenId] = useState('');
  const [mailerLoading, setMailerLoading] = useState(false);
  const [mailerError, setMailerError] = useState<string | null>(null);

  // Four-Act confirm page (act 2) — the desk-picked fact is stored on the
  // token metadata so the printed postcard and the page cannot drift.
  const [confirmFact, setConfirmFact] = useState('');
  const [confirmMintBusy, setConfirmMintBusy] = useState(false);
  const [confirmMintResult, setConfirmMintResult] = useState<{
    token: string;
    shortCode: string | null;
    url: string;
    qrUrl: string;
  } | null>(null);
  const [confirmMintError, setConfirmMintError] = useState<string | null>(null);

  const handleMintConfirmPage = async () => {
    if (!confirmFact.trim()) {
      setConfirmMintError('Enter the fact the page should confirm.');
      return;
    }
    setConfirmMintBusy(true);
    setConfirmMintError(null);
    setConfirmMintResult(null);
    try {
      const result = await marketingOpsService.mintConfirmPage(campaignId, {
        field: 'desk_fact',
        label: confirmFact.trim(),
      });
      setConfirmMintResult(result);
    } catch (err) {
      setConfirmMintError(err instanceof Error ? err.message : 'Failed to mint the confirm page');
    } finally {
      setConfirmMintBusy(false);
    }
  };

  // Gallery eligibility + existing links for the destination picker (degrade
  // silently — the server validates hard at resolve/generate time anyway).
  useEffect(() => {
    if (!mailerAllowed) return;
    marketingOpsService
      .getGalleryEligibility(campaignId)
      .then(setEligibility)
      .catch(() => setEligibility(null));
    marketingOpsService
      .listGalleryTokens(campaignId)
      .then(setGalleryTokens)
      .catch(() => setGalleryTokens([]));
  }, [campaignId, mailerAllowed]);

  const galleryMintEligible = canMintGalleryLink(eligibility);
  const liveGalleryTokens = useMemo(() => filterLiveGalleryTokens(galleryTokens), [galleryTokens]);
  const isGalleryDestination =
    qrDestination === 'diagnostic_gallery' || qrDestination === 'cascade_gallery';

  // Live links first; a pinned link that has since expired stays selectable so
  // the picker never renders blank on a value the operator already chose.
  const galleryTokenChoices = useMemo(() => {
    const pinned = galleryTokens.find((t) => t.id === galleryTokenId);
    return pinned && !liveGalleryTokens.some((t) => t.id === pinned.id)
      ? [pinned, ...liveGalleryTokens]
      : liveGalleryTokens;
  }, [galleryTokens, galleryTokenId, liveGalleryTokens]);

  // A destination change invalidates a previously resolved/designed QR — it
  // encodes the old target's URL.
  const changeDestination = (value: MailerQrDestination) => {
    setQrDestination(value);
    // Reuse-or-mint needs eligibility; encoding an existing link doesn't, so
    // default to the newest live link when a fresh one can't be minted.
    setGalleryTokenId(defaultGalleryTokenId(eligibility, liveGalleryTokens));
    setStyledQrDataUrl(null);
    setResolvedTarget(null);
    setPlainPreviewUrl(null);
    setMailerError(null);
  };

  const resolveQrTarget = useCallback(async () => {
    setResolvingQr(true);
    setMailerError(null);
    try {
      const target = await marketingOpsService.resolveMailerQrTarget(
        campaignId,
        qrDestination,
        qrDestination === 'custom' ? customUrl.trim() : undefined,
        isGalleryDestination && galleryTokenId ? galleryTokenId : undefined,
      );
      setResolvedTarget(target);
      return target;
    } catch (err) {
      setMailerError(err instanceof Error ? err.message : 'Failed to resolve QR target');
      return null;
    } finally {
      setResolvingQr(false);
    }
  }, [campaignId, qrDestination, customUrl, galleryTokenId]);

  const handlePreviewQr = useCallback(() => {
    void resolveQrTarget();
  }, [resolveQrTarget]);

  const handleDesignQr = useCallback(async () => {
    const target = resolvedTarget ?? (await resolveQrTarget());
    if (target) setDesignerOpen(true);
  }, [resolvedTarget, resolveQrTarget]);

  // Plain-QR preview for the artifact card once the target resolves — same
  // unstyled preview the seed QR kits render (styled:false, errorCorrection H).
  useEffect(() => {
    const url = resolvedTarget?.qrUrl;
    if (!url) {
      setPlainPreviewUrl(null);
      return;
    }
    let cancelled = false;
    generateQrDataUrl({ data: url, exportSize: 256, styled: false, errorCorrection: 'H' })
      .then((d) => {
        if (!cancelled) setPlainPreviewUrl(d);
      })
      .catch(() => {
        if (!cancelled) setPlainPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedTarget?.qrUrl]);

  const handleGenerateMailer = async (importCopy?: { headline: string; body: string }) => {
    setMailerLoading(true);
    setMailerError(null);
    // Popup-blocker safe: transient user activation expires ~5s after the
    // click, and generation can take 10s+ — open the tab inside the click
    // and navigate it once the blob exists.
    const tab = window.open('', '_blank');
    try {
      const result = await marketingOpsService.generateMailer(campaignId, {
        headline: importCopy?.headline,
        body: importCopy?.body,
        qrDestination,
        customUrl: qrDestination === 'custom' ? customUrl.trim() : undefined,
        galleryTokenId:
          isGalleryDestination && galleryTokenId ? galleryTokenId : undefined,
        qrDataUrl: styledQrDataUrl ?? undefined,
      });
      if (!result.success || !result.pdfUrl) {
        throw new Error(result.error || 'Failed to generate mailer');
      }
      if (tab) {
        tab.location.href = result.pdfUrl;
      } else {
        const link = document.createElement('a');
        link.href = result.pdfUrl;
        link.download = `postcard-${campaignId}.pdf`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(result.pdfUrl!), 60_000);
    } catch (err) {
      tab?.close();
      setMailerError(err instanceof Error ? err.message : 'Failed to generate mailer');
    } finally {
      setMailerLoading(false);
    }
  };

  const galleryOptionHint = eligibility?.eligible
    ? `${eligibility.screenshotCount} screenshot${eligibility.screenshotCount === 1 ? '' : 's'} · ${eligibility.archetype ?? ''}`
    : null;

  // Proactive gating — only offer destinations that can actually resolve, so
  // the operator can't pick a target that would 400 at resolve/generate.
  // Server still validates hard; the omission is advisory.
  const availableDestinations = useMemo(
    () => resolveMailerDestinations({ eligibility, liveGalleryTokens, campaign }),
    [eligibility, liveGalleryTokens, campaign.email, campaign.customer_id, campaign.date_paid],
  );

  const galleryOptionAvailable = availableDestinations.some(
    (o) => o.value === 'diagnostic_gallery' || o.value === 'cascade_gallery',
  );
  // Gallery picked on a campaign that can't mint and with nothing pinned —
  // resolve would 400, so the resolve/generate buttons stay disabled.
  const galleryNeedsToken = isGalleryDestination && !galleryMintEligible && !galleryTokenId;
  const qrActionDisabled =
    resolvingQr || (qrDestination === 'custom' && !customUrl.trim()) || galleryNeedsToken;

  // If the selected destination dropped out of the available set (e.g. the
  // eligibility fetch came back ineligible), fall back to auto. A gallery
  // selection that survives a losing-eligibility refetch re-pins to a live
  // link, since the reuse-or-mint sentinel would 400 on an ineligible campaign.
  useEffect(() => {
    if (!availableDestinations.some((o) => o.value === qrDestination)) {
      changeDestination('auto');
      return;
    }
    if (isGalleryDestination && !galleryMintEligible && !galleryTokenId) {
      setGalleryTokenId(defaultGalleryTokenId(eligibility, liveGalleryTokens));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDestinations, qrDestination, galleryMintEligible, galleryTokenId, liveGalleryTokens]);

  // Short print-runway warning — a QR that expires before the card lands is
  // dead on arrival. The /g/ short code still re-resolves to a live token,
  // but only when a successor exists.
  const tokenExpiryWarning = (() => {
    if (!resolvedTarget?.tokenExpiresAt) return null;
    const expiresAt = new Date(resolvedTarget.tokenExpiresAt);
    const daysLeft = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysLeft >= 7) return null;
    const label =
      resolvedTarget.qrDestination === 'claim'
        ? 'claim'
        : resolvedTarget.qrDestination === 'cascade_confirm'
          ? 'confirm page'
          : 'gallery';
    return `The ${label} link expires ${expiresAt.toLocaleDateString()} — tight for a mailed card. Regenerate a longer-lived link first, or proceed anyway.`;
  })();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <QrCode className="h-5 w-5 text-gray-500" />
          Postal Mailer
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          4×6″ postcard — the print front-end for the QR destination you pick below
        </p>
      </div>

      {!mailerAllowed ? (
        <p className="text-sm text-gray-400">
          The postcard mailer is available for business-scope campaigns at the seek, seed, or
          preview_built stage.
        </p>
      ) : (
        <div className="space-y-3">
          {/* QR destination */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
              QR destination
            </label>
            <select
              value={qrDestination}
              onChange={(e) => changeDestination(e.target.value as MailerQrDestination)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white"
            >
              {availableDestinations.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isGalleryDestination && galleryMintEligible && galleryOptionHint && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {galleryOptionHint}
              </p>
            )}
            {isGalleryDestination && !galleryMintEligible && (
              <p className="mt-1 text-[11px] text-amber-600">
                A new gallery link can't be minted for this campaign — the postcard will encode the
                existing link you pick.
              </p>
            )}
            {isGalleryDestination && galleryTokenChoices.length > 0 && (
              <select
                value={galleryTokenId}
                onChange={(e) => {
                  setGalleryTokenId(e.target.value);
                  setStyledQrDataUrl(null);
                  setResolvedTarget(null);
                }}
                className="mt-1.5 w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white"
              >
                {galleryMintEligible && <option value="">Latest live link (reuse or mint)</option>}
                {galleryTokenChoices.map((t) => (
                  <option key={t.id} value={t.id}>
                    {galleryTokenLabel(t)}
                  </option>
                ))}
              </select>
            )}
            {eligibility && !galleryOptionAvailable && (
              <p className="mt-1 text-[11px] text-amber-600">
                Diagnostic gallery isn't an option yet — {eligibility.action ?? eligibility.reason}
              </p>
            )}
            {qrDestination === 'custom' && (
              <input
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setStyledQrDataUrl(null);
                  setResolvedTarget(null);
                }}
                placeholder="https://…"
                className="mt-1.5 w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white"
              />
            )}
          </div>

          {/* QR artifact — same card pattern as the seed QR kits: preview +
              encoded URL + peer actions. Resolution stays lazy (it
              mints/reuses the destination token), so the preview appears
              after "Preview QR" or "Design". */}
          <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-3">
            <div className="flex justify-center">
              {styledQrDataUrl ? (
                <img
                  src={styledQrDataUrl}
                  alt="Styled QR preview"
                  className="w-28 h-28 rounded border border-gray-200 dark:border-neutral-600 bg-white"
                />
              ) : plainPreviewUrl ? (
                <img
                  src={plainPreviewUrl}
                  alt="QR preview"
                  className="w-28 h-28 rounded border border-gray-200 dark:border-neutral-600"
                />
              ) : (
                <div className="w-28 h-28 rounded border border-dashed border-gray-300 bg-gray-50 dark:bg-neutral-900 dark:border-neutral-600 flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-gray-300" />
                </div>
              )}
            </div>
            <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all bg-gray-50 dark:bg-neutral-900 rounded px-2 py-1.5">
              {resolvedTarget?.qrUrl ??
                'Resolve the QR target to see what the code will encode.'}
            </p>
            {resolvedTarget?.qrDestination === 'none' && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Auto found no claim, portal, or gallery link for this campaign, so the code encodes
                the platform home page. Pick a destination above to override it.
              </p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              {!resolvedTarget && (
                <button
                  onClick={handlePreviewQr}
                  disabled={qrActionDisabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50"
                  title="Resolve the QR landing URL and show a preview"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {resolvingQr ? 'Resolving…' : 'Preview QR'}
                </button>
              )}
              <button
                onClick={handleDesignQr}
                disabled={qrActionDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50"
                title="Open the styled QR designer — templates, colors, platform or custom logo"
              >
                <Palette className="w-3.5 h-3.5" />
                {resolvingQr ? 'Resolving…' : styledQrDataUrl ? 'Redesign' : 'Design'}
              </button>
              {styledQrDataUrl ? (
                <button
                  onClick={() => setStyledQrDataUrl(null)}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  Reset to plain QR
                </button>
              ) : (
                <span className="text-[11px] text-gray-400">
                  Optional — a plain QR is used if skipped
                </span>
              )}
            </div>
          </div>
          {tokenExpiryWarning && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300">{tokenExpiryWarning}</p>
            </div>
          )}

          {/* Copy mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMailerMode('ai'); setMailerError(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                mailerMode === 'ai'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300'
                  : 'border-gray-300 text-gray-600 dark:border-neutral-600 dark:text-gray-400'
              }`}
            >
              Generate with AI
            </button>
            <button
              onClick={() => { setMailerMode('import'); setMailerError(null); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                mailerMode === 'import'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300'
                  : 'border-gray-300 text-gray-600 dark:border-neutral-600 dark:text-gray-400'
              }`}
            >
              Import copy
            </button>
          </div>

          {mailerMode === 'ai' ? (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Runs triage archetype resolution + AI copy generation.
              </p>
              <button
                onClick={() => handleGenerateMailer()}
                disabled={mailerLoading || galleryNeedsToken}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {mailerLoading ? 'Generating...' : 'Generate Postcard PDF'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste a headline and body. To resolve the prompt for an external AI, use the{' '}
                <Link
                  href={`/settings/admin/marketing-ops/openers?campaign=${campaignId}`}
                  target="_blank"
                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
                >
                  Openers workspace
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
                .
              </p>
              <input
                value={importHeadline}
                onChange={(e) => setImportHeadline(e.target.value)}
                placeholder="Headline (5-10 words)"
                maxLength={120}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white"
              />
              <textarea
                value={importBody}
                onChange={(e) => setImportBody(e.target.value)}
                placeholder="Body (25-45 words)"
                rows={3}
                maxLength={400}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white"
              />
              <button
                onClick={() =>
                  handleGenerateMailer({
                    headline: importHeadline.trim(),
                    body: importBody.trim(),
                  })
                }
                disabled={mailerLoading || galleryNeedsToken || !importHeadline.trim() || !importBody.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {mailerLoading ? 'Generating...' : 'Generate PDF from imported copy'}
              </button>
            </div>
          )}

          {mailerError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{mailerError}</p>}
        </div>
      )}

      <div className="mt-5 rounded-lg border border-gray-200 dark:border-neutral-700 p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Confirm page (act 2)</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Names the desk-picked fact and leads onward to the gallery. The token is the
          destination for the act-2 postcard QR; the fact is stored on the token so the
          printed card and the page cannot drift.
        </p>
        <input
          type="text"
          value={confirmFact}
          onChange={(e) => setConfirmFact(e.target.value)}
          placeholder="e.g. Your Google listing shows a different phone than your Yelp page."
          className="mt-3 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleMintConfirmPage}
            disabled={confirmMintBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {confirmMintBusy ? 'Minting…' : 'Mint confirm page'}
          </button>
          {confirmMintError && (
            <span className="text-xs text-red-600 dark:text-red-400">{confirmMintError}</span>
          )}
        </div>
        {confirmMintResult && (
          <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            <p>
              Confirm page:{' '}
              <a
                href={confirmMintResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {confirmMintResult.url}
              </a>
            </p>
            <p>
              Tagged QR target:{' '}
              <a
                href={confirmMintResult.qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {confirmMintResult.qrUrl}
              </a>
            </p>
          </div>
        )}
      </div>

      <MailerQrDesignerModal
        open={designerOpen}
        onClose={() => setDesignerOpen(false)}
        url={resolvedTarget?.qrUrl ?? ''}
        title={campaign.business_name ?? 'Postcard'}
        onApply={setStyledQrDataUrl}
      />
    </div>
  );
}
