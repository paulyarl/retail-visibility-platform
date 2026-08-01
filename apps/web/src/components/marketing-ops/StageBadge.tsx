'use client';

import { CampaignStage } from '@/services/MarketingOpsService';

const STAGE_LABELS: Record<string, string> = {
  // Review pipeline stages
  seek: 'Seek',
  preview_built: 'Preview Built',
  shown: 'Shown',
  paid: 'Paid',
  delivered: 'Delivered',
  retainer_pitched: 'Retainer Pitched',
  retainer_won: 'Retainer Won',
  lost: 'Lost',
  dead: 'Dead',
  tenant_onboarded: 'Tenant Onboarded',
  // Recovery management stages
  audit_identified: 'Audit Identified',
  framework_preview_generated: 'Framework Preview',
  outreach_dispatched: 'Outreach Dispatched',
  awaiting_owner_intake: 'Awaiting Owner Intake',
  intake_submitted: 'Intake Submitted',
  final_resolution_drafted: 'Final Resolution Drafted',
  owner_approved: 'Owner Approved',
  resolved_and_closed: 'Resolved & Closed',
};

const STAGE_COLORS: Record<string, string> = {
  // Review pipeline stages
  seek: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  preview_built: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  shown: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  retainer_pitched: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  retainer_won: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  dead: 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  tenant_onboarded: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  // Recovery management stages
  audit_identified: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  framework_preview_generated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  outreach_dispatched: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  awaiting_owner_intake: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
  intake_submitted: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  final_resolution_drafted: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
  owner_approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  resolved_and_closed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
};

export const RECOVERY_STAGES = [
  'audit_identified',
  'framework_preview_generated',
  'outreach_dispatched',
  'awaiting_owner_intake',
  'intake_submitted',
  'final_resolution_drafted',
  'owner_approved',
  'resolved_and_closed',
  'dead',
] as const;

export function StageBadge({ stage, size = 'sm' }: { stage: string; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-800'} ${sizeClasses}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export { STAGE_LABELS, STAGE_COLORS };
