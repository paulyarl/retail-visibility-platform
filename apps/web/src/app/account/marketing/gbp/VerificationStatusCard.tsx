'use client';

import { ShieldCheck, Clock, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import type { GbpVerificationOption } from '@/services/MarketingCustomerService';

interface VerificationStatusCardProps {
  verificationState: string;
  onStartVerification: () => void;
  startingVerification: boolean;
  options: GbpVerificationOption[];
  onSelectOption: (option: GbpVerificationOption) => void;
  onShowPinDialog: () => void;
}

const STATE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof ShieldCheck }> = {
  UNVERIFIED: {
    label: 'Not Verified',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: AlertCircle,
  },
  PENDING: {
    label: 'Verification Pending',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: Clock,
  },
  COMPLETED: {
    label: 'Verified',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: ShieldCheck,
  },
  FAILED: {
    label: 'Verification Failed',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: XCircle,
  },
};

export function VerificationStatusCard({
  verificationState,
  onStartVerification,
  startingVerification,
  options,
  onSelectOption,
  onShowPinDialog,
}: VerificationStatusCardProps) {
  const config = STATE_CONFIG[verificationState] || STATE_CONFIG.UNVERIFIED;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Verification Status</p>
            <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
          </div>
        </div>

        {/* Action buttons based on state */}
        <div className="flex items-center gap-2">
          {verificationState === 'UNVERIFIED' && options.length === 0 && (
            <button
              onClick={onStartVerification}
              disabled={startingVerification}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startingVerification ? 'Loading...' : 'Start Verification'}
            </button>
          )}

          {verificationState === 'PENDING' && (
            <button
              onClick={onShowPinDialog}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Enter PIN
            </button>
          )}

          {verificationState === 'FAILED' && options.length === 0 && (
            <button
              onClick={onStartVerification}
              disabled={startingVerification}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {startingVerification ? 'Loading...' : 'Try Again'}
            </button>
          )}
        </div>
      </div>

      {/* Verification options list */}
      {options.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Choose a verification method:</p>
          {options.map((option) => (
            <button
              key={option.method}
              onClick={() => onSelectOption(option)}
              disabled={startingVerification}
              className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 disabled:opacity-50"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {/* State-specific help text */}
      {verificationState === 'UNVERIFIED' && options.length === 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Verification confirms you are the authorized owner of this business on Google.
          You&apos;ll need a verification code sent by Google to complete the process.
        </p>
      )}
      {verificationState === 'PENDING' && (
        <p className="mt-3 text-xs text-gray-500">
          A verification code has been sent to you by Google. Click &quot;Enter PIN&quot; to submit it.
        </p>
      )}
      {verificationState === 'COMPLETED' && (
        <p className="mt-3 text-xs text-gray-500">
          Your business is verified on Google. You can now manage reviews, posts, and photos.
        </p>
      )}
    </div>
  );
}
