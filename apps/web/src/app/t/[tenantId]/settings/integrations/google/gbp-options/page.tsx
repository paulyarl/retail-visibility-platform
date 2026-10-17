'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Star, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { clientLogger } from '@/lib/client-logger';

/**
 * GBP display settings — the merchant soft gate for the gbp_management module.
 *
 * The hard gate (tier / BSaaS purchase / admin grant) decides whether the
 * merchant *has* GBP surfacing; these toggles decide whether entitled content
 * is *displayed* on public pages. Toggling off never revokes the capability.
 *
 * Backed by GET/PUT /api/tenants/:tenantId/gbp-options.
 */
export default function GbpOptionsSettingsPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const { data: capabilities } = useAllCapabilities(tenantId || null);
  const gbp = capabilities?.gbpManagement;
  const canShowReviews = !!gbp?.canShowReviews;
  const canShowContent = !!gbp?.canShowContent;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewsDisplay, setReviewsDisplay] = useState(true);
  const [contentDisplay, setContentDisplay] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const settings = await platformHomeService.getGbpOptionsSettings(tenantId);
        if (settings) {
          setReviewsDisplay(settings.gbp_reviews_display);
          setContentDisplay(settings.gbp_content_display);
        }
      } catch (err) {
        clientLogger.error('Failed to load GBP display settings:', { detail: err });
        setError('Failed to load display settings.');
      } finally {
        setLoading(false);
      }
    }
    if (tenantId) load();
  }, [tenantId]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      await platformHomeService.updateGbpOptionsSettings(tenantId, {
        gbp_reviews_display: reviewsDisplay,
        gbp_content_display: contentDisplay,
      });
      setSaved(true);
    } catch (err) {
      clientLogger.error('Failed to save GBP display settings:', { detail: err });
      setError('Failed to save display settings.');
    } finally {
      setSaving(false);
    }
  }

  if (accessLoading || loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="h-40 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Settings</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations/google`} className="hover:text-neutral-700 dark:hover:text-neutral-300">Google</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-neutral-900 dark:text-neutral-100">GBP Display</span>
      </div>

      <div className="mb-6">
        <Link
          href={`/t/${tenantId}/settings/integrations/google/advanced`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Advanced Features
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">GBP Display Settings</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Choose whether your Google reviews, posts, and photos appear on your public pages. Turning these off never
          affects your plan — the content just stops rendering.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Display settings saved.
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
        <ToggleRow
          icon={Star}
          label="Show Google reviews"
          description="Display your Google reviews and aggregate rating on your directory and place pages."
          checked={reviewsDisplay}
          onChange={(v) => { setReviewsDisplay(v); setSaved(false); }}
          entitled={canShowReviews}
          featureHref={`/t/${tenantId}/settings/feature-store?feature=gbp_directory_reviews`}
        />
        <ToggleRow
          icon={ImageIcon}
          label="Show Google posts & photos"
          description="Display your Google posts and photos on your directory and place pages."
          checked={contentDisplay}
          onChange={(v) => { setContentDisplay(v); setSaved(false); }}
          entitled={canShowContent}
          featureHref={`/t/${tenantId}/settings/feature-store?feature=gbp_directory_content`}
        />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save display settings
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon, label, description, checked, onChange, entitled, featureHref,
}: {
  icon: typeof Star;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  entitled: boolean;
  featureHref: string;
}) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
      entitled ? 'cursor-pointer border-neutral-200 dark:border-neutral-700 hover:border-neutral-300' : 'border-neutral-200 dark:border-neutral-700 opacity-70'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!entitled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-neutral-300 dark:border-neutral-600"
      />
      <Icon className="w-5 h-5 mt-0.5 text-neutral-500" />
      <div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        {!entitled && (
          <Link href={featureHref} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Not included in your plan — activate it
          </Link>
        )}
      </div>
    </label>
  );
}
