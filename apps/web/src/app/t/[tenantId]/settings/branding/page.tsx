'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import Image from 'next/image';

export default function TenantBrandingPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');

  useEffect(() => {
    loadBranding();
  }, [tenantId]);

  const loadBranding = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/tenant/${encodeURIComponent(tenantId)}/profile`);
      
      if (response.ok) {
        const data = await response.json();
        setBusinessName(data.business_name || '');
        setTagline(data.business_description || '');
        setLogoUrl(data.logo_url || '');
        setLogoPreview(data.logo_url || '');
      }
    } catch (err) {
      console.error('Failed to load branding:', err);
      setError('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  };

  const compressImage = async (file: File, maxWidth = 800, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedReader = new FileReader();
              compressedReader.onloadend = () => {
                resolve(compressedReader.result as string);
              };
              compressedReader.readAsDataURL(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      setError(null);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }

      // Compress image
      const compressedBase64 = await compressImage(file);

      // Upload to backend
      const body = JSON.stringify({
        tenant_id: tenantId,
        dataUrl: compressedBase64,
        contentType: "image/jpeg" 
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
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
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <p className="text-green-800 dark:text-green-200">{success}</p>
          </Alert>
        )}

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Store Logo</CardTitle>
            <CardDescription>
              Upload your store logo. This will appear on your public landing page and in various places throughout the platform.
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
                  accept="image/*"
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
            disabled={loading || saving || uploadingLogo}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
