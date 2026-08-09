'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Link2, Copy, RefreshCw, Check, Clock, AlertCircle, ImageIcon, Trash2, ExternalLink } from 'lucide-react';
import marketingOpsService, {
  CampaignDetail,
  MarketingFile,
  GalleryToken,
  GalleryTokenParams,
} from '@/services/MarketingOpsService';

interface GalleryPanelProps {
  campaignId: string;
  campaign: CampaignDetail;
  onRefresh: () => void;
}

export default function GalleryPanel({ campaignId, campaign }: GalleryPanelProps) {
  const [screenshots, setScreenshots] = useState<MarketingFile[]>([]);
  const [galleryTokens, setGalleryTokens] = useState<GalleryToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [useShortUrl, setUseShortUrl] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate modal state
  const [expiryDays, setExpiryDays] = useState(3);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [gallerySubtitle, setGallerySubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Start Recovery');
  const [frictionRows, setFrictionRows] = useState<{ key: string; value: string }[]>([]);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [files, tokens] = await Promise.all([
        marketingOpsService.listFiles(campaignId),
        marketingOpsService.listGalleryTokens(campaignId),
      ]);
      setScreenshots(files.filter((f) => f.file_type === 'diagnostic_screenshot'));
      setGalleryTokens(tokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery data');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await marketingOpsService.uploadDiagnosticScreenshot(campaignId, file);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const params: GalleryTokenParams = {
        expiryDays,
        galleryTitle: galleryTitle || undefined,
        gallerySubtitle: gallerySubtitle || undefined,
        ctaLabel: ctaLabel || undefined,
        frictionSummary: frictionRows.length > 0
          ? Object.fromEntries(frictionRows.filter((r) => r.key).map((r) => [r.key, r.value]))
          : undefined,
      };
      await marketingOpsService.generateGalleryToken(campaignId, params);
      await fetchData();
      setShowGenerateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const addFrictionRow = () => {
    setFrictionRows([...frictionRows, { key: '', value: '' }]);
  };

  const removeFrictionRow = (idx: number) => {
    setFrictionRows(frictionRows.filter((_, i) => i !== idx));
  };

  const updateFrictionRow = (idx: number, field: 'key' | 'value', value: string) => {
    setFrictionRows(frictionRows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const packagePriceCents = (campaign as any).package_price_cents ?? null;
  const ctaAmountDisplay = packagePriceCents != null ? `$${(packagePriceCents / 100).toFixed(2)}` : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Screenshot Upload Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-gray-500" />
              Diagnostic Screenshots
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload screenshots of the diagnostic findings (PNG, JPEG, WebP — max 10MB)
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? 'Uploading...' : 'Upload Screenshot'}
            </button>
          </div>
        </div>

        {screenshots.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No screenshots uploaded yet.</p>
            <p className="text-xs mt-1">Upload at least 1 screenshot before generating a gallery link.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {screenshots.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{s.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {s.file_size ? `${(s.file_size / 1024).toFixed(1)} KB` : '—'}
                      {s.mime_type ? ` · ${s.mime_type}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {s.uploaded_at ? new Date(s.uploaded_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery Token Generation Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-gray-500" />
              Gallery Links
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Generate expiring tokenized URLs for the prospect to view their diagnostic gallery
            </p>
            {galleryTokens.some((t) => t.short_code) && (
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useShortUrl}
                  onChange={(e) => setUseShortUrl(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 dark:border-neutral-600"
                />
                Use short URLs (SMS-friendly /g/…)
              </label>
            )}
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            disabled={screenshots.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={screenshots.length === 0 ? 'Upload at least 1 screenshot first' : 'Generate a new gallery link'}
          >
            <Link2 className="h-4 w-4" />
            Generate Gallery Link
          </button>
        </div>

        {galleryTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No gallery links generated yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {galleryTokens.map((t) => {
              const longGalleryUrl = `${window.location.origin}/preview/${t.token}`;
              const shortGalleryUrl = t.short_code ? `${window.location.origin}/g/${t.short_code}` : null;
              const galleryUrl = useShortUrl && shortGalleryUrl ? shortGalleryUrl : longGalleryUrl;
              const isExpired = t.expires_at ? new Date(t.expires_at) < new Date() : false;
              const isViewed = !!t.viewed_at;
              const isConverted = !!t.converted_at;
              return (
                <div
                  key={t.id}
                  className="p-4 bg-gray-50 dark:bg-neutral-700/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {t.gallery_archetype && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                          {t.gallery_archetype}
                        </span>
                      )}
                      {isConverted && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">
                          Converted
                        </span>
                      )}
                      {isViewed && !isConverted && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
                          Viewed
                        </span>
                      )}
                      {isExpired && !isConverted && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded">
                          Expired
                        </span>
                      )}
                      {!isViewed && !isExpired && !isConverted && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-neutral-600 dark:text-gray-300 rounded">
                          Pending
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {t.expires_at ? `Expires ${new Date(t.expires_at).toLocaleDateString()}` : 'No expiry'}
                    </span>
                  </div>
                  {t.gallery_title && (
                    <p className="text-sm font-medium">{t.gallery_title}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white dark:bg-neutral-900 px-2 py-1 rounded border border-gray-200 dark:border-neutral-600 truncate">
                      {galleryUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(galleryUrl)}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded"
                      title="Copy URL"
                    >
                      {copiedUrl === galleryUrl ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    <a
                      href={galleryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-500" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Generate Gallery Link</h3>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* TTL selector */}
              <div>
                <label className="block text-sm font-medium mb-1">Link TTL (days)</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days (default)</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>

              {/* Gallery title */}
              <div>
                <label className="block text-sm font-medium mb-1">Gallery Title</label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={(e) => setGalleryTitle(e.target.value)}
                  placeholder="e.g. Review Recovery Diagnostic"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to use archetype default</p>
              </div>

              {/* Gallery subtitle */}
              <div>
                <label className="block text-sm font-medium mb-1">Gallery Subtitle</label>
                <input
                  type="text"
                  value={gallerySubtitle}
                  onChange={(e) => setGallerySubtitle(e.target.value)}
                  placeholder="e.g. We found 3 critical issues affecting your online reputation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                />
              </div>

              {/* Friction summary builder */}
              <div>
                <label className="block text-sm font-medium mb-1">Friction Summary</label>
                <div className="space-y-2">
                  {frictionRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => updateFrictionRow(idx, 'key', e.target.value)}
                        placeholder="Label (e.g. BBB Grade)"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => updateFrictionRow(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. F)"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                      />
                      <button
                        onClick={() => removeFrictionRow(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addFrictionRow}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Add friction row
                  </button>
                </div>
              </div>

              {/* CTA label */}
              <div>
                <label className="block text-sm font-medium mb-1">CTA Label</label>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Start Recovery"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-sm"
                />
              </div>

              {/* CTA amount (read-only) */}
              <div>
                <label className="block text-sm font-medium mb-1">CTA Amount (from package price)</label>
                <input
                  type="text"
                  value={ctaAmountDisplay}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-gray-100 dark:bg-neutral-700/50 text-sm text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Auto-filled from campaign package price — read-only
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {generating ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
