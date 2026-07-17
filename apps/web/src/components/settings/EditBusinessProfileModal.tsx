"use client";

import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Input, Select, Alert } from '@/components/ui';
import { BusinessProfile, businessProfileSchema, countries, normalizePhoneInput, geocodeAddress } from '@/lib/validation/businessProfile';
import { z } from 'zod';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import SlugPatternSelector from '@/components/shops/SlugPatternSelector';
import { Button } from '@mantine/core';
import { metaIntegrationService, MetaStatus } from '@/services/MetaIntegrationService';
import { tiktokIntegrationService, TikTokStatus } from '@/services/TikTokIntegrationService';
import { useSocialCommerceOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import Link from 'next/link';
import { clientLogger } from '@/lib/client-logger';

const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage', helperText: 'Your Facebook page URL' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle', helperText: 'Your Instagram profile URL' },
  { key: 'twitter', label: 'Twitter/X', placeholder: 'https://twitter.com/yourhandle', helperText: 'Your Twitter/X profile URL' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourcompany', helperText: 'Your LinkedIn company page URL' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel', helperText: 'Your YouTube channel URL' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle', helperText: 'Your TikTok profile URL' },
];

interface EditBusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BusinessProfile | Partial<BusinessProfile> | null;
  onSave?: (profile: BusinessProfile) => void;
  tenantId?: string;
}



