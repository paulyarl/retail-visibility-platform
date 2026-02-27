'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Alert, Spinner } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import Image from 'next/image';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function TenantBrandingPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Centralized access control - Platform Support or Tenant Admin
  const { hasAccess, loading: accessLoading, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');

  useEffect(() => {
    loadBranding();
  }, [tenantId]);

  const loadBranding = async () => {
    try {
      // Fetch tenant info for name, logo, and banner
      const tenantData = await platformHomeService.getTenant(tenantId);
      let tenantName = '';
      let logoUrl = '';
      let bannerUrl = '';
      
      if (tenantData) {
        tenantName = tenantData.name || '';
        // Logo and banner are stored in tenant.metadata
        logoUrl = tenantData.metadata?.logo_url || '';
        bannerUrl = tenantData.metadata?.banner_url || '';
      }

      // If no logo in metadata, try to get it from mv_global_discovery
      if (!logoUrl) {
        try {
          const logoData = await platformHomeService.getTenantLogo(tenantId);
          if (logoData?.success && logoData.data && logoData.data.length > 0) {
            logoUrl = logoData.data[0].tenant_logo_url || '';
            console.log('[Branding] Found logo from mv_global_discovery:', logoUrl);
          }
        } catch (logoErr) {
          console.warn('Failed to fetch logo from mv_global_discovery:', logoErr);
        }
      }
      
      // Fetch profile for business description
      let businessName = tenantName;
      let businessDescription = '';
      
      try {
        const profileData = await platformHomeService.getTenantProfile(tenantId);
        if (profileData) {
          // Use tenant name if no business_name is set, otherwise use business_name
          businessName = profileData?.business_name || tenantName || '';
          businessDescription = profileData?.website || '';
          
          // Also check for logo and banner in the profile (these might be custom fields)
          if (!logoUrl) logoUrl = (profileData as any)?.profile?.logo_url || '';
          if (!bannerUrl) bannerUrl = (profileData as any)?.profile?.banner_url || '';
        }
      } catch (profileErr) {
        console.warn('Profile fetch failed, using tenant name:', profileErr);
      }
      
      // Set all state
      setBusinessName(businessName);
      setTagline(businessDescription);
      setLogoUrl(logoUrl);
      setLogoPreview(logoUrl);
      setBannerUrl(bannerUrl);
      setBannerPreview(bannerUrl);
    } catch (err) {
      console.error('Failed to load branding:', err);
      setError('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.logo);

      // Upload to backend
      const payload = await platformHomeService.uploadTenantLogo(tenantId, result.dataUrl, result.contentType);
      const uploadedUrl = payload.url;
      
      if (uploadedUrl) {
        console.log('[Branding] Logo upload successful, URL:', uploadedUrl);
        setLogoUrl(uploadedUrl);
        setLogoPreview(uploadedUrl);
        setSuccess('Logo uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('[Branding] Logo upload response missing URL:', payload);
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setError(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleBannerUpload = async (file: File) => {
    try {
      setUploadingBanner(true);
      setError(null);

      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.banner);

      // Upload to backend
      const payload = await platformHomeService.uploadTenantBanner(tenantId, result.dataUrl, result.contentType);
      const uploadedUrl = payload.url;
      
      if (uploadedUrl) {
        console.log('[Branding] Banner upload successful, URL:', uploadedUrl);
        setBannerUrl(uploadedUrl);
        setBannerPreview(uploadedUrl);
        setSuccess('Banner uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        console.error('[Branding] Banner upload response missing URL:', payload);
      }
    } catch (err: any) {
      console.error('Banner upload error:', err);
      setError(err.message || 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleBannerUpload(file);
    }
  };

  const handleSave = async () => {
    console.log('[Branding] Save clicked with values:', {
      businessName,
      tagline,
      logoUrl,
      bannerUrl
    });
    
    try {
      setSaving(true);
      setError(null);

      // Update tenant name
      await platformHomeService.updateTenantName(tenantId, businessName);
      
      // Update profile (business description, logo, banner)
      console.log('[Branding] Sending profile update:', {
        tenant_id: tenantId,
        business_name: businessName,
        business_description: tagline,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      });
      
      const response = await platformHomeService.updateTenantProfileBranding(tenantId, {
        business_name: businessName,
        business_description: tagline,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      });

      setSuccess('Branding updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  // Access control checks
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You need tenant administrator privileges to manage branding settings."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Branding"
        description="Customize your store's visual identity and branding"
        icon={Icons.Settings}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert variant="error">
            <p>{error}</p>
          </Alert>
        )}

        {/* Success Alert */}
        {success && (
          <Alert variant="success" title="Success!">
            <p>{success}</p>
          </Alert>
        )}

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Store Logo (Square)</CardTitle>
            <CardDescription>
              Upload your square or circular logo. Used on: storefront, dashboard, sidebar, and profile pages. Must be roughly square (aspect ratio 1:2 to 2:1).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Preview */}
            {logoPreview && (
              <div className="flex justify-center p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <div className="relative w-48 h-48">
                  <Image
                    src={logoPreview}
                    alt="Store logo"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div>
              <Label htmlFor="logo-upload">Upload Logo</Label>
              <div className="mt-2">
                <input
                  id="logo-upload"
                  type="file"
                  accept={getAcceptString(ImageUploadPresets.logo.allowedTypes!)}
                  onChange={handleLogoChange}
                  disabled={uploadingLogo}
                  className="block w-full text-sm text-neutral-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100
                    dark:file:bg-primary-900/20 dark:file:text-primary-400
                    dark:hover:file:bg-primary-900/30
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                Recommended: Square image, 400x400px to 800x800px. Smaller files load faster and save storage. Max 5MB. Automatically optimized to 800px.
              </p>
              {uploadingLogo && (
                <p className="mt-2 text-sm text-primary-600 dark:text-primary-400">
                  Uploading and optimizing...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Banner Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Store Banner (Wide) - Optional</CardTitle>
            <CardDescription>
              Upload a wide banner image for a professional look on the items/inventory page. Optional - if not provided, the page will simply not show a banner (your logo appears in the sidebar anyway). Must be landscape/wide (aspect ratio at least 2:1, e.g., 1200x400).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Banner Preview */}
            {bannerPreview && (
              <div className="flex justify-center p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <div className="relative w-full max-w-2xl h-32">
                  <Image
                    src={bannerPreview}
                    alt="Store banner"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div>
              <Label htmlFor="banner-upload">Upload Banner</Label>
              <div className="mt-2">
                <input
                  id="banner-upload"
                  type="file"
                  accept={getAcceptString(ImageUploadPresets.banner.allowedTypes!)}
                  onChange={handleBannerChange}
                  disabled={uploadingBanner}
                  className="block w-full text-sm text-neutral-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100
                    dark:file:bg-primary-900/20 dark:file:text-primary-400
                    dark:hover:file:bg-primary-900/30
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                Recommended: Wide image, 1200x300px to 1200x400px. Max 5MB. Automatically optimized to 1200px width.
              </p>
              {uploadingBanner && (
                <p className="mt-2 text-sm text-primary-600 dark:text-primary-400">
                  Uploading and optimizing...
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Name & Tagline */}
        <Card>
          <CardHeader>
            <CardTitle>Store Identity</CardTitle>
            <CardDescription>
              Your business name and tagline as they appear to customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Store Name"
                disabled={loading}
              />
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                This updates both your tenant name and business profile
              </p>
            </div>

            <div>
              <Label htmlFor="tagline">Tagline / Description</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="A brief description of your business"
                disabled={loading}
              />
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                This appears on your landing page and in search results
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={loadBranding}
            disabled={loading || saving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving || uploadingLogo || uploadingBanner}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
