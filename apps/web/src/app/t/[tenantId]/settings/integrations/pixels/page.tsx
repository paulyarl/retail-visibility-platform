'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  AlertTriangle,
  Lock,
  Save,
  Camera,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { socialPixelsService } from '@/services/SocialPixelsService';
import type { PixelConfig } from '@/services/SocialPixelsService';

export default function SocialPixelsSettingsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading, accessReason, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [config, setConfig] = useState<PixelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [tiktokPixelId, setTiktokPixelId] = useState('');
  const [tiktokAccessToken, setTiktokAccessToken] = useState('');

  async function fetchConfig() {
    try {
      setLoading(true);
      const data = await socialPixelsService.getPixelConfig(tenantId);
      if (data) {
        setConfig(data);
        setMetaPixelId(data.metaPixelId || '');
        setMetaAccessToken(data.metaAccessToken || '');
        setTiktokPixelId(data.tiktokPixelId || '');
        setTiktokAccessToken(data.tiktokAccessToken || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const data = await socialPixelsService.updatePixelConfig(tenantId, {
        metaPixelId: metaPixelId || null,
        metaAccessToken: metaAccessToken || null,
        tiktokPixelId: tiktokPixelId || null,
        tiktokAccessToken: tiktokAccessToken || null,
      });

      setConfig(data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
    }
  }, [tenantId]);

  if (accessLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3 mb-4"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
            <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700">Settings</Link>
            <span>/</span>
            <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700">Integrations</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">Social Pixels</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Social Pixels</h1>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full mb-4">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Access Restricted</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4 max-w-2xl mx-auto">
            {accessReason || 'Only store owners and administrators can manage social pixel configuration.'}
          </p>
          {tenantRole && (
            <p className="text-sm text-neutral-500">Your current role: <span className="font-medium">{tenantRole}</span></p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto dark:bg-neutral-800">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
          <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Settings</Link>
          <span>/</span>
          <Link href={`/t/${tenantId}/settings/integrations`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Integrations</Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">Social Pixels</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-3">
            <Camera className="w-8 h-8 text-pink-500" />
            <Share2 className="w-8 h-8 text-blue-600" />
            Social Pixels
          </h1>
          <p className="text-neutral-600 dark:text-gray-300">
            Track conversions for Meta Ads and TikTok Ads with pixel-based tracking and server-side Conversions API.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <p className="text-green-800 dark:text-green-200">Pixel configuration saved successfully!</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
          <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      ) : (
        <>
          {/* Meta Pixel Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-pink-500" />
              Meta (Facebook) Pixel
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Track Meta Ads conversions. The pixel ID is injected on your storefront for client-side tracking.
              The access token enables server-side Conversions API events for improved attribution.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                  Meta Pixel ID
                </label>
                <input
                  type="text"
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Find in Meta Events Manager &gt; Data Sources &gt; Pixel.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                  Meta Conversions API Access Token
                </label>
                <input
                  type="password"
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                  placeholder="Optional — for server-side tracking"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Generate in Meta Events Manager &gt; Settings &gt; Conversions API.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <a
                href="https://www.facebook.com/business/help/952192354843755"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Meta Pixel setup guide <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* TikTok Pixel Card */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
              <Share2 className="w-5 h-5 text-blue-600" />
              TikTok Pixel
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Track TikTok Ads conversions. The pixel ID is injected on your storefront for client-side tracking.
              The access token enables server-side Events API events.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                  TikTok Pixel ID
                </label>
                <input
                  type="text"
                  value={tiktokPixelId}
                  onChange={(e) => setTiktokPixelId(e.target.value)}
                  placeholder="e.g. C8XXXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Find in TikTok Ads Manager &gt; Assets &gt; Events &gt; Pixel.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
                  TikTok Events API Access Token
                </label>
                <input
                  type="password"
                  value={tiktokAccessToken}
                  onChange={(e) => setTiktokAccessToken(e.target.value)}
                  placeholder="Optional — for server-side tracking"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Generate in TikTok Ads Manager &gt; Events &gt; Settings &gt; Events API.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <a
                href="https://ads.tiktok.com/help/article/get-started-pixel"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                TikTok Pixel setup guide <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Configuration
                </>
              )}
            </button>
            <Link
              href={`/t/${tenantId}/settings/integrations`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
            >
              ← Back to Integrations
            </Link>
          </div>

          {/* Tracked Events info */}
          <div className="mt-8 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-3">Tracked Events</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-neutral-700 dark:text-neutral-300"><strong>PageView</strong> — on every page load</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-neutral-700 dark:text-neutral-300"><strong>ViewContent</strong> — on product pages</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-neutral-700 dark:text-neutral-300"><strong>InitiateCheckout</strong> — on checkout page</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-neutral-700 dark:text-neutral-300"><strong>Purchase</strong> — on checkout success (client + server)</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
