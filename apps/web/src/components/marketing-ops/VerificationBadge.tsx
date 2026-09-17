'use client';

/**
 * Verify-then-outreach status badge (Migration 255).
 *
 * Surfaces the outcome of the verification call on queue / cockpit prospect
 * rows. The tooltip lists the identity sources captured on the call (name,
 * phone, social + directory profiles) so the operator can see at a glance
 * whether a prospect carries authoritative verified identity.
 */

import { BadgeCheck, Ban, Clock, AlertTriangle, HelpCircle } from 'lucide-react';
import type { VerificationRecord } from '@/services/MarketingOpsService';

interface VerificationBadgeProps {
  verification: VerificationRecord | null | undefined;
}

const BASE =
  'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium align-middle';

const OUTCOME_META: Record<
  string,
  { label: string; className: string; Icon: typeof BadgeCheck }
> = {
  operational: {
    label: 'verified',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Icon: BadgeCheck,
  },
  relocated: {
    label: 'verified · relocated',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Icon: BadgeCheck,
  },
  closed: {
    label: 'closed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    Icon: Ban,
  },
  closed_temporarily: {
    label: 'temp closed',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    Icon: AlertTriangle,
  },
  unreachable: {
    label: 'unreachable',
    className: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    Icon: HelpCircle,
  },
  wrong_business: {
    label: 'wrong business',
    className: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    Icon: HelpCircle,
  },
};

export default function VerificationBadge({ verification }: VerificationBadgeProps) {
  if (!verification) return null;

  const outcome = verification.outcome;
  if (!outcome) {
    // Verification requested, not yet resolved — the prospect is in the gate.
    const requested = verification.requested_at
      ? `requested ${new Date(verification.requested_at).toLocaleDateString()}`
      : 'requested';
    return (
      <span className={`${BASE} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`} title={`Verification pending — ${requested}`}>
        <Clock className="w-2.5 h-2.5" />
        verify pending
      </span>
    );
  }

  const meta = OUTCOME_META[outcome] ?? {
    label: outcome.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300',
    Icon: HelpCircle,
  };
  const { label, className, Icon } = meta;

  const socialCount = verification.verified_social_profiles?.length ?? 0;
  const directoryCount = verification.verified_directory_profiles?.length ?? 0;
  const title = [
    `Verification: ${outcome.replace(/_/g, ' ')}`,
    verification.resolved_at ? `resolved ${new Date(verification.resolved_at).toLocaleDateString()}` : null,
    verification.verified_name ? `name: ${verification.verified_name}` : null,
    verification.verified_phone ? `phone: ${verification.verified_phone}` : null,
    verification.verified_address ? `address: ${verification.verified_address}` : null,
    socialCount > 0 ? `${socialCount} social profile${socialCount !== 1 ? 's' : ''}` : null,
    directoryCount > 0 ? `${directoryCount} directory profile${directoryCount !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <span className={`${BASE} ${className}`} title={title}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
