"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Input, Select, Alert } from '@/components/ui';
import { BusinessProfile, businessProfileSchema, countries, normalizePhoneInput } from '@/lib/validation/businessProfile';
import { z } from 'zod';

interface StoreIdentityStepProps {
  initialData?: Partial<BusinessProfile>;
  onDataChange: (data: Partial<BusinessProfile>) => void;
  onValidationChange: (isValid: boolean) => void;
}

export default function StoreIdentityStep({ 
  initialData = {}, 
  onDataChange,
  onValidationChange 
}: StoreIdentityStepProps) {
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Update formData when initialData changes (e.g., when API data loads)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      console.log('[StoreIdentityStep] Updating formData with initialData:', initialData);
      setFormData(initialData);
    }
  }, [initialData]);

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
          [name]: error.issues[0]?.message || 'Invalid value'
        }));
        return false;
      }
    }
    return false;
  };

  const handleChange = (name: keyof BusinessProfile, value: any) => {
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    onDataChange(newData);

    // Validate field if it's been touched
    if (touched[name]) {
      validateField(name, value);
    }

    // Check overall validity
    try {
      businessProfileSchema.parse(newData);
      onValidationChange(true);
    } catch {
      onValidationChange(false);
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </motion.div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Business Information</h2>
        <p className="text-neutral-600">
          Update your store details to help customers find you online
        </p>
      </div>

      {/* Info Alert */}
      <Alert variant="info">
        Complete business information improves your store's visibility in search results and builds customer trust.
      </Alert>

      {/* Form Fields */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Business Name */}
        <Input
          label="Business Name"
          placeholder="e.g., Downtown Electronics Store"
          value={formData.business_name || ''}
          onChange={(e) => handleChange('business_name', e.target.value)}
          onBlur={() => handleBlur('business_name')}
          error={touched.business_name ? errors.business_name : undefined}
          required
        />

        {/* Address Line 1 */}
        <Input
          label="Address Line 1"
          placeholder="e.g., 123 Main Street, Suite 100"
          value={formData.address_line1 || ''}
          onChange={(e) => handleChange('address_line1', e.target.value)}
          onBlur={() => handleBlur('address_line1')}
          error={touched.address_line1 ? errors.address_line1 : undefined}
          required
        />

        {/* Address Line 2 */}
        <Input
          label="Address Line 2"
          placeholder="Apartment, suite, unit, etc. (optional)"
          value={formData.address_line2 || ''}
          onChange={(e) => handleChange('address_line2', e.target.value)}
          onBlur={() => handleBlur('address_line2')}
          error={touched.address_line2 ? errors.address_line2 : undefined}
        />

        {/* City, State, Postal Code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="City"
            placeholder="e.g., New York"
            value={formData.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            onBlur={() => handleBlur('city')}
            error={touched.city ? errors.city : undefined}
            required
          />
          
          <Input
            label="State / Province"
            placeholder="e.g., NY"
            value={formData.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            onBlur={() => handleBlur('state')}
            error={touched.state ? errors.state : undefined}
          />
          
          <Input
            label="Postal Code"
            placeholder="e.g., 10001"
            value={formData.postal_code || ''}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            onBlur={() => handleBlur('postal_code')}
            error={touched.postal_code ? errors.postal_code : undefined}
            required
          />
        </div>

        {/* Country */}
        <Select
          label="Country"
          value={formData.country_code || ''}
          onChange={(e) => handleChange('country_code', e.target.value)}
          onBlur={() => handleBlur('country_code')}
          error={touched.country_code ? errors.country_code : undefined}
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
          error={touched.phone_number ? errors.phone_number : undefined}
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
          error={touched.email ? errors.email : undefined}
          required
        />

        {/* Website (Optional) */}
        <Input
          label="Website"
          placeholder="https://www.example.com"
          value={formData.website || ''}
          onChange={(e) => handleChange('website', e.target.value)}
          onBlur={() => handleBlur('website')}
          error={touched.website ? errors.website : undefined}
          helperText="Optional - Include https://"
        />

        {/* Contact Person (Optional) */}
        <Input
          label="Contact Person"
          placeholder="e.g., John Smith"
          value={formData.contact_person || ''}
          onChange={(e) => handleChange('contact_person', e.target.value)}
          onBlur={() => handleBlur('contact_person')}
          error={touched.contact_person ? errors.contact_person : undefined}
          helperText="Optional - Primary contact for this location"
        />
      </motion.div>
    </div>
  );
}
