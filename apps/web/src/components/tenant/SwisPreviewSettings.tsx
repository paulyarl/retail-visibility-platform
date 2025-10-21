"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert, Select } from '@/components/ui';
import SwisPreviewWidget from './SwisPreviewWidget';

interface SwisPreviewSettingsProps {
  tenantId: string;
  enabled: boolean;
  previewLimit: number;
  sortOrder: 'updated_desc' | 'price_asc' | 'alpha_asc';
  badgesEnabled: boolean;
  onSave: (settings: {
    enabled: boolean;
    previewLimit: number;
    sortOrder: 'updated_desc' | 'price_asc' | 'alpha_asc';
    badgesEnabled: boolean;
  }) => Promise<void>;
}

export default function SwisPreviewSettings({
  tenantId,
  enabled: initialEnabled,
  previewLimit: initialLimit,
  sortOrder: initialSortOrder,
  badgesEnabled: initialBadgesEnabled,
  onSave,
}: SwisPreviewSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [previewLimit, setPreviewLimit] = useState(initialLimit);
  const [sortOrder, setSortOrder] = useState<'updated_desc' | 'price_asc' | 'alpha_asc'>(initialSortOrder);
  const [badgesEnabled, setBadgesEnabled] = useState(initialBadgesEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasChanges = 
    enabled !== initialEnabled ||
    previewLimit !== initialLimit ||
    sortOrder !== initialSortOrder ||
    badgesEnabled !== initialBadgesEnabled;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave({ enabled, previewLimit, sortOrder, badgesEnabled });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Product Preview Settings</CardTitle>
          <CardDescription>
            Control how your products appear on your public tenant page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" title="Settings saved">
              Your product preview settings have been updated
            </Alert>
          )}

          {/* Enable Toggle */}
          <div className="flex items-start justify-between p-4 bg-neutral-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 mb-1">
                Show product preview
              </h3>
              <p className="text-sm text-neutral-600">
                Display a preview of your products on your public page
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary-600' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Settings (when enabled) */}
          {enabled && (
            <div className="space-y-4">
              {/* Number of Products */}
              <div className="p-4 bg-neutral-50 rounded-lg space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900 mb-1">
                    Number of products
                  </h3>
                  <p className="text-sm text-neutral-600">
                    How many products to show in the preview
                  </p>
                </div>

                <Select
                  value={previewLimit.toString()}
                  onChange={(e) => setPreviewLimit(parseInt(e.target.value))}
                  options={[
                    { value: '4', label: '4 products' },
                    { value: '8', label: '8 products' },
                    { value: '12', label: '12 products (recommended)' },
                    { value: '16', label: '16 products' },
                    { value: '20', label: '20 products' },
                    { value: '24', label: '24 products (maximum)' },
                  ]}
                />
              </div>

              {/* Sort Order */}
              <div className="p-4 bg-neutral-50 rounded-lg space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-neutral-900 mb-1">
                    Sort order
                  </h3>
                  <p className="text-sm text-neutral-600">
                    How to order the products in the preview
                  </p>
                </div>

                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  options={[
                    { value: 'updated_desc', label: 'Recently updated (recommended)' },
                    { value: 'price_asc', label: 'Price: Low to High' },
                    { value: 'alpha_asc', label: 'Alphabetical' },
                  ]}
                />
              </div>

              {/* Badges Toggle */}
              <div className="flex items-start justify-between p-4 bg-neutral-50 rounded-lg">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-neutral-900 mb-1">
                    Show badges
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Display "New", "Sale", and "Low Stock" badges on products
                  </p>
                </div>
                <button
                  onClick={() => setBadgesEnabled(!badgesEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    badgesEnabled ? 'bg-primary-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      badgesEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Info Box */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-900">
                  <p className="font-medium mb-1">Privacy & Security</p>
                  <p>Only public product information is shown. Wholesale costs, supplier details, and internal notes are never displayed.</p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              loading={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {enabled && (
        <div>
          <h3 className="text-sm font-medium text-neutral-900 mb-3">Preview</h3>
          <SwisPreviewWidget
            tenantId={tenantId}
            limit={previewLimit}
            sortOrder={sortOrder}
            badgesEnabled={badgesEnabled}
            editable={false}
          />
        </div>
      )}
    </div>
  );
}
