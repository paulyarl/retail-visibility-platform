"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input, Alert, Button } from '@/components/ui';
import { BusinessProfile, geocodeAddress } from '@/lib/validation/businessProfile';

interface AdditionalSettingsStepProps {
  tenantId: string;
  initialData?: Partial<BusinessProfile>;
  onDataChange: (data: Partial<BusinessProfile>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function AdditionalSettingsStep({
  tenantId,
  initialData = {},
  onDataChange,
  onValidationChange,
}: AdditionalSettingsStepProps) {
  // Local state only for UI-specific fields
  const [geocoding, setGeocoding] = useState(false);
  const [seoTagInput, setSeoTagInput] = useState('');

  useEffect(() => {
    // This step is always valid (all fields are optional)
    onValidationChange(true);
  }, [onValidationChange]);

  const handleChange = (field: keyof BusinessProfile, value: any) => {
    const updated = { ...initialData, [field]: value };
    onDataChange(updated);
  };

  const handleGeocodeAddress = async () => {
    if (!initialData.address_line1 || !initialData.city || !initialData.postal_code || !initialData.country_code) {
      return;
    }

    try {
      setGeocoding(true);
      const coords = await geocodeAddress({
        address_line1: initialData.address_line1,
        address_line2: initialData.address_line2,
        city: initialData.city,
        state: initialData.state,
        postal_code: initialData.postal_code,
        country_code: initialData.country_code,
      });

      if (coords) {
        const updated = {
          ...initialData,
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        onDataChange(updated);
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddSeoTag = () => {
    const tag = seoTagInput.trim().toLowerCase();
    if (!tag) return;

    const currentTags = initialData.seo_tags || [];
    if (currentTags.includes(tag)) {
      setSeoTagInput('');
      return;
    }

    const updated = {
      ...initialData,
      seo_tags: [...currentTags, tag],
    };
    onDataChange(updated);
    setSeoTagInput('');
  };

  const handleRemoveSeoTag = (tag: string) => {
    const updated = {
      ...initialData,
      seo_tags: (initialData.seo_tags || []).filter((t) => t !== tag),
    };
    onDataChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSeoTag();
    }
  };

  // Check if address is complete for geocoding (from step 2)
  const canGeocode = initialData.address_line1 && initialData.city && initialData.postal_code && initialData.country_code;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4"
        >
          <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </motion.div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Additional Settings</h2>
        <p className="text-neutral-600">
          Fine-tune your store's online presence
        </p>
      </div>

      {/* Info Alert */}
      <Alert variant="info">
        These settings help improve your store's visibility in search results and on maps. All fields are optional.
      </Alert>

      {/* Map Coordinates (Geocoding) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
              Map Coordinates
            </h4>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Get latitude and longitude for map display from your business address
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGeocodeAddress}
            disabled={geocoding || !canGeocode}
            loading={geocoding}
          >
            {geocoding ? 'Getting...' : 'Get Coordinates'}
          </Button>
        </div>

        {!canGeocode && (
          <p className="text-xs text-amber-600">
            ⚠️ Complete your address in Step 2 to enable geocoding
          </p>
        )}

        {initialData.latitude && initialData.longitude && (
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Coordinates: {Number(initialData.latitude).toFixed(6)}, {Number(initialData.longitude).toFixed(6)}
            </span>
          </div>
        )}

        {/* Manual Coordinate Entry */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Input
            label="Latitude"
            placeholder="e.g., 40.7128"
            value={initialData.latitude?.toString() || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleChange('latitude', isNaN(val) ? undefined : val);
            }}
            type="number"
            step="any"
          />
          <Input
            label="Longitude"
            placeholder="e.g., -74.0060"
            value={initialData.longitude?.toString() || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleChange('longitude', isNaN(val) ? undefined : val);
            }}
            type="number"
            step="any"
          />
        </div>
      </motion.div>

      {/* SEO Tags */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          SEO Keywords
        </label>
        <p className="text-xs text-neutral-500 mb-3">
          Add keywords that describe your business to improve search visibility
        </p>

        {/* Tag Input */}
        <div className="flex gap-2">
          <Input
            placeholder="e.g., electronics, gadgets, tech"
            value={seoTagInput}
            onChange={(e) => setSeoTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button variant="secondary" onClick={handleAddSeoTag} disabled={!seoTagInput.trim()}>
            Add
          </Button>
        </div>

        {/* Tags Display */}
        {(initialData.seo_tags || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {(initialData.seo_tags || []).map((tag, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
              >
                {tag}
                <button
                  onClick={() => handleRemoveSeoTag(tag)}
                  className="hover:text-primary-900 ml-1"
                >
                  ×
                </button>
              </motion.span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Admin Email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Input
          type="email"
          label="Admin Email (Optional)"
          placeholder="admin@yourbusiness.com"
          value={initialData.admin_email || ''}
          onChange={(e) => handleChange('admin_email', e.target.value)}
          helperText="Separate admin email for receiving system notifications"
        />
      </motion.div>

      {/* Summary Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-neutral-50 rounded-lg p-4 border border-neutral-200"
      >
        <h4 className="text-sm font-medium text-neutral-700 mb-3">Settings Summary</h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-600">Map Coordinates:</span>
            <span className={initialData.latitude ? 'text-green-600' : 'text-neutral-400'}>
              {initialData.latitude ? '✓ Set' : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">SEO Keywords:</span>
            <span className={(initialData.seo_tags || []).length > 0 ? 'text-green-600' : 'text-neutral-400'}>
              {(initialData.seo_tags || []).length > 0 ? `${(initialData.seo_tags || []).length} tags` : 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-600">Admin Email:</span>
            <span className={initialData.admin_email ? 'text-green-600' : 'text-neutral-400'}>
              {initialData.admin_email ? '✓ Set' : 'Not set'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Skip Notice */}
      <div className="text-center text-xs text-neutral-500">
        You can skip this step and configure these settings later in Settings → Tenant
      </div>
    </div>
  );
}
