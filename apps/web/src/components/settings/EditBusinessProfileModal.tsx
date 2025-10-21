"use client";

import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Select, Alert } from '@/components/ui';
import { BusinessProfile, businessProfileSchema, countries, normalizePhoneInput } from '@/lib/validation/businessProfile';
import { z } from 'zod';

interface EditBusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BusinessProfile | null;
  onSave?: (profile: BusinessProfile) => void;
}

export default function EditBusinessProfileModal({ 
  isOpen, 
  onClose, 
  profile,
  onSave 
}: EditBusinessProfileModalProps) {
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(profile || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form when modal opens/closes or profile changes
  useEffect(() => {
    if (isOpen) {
      setFormData(profile || {});
      setErrors({});
      setTouched({});
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, profile]);

  const validateField = (name: string, value: any) => {
    try {
      const fieldSchema = (businessProfileSchema.shape as any)[name];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
        return true;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({
          ...prev,
          [name]: error.errors[0]?.message || 'Invalid value'
        }));
        return false;
      }
    }
    return false;
  };

  const handleChange = (name: keyof BusinessProfile, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate if touched
    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, formData[name as keyof BusinessProfile]);
  };

  const handlePhoneChange = (value: string) => {
    const normalized = normalizePhoneInput(value);
    handleChange('phone_number', normalized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    try {
      const validatedData = businessProfileSchema.parse(formData);
      
      setSaving(true);
      setError(null);

      // Call API to save
      const response = await fetch('/api/tenant/profile', {
        method: profile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save business profile');
      }

      const savedProfile = await response.json();
      
      setSuccess(true);
      
      // Call onSave callback
      if (onSave) {
        onSave(savedProfile);
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Set all validation errors
        const newErrors: Record<string, string> = {};
        err.errors.forEach(error => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
        setError('Please fix the validation errors below');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={profile ? 'Edit Business Profile' : 'Add Business Profile'}
      description="Update your store information for better SEO and customer visibility"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
          {error && !success && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" title="Success!">
              Business profile saved successfully
            </Alert>
          )}

          {/* Business Name */}
          <Input
            label="Business Name"
            placeholder="e.g., Downtown Electronics Store"
            value={formData.business_name || ''}
            onChange={(e) => handleChange('business_name', e.target.value)}
            onBlur={() => handleBlur('business_name')}
            error={errors.business_name}
            required
          />

          {/* Address Line 1 */}
          <Input
            label="Address Line 1"
            placeholder="e.g., 123 Main Street, Suite 100"
            value={formData.address_line1 || ''}
            onChange={(e) => handleChange('address_line1', e.target.value)}
            onBlur={() => handleBlur('address_line1')}
            error={errors.address_line1}
            required
          />

          {/* Address Line 2 */}
          <Input
            label="Address Line 2"
            placeholder="Apartment, suite, unit, etc. (optional)"
            value={formData.address_line2 || ''}
            onChange={(e) => handleChange('address_line2', e.target.value)}
            onBlur={() => handleBlur('address_line2')}
            error={errors.address_line2}
          />

          {/* City, State, Postal Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="City"
              placeholder="e.g., New York"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              onBlur={() => handleBlur('city')}
              error={errors.city}
              required
            />
            
            <Input
              label="State / Province"
              placeholder="e.g., NY"
              value={formData.state || ''}
              onChange={(e) => handleChange('state', e.target.value)}
              onBlur={() => handleBlur('state')}
              error={errors.state}
            />
            
            <Input
              label="Postal Code"
              placeholder="e.g., 10001"
              value={formData.postal_code || ''}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              onBlur={() => handleBlur('postal_code')}
              error={errors.postal_code}
              required
            />
          </div>

          {/* Country */}
          <Select
            label="Country"
            value={formData.country_code || ''}
            onChange={(e) => handleChange('country_code', e.target.value)}
            onBlur={() => handleBlur('country_code')}
            error={errors.country_code}
            required
          >
            <option value="">Select a country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.name}
              </option>
            ))}
          </Select>

          {/* Phone Number */}
          <Input
            label="Phone Number"
            placeholder="+1 234 567 8900"
            value={formData.phone_number || ''}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={() => handleBlur('phone_number')}
            error={errors.phone_number}
            helperText="International format with country code (e.g., +1 for US/Canada)"
            required
          />

          {/* Email */}
          <Input
            type="email"
            label="Email Address"
            placeholder="store@example.com"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            error={errors.email}
            required
          />

          {/* Website (Optional) */}
          <Input
            label="Website"
            placeholder="https://www.example.com"
            value={formData.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            onBlur={() => handleBlur('website')}
            error={errors.website}
            helperText="Optional - Include https://"
          />

          {/* Contact Person (Optional) */}
          <Input
            label="Contact Person"
            placeholder="e.g., John Smith"
            value={formData.contact_person || ''}
            onChange={(e) => handleChange('contact_person', e.target.value)}
            onBlur={() => handleBlur('contact_person')}
            error={errors.contact_person}
            helperText="Optional - Primary contact for this location"
          />
        </div>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} loading={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
