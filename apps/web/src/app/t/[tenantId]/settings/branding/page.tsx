'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label, Alert, Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import Image from 'next/image';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';

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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      // Fetch tenant info for name, logo, and banner
      const tenantResponse = await api.get(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantId)}`);
      let tenantName = '';
      let logoUrl = '';
      let bannerUrl = '';
      
      if (tenantResponse.ok) {
        const tenantData = await tenantResponse.json();
        tenantName = tenantData.name || '';
        // Logo and banner are stored in tenant.metadata
        logoUrl = tenantData.metadata?.logo_url || '';
        bannerUrl = tenantData.metadata?.banner_url || '';
      }
      
      // Fetch profile for business description
      let businessName = tenantName;
      let businessDescription = '';
      
      try {
        const response = await api.get(`${apiBaseUrl}/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`);
        if (response.ok) {
          const data = await response.json();
          // Use tenant name if no business_name is set, otherwise use business_name
          businessName = data.business_name || tenantName || '';
          businessDescription = data.business_description || '';
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
      const body = JSON.stringify({
        tenant_id: tenantId,
        dataUrl: result.dataUrl,
        contentType: result.contentType,
      });

      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Logo upload error:', errorData);
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      const payload = await res.json();
      const uploadedUrl = payload.url;
      
      if (uploadedUrl) {
        setLogoUrl(uploadedUrl);
        setLogoPreview(uploadedUrl);
        setSuccess('Logo uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
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
      const body = JSON.stringify({
        tenant_id: tenantId,
        dataUrl: result.dataUrl,
        contentType: result.contentType,
      });

      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/banner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Banner upload error:', errorData);
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      const payload = await res.json();
      const uploadedUrl = payload.url;
      
      if (uploadedUrl) {
        setBannerUrl(uploadedUrl);
        setBannerPreview(uploadedUrl);
        setSuccess('Banner uploaded successfully!');
        setTimeout(() => setSuccess(null), 3000);
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
    try {
      setSaving(true);
      setError(null);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      // Update tenant name
      const tenantResponse = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: businessName,
        }),
      });

      if (!tenantResponse.ok) {
        const errorData = await tenantResponse.json().catch(() => ({}));
        console.error('Tenant name update failed:', tenantResponse.status, errorData);
        throw new Error('Failed to update tenant name');
      }
      
      // Update profile (business description, logo, banner)
      const response = await fetch(`${apiBaseUrl}/tenant/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          business_name: businessName,
          business_description: tagline,
          logo_url: logoUrl,
          banner_url: bannerUrl,
        }),
      });

      if (response.ok) {
        setSuccess('Branding updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Save failed:', response.status, errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to update branding');
      }
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
