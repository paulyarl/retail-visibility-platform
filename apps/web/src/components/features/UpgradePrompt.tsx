/**
 * Upgrade Prompt Component
 * 
 * Shows upgrade prompts when features are not available
 */

import React from 'react';

// Simple SVG icons to replace lucide-react
const ArrowUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);

const Crown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m0-4h4m4 0l4 4m-4-4v4m0-4h4m-6 4l-4-4m4 4l4-4" />
  </svg>
);

export interface UpgradePromptProps {
  currentTier: string;
  requiredTier: string;
  capabilities: string[];
  message?: string;
  className?: string;
}

export function UpgradePrompt({
  currentTier,
  requiredTier,
  capabilities,
  message,
  className = ''
}: UpgradePromptProps) {
  return (
    <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Crown className="h-6 w-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-amber-800">
            Upgrade to {requiredTier}
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            {message || `This feature requires ${requiredTier} tier. You're currently on ${currentTier}.`}
          </p>
          <div className="mt-2">
            <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500">
              <ArrowUp className="h-3 w-3 mr-1" />
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
