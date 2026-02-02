'use client';

import { useState } from 'react';
import { Modal, ModalFooter, Button, Input, Select } from '@/components/ui';
import SlugPatternSelector from '@/components/shops/SlugPatternSelector';
import { countries } from '@/lib/validation/businessProfile';

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: TenantCreationData) => Promise<void>;
  loading?: boolean;
}

export interface TenantCreationData {
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  country_code?: string;
}

export default function CreateTenantModal({
  isOpen,
  onClose,
  onCreate,
  loading = false,
}: CreateTenantModalProps) {
  const [formData, setFormData] = useState<TenantCreationData>({
    name: '',
    slug: '',
    city: '',
    state: '',
    country_code: 'US',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof TenantCreationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Location name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      await onCreate(formData);
      // Reset form on success
      setFormData({
        name: '',
        slug: '',
        city: '',
        state: '',
        country_code: 'US',
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to create tenant:', error);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      slug: '',
      city: '',
      state: '',
      country_code: 'US',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Location"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location Name */}
        <Input
          label="Location Name"
          placeholder="e.g., Downtown Store, Main Street Location"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
        />

        {/* Optional Location Details */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900 mb-3">
            <strong>Optional:</strong> Add location details to generate a professional URL slug
          </p>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                placeholder="e.g., Seattle"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
              
              <Input
                label="State/Province"
                placeholder="e.g., WA"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
              />
            </div>

            <Select
              label="Country"
              value={formData.country_code}
              onChange={(e) => handleChange('country_code', e.target.value)}
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Slug Pattern Selector */}
        {formData.name && (
          <SlugPatternSelector
            businessName={formData.name}
            location={{
              city: formData.city,
              state: formData.state,
              country: formData.country_code,
            }}
            tenantId={undefined}
            selectedSlug={formData.slug || ''}
            onSlugSelect={(slug) => handleChange('slug', slug)}
          />
        )}

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            loading={loading}
          >
            {loading ? 'Creating...' : 'Create Location'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
