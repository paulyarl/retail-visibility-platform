'use client';

/**
 * LaneDeliveryModePanel — the DFY/DIY delivery lane for the review (PB-02) and
 * recovery (PB-04) motions.
 *
 * The website lane has its own home (`WebsiteBuildExecutionCard`, scope-gated
 * by `BUILD_SCOPE_MODES`). The review and recovery lanes share one shape: the
 * platform produces the written case either way, and the fork is who it lands
 * with —
 *
 *   review    DIY — the platform drafted the responses; the OWNER posts them.
 *             DFY — the platform posts them on the owner's behalf.
 *   recovery  DIY — the platform drafted the resolution/appeal; the OWNER files.
 *             DFY — the platform files on the owner's behalf.
 *
 * Recorded in `playbook_decision` — the playbook-agnostic decision column
 * (migration 309) — namespaced by `kind`. `campaign.pipeline` picks the lane,
 * so one panel serves both.
 *
 * Self-gates: renders nothing outside a business-scope review/recovery lane.
 * Fully prop-driven (no fetch), so it renders statically in tests.
 */

import { useState } from 'react';
import { Truck } from 'lucide-react';
import marketingOpsService, {
  type Campaign,
  type WebsiteBuildDeliveryMode,
} from '@/services/MarketingOpsService';

type Lane = 'review' | 'recovery';

/** The decision `kind` each lane writes — a literal union so the read below
 *  narrows the `playbook_decision` union instead of widening it. */
type LaneKind = 'review_delivery_mode' | 'recovery_delivery_mode';

const LANE_COPY: Record<Lane, { title: string; kind: LaneKind; diy: string; dfy: string }> = {
  review: {
    title: 'Review response delivery',
    kind: 'review_delivery_mode',
    diy: 'DIY — we draft the responses, the owner posts them',
    dfy: 'DFY — we post the responses for the owner',
  },
  recovery: {
    title: 'Recovery package delivery',
    kind: 'recovery_delivery_mode',
    diy: 'DIY — we draft the resolution and appeal, the owner files them',
    dfy: 'DFY — we file the resolution and appeal for the owner',
  },
};

export default function LaneDeliveryModePanel({
  campaign,
  onRefresh,
}: {
  campaign: Campaign;
  onRefresh: () => void | Promise<void>;
}) {
  const lane: Lane | null =
    campaign.scope === 'business'
      ? campaign.pipeline === 'recovery'
        ? 'recovery'
        : campaign.pipeline === 'review'
          ? 'review'
          : null
      : null;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lane) return null;
  const copy = LANE_COPY[lane];

  // The column holds one decision discriminated by `kind`; read only this lane's.
  const decision = campaign.playbook_decision;
  const current: WebsiteBuildDeliveryMode | null =
    decision?.kind === copy.kind ? decision.delivery_mode : null;

  const [mode, setMode] = useState<WebsiteBuildDeliveryMode>(current ?? 'diy');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (lane === 'recovery') {
        await marketingOpsService.setRecoveryDeliveryMode(campaign.id, mode);
      } else {
        await marketingOpsService.setReviewDeliveryMode(campaign.id, mode);
      }
      await onRefresh();
    } catch (e) {
      setError((e as Error).message || 'Failed to set the delivery lane');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{copy.title}</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Who the finished work lands with. The platform produces the written case either way — this
        picks whether the owner posts or files it, or we do it on their behalf.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Delivery lane
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as WebsiteBuildDeliveryMode)}
            className="w-72 text-xs rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-gray-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-300"
          >
            <option value="diy">{copy.diy}</option>
            <option value="dfy">{copy.dfy}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving || mode === current}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : current ? 'Update lane' : 'Set lane'}
        </button>
        {current && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            Current: <span className="font-medium">{current.toUpperCase()}</span>
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
