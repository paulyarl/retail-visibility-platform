'use client';

import { useState, useEffect } from 'react';
import { Mail, Phone, Globe, Share2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import marketingOpsService, { ContactReadiness } from '@/services/MarketingOpsService';

interface ChannelReadinessWidgetProps {
  campaignId: string;
  /** Optional: show intake email status (recovery campaigns only) */
  intakeEmail?: string | null;
}

export default function ChannelReadinessWidget({ campaignId, intakeEmail }: ChannelReadinessWidgetProps) {
  const [readiness, setReadiness] = useState<ContactReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await marketingOpsService.getContactReadiness(campaignId);
        if (!cancelled) setReadiness(result);
      } catch {
        // Silently fail — widget is informational, not critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

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

  // Cascade readiness: green if email + (phone OR social), amber if only email, red if no email
  const hasSecondaryChannel = readiness.hasPhone || readiness.hasSocial;
  const cascadeLevel: 'ready' | 'partial' | 'blocked' =
    readiness.hasEmail && hasSecondaryChannel ? 'ready' :
    readiness.hasEmail ? 'partial' :
    'blocked';

  const cascadeConfig = {
    ready: { color: 'green', icon: CheckCircle, label: 'Cascade Ready', desc: 'Email + secondary channel available' },
    partial: { color: 'amber', icon: AlertTriangle, label: 'Partial', desc: 'Email only — SMS/DM steps will be skipped' },
    blocked: { color: 'red', icon: XCircle, label: 'Blocked', desc: 'No email — cascade cannot fire' },
  }[cascadeLevel];

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
            {cascadeConfig.label}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{cascadeConfig.desc}</p>
        </div>
      </div>
    </div>
  );
}
