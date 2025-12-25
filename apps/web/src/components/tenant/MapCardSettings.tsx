"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Alert } from '@/components/ui';
import MapCard from './MapCard';

interface MapCardSettingsProps {
  businessProfile: {
    business_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country_code: string;
    latitude?: number;
    longitude?: number;
  };
  displayMap: boolean;
  privacyMode: 'precise' | 'neighborhood';
  onSave: (settings: { displayMap: boolean; privacyMode: 'precise' | 'neighborhood' }) => Promise<void>;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function MapCardSettings({
  businessProfile,
  displayMap: initialDisplayMap,
  privacyMode: initialPrivacyMode,
  onSave,
}: MapCardSettingsProps) {
  const [displayMap, setDisplayMap] = useState(initialDisplayMap);
  const [privacyMode, setPrivacyMode] = useState<'precise' | 'neighborhood'>(initialPrivacyMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasChanges = displayMap !== initialDisplayMap || privacyMode !== initialPrivacyMode;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave({ displayMap, privacyMode });
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
          <CardTitle>Map Display Settings</CardTitle>
          <CardDescription>
            Control how your store location appears to visitors
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
              Your map display settings have been updated
            </Alert>
          )}

          {/* Display Toggle */}
          <div className="flex items-start justify-between p-4 bg-neutral-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 mb-1">
                Show store location
              </h3>
              <p className="text-sm text-neutral-600">
                Display an interactive map on your public tenant page
              </p>
            </div>
            <button
              onClick={() => setDisplayMap(!displayMap)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                displayMap ? 'bg-primary-600' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  displayMap ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Privacy Mode */}
          {displayMap && (
            <div className="p-4 bg-neutral-50 rounded-lg space-y-3">
              <div>
                <h3 className="text-sm font-medium text-neutral-900 mb-1">
                  Privacy mode
                </h3>
                <p className="text-sm text-neutral-600">
                  Choose how precisely to show your location
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPrivacyMode('precise')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    privacyMode === 'precise'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium text-sm">Precise</span>
                  </div>
                  <p className="text-xs text-neutral-600 text-left">
                    Show exact location on map
                  </p>
                </button>

                <button
                  onClick={() => setPrivacyMode('neighborhood')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    privacyMode === 'neighborhood'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-medium text-sm">Neighborhood</span>
                  </div>
                  <p className="text-xs text-neutral-600 text-left">
                    Show approximate area
                  </p>
                </button>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-900">
                  {privacyMode === 'precise'
                    ? 'Your exact coordinates will be visible to visitors'
                    : 'Coordinates will be rounded to protect your privacy while still showing your general area'}
                </p>
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
      {displayMap && (
        <div>
          <h3 className="text-sm font-medium text-neutral-900 mb-3">Preview</h3>
          <MapCard
            businessName={businessProfile.business_name}
            addressLine1={businessProfile.address_line1}
            addressLine2={businessProfile.address_line2}
            city={businessProfile.city}
            state={businessProfile.state}
            postalCode={businessProfile.postal_code}
            countryCode={businessProfile.country_code}
            latitude={businessProfile.latitude}
            longitude={businessProfile.longitude}
            displayMap={true}
            privacyMode={privacyMode}
            editable={false}
          />
        </div>
      )}
    </div>
  );
}
