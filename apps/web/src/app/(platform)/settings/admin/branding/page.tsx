'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@mantine/core';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Palette, Type, Image as ImageIcon, Settings, Save, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';
import Image from 'next/image';
import { brandingSettingsService } from '@/services/BrandingSettingsSingletonService';

interface PlatformBranding {
  platformName: string;
  platformDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  themePreset: string;
  themeColors: {
    primary: string;
    accent: string;
    neutral: string;
    [key: string]: string;
  };
  themeFontFamily: string;
  themeBorderRadius: string;
  themeButtonSize: string;
  themeSpacing: number;
  // Contact Information
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactWebsite: string;
  // Social Media
  socialFacebook: string;
  socialTwitter: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialYoutube: string;
}

export default function PlatformBrandingPage() {
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');
  
  // Contact and social media state
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactAddress, setContactAddress] = useState<string>('');
  const [contactWebsite, setContactWebsite] = useState<string>('');
  const [socialFacebook, setSocialFacebook] = useState<string>('');
  const [socialTwitter, setSocialTwitter] = useState<string>('');
  const [socialInstagram, setSocialInstagram] = useState<string>('');
  const [socialLinkedIn, setSocialLinkedIn] = useState<string>('');
  const [socialYoutube, setSocialYoutube] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const data = await brandingSettingsService.getBrandingSettings();
      if (data) {
        // Map PlatformSettings to PlatformBranding interface
        const brandingData: PlatformBranding = {
          platformName: data.platformName || '',
          platformDescription: data.branding?.description || data.platformDescription || '',
          logoUrl: data.logoUrl || null,
          faviconUrl: data.faviconUrl || null,
          bannerUrl: data.bannerUrl || null,
          themePreset: data.themePreset || 'default',
          themeColors: data.themeColors || {
            primary: '#000000',
            accent: '#000000',
            neutral: '#000000'
          },
          themeFontFamily: data.themeFontFamily || 'default',
          themeBorderRadius: data.themeBorderRadius || 'default',
          themeButtonSize: data.themeButtonSize || 'default',
          themeSpacing: data.themeSpacing || 1,
          contactEmail: data.contactEmail || '',
          contactPhone: data.contactPhone || '',
          contactAddress: data.contactAddress || '',
          contactWebsite: data.contactWebsite || '',
          socialFacebook: data.socialFacebook || '',
          socialTwitter: data.socialTwitter || '',
          socialInstagram: data.socialInstagram || '',
          socialLinkedIn: data.socialLinkedIn || '',
          socialYoutube: data.socialYoutube || ''
        };
        setBranding(brandingData);
        setLogoPreview(brandingData.logoUrl || '');
        setFaviconPreview(brandingData.faviconUrl || '');
        setBannerPreview(brandingData.bannerUrl || '');
        
        // Initialize contact and social media fields
        setContactEmail(data.contactEmail || '');
        setContactPhone(data.contactPhone || '');
        setContactAddress(data.contactAddress || '');
        setContactWebsite(data.contactWebsite || '');
        setSocialFacebook(data.socialFacebook || '');
        setSocialTwitter(data.socialTwitter || '');
        setSocialInstagram(data.socialInstagram || '');
        setSocialLinkedIn(data.socialLinkedIn || '');
        setSocialYoutube(data.socialYoutube || '');
      } else {
        throw new Error('Failed to fetch branding settings');
      }
    } catch (error) {
      console.error('Error fetching branding:', error);
      toast('Failed to load branding settings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!branding) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      
      // Add branding data
      formData.append('platformName', branding.platformName);
      formData.append('platformDescription', branding.platformDescription);
      formData.append('themePreset', branding.themePreset);
      formData.append('themeFontFamily', branding.themeFontFamily);
      formData.append('themeBorderRadius', branding.themeBorderRadius);
      formData.append('themeButtonSize', branding.themeButtonSize);
      formData.append('themeSpacing', branding.themeSpacing.toString());
      
      // Add theme colors as JSON string
      formData.append('themeColors', JSON.stringify(branding.themeColors));
      
      // Add uploaded image URLs
      if (logoPreview) {
        formData.append('logoUrl', logoPreview);
      }
      if (faviconPreview) {
        formData.append('faviconUrl', faviconPreview);
      }
      if (bannerPreview) {
        formData.append('bannerUrl', bannerPreview);
      }
      
      // Add contact information
      formData.append('contactEmail', contactEmail);
      formData.append('contactPhone', contactPhone);
      formData.append('contactAddress', contactAddress);
      formData.append('contactWebsite', contactWebsite);
      
      // Add social media
      formData.append('socialFacebook', socialFacebook);
      formData.append('socialTwitter', socialTwitter);
      formData.append('socialInstagram', socialInstagram);
      formData.append('socialLinkedIn', socialLinkedIn);
      formData.append('socialYoutube', socialYoutube);

      const updatedBranding = await brandingSettingsService.updateBrandingSettingsWithFormData(formData);

      if (updatedBranding) {
        // Map PlatformSettings to PlatformBranding interface
        const brandingData: PlatformBranding = {
          platformName: updatedBranding.platformName || '',
          platformDescription: updatedBranding.branding?.description || updatedBranding.platformDescription || '',
          logoUrl: updatedBranding.logoUrl || null,
          faviconUrl: updatedBranding.faviconUrl || null,
          bannerUrl: updatedBranding.bannerUrl || null,
          themePreset: updatedBranding.themePreset || 'default',
          themeColors: updatedBranding.themeColors || {
            primary: '#000000',
            accent: '#000000',
            neutral: '#000000'
          },
          themeFontFamily: updatedBranding.themeFontFamily || 'default',
          themeBorderRadius: updatedBranding.themeBorderRadius || 'default',
          themeButtonSize: updatedBranding.themeButtonSize || 'default',
          themeSpacing: updatedBranding.themeSpacing || 1,
          contactEmail: updatedBranding.contactEmail || '',
          contactPhone: updatedBranding.contactPhone || '',
          contactAddress: updatedBranding.contactAddress || '',
          contactWebsite: updatedBranding.contactWebsite || '',
          socialFacebook: updatedBranding.socialFacebook || '',
          socialTwitter: updatedBranding.socialTwitter || '',
          socialInstagram: updatedBranding.socialInstagram || '',
          socialLinkedIn: updatedBranding.socialLinkedIn || '',
          socialYoutube: updatedBranding.socialYoutube || ''
        };
        setBranding(brandingData);
        setSuccess('Platform branding updated successfully!');
        toast('Platform branding updated successfully', { variant: 'success' });
      } else {
        throw new Error('Failed to update branding');
      }
    } catch (error) {
      console.error('Error saving branding:', error);
      setError('Failed to update branding settings');
      toast('Failed to update branding settings', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
    setUploadingLogo(true);

    try {
      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.logo);

      // Update preview
      setLogoPreview(result.dataUrl);
      setSuccess('Logo uploaded successfully!');
    } catch (error: any) {
      console.error('Logo upload error:', error);
      setError(error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
    setUploadingFavicon(true);

    try {
      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.favicon);

      // Update preview
      setFaviconPreview(result.dataUrl);
      setSuccess('Favicon uploaded successfully!');
    } catch (error: any) {
      console.error('Favicon upload error:', error);
      setError(error.message || 'Failed to upload favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    setError(null);
    setSuccess(null);
    setUploadingBanner(true);

    try {
      // Use centralized image upload middleware
      const result = await uploadImage(file, ImageUploadPresets.banner);

      // Update preview
      setBannerPreview(result.dataUrl);
      setSuccess('Banner uploaded successfully!');
    } catch (error: any) {
      console.error('Banner upload error:', error);
      setError(error.message || 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleColorChange = (colorKey: string, value: string) => {
    if (!branding) return;
    setBranding({
      ...branding,
      themeColors: {
        ...branding.themeColors,
        [colorKey]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading branding settings...</span>
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load branding settings</p>
          <Button onClick={fetchBranding} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Branding"
        description="Customize platform logo, name, colors, and appearance"
        icon={<ImageIcon className="h-6 w-6" />}
      />

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Configure your platform name and description
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="platformName">Platform Name</Label>
            <Input
              id="platformName"
              value={branding.platformName}
              onChange={(e) => setBranding({ ...branding, platformName: e.target.value })}
              placeholder="Visible Shelf"
            />
          </div>
          <div>
            <Label htmlFor="platformDescription">Platform Description</Label>
            <Textarea
              id="platformDescription"
              value={branding.platformDescription}
              onChange={(e) => setBranding({ ...branding, platformDescription: e.target.value })}
              placeholder="Retail visibility platform empowering local businesses..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Contact Information
          </CardTitle>
          <CardDescription>
            Configure platform contact details for invoices and communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="billing@platform.com"
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="contactAddress">Business Address</Label>
            <Textarea
              id="contactAddress"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="123 Business St, Suite 100, City, State 12345"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="contactWebsite">Website URL</Label>
            <Input
              id="contactWebsite"
              type="url"
              value={contactWebsite}
              onChange={(e) => setContactWebsite(e.target.value)}
              placeholder="https://platform.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Social Media
          </CardTitle>
          <CardDescription>
            Configure social media links for invoice footers and marketing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="socialFacebook">Facebook</Label>
              <Input
                id="socialFacebook"
                type="url"
                value={socialFacebook}
                onChange={(e) => setSocialFacebook(e.target.value)}
                placeholder="https://facebook.com/platform"
              />
            </div>
            <div>
              <Label htmlFor="socialTwitter">Twitter</Label>
              <Input
                id="socialTwitter"
                type="url"
                value={socialTwitter}
                onChange={(e) => setSocialTwitter(e.target.value)}
                placeholder="https://twitter.com/platform"
              />
            </div>
            <div>
              <Label htmlFor="socialInstagram">Instagram</Label>
              <Input
                id="socialInstagram"
                type="url"
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value)}
                placeholder="https://instagram.com/platform"
              />
            </div>
            <div>
              <Label htmlFor="socialLinkedIn">LinkedIn</Label>
              <Input
                id="socialLinkedIn"
                type="url"
                value={socialLinkedIn}
                onChange={(e) => setSocialLinkedIn(e.target.value)}
                placeholder="https://linkedin.com/company/platform"
              />
            </div>
            <div>
              <Label htmlFor="socialYoutube">YouTube</Label>
              <Input
                id="socialYoutube"
                type="url"
                value={socialYoutube}
                onChange={(e) => setSocialYoutube(e.target.value)}
                placeholder="https://youtube.com/channel/platform"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Assets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Visual Assets
          </CardTitle>
          <CardDescription>
            Upload your platform logo, favicon, and banner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div>
            <Label htmlFor="logo">Logo</Label>
            <div className="space-y-2">
              <Input
                id="logo"
                type="file"
                accept={getAcceptString(ImageUploadPresets.logo.allowedTypes)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleLogoUpload(file);
                  }
                }}
                disabled={uploadingLogo}
              />
              {logoPreview && (
                <div className="mt-2">
                  <Image
                    src={logoPreview}
                    alt="Platform Logo Preview"
                    width={200}
                    height={80}
                    className="object-cover rounded-md"
                  />
                </div>
              )}
              {uploadingLogo && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading logo...
                </div>
              )}
            </div>
          </div>

          {/* Favicon Upload */}
          <div>
            <Label htmlFor="favicon">Favicon</Label>
            <div className="space-y-2">
              <Input
                id="favicon"
                type="file"
                accept={getAcceptString(ImageUploadPresets.favicon.allowedTypes)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFaviconUpload(file);
                  }
                }}
                disabled={uploadingFavicon}
              />
              {faviconPreview && (
                <div className="mt-2">
                  <Image
                    src={faviconPreview}
                    alt="Platform Favicon Preview"
                    width={32}
                    height={32}
                    className="object-cover rounded-md"
                  />
                </div>
              )}
              {uploadingFavicon && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading favicon...
                </div>
              )}
            </div>
          </div>

          {/* Banner Upload */}
          <div>
            <Label htmlFor="banner">Banner</Label>
            <div className="space-y-2">
              <Input
                id="banner"
                type="file"
                accept={getAcceptString(ImageUploadPresets.banner.allowedTypes)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleBannerUpload(file);
                  }
                }}
                disabled={uploadingBanner}
              />
              {bannerPreview && (
                <div className="mt-2">
                  <Image
                    src={bannerPreview}
                    alt="Platform Banner Preview"
                    width={600}
                    height={200}
                    className="object-cover rounded-md"
                  />
                </div>
              )}
              {uploadingBanner && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading banner...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Configuration
          </CardTitle>
          <CardDescription>
            Customize colors, fonts, and visual appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Colors */}
          <div>
            <h4 className="text-sm font-medium mb-3">Theme Colors</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={branding.themeColors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    value={branding.themeColors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    placeholder="#7c3aed"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="accentColor"
                    type="color"
                    value={branding.themeColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    value={branding.themeColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    placeholder="#f59e0b"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="neutralColor">Neutral Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="neutralColor"
                    type="color"
                    value={branding.themeColors.neutral}
                    onChange={(e) => handleColorChange('neutral', e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    value={branding.themeColors.neutral}
                    onChange={(e) => handleColorChange('neutral', e.target.value)}
                    placeholder="#64748b"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography */}
          <div>
            <h4 className="text-sm font-medium mb-3">Typography</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fontFamily">Font Family</Label>
                <Input
                  id="fontFamily"
                  value={branding.themeFontFamily}
                  onChange={(e) => setBranding({ ...branding, themeFontFamily: e.target.value })}
                  placeholder='"Poppins", sans-serif'
                />
              </div>
              <div>
                <Label htmlFor="fontSize">Font Size</Label>
                <select
                  id="fontSize"
                  value={branding.themeButtonSize}
                  onChange={(e) => setBranding({ ...branding, themeButtonSize: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </div>
          </div>

          {/* Layout */}
          <div>
            <h4 className="text-sm font-medium mb-3">Layout</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="borderRadius">Border Radius</Label>
                <select
                  id="borderRadius"
                  value={branding.themeBorderRadius}
                  onChange={(e) => setBranding({ ...branding, themeBorderRadius: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
              <div>
                <Label htmlFor="spacing">Spacing (px)</Label>
                <Input
                  id="spacing"
                  type="number"
                  value={branding.themeSpacing}
                  onChange={(e) => setBranding({ ...branding, themeSpacing: parseInt(e.target.value) })}
                  placeholder="16"
                />
              </div>
              <div>
                <Label htmlFor="themePreset">Theme Preset</Label>
                <select
                  id="themePreset"
                  value={branding.themePreset}
                  onChange={(e) => setBranding({ ...branding, themePreset: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="vibrant">Vibrant</option>
                  <option value="minimal">Minimal</option>
                  <option value="professional">Professional</option>
                  <option value="playful">Playful</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
          variant="filled"
          style={{ color: 'white' }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