export default function EditBusinessProfileModal({ 
  isOpen, 
  onClose, 
  profile,
  onSave,
  tenantId
}: EditBusinessProfileModalProps) {
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(profile || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pastedLogoUrl, setPastedLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(formData.logo_url || null);
  const [geocoding, setGeocoding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [metaOAuth, setMetaOAuth] = useState<MetaStatus | null>(null);
  const [tiktokOAuth, setTiktokOAuth] = useState<TikTokStatus | null>(null);
  const { data: socialCap } = useSocialCommerceOptionsCapability(tenantId || null);

  // Reset form when modal opens/closes or profile changes
  useEffect(() => {
    if (isOpen) {
      setFormData(profile || {});
      setErrors({});
      setTouched({});
      setError(null);
      setSuccess(false);
      setLogoPreview(profile?.logo_url || null);

      // Fetch OAuth connection status for Meta and TikTok
      const tid = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);
      if (tid) {
        metaIntegrationService.getOAuthStatus(tid).then(setMetaOAuth).catch(() => setMetaOAuth(null));
        tiktokIntegrationService.getOAuthStatus(tid).then(setTiktokOAuth).catch(() => setTiktokOAuth(null));
      }
    }
  }, [isOpen, profile, tenantId]);

  // Fetch and optimize pasted logo URL
  const optimizePastedLogoUrl = async (url: string) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Fetch the image from URL using service with caching
      const { imageFetchService } = await import('@/services/ImageFetchService');
      const file = await imageFetchService.fetchExternalImageAsFile(url, 'logo.png');
      
      if (!file) {
        throw new Error('Failed to fetch image from URL');
      }

      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.logo);

      // Get tenant ID from localStorage
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      if (!tenantId) {
        setError('No tenant selected');
        return null;
      }

      // Upload logo using service with automatic cache invalidation
      const uploadResult = await platformHomeService.uploadTenantLogo(tenantId, result.dataUrl, result.contentType);
      
      if (!uploadResult.success) {
        setError(uploadResult.error || 'Upload failed');
        return null;
      }

      // Return the optimized URL
      return uploadResult.data?.url || uploadResult.data?.dataUrl;
    } catch (err: any) {
      clientLogger.error('Failed to optimize pasted logo URL:', { detail: err });
      setError(err.message || 'Failed to fetch and optimize logo from URL');
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle logo file upload
  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.logo);
      setLogoPreview(result.dataUrl);

      // Get tenant ID from localStorage
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      if (!tenantId) {
        setError('No tenant selected');
        return;
      }

      // Upload logo using service with automatic cache invalidation
      const uploadResult = await platformHomeService.uploadTenantLogo(tenantId, result.dataUrl, result.contentType);
      
      if (!uploadResult.success) {
        setError(uploadResult.error || 'Upload failed');
        return;
      }

      // Update form data with uploaded URL
      const uploadedUrl = uploadResult.data?.url || uploadResult.data?.dataUrl;
      if (uploadedUrl) {
        handleChange('logo_url', uploadedUrl);
        setLogoPreview(uploadedUrl);
      }
    } catch (err: any) {
      clientLogger.error('Logo upload error:', { detail: err });
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Upload logo from pasted URL
  const handleUploadLogoFromUrl = async () => {
    if (!pastedLogoUrl.trim()) return;

    try {
      setUploadingLogo(true);
      setError(null);

      // Get tenant ID from localStorage
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      if (!tenantId) {
        setError('No tenant selected');
        return;
      }

      // Upload logo using service with automatic cache invalidation
      const result = await platformHomeService.uploadTenantLogo(tenantId, pastedLogoUrl, 'image/*');
      
      if (!result.success) {
        setError(result.error || 'Upload failed');
        return;
      }

      // Update form with new logo URL
      setFormData(prev => ({ ...prev, logo_url: result.data?.logo_url || result.data?.dataUrl }));
      setLogoPreview(result.data?.logo_url || result.data?.dataUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      clientLogger.error('[EditBusinessProfile] Error uploading logo from URL:', { detail: err });
      setError(err instanceof Error ? err.message : 'Upload failed');
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
        logo_url: formData.logo_url || undefined,
        business_description: formData.business_description || undefined,
        phone_number: formData.phone_number ? formData.phone_number : undefined,
        email: formData.email ? formData.email : undefined,
        // Include social links if they exist
        social_links: formData.social_links && Object.keys(formData.social_links).length > 0 ? formData.social_links : undefined,
        // Explicitly include coordinates if they exist
        latitude: formData.latitude !== undefined && formData.latitude !== null ? formData.latitude : undefined,
        longitude: formData.longitude !== undefined && formData.longitude !== null ? formData.longitude : undefined,
        // Include slug if selected
        slug: (formData as any).slug || undefined,
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

          {/* City and State - moved before slug selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Info box explaining why location helps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Adding your city and state helps generate better URL options that are easier to find in search results.
            </p>
          </div>

          {/* Slug Pattern Selector */}
          <SlugPatternSelector
            businessName={formData.business_name || ''}
            location={{
              city: formData.city,
              state: formData.state,
              country: formData.country_code,
            }}
            tenantId={tenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') || undefined : undefined)}
            selectedSlug={(formData as any).slug || ''}
            onSlugSelect={(slug) => handleChange('slug' as any, slug)}
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

          {/* Postal Code */}
          <Input
            label="Postal Code"
            placeholder="e.g., 10001"
            value={formData.postal_code || ''}
            onChange={(e) => handleChange('postal_code', e.target.value)}
            onBlur={() => handleBlur('postal_code')}
            error={errors.postal_code}
            required
          />

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
                variant="gradient"
                style={{color:'white'}}
                size="lg"
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

          {/* Social Links (Optional) */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Social Links
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              Optional - Connect your social media profiles for better SEO and customer engagement
            </p>

            {SOCIAL_PLATFORMS.map((platform) => {
              const isMetaPlatform = platform.key === 'facebook' || platform.key === 'instagram';
              const isTikTokPlatform = platform.key === 'tiktok';
              const metaConnected = isMetaPlatform && metaOAuth?.isConnected && !metaOAuth.isExpired;
              const tiktokConnected = isTikTokPlatform && tiktokOAuth?.isConnected && !tiktokOAuth.isExpired;
              const metaExpired = isMetaPlatform && metaOAuth?.isExpired;
              const tiktokExpired = isTikTokPlatform && tiktokOAuth?.isExpired;
              const tid = tenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);

              return (
                <div key={platform.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {platform.label}
                    </label>
                    {metaConnected && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Commerce Connected
                      </span>
                    )}
                    {tiktokConnected && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Shop Connected
                      </span>
                    )}
                    {metaExpired && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Reconnect needed
                      </span>
                    )}
                    {tiktokExpired && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Reconnect needed
                      </span>
                    )}
                    {isMetaPlatform && !metaConnected && !metaExpired && (formData.social_links as any)?.[platform.key] && tid && socialCap?.metaEnabled && (
                      <Link
                        href={`/t/${tid}/settings/integrations/meta`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Connect for Commerce
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    )}
                    {isTikTokPlatform && !tiktokConnected && !tiktokExpired && (formData.social_links as any)?.[platform.key] && tid && socialCap?.tiktokEnabled && (
                      <Link
                        href={`/t/${tid}/settings/integrations/tiktok`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Connect for Commerce
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    )}
                  </div>
                  <Input
                    placeholder={platform.placeholder}
                    value={(formData.social_links as any)?.[platform.key] || ''}
                    onChange={(e) => {
                      const currentLinks = formData.social_links || {};
                      handleChange('social_links', {
                        ...currentLinks,
                        [platform.key]: e.target.value
                      });
                    }}
                    onBlur={() => handleBlur('social_links')}
                    error={errors.social_links}
                    helperText={platform.helperText}
                  />
                </div>
              );
            })}
          </div>

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

            {/* URL Paste Input */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <Input
                  type="url"
                  placeholder="Or paste logo URL: https://example.com/logo.png"
                  value={pastedLogoUrl}
                  onChange={(e) => setPastedLogoUrl(e.target.value)}
                  disabled={uploadingLogo}
                />
              </div>
              <button
                type="button"
                onClick={handleUploadLogoFromUrl}
                disabled={!pastedLogoUrl.trim() || uploadingLogo}
                className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
              >
                {uploadingLogo ? 'Uploading...' : 'Upload from URL'}
              </button>
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
          <Button type="submit" variant="gradient" style={{color:'white'}} disabled={saving} loading={saving}>
            {saving ? 'Saving...' : 'Save Changes'} 
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
