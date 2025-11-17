'use client';

import { useState } from 'react';
import ChangeLocationStatusModal from './ChangeLocationStatusModal';

interface LocationStatusBannerProps {
  locationStatus: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  reopeningDate?: string | Date | null;
  tenantName: string;
  tenantId: string;
  variant?: 'full' | 'compact';
}

export default function LocationStatusBanner({ 
  locationStatus,
  reopeningDate,
  tenantName,
  tenantId,
  variant = 'compact'
}: LocationStatusBannerProps) {
  // Active locations don't need a banner
  if (locationStatus === 'active') {
    return null;
  }

  const getStatusConfig = () => {
    switch (locationStatus) {
      case 'inactive':
        return {
          title: 'Location Temporarily Closed',
          message: reopeningDate 
            ? `This location is temporarily closed and will reopen on ${new Date(reopeningDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
            : 'This location is temporarily closed. Check back soon for updates.',
          icon: '⏸️',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-900 dark:text-orange-100',
          iconColor: 'text-orange-600 dark:text-orange-400',
        };
      case 'closed':
        return {
          title: 'Location Permanently Closed',
          message: 'This location is permanently closed. Thank you for your support over the years.',
          icon: '🔒',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-900 dark:text-red-100',
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'pending':
        return {
          title: 'Location Opening Soon',
          message: 'This location is being set up and will be available soon.',
          icon: '🚧',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          textColor: 'text-yellow-900 dark:text-yellow-100',
          iconColor: 'text-yellow-600 dark:text-yellow-400',
        };
      case 'archived':
        return {
          title: 'Location Archived',
          message: 'This location has been archived and is no longer operational.',
          icon: '📦',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
          textColor: 'text-gray-900 dark:text-gray-100',
          iconColor: 'text-gray-600 dark:text-gray-400',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  if (variant === 'full') {
    return (
      <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-6 mb-6`}>
        <div className="flex items-start gap-4">
          <div className={`text-4xl ${config.iconColor}`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${config.textColor} mb-2`}>
              {config.title}
            </h3>
            <p className={`${config.textColor} mb-4`}>
              {config.message}
            </p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setIsStatusModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Location Status
              </button>
              {locationStatus === 'inactive' && (
                <button 
                  onClick={() => setIsStatusModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                >
                  Set Reopening Date
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant
  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4 mb-4`}>
      <div className="flex items-center gap-3">
        <span className={`text-2xl ${config.iconColor}`}>
          {config.icon}
        </span>
        <div className="flex-1">
          <p className={`font-medium ${config.textColor}`}>
            {config.title}
          </p>
          <p className={`text-sm ${config.textColor} opacity-90 mt-0.5`}>
            {config.message}
          </p>
        </div>
        <button 
          onClick={() => setIsStatusModalOpen(true)}
          className="text-sm font-medium hover:underline whitespace-nowrap"
        >
          Manage →
        </button>
      </div>
    </div>
  );
}

{isStatusModalOpen && (
  <ChangeLocationStatusModal
    isOpen={isStatusModalOpen}
    onClose={() => setIsStatusModalOpen(false)}
    tenantId={tenantId}
    tenantName={tenantName}
    currentStatus={locationStatus}
  />
)}
