"use client";

import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Select, Alert } from '@/components/ui';
import { BusinessProfile, businessProfileSchema, countries, normalizePhoneInput, geocodeAddress } from '@/lib/validation/businessProfile';
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(formData.logo_url || null);
  const [geocoding, setGeocoding] = useState(false);

  // Reset form when modal opens/closes or profile changes
  useEffect(() => {
    if (isOpen) {
      setFormData(profile || {});
      setErrors({});
      setTouched({});
      setError(null);
      setSuccess(false);
      setLogoPreview(profile?.logo_url || null);
    }
  }, [isOpen, profile]);

  // Image compression helper
  const compressImage = async (file: File, maxWidth = 800, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        
        // Resize if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_failed"));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with compression
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      
      img.onerror = () => reject(new Error("image_load_failed"));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  };

  // Handle logo file upload
  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB');
        return;
      }

      // Compress image
      const dataUrl = await compressImage(file);
      setLogoPreview(dataUrl);

      // Get tenant ID from localStorage
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      if (!tenantId) {
        setError('No tenant selected');
        return;
      }

      // Upload to server
      const body = JSON.stringify({ 
        tenant_id: tenantId, 
        dataUrl, 
        contentType: "image/jpeg" 
      });

      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Upload failed");
        return;
      }

      // Update form data with uploaded URL
      const uploadedUrl = payload.url;
      if (uploadedUrl) {
        handleChange('logo_url', uploadedUrl);
        setLogoPreview(uploadedUrl);
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      setError('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Fetch and optimize pasted logo URL
  const optimizePastedLogoUrl = async (url: string) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Fetch the image from the URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch image from URL');
      }

      const blob = await response.blob();
      
      // Convert blob to File
      const file = new File([blob], 'logo.jpg', { type: blob.type || 'image/jpeg' });

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB');
        return null;
      }

      // Compress image
      const dataUrl = await compressImage(file, 400, 0.9); // Smaller size for logos

      // Get tenant ID from localStorage
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      if (!tenantId) {
        setError('No tenant selected');
        return null;
      }

      // Upload to server
      const body = JSON.stringify({ 
        tenant_id: tenantId, 
        dataUrl, 
        contentType: "image/jpeg" 
      });

      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error || "Upload failed");
        return null;
      }

      // Return the optimized URL
      return payload.url;
    } catch (err) {
      console.error('Failed to optimize pasted logo URL:', err);
      setError('Failed to fetch and optimize logo from URL');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

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
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate if touched
    if (touched[name]) {
      validateField(name, value);
    } else {
      // Live-clear error if the field becomes valid even before blur
      try {
        const fieldSchema = (businessProfileSchema.shape as any)[name];
        if (fieldSchema) {
          fieldSchema.parse(value);
          setErrors(prev => {
            const next = { ...prev };
            delete next[name as string];
            return next;
          });
        }
      } catch {/* keep existing error until blur */}
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

  const handleGeocodeAddress = async () => {
    if (!formData.address_line1 || !formData.city || !formData.postal_code || !formData.country_code) {
      setError('Please fill in address, city, postal code, and country before geocoding');
      return;
    }

    setGeocoding(true);
    setError(null);

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
        console.log('[Geocoding] Got coordinates:', coordinates);
        setFormData(prev => {
          const updated = {
            ...prev,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          };
          console.log('[Geocoding] Updated formData:', updated);
          return updated;
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Could not find coordinates for this address. Please check the address and try again.');
      }
    } catch (err) {
      setError('Failed to geocode address. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    try {
      // Clear any stale errors before validating
      setErrors({});
      setError(null);
      
      console.log('[EditBusinessProfile] formData before normalization:', {
        latitude: formData.latitude,
        longitude: formData.longitude,
      });
      
      // Normalize optional fields: convert empty string to undefined so optional() passes cleanly
      const normalized: Partial<BusinessProfile> = {
        ...formData,
        address_line2: formData.address_line2 ? formData.address_line2 : undefined,
        state: formData.state ? formData.state : undefined,
        website: formData.website ? formData.website : undefined,
        contact_person: formData.contact_person ? formData.contact_person : undefined,
        admin_email: (formData as any).admin_email ? (formData as any).admin_email : undefined,
        logo_url: formData.logo_url !== undefined ? formData.logo_url : undefined,
        business_description: formData.business_description ? formData.business_description : undefined,
        phone_number: formData.phone_number ? formData.phone_number : undefined,
        email: formData.email ? formData.email : undefined,
        // Explicitly include coordinates if they exist
        latitude: formData.latitude !== undefined && formData.latitude !== null ? formData.latitude : undefined,
        longitude: formData.longitude !== undefined && formData.longitude !== null ? formData.longitude : undefined,
      };
      const validatedData = businessProfileSchema.parse(normalized);
      
      console.log('[EditBusinessProfile] Saving profile with data:', {
        ...validatedData,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      });
      
      setSaving(true);
      setError(null);

      // Call parent's onSave callback (parent will handle API call with tenant_id)
      if (onSave) {
        await onSave(validatedData);
      }
      
      setSuccess(true);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Set all validation errors
        const newErrors: Record<string, string> = {};
        err.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(newErrors);
        // Mark errored fields as touched so per-field errors show
        setTouched((prev) => {
          const next = { ...prev } as Record<string, boolean>;
          Object.keys(newErrors).forEach((k) => { next[k] = true; });
          return next;
        });
        // Show the first validation message in the banner for clarity
        const firstMsg = Object.values(newErrors)[0];
        setError(firstMsg ? `Validation: ${firstMsg}` : 'Please fix the validation errors below');
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

          {/* Geocoding Section */}
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

          {/* Logo URL (Professional+ Tier) - with upload option */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Business Logo
            </label>
            
            {/* Logo Preview */}
            {logoPreview && (
              <div className="mb-3 flex items-center gap-3">
                <img 
                  src={logoPreview} 
                  alt="Logo preview" 
                  className="h-20 w-20 object-contain border border-neutral-200 rounded-lg bg-white p-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null);
                    handleChange('logo_url', '');
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-2 mb-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  disabled={uploadingLogo}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium text-center cursor-pointer">
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </div>
              </label>
            </div>

            {/* Manual URL Input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="Or paste logo URL: https://example.com/logo.png"
                  value={formData.logo_url || ''}
                  onChange={(e) => {
                    handleChange('logo_url', e.target.value);
                    setLogoPreview(e.target.value);
                  }}
                  onBlur={() => handleBlur('logo_url')}
                  error={errors.logo_url}
                  helperText="Optional - Click 'Optimize' to compress and upload to our servers"
                />
              </div>
              {formData.logo_url && formData.logo_url.startsWith('http') && (
                <button
                  type="button"
                  onClick={async () => {
                    const optimizedUrl = await optimizePastedLogoUrl(formData.logo_url!);
                    if (optimizedUrl) {
                      handleChange('logo_url', optimizedUrl);
                      setLogoPreview(optimizedUrl);
                    }
                  }}
                  disabled={uploadingLogo}
                  className="mt-6 px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                >
                  {uploadingLogo ? 'Optimizing...' : 'Optimize'}
                </button>
              )}
            </div>
          </div>

          {/* Business Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Business Description
            </label>
            <textarea
              value={formData.business_description || ''}
              onChange={(e) => handleChange('business_description', e.target.value)}
              onBlur={() => handleBlur('business_description')}
              placeholder="Tell customers about your business, your story, and what makes you unique..."
              rows={5}
              maxLength={1000}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.business_description && (
              <p className="text-sm text-red-600 mt-1">{errors.business_description}</p>
            )}
            <p className="text-xs text-neutral-500 mt-1">
              Optional - Describe your business (for platform use, not sent to Google Shopping)
            </p>
          </div>
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
