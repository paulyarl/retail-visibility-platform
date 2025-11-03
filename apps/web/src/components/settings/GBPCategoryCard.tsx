'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import GBPCategorySelector from './GBPCategorySelector';
import { api } from '@/lib/api';

interface GBPCategoryCardProps {
  tenantId: string;
  initialCategory?: { id: string; name: string } | null;
  syncStatus?: string | null;
  lastMirrored?: string | null;
}

export default function GBPCategoryCard({
  tenantId,
  initialCategory,
  syncStatus,
  lastMirrored,
}: GBPCategoryCardProps) {
  const [category, setCategory] = useState<{ id: string; name: string } | null>(initialCategory || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!category) {
      setError('Please select a category');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await api.put('/api/tenant/gbp-category', {
        tenantId,
        gbpCategoryId: category.id,
        gbpCategoryName: category.name,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save GBP category');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[GBPCategoryCard] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const getSyncStatusBadge = () => {
    if (!syncStatus) return null;

    const statusConfig: Record<string, { label: string; className: string }> = {
      ok: { label: 'Synced', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
      out_of_sync: { label: 'Out of Sync', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
      error: { label: 'Error', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    };

    const config = statusConfig[syncStatus] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Google Business Profile Category</CardTitle>
            <CardDescription>
              Select the primary business category for your Google Business Profile
            </CardDescription>
          </div>
          {getSyncStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GBPCategorySelector
            tenantId={tenantId}
            value={category}
            onChange={setCategory}
            disabled={saving}
          />

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300">
                Category saved successfully!
              </p>
            </div>
          )}

          {lastMirrored && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Last synced: {new Date(lastMirrored).toLocaleString()}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !category}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Category'}
            </button>

            {category && (
              <button
                onClick={() => setCategory(null)}
                disabled={saving}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Clear
              </button>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> This category will be used for your Google Business Profile listing.
              Choose the category that best describes your primary business activity.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
