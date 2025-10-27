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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(formData.logo_url || null);

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
              helperText="Optional - Professional+ tier: Logo displays on product landing pages"
            />
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
