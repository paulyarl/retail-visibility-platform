'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Mail, Phone, Globe, Share2, CheckCircle, XCircle, AlertTriangle, Sparkles, Pencil, ArrowRight, PhoneCall } from 'lucide-react';
import marketingOpsService, { type Campaign, type ContactReadiness } from '@/services/MarketingOpsService';
import LogContactModal from './LogContactModal';

export type CascadeLevel = 'ready' | 'partial' | 'blocked';

export interface CascadeState {
  level: CascadeLevel;
  label: string;
  desc: string;
}

/**
 * Derive the cascade readiness status from contact flags.
 *
 * Mirrors the backend cascade gate: the sequence is only truly blocked when
 * NO contact channel exists (email, phone, or social) — the Recovery/Review
 * cascade services gate on `hasAnyChannel`. Email is special: it's the Day-1
 * channel and the universal fallback, so "email + a secondary" is the only
 * fully-ready state. A secondary-only campaign still fires its SMS/DM steps
 * (Day 1 email is skipped) → 'partial', not 'blocked'.
 */
export function resolveCascadeState(readiness: ContactReadiness): CascadeState {
  const hasSecondary = readiness.hasPhone || readiness.hasSocial;
  if (readiness.hasEmail && hasSecondary) {
    return { level: 'ready', label: 'Cascade Ready', desc: 'Email + secondary channel available' };
  }
  if (readiness.hasEmail) {
    return { level: 'partial', label: 'Partial', desc: 'Email only — SMS/DM steps will fall back to email' };
  }
  if (hasSecondary) {
    return { level: 'partial', label: 'Partial', desc: 'No email — Day-1 step will be skipped; SMS/DM steps still fire' };
  }
  return { level: 'blocked', label: 'Blocked', desc: 'No contact channels — cascade cannot fire' };
}

interface ChannelReadinessWidgetProps {
  campaignId: string;
  /** Optional: show intake email status (recovery campaigns only) */
  intakeEmail?: string | null;
  /** Full campaign record — enables the "Log contact" CTA (LogContactModal)
      on Cascade Ready, the same manual-outreach entry the communications
      page offers. */
  campaign?: Campaign | null;
  /** CTA shown on 'ready' status — e.g. jump to the Cascade tab (review pipeline). */
  onOpenCascade?: () => void;
  /** Called after a successful GBP enrichment so the parent can refresh campaign data. */
  onEnriched?: () => void;
  /** Called after a manual contact is logged via the modal. */
  onContactLogged?: () => void;
}

export default function ChannelReadinessWidget({ campaignId, intakeEmail, campaign, onOpenCascade, onEnriched, onContactLogged }: ChannelReadinessWidgetProps) {
  const [readiness, setReadiness] = useState<ContactReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [showLogContact, setShowLogContact] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await marketingOpsService.getContactReadiness(campaignId);
      setReadiness(result);
    } catch {
      // Silently fail — widget is informational, not critical
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichError(null);
    try {
      await marketingOpsService.enrichContact(campaignId, { force: false });
      await load();
      onEnriched?.();
    } catch (err: any) {
      setEnrichError(err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Channel Readiness</h3>
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!readiness) return null;

  const channels = [
    { label: 'Email', icon: Mail, present: readiness.hasEmail },
    { label: 'Phone', icon: Phone, present: readiness.hasPhone },
    { label: 'Social', icon: Share2, present: readiness.hasSocial },
    { label: 'Website', icon: Globe, present: readiness.hasWebsite },
  ];

  const cascade = resolveCascadeState(readiness);
  const editHref = `/settings/admin/marketing-ops/campaigns/${campaignId}/edit`;

  const cascadeConfig = {
    ready: { color: 'green', icon: CheckCircle },
    partial: { color: 'amber', icon: AlertTriangle },
    blocked: { color: 'red', icon: XCircle },
  }[cascade.level];

  const CascadeIcon = cascadeConfig.icon;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Channel Readiness</h3>

      {/* Channel badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {channels.map((ch) => {
          const Icon = ch.icon;
          return (
            <span
              key={ch.label}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                ch.present
                  ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                  : 'text-gray-400 bg-gray-100 dark:bg-neutral-700 dark:text-gray-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {ch.label}
              {ch.present ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            </span>
          );
        })}
      </div>

      {/* Intake email (recovery only) */}
      {intakeEmail !== undefined && (
        <div className="mb-3 text-xs">
          <span className="text-gray-500 dark:text-gray-400">Intake email: </span>
          {intakeEmail ? (
            <span className="text-green-600 dark:text-green-400 font-medium">{intakeEmail}</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Not yet captured (owner must submit intake)</span>
          )}
        </div>
      )}

      {/* Cascade readiness indicator */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        cascadeConfig.color === 'green' ? 'bg-green-50 dark:bg-green-900/20' :
        cascadeConfig.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20' :
        'bg-red-50 dark:bg-red-900/20'
      }`}>
        <CascadeIcon className={`w-4 h-4 ${
          cascadeConfig.color === 'green' ? 'text-green-600 dark:text-green-400' :
          cascadeConfig.color === 'amber' ? 'text-amber-600 dark:text-amber-400' :
          'text-red-600 dark:text-red-400'
        }`} />
        <div>
          <p className={`text-xs font-medium ${
            cascadeConfig.color === 'green' ? 'text-green-700 dark:text-green-400' :
            cascadeConfig.color === 'amber' ? 'text-amber-700 dark:text-amber-400' :
            'text-red-700 dark:text-red-400'
          }`}>
            {cascade.label}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{cascade.desc}</p>
        </div>
      </div>

      {/* Status actionables */}
      {cascade.level === 'ready' && (onOpenCascade || campaign) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onOpenCascade && (
            <button
              type="button"
              onClick={onOpenCascade}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Go to Cascade
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          {campaign && (
            <button
              type="button"
              onClick={() => setShowLogContact(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600"
            >
              <PhoneCall className="w-3 h-3" />
              Log contact
            </button>
          )}
        </div>
      )}

      {cascade.level !== 'ready' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEnrich}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <Sparkles className={`w-3 h-3 ${enriching ? 'animate-spin' : ''}`} />
            {enriching ? 'Enriching…' : 'Enrich from GBP'}
          </button>
          <Link
            href={editHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600"
          >
            <Pencil className="w-3 h-3" />
            Edit contact info
          </Link>
        </div>
      )}

      {enrichError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{enrichError}</p>
      )}

      {showLogContact && campaign && (
        <LogContactModal
          campaign={campaign}
          onClose={() => setShowLogContact(false)}
          onLogged={() => {
            setShowLogContact(false);
            onContactLogged?.();
          }}
        />
      )}
    </div>
  );
}
