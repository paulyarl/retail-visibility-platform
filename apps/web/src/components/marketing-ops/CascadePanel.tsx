'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, ZapOff, Mail, Phone, MessageCircle, CheckCircle, XCircle } from 'lucide-react';
import marketingOpsService from '@/services/MarketingOpsService';

interface CascadeContact {
  id: string;
  contactDate: string;
  channel: string;
  outcome: string;
  notes: string;
}

interface CascadeStatus {
  campaignId: string;
  cascadeEnabled: boolean;
  cascadeConfig: any;
  stepsFired: number;
  stepsRemaining: number;
  totalSteps: number;
  contacts: CascadeContact[];
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  social: MessageCircle,
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  phone: 'SMS',
  social: 'DM',
};

export default function CascadePanel({ campaignId }: { campaignId: string }) {
  const [status, setStatus] = useState<CascadeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await marketingOpsService.getCascadeStatus(campaignId);
      setStatus(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load cascade status');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    setActionMsg(null);
    try {
      if (status.cascadeEnabled) {
        await marketingOpsService.disableCascade(campaignId);
        setActionMsg({ type: 'success', text: 'Cascade disabled.' });
      } else {
        await marketingOpsService.enableCascade(campaignId);
        setActionMsg({ type: 'success', text: 'Cascade enabled. The email → SMS → DM sequence will start on the next scheduler pass.' });
      }
      fetchStatus();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'Failed to toggle cascade' });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action message */}
      {actionMsg && (
        <div className={`rounded-lg p-3 border text-sm ${
          actionMsg.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {actionMsg.text}
        </div>
      )}

      {/* Status + toggle */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Multi-Channel Cascade</h3>
            {status?.cascadeEnabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                <CheckCircle className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                <XCircle className="w-3 h-3" /> Inactive
              </span>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${
              status?.cascadeEnabled
                ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-neutral-700 dark:text-gray-200 dark:border-neutral-600'
                : 'text-white bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {status?.cascadeEnabled ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            {toggling ? '...' : status?.cascadeEnabled ? 'Disable Cascade' : 'Enable Cascade'}
          </button>
        </div>

        {/* Cascade flow diagram */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { day: 'Day 1', channel: 'email', label: 'Primary Email', desc: 'Frame preview + grade impact + CTA' },
            { day: 'Day 2', channel: 'phone', label: 'SMS Pointer', desc: 'Short reference to email + drop link' },
            { day: 'Day 4', channel: 'social', label: 'Webform / DM', desc: 'Administrative check-in' },
          ].map((step, i) => {
            const Icon = CHANNEL_ICONS[step.channel] || Mail;
            const contact = status?.contacts?.[i];
            const isSkipped = contact?.notes?.includes('SKIPPED');
            const isFired = contact && !isSkipped;
            return (
              <div
                key={i}
                className={`relative rounded-lg border p-3 ${
                  isFired
                    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                    : isSkipped
                    ? 'border-gray-200 bg-gray-50 dark:border-neutral-600 dark:bg-neutral-700/50'
                    : 'border-gray-200 dark:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{step.day}</span>
                  {isFired && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                  {isSkipped && <XCircle className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{step.label}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{step.desc}</p>
                {isSkipped && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No contact info — skipped</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress summary */}
        {status && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{status.stepsFired}</strong> fired
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{status.stepsRemaining}</strong> remaining
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{status.totalSteps}</strong> total
            </span>
          </div>
        )}
      </div>

      {/* Contact log */}
      {status && status.contacts.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cascade Contact Log</h3>
          <div className="space-y-2">
            {status.contacts.map((c) => {
              const Icon = CHANNEL_ICONS[c.channel] || Mail;
              const isSkipped = c.notes?.includes('SKIPPED');
              return (
                <div key={c.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-100 dark:border-neutral-700 last:border-0">
                  <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{CHANNEL_LABELS[c.channel] || c.channel}</span>
                      <span className="text-xs text-gray-400">{new Date(c.contactDate).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.notes}</p>
                  </div>
                  {isSkipped && (
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-neutral-700 px-2 py-0.5 rounded">Skipped</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {!status?.cascadeEnabled && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Enabling the cascade starts an automated email → SMS → DM sequence for this campaign.
            The cascade fires on Day 1 (email), Day 2 (SMS, if unopened), and Day 4 (DM, if unopened).
            Steps are skipped if the corresponding contact info is missing.
          </p>
        </div>
      )}
    </div>
  );
}
