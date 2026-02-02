'use client';

import React, { useState, useEffect } from 'react';
import { Bug, Settings } from 'lucide-react';
import { ProductCache } from '@/hooks/shops/useShopsFeaturedBuckets';

/**
 * Troubleshooting Toggle Component
 * 
 * Provides a toggle switch to enable/disable caching for debugging purposes.
 * When enabled, all API calls will bypass cache using timestamps.
 * 
 * Usage:
 * <TroubleshootingToggle />
 * 
 * URL Parameters:
 * ?debug=true - Enable troubleshooting mode temporarily
 * ?troubleshoot=true - Enable troubleshooting mode temporarily
 */
export default function TroubleshootingToggle() {
  const [isTroubleshooting, setIsTroubleshooting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check current troubleshooting mode status
    const currentMode = ProductCache.getTroubleshootingMode();
    setIsTroubleshooting(currentMode);

    // Show toggle only in development or when explicitly enabled
    const isDev = process.env.NODE_ENV === 'development';
    const hasDebugParam = typeof window !== 'undefined' && 
      (window.location.search.includes('debug') || window.location.search.includes('troubleshoot'));
    
    setIsVisible(isDev || hasDebugParam);

    // Listen for storage changes (in case toggled in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'troubleshooting-mode') {
        setIsTroubleshooting(e.newValue === 'true');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  const handleToggle = () => {
    const newMode = ProductCache.toggleTroubleshootingMode();
    setIsTroubleshooting(newMode);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isTroubleshooting ? (
            <Bug className="w-4 h-4 text-red-500" />
          ) : (
            <Settings className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Troubleshooting Mode
          </span>
        </div>
        
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isTroubleshooting ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isTroubleshooting ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      
      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
        {isTroubleshooting ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Cache bypassed</span>
            </div>
            <div className="text-gray-500">
              All API calls use timestamps
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Cache enabled</span>
            </div>
            <div className="text-gray-500">
              5-minute TTL for products
            </div>
          </div>
        )}
      </div>
      
      {/* Keyboard shortcut hint */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500">
        <div>URL: ?debug=true or ?troubleshoot=true</div>
      </div>
    </div>
  );
}
