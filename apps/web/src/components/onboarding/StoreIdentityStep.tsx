"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input, Select, Alert, Button } from '@/components/ui';
import { BusinessProfile, onboardingProfileSchema, countries, normalizePhoneInput, geocodeAddress } from '@/lib/validation/businessProfile';
import { addressParser } from '@/lib/address-parser';
import { z } from 'zod';
import SlugPatternSelector from '@/components/tenants/SlugPatternSelector';
import { clientLogger } from '@/lib/client-logger';

// E.164 phone number validation
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Create a schema that only validates onboarding form fields and ignores extra fields
const onboardingFormSchema = z.object({
  business_name: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters')
    .trim(),
  
  address_line1: z.string({ message: 'Address is required' })
    .min(5, 'Address must be at least 5 characters')
    .max(200, 'Address must be less than 200 characters')
    .trim(),
  
  address_line2: z.string()
    .max(200, 'Address line 2 must be less than 200 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  city: z.string({ message: 'City is required' })
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    .trim(),
  
  state: z.string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  postal_code: z.string({ message: 'Postal code is required' })
    .min(3, 'Postal code must be at least 3 characters')
    .max(20, 'Postal code must be less than 20 characters')
    .trim(),
  
  country_code: z.string({ message: 'Country is required' })
    .length(2, 'Country code must be 2 characters (ISO 3166)')
    .toUpperCase(),
  
  phone_number: z.string({ message: 'Phone number is required' })
    .min(1, 'Phone number is required')
    .regex(phoneRegex, 'Phone must be in E.164 format (e.g., +1 202 555 1234)')
    .trim(),
  
  email: z.string()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Please enter a valid email address')
    .toLowerCase()
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  website: z.string()
    .refine((val) => !val || /^https:\/\//.test(val), 'Website must use HTTPS (e.g., https://www.example.com)')
    .toLowerCase()
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  contact_person: z.string()
    .max(100, 'Contact person must be less than 100 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
}).passthrough(); // This allows extra fields like latitude/longitude to pass through

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
  // console.log('[StoreIdentityStep] Received initialData:', initialData);
  
  // Use refs for callbacks to prevent infinite loops
  const onDataChangeRef = useRef(onDataChange);
  const onValidationChangeRef = useRef(onValidationChange);
  
  // Update refs when callbacks change
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);
  
  useEffect(() => {
    onValidationChangeRef.current = onValidationChange;
  }, [onValidationChange]);
  
  // Sanitize initial data to prevent hydration mismatches
  const sanitizedInitialData = sanitizeData(initialData);
  // Normalize phone number so loaded data always has E.164 +1 prefix
  if (sanitizedInitialData.phone_number) {
    sanitizedInitialData.phone_number = normalizePhoneInput(sanitizedInitialData.phone_number);
  }
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(sanitizedInitialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [geocoding, setGeocoding] = useState(false);
  const lastInitialDataRef = useRef<string>('');

  // Update form data when initialData changes (e.g., when navigating back from another step)
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      // Serialize to compare and prevent unnecessary updates
      const dataKey = JSON.stringify(initialData);
      if (dataKey !== lastInitialDataRef.current) {
        lastInitialDataRef.current = dataKey;
        const sanitized = sanitizeData(initialData);
        if (sanitized.phone_number) {
          sanitized.phone_number = normalizePhoneInput(sanitized.phone_number);
        }
        setFormData(sanitized);
      }
    }
  }, [initialData]);

  // Validate initial data once on mount
  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      try {
        onboardingFormSchema.parse(sanitizedInitialData);
        onValidationChangeRef.current(true);
      } catch (error) {
        if (error instanceof z.ZodError && error.issues) {
          const fieldErrors: Record<string, string> = {};
          error.issues.forEach((err: any) => {
            if (err.path.length > 0) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          onValidationChangeRef.current(false);
        }
      }
    }
  }, []); // Only run once on mount

  const validateField = (name: string, value: any) => {
    try {
      const fieldSchema = (onboardingFormSchema.shape as any)[name];
      if (fieldSchema) {
        fieldSchema.parse(value);
        // Clear error for this field if validation passes
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError && error.issues) {
        const errorMessage = error.issues[0]?.message || 'Invalid value';
        setErrors(prev => ({ ...prev, [name]: errorMessage }));
      }
    }
  };

  const handleChange = (name: keyof BusinessProfile, value: any) => {
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    onDataChangeRef.current(newData);

    // Mark field as touched when user changes it
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate field if it's been touched
    if (touched[name]) {
      validateField(name, value);
    }

    // Check overall validity using onboardingFormSchema
    try {
      onboardingFormSchema.parse(newData);
      setErrors({}); // Clear all errors on valid form
      onValidationChangeRef.current(true);
      // console.log('[StoreIdentityStep] Validation passed for:', newData);
    } catch (error) {
      if (error instanceof z.ZodError && error.issues) {
        // Extract all field errors and display them
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach((err: any) => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        
        // Mark all fields with errors as touched
        const newTouched = { ...touched };
        Object.keys(fieldErrors).forEach(key => {
          newTouched[key] = true;
        });
        setTouched(newTouched);
        
          // console.log('[StoreIdentityStep] Validation failed:', fieldErrors);
          // console.log('[StoreIdentityStep] Form data:', newData);
      } else {
        // console.log('[StoreIdentityStep] Validation error (non-Zod):', error);
      }
      onValidationChangeRef.current(false);
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
        onboardingFormSchema.parse(newData);
        onValidationChangeRef.current(true);
      } catch (error) {
        onValidationChangeRef.current(false);
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
        // console.log('[StoreIdentityStep] Got coordinates:', coordinates);
        const newData = {
          ...formData,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        };
        setFormData(newData);
        onDataChange(newData);
      }
    } catch (err) {
      clientLogger.error('[StoreIdentityStep] Failed to geocode address:', { detail: err });
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
