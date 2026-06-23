'use client';

import { deriveInternalStatus, type InternalStatus } from '@/lib/subscription-status';

interface SubscriptionStatusPanelProps {
  subscriptionStatus: string;
  subscriptionTier: string;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
}

const PANEL_CONFIG: Record<string, { bg: string; border: string; text: string; message: string }> = {
  frozen: {
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    message: 'This store is in read-only mode. Online ordering and some features are temporarily unavailable.',
  },
  canceled: {
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    message: 'This store is in read-only mode. Online ordering and some features are temporarily unavailable.',
  },
  expired: {
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    message: 'This store is in read-only mode. Online ordering and some features are temporarily unavailable.',
  },
  maintenance: {
    bg: 'bg-yellow-50/80 dark:bg-yellow-950/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
    message: 'This store is in maintenance mode. Some features are temporarily limited.',
  },
  past_due: {
    bg: 'bg-amber-50/80 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    message: 'This store is operating with limited features. Please check back soon.',
  },
};

export function SubscriptionStatusPanel({
  subscriptionStatus,
  subscriptionTier,
  trialEndsAt,
  subscriptionEndsAt,
}: SubscriptionStatusPanelProps) {
  const internalStatus: InternalStatus = deriveInternalStatus({
    subscriptionStatus,
    subscriptionTier,
    trialEndsAt,
    subscriptionEndsAt,
  });

  const config = PANEL_CONFIG[internalStatus];
  if (!config) return null;

  return (
    <div className={`${config.bg} ${config.border} border-b px-4 py-2.5`}>
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <svg className={`w-4 h-4 flex-shrink-0 ${config.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className={`text-sm ${config.text} font-medium`}>{config.message}</p>
      </div>
    </div>
  );
}
