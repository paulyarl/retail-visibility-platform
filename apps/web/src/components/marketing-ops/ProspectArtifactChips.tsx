'use client';

/**
 * ProspectArtifactChips — tier-0 "click to open" artifact matrix row
 * (PG stage-culture fit §6.4, modeled on the coverage page's state chips).
 *
 * One chip per business artifact surface. Chips NAVIGATE ONLY — they never
 * mutate campaign/queue state; promotion, graduation, and dismissal stay
 * explicit actions in the cockpit's promote panel.
 *
 * Chip states:
 *   locked    — gray, non-clickable, title names the unlock condition.
 *               Pre-graduation prospects (no processed_campaign_id) only
 *               legitimately have seed + queue artifacts, so every
 *               campaign-scoped chip locks until graduation.
 *   available — links to the artifact's deep link. Campaign tabs are
 *               ?tab= deep links (PIPELINE_TABS); openers/follow-ups take
 *               ?campaign= which prefills the workspace dropdown.
 *
 * The audit chip is two-state (audited / no audit) — the only tier-0
 * presence signal the decorated queue row already carries. Gallery
 * tokens, deliverables, and opener counts are the tier-1 presence
 * decoration and render as plain available links until then.
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface Props {
  /** Queue entry's processed_campaign_id — chips unlock on graduation. */
  processedCampaignId?: string | null;
  /** Decorated flag: the processed campaign has a business_analysis audit. */
  hasBusinessAudit?: boolean | null;
  businessAuditAt?: string | null;
  /** Decorated completed-checklist-step count (raw count — playbook
   *  denominators vary, so this is a progress signal, not a fraction). */
  checklistCompleted?: number | null;
}

const CAMPAIGNS_BASE = '/settings/admin/marketing-ops/campaigns';

const chipBase =
  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border flex-shrink-0';
const chipLocked =
  'bg-gray-50 text-gray-400 border-gray-200 dark:bg-neutral-800 dark:text-gray-500 dark:border-neutral-700 cursor-not-allowed';
const chipAvailable =
  'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-neutral-900 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-neutral-800';
const chipWarn =
  'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';

export default function ProspectArtifactChips({ processedCampaignId, hasBusinessAudit, businessAuditAt, checklistCompleted }: Props) {
  const campaignId = processedCampaignId ?? null;
  const locked = !campaignId;
  const lockTitle = 'Locked — prospect has no campaign yet. Graduate it from the queue first.';

  type Chip = { key: string; label: string; href: string; warn?: boolean; title?: string };

  const chips: Chip[] = [
    {
      key: 'audit',
      label: hasBusinessAudit === true ? 'audited' : 'audit',
      href: `${CAMPAIGNS_BASE}/${campaignId}?tab=audits`,
      warn: hasBusinessAudit !== true,
      title: hasBusinessAudit === true
        ? `Business audit ${businessAuditAt ? new Date(businessAuditAt).toLocaleDateString() : 'on file'} — open Audits tab`
        : 'No business_analysis audit yet — run it before seeding for richer listing data',
    },
    {
      key: 'checklist',
      label: checklistCompleted != null && checklistCompleted > 0 ? `checklist · ${checklistCompleted} done` : 'checklist',
      href: `${CAMPAIGNS_BASE}/${campaignId}?tab=checklist`,
      title: 'Checklist — data-driven operator steps (seek/seed/preview_built stage tags)',
    },
    { key: 'outreach', label: 'outreach', href: `${CAMPAIGNS_BASE}/${campaignId}?tab=outreach-prep`, title: 'Outreach prep — hooks, subject lines, call script' },
    { key: 'gallery', label: 'gallery', href: `${CAMPAIGNS_BASE}/${campaignId}?tab=gallery`, title: 'Diagnostic gallery — shareable preview links' },
    { key: 'openers', label: 'openers', href: `/settings/admin/marketing-ops/openers?campaign=${campaignId}` },
    { key: 'follow-ups', label: 'follow-ups', href: `/settings/admin/marketing-ops/follow-ups?campaign=${campaignId}` },
    { key: 'deliverables', label: 'deliverables', href: `${CAMPAIGNS_BASE}/${campaignId}?tab=deliverables` },
  ];

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {chips.map((chip) =>
        locked ? (
          <span key={chip.key} className={`${chipBase} ${chipLocked}`} title={lockTitle}>
            <Lock className="w-2.5 h-2.5" />
            {chip.label}
          </span>
        ) : (
          <Link
            key={chip.key}
            href={chip.href}
            className={`${chipBase} ${chip.warn ? chipWarn : chipAvailable}`}
            title={chip.title}
          >
            {chip.label}
          </Link>
        ),
      )}
    </span>
  );
}
