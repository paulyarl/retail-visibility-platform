"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input, Alert, Button } from '@/components/ui';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

interface BrandingSocialStepProps {
  tenantId: string;
  initialData?: Partial<BusinessProfile>;
  onDataChange: (data: Partial<BusinessProfile>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourpage', icon: '📘' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle', icon: '📸' },
  { key: 'twitter', label: 'Twitter/X', placeholder: 'https://twitter.com/yourhandle', icon: '🐦' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourcompany', icon: '💼' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel', icon: '📺' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle', icon: '🎵' },
];

export default function BrandingSocialStep({
  tenantId,
  initialData = {},
  onDataChange,
  onValidationChange,
}: BrandingSocialStepProps) {
  const [formData, setFormData] = useState<Partial<BusinessProfile>>(initialData);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialData.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // This step is always valid (branding and social are optional)
    onValidationChange(true);
  }, [onValidationChange]);

  useEffect(() => {
    if (hasInitialized.current) return;
    if (Object.keys(initialData).length > 0) {
      hasInitialized.current = true;
      setFormData(initialData);
      setLogoPreview(initialData.logo_url || null);
    }
  }, [initialData]);

  const handleChange = (field: keyof BusinessProfile, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onDataChange(updated);
  };

  const handleSocialChange = (platform: string, value: string) => {
    const currentLinks = (formData.social_links as Record<string, string>) || {};
    const updated = {
      ...formData,
      social_links: {
        ...currentLinks,
        [platform]: value,
      },
    };
    setFormData(updated);
    onDataChange(updated);
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);

      // Optimize image
      const result = await uploadImage(file, ImageUploadPresets.logo);
      setLogoPreview(result.dataUrl);

      // Upload to server
      const uploadResult = await platformHomeService.uploadTenantLogo(tenantId, result.dataUrl, result.contentType);

      if (uploadResult.success && uploadResult.data?.url) {
        handleChange('logo_url', uploadResult.data.url);
        setLogoPreview(uploadResult.data.url);
      }
    } catch (err) {
      console.error('Logo upload error:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoUrlPaste = async (url: string) => {
    try {
      setUploadingLogo(true);
      const uploadResult = await platformHomeService.uploadTenantLogo(tenantId, url, 'image/*');

      if (uploadResult.success && uploadResult.data?.url) {
        handleChange('logo_url', uploadResult.data.url);
        setLogoPreview(uploadResult.data.url);
      }
    } catch (err) {
      console.error('Logo URL upload error:', err);
    } finally {
      setUploadingLogo(false);
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </motion.div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Branding & Social</h2>
        <p className="text-neutral-600">
          Add your brand identity and connect with customers on social media
        </p>
      </div>

      {/* Info Alert */}
      <Alert variant="info">
        A strong brand presence helps customers recognize and trust your business. All fields in this step are optional but recommended.
      </Alert>

      {/* Logo Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Business Logo
        </label>

        {/* Logo Preview */}
        {logoPreview && (
          <div className="flex justify-center mb-4">
            <div className="w-32 h-32 rounded-lg border border-neutral-200 overflow-hidden bg-neutral-50">
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
            </div>
          </div>
        )}

        {/* Upload Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* File Upload */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Upload from device</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
              disabled={uploadingLogo}
              className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Or paste logo URL</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/logo.png"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value) handleLogoUrlPaste(input.value);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {uploadingLogo && (
          <p className="text-xs text-primary-600 animate-pulse">Uploading logo...</p>
        )}
      </motion.div>

      {/* Business Description */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Business Description
        </label>
        <textarea
          value={formData.business_description || ''}
          onChange={(e) => handleChange('business_description', e.target.value)}
          placeholder="Tell customers about your business, what makes you unique, and what they can expect..."
          rows={4}
          maxLength={1000}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
        />
        <p className="text-xs text-neutral-500 mt-1">
          {(formData.business_description || '').length}/1000 characters
        </p>
      </motion.div>

      {/* Social Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Social Media Links
        </label>
        <p className="text-xs text-neutral-500 mb-3">
          Connect your social media profiles to improve your online presence
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => (
            <div key={platform.key}>
              <label className="block text-xs text-neutral-600 mb-1">
                {platform.icon} {platform.label}
              </label>
              <Input
                placeholder={platform.placeholder}
                value={((formData.social_links as Record<string, string>) || {})[platform.key] || ''}
                onChange={(e) => handleSocialChange(platform.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Skip Notice */}
      <div className="text-center text-xs text-neutral-500">
        You can skip this step and add branding later in Settings → Tenant
      </div>
    </div>
  );
}
