"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input, Select, Alert, Button } from '@/components/ui';
import { BusinessProfile, onboardingProfileSchema, countries, normalizePhoneInput, geocodeAddress } from '@/lib/validation/businessProfile';
import { addressParser } from '@/lib/address-parser';
import { z } from 'zod';
import SlugPatternSelector from '@/components/tenants/SlugPatternSelector';

interface StoreIdentityStepProps {
  tenantId: string;
  initialData?: Partial<BusinessProfile>;
  onDataChange: (data: Partial<BusinessProfile>) => void;
  onValidationChange: (isValid: boolean) => void;
}

// Helper to sanitize data - treat whitespace-only strings as empty
const sanitizeData = (data: Partial<BusinessProfile>): Partial<BusinessProfile> => {
  const sanitized: Partial<BusinessProfile> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim() === '') {
      sanitized[key as keyof BusinessProfile] = '' as any;
    } else {
      sanitized[key as keyof BusinessProfile] = value as any;
    }
  }
  return sanitized;
};



export default function StoreIdentityStep({
  tenantId,
  initialData = {},
  onDataChange,
  onValidationChange
}: StoreIdentityStepProps) {
  // Sanitize initial data to prevent hydration mismatches
  const sanitizedInitialData = sanitizeData(initialData);
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(sanitizedInitialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [geocoding, setGeocoding] = useState(false);
  const hasInitializedFromInitialData = useRef(false);

  // Update formData when initialData changes (e.g., when API data loads)
  useEffect(() => {
    // Only hydrate once when non-empty initial data first arrives to avoid
    // infinite loops with onDataChange -> parent state -> initialData changes.
    if (hasInitializedFromInitialData.current) return;

    if (Object.keys(initialData).length > 0) {
      hasInitializedFromInitialData.current = true;
      console.log('[StoreIdentityStep] Updating formData with initialData:', initialData);
      const sanitized = sanitizeData(initialData);
      
      // Auto-convert HTTP to HTTPS for website field
      if (sanitized.website && typeof sanitized.website === 'string') {
        const website = sanitized.website.trim();
        if (website.toLowerCase().startsWith('http://')) {
          sanitized.website = 'https://' + website.substring(7);
          console.log('[StoreIdentityStep] Auto-converted HTTP to HTTPS:', sanitized.website);
        }
      }
      
      setFormData(sanitized);
      
      // Notify parent of the sanitized data (with HTTPS conversion)
      onDataChange(sanitized);
      
      // Validate the sanitized data (not the original initialData)
      // This ensures HTTP->HTTPS conversion is validated correctly
      // Use onboardingProfileSchema which only validates fields on the form
      try {
        onboardingProfileSchema.parse(sanitized);
        onValidationChange(true);
      } catch (error) {
        // Pre-populated data is incomplete - this is expected for new tenants
        // Show errors for all incomplete fields
        if (error instanceof z.ZodError) {
          const fieldErrors: Record<string, string> = {};
          error.issues.forEach(issue => {
            const fieldName = issue.path.join('.');
            if (!fieldErrors[fieldName]) {
              fieldErrors[fieldName] = issue.message;
            }
          });
          setErrors(fieldErrors);
          // Mark all fields with errors as touched so errors are visible
          setTouched(prev => {
            const newTouched = { ...prev };
            Object.keys(fieldErrors).forEach(key => {
              newTouched[key] = true;
            });
            return newTouched;
          });
        }
        onValidationChange(false);
      }
    }
  }, [initialData, onDataChange, onValidationChange]);

  const validateField = (name: string, value: any) => {
    try {
      const fieldSchema = (onboardingProfileSchema.shape as any)[name];
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

    // Mark field as touched when user changes it
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate field if it's been touched
    if (touched[name]) {
      validateField(name, value);
    }

    // Check overall validity using onboardingProfileSchema
    try {
      onboardingProfileSchema.parse(newData);
      setErrors({}); // Clear all errors on valid form
      onValidationChange(true);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Extract all field errors and display them
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(issue => {
          const fieldName = issue.path.join('.');
          if (!fieldErrors[fieldName]) {
            fieldErrors[fieldName] = issue.message;
          }
        });
        setErrors(fieldErrors);
        // Mark all fields with errors as touched so errors are visible
        setTouched(prev => {
          const newTouched = { ...prev };
          Object.keys(fieldErrors).forEach(key => {
            newTouched[key] = true;
          });
          return newTouched;
        });
      }
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

  const handleWebsiteChange = (value: string) => {
    // Auto-convert HTTP to HTTPS
    let normalized = value.trim();
    if (normalized && normalized.toLowerCase().startsWith('http://')) {
      normalized = 'https://' + normalized.substring(7);
    }
    handleChange('website', normalized);
  };

  const handleAddressChange = (value: string) => {
    // Check if this looks like a full address using the middleware
    const looksLikeFullAddress = addressParser.canParse(value);
    
    if (looksLikeFullAddress) {
      // Parse the full address using the middleware
      const parsed = addressParser.parse(value);
      
      // Update all fields at once
      const newData = { ...formData, ...parsed };
      setFormData(newData);
      onDataChange(newData);
      
      // Mark all populated fields as touched
      const newTouched = { ...touched };
      Object.keys(parsed).forEach(key => {
        newTouched[key] = true;
      });
      setTouched(newTouched);
      
      // Validate all populated fields
      Object.entries(parsed).forEach(([key, val]) => {
        validateField(key, val);
      });
      
      // Check overall validity
      try {
        onboardingProfileSchema.parse(newData);
        onValidationChange(true);
      } catch (error) {
        onValidationChange(false);
      }
    } else {
      // Normal single-field update
      handleChange('address_line1', value);
    }
  };

  // Handle geocoding to get coordinates from address
  const handleGeocodeAddress = async () => {
    if (!formData.address_line1 || !formData.city || !formData.postal_code || !formData.country_code) {
      return;
    }

    setGeocoding(true);

    try {
      const coordinates = await geocodeAddress({
        address_line1: formData.address_line1,
        address_line2: formData.address_line2,
        city: formData.city,
        state: formData.state,
        postal_code: formData.postal_code,
        country_code: formData.country_code,
      });

      if (coordinates) {
        console.log('[StoreIdentityStep] Got coordinates:', coordinates);
        const newData = {
          ...formData,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        };
        setFormData(newData);
        onDataChange(newData);
      }
    } catch (err) {
      console.error('[StoreIdentityStep] Failed to geocode address:', err);
    } finally {
      setGeocoding(false);
    }
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

        {/* City and State - moved before slug selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        {/* Info box explaining why location helps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Adding your city and state helps generate better URL options that are easier to find in search results.
          </p>
        </div>

        {/* Address Line 1 */}
        <Input
          label="Address Line 1"
          placeholder="Paste full address or enter street address"
          value={formData.address_line1 || ''}
          onChange={(e) => handleAddressChange(e.target.value)}
          onBlur={() => handleBlur('address_line1')}
          error={touched.address_line1 ? errors.address_line1 : undefined}
          helperText="💡 Tip: Paste a full address to auto-fill all fields (supports all 38 platform countries worldwide!)"
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

        {/* Postal Code */}
        <Input
          label="Postal Code"
          placeholder="e.g., 10001"
          value={formData.postal_code || ''}
          onChange={(e) => handleChange('postal_code', e.target.value)}
          onBlur={() => handleBlur('postal_code')}
          error={touched.postal_code ? errors.postal_code : undefined}
          required
        />

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

        {/* Slug Pattern Selector */}
        <SlugPatternSelector
          businessName={formData.business_name || ''}
          location={{
            city: formData.city,
            state: formData.state,
            country: formData.country_code,
          }}
          tenantId={tenantId}
          selectedSlug={(formData as any).slug || ''}
          onSlugSelect={(slug) => handleChange('slug' as any, slug)}
        />

        {/* Map Coordinates (Geocoding) */}
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
                Map Coordinates
              </h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Get latitude and longitude for map display
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGeocodeAddress}
              disabled={geocoding || !formData.address_line1 || !formData.city || !formData.postal_code || !formData.country_code}
              loading={geocoding}
            >
              {geocoding ? 'Getting...' : 'Get Coordinates'}
            </Button>
          </div>
          
          {formData.latitude && formData.longitude && (
            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Coordinates: {Number(formData.latitude).toFixed(6)}, {Number(formData.longitude).toFixed(6)}
              </span>
            </div>
          )}
        </div>

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
          onChange={(e) => handleWebsiteChange(e.target.value)}
          onBlur={() => handleBlur('website')}
          error={touched.website ? errors.website : undefined}
          helperText="Optional - HTTP will be auto-converted to HTTPS"
        />

        {/* Contact Person */}
        <Input
          label="Contact Person"
          placeholder="e.g., John Smith"
          value={formData.contact_person || ''}
          onChange={(e) => handleChange('contact_person', e.target.value)}
          onBlur={() => handleBlur('contact_person')}
          error={touched.contact_person ? errors.contact_person : undefined}
          helperText="Primary contact for this location"
          required
        />
      </motion.div>
    </div>
  );
}
