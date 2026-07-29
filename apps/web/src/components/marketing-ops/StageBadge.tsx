'use client';

import { CampaignStage } from '@/services/MarketingOpsService';

const STAGE_LABELS: Record<CampaignStage, string> = {
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
};

const STAGE_COLORS: Record<CampaignStage, string> = {
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
};

export function StageBadge({ stage, size = 'sm' }: { stage: CampaignStage; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-800'} ${sizeClasses}`}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export { STAGE_LABELS, STAGE_COLORS };
