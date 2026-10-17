'use client';

/**
 * FlyerReportButton — public reactive-moderation affordance (spec §10).
 * Renders a quiet footer link that opens a minimal reason picker; posts to
 * /api/public/flyer/:code/report via PublicFlyerService.
 */

import { useState } from 'react';
import { publicFlyerService } from '@/services/PublicFlyerService';

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'misleading', label: 'Misleading or false' },
  { value: 'ip_infringement', label: 'Uses my content without permission' },
  { value: 'prohibited_item', label: 'Prohibited or restricted item' },
  { value: 'other', label: 'Something else' },
];

export default function FlyerReportButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    if (!reason) return;
    setState('sending');
    try {
      await publicFlyerService.reportFlyer(code, reason, detail || undefined);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return <p className="text-xs text-neutral-400">Thanks — our team will review this flyer.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-400 hover:text-neutral-600 underline underline-offset-2">
        Report this flyer
      </button>
    );
  }

  return (
    <div className="max-w-sm space-y-2 text-left">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
      >
        <option value="">What's wrong with this flyer?</option>
        {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        maxLength={2000}
        className="w-full text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!reason || state === 'sending'}
          className="text-xs font-medium rounded-lg px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-40"
        >
          {state === 'sending' ? 'Sending…' : 'Submit report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">Cancel</button>
        {state === 'error' && <span className="text-xs text-red-500">Couldn't send — try again</span>}
      </div>
    </div>
  );
}
