/**
 * BSaaS Catalog Management Admin Page
 *
 * Tabbed container for managing BSaaS features and bundles.
 * Delegates to BsaasFeaturesTab and BundlesTab components.
 */

'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import BsaasFeaturesTab from './BsaasFeaturesTab';
import BundlesTab from './BundlesTab';
import ServicesTab from './ServicesTab';
import GrantsTab from './GrantsTab';

type TabKey = 'features' | 'bundles' | 'services' | 'grants';

export default function BsaasCatalogManagement() {
  const [activeTab, setActiveTab] = useState<TabKey>('features');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleError = (msg: string) => setError(msg);
  const handleSuccess = (msg: string) => setSuccess(msg);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            BSaaS Catalog
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Manage purchasable features and bundles — pricing, availability, and composition.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{error}</p>
            <button className="text-xs underline mt-1" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
          <div className="flex-1">
            <p className="text-sm">{success}</p>
            <button className="text-xs underline mt-1" onClick={() => setSuccess(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('features')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'features'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Features
        </button>
        <button
          onClick={() => setActiveTab('bundles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bundles'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Bundles
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'services'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Services
        </button>
        <button
          onClick={() => setActiveTab('grants')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'grants'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Grants
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'features' ? (
        <BsaasFeaturesTab onError={handleError} onSuccess={handleSuccess} />
      ) : activeTab === 'bundles' ? (
        <BundlesTab onError={handleError} onSuccess={handleSuccess} />
      ) : activeTab === 'services' ? (
        <ServicesTab onError={handleError} onSuccess={handleSuccess} />
      ) : (
        <GrantsTab onError={handleError} onSuccess={handleSuccess} />
      )}
    </div>
  );
}
