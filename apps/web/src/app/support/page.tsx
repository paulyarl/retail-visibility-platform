'use client';

import { useState } from 'react';
import Link from 'next/link';
import HelpDeskForm from '@/components/crm/HelpDeskForm';
import { LifeBuoy, Search, Wrench } from 'lucide-react';

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<'help-desk' | 'directory'>('help-desk');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
          <LifeBuoy className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Help Desk Support
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Need help with the platform? Submit a support inquiry and our team will get back to you.
          No account required.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('help-desk')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'help-desk'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <LifeBuoy className="w-4 h-4" />
            Help Desk
          </button>
          <button
            onClick={() => setActiveTab('directory')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'directory'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Search className="w-4 h-4" />
            Directory Tools
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'help-desk' && (
        <div className="max-w-2xl mx-auto">
          <HelpDeskForm />
        </div>
      )}

      {activeTab === 'directory' && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Help tenants with directory listings, quality checks, and troubleshooting.
          </p>
          <div className="flex gap-3">
            <Link
              href="/support/directory"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Wrench className="w-4 h-4" />
              Open Directory Support Tools
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
