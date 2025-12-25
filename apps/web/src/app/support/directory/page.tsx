'use client';

import { useState } from 'react';
import DirectoryTenantLookup from '@/components/support/directory/DirectoryTenantLookup';
import DirectoryTroubleshootingGuide from '@/components/support/directory/DirectoryTroubleshootingGuide';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function SupportDirectoryPage() {
  const [activeTab, setActiveTab] = useState<'lookup' | 'troubleshooting'>('lookup');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Directory Support Tools
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Help tenants with directory listings, quality checks, and troubleshooting
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('lookup')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'lookup'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Tenant Lookup
          </button>
          <button
            onClick={() => setActiveTab('troubleshooting')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'troubleshooting'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Troubleshooting Guide
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'lookup' && <DirectoryTenantLookup />}
      {activeTab === 'troubleshooting' && <DirectoryTroubleshootingGuide />}
    </div>
  );
}
