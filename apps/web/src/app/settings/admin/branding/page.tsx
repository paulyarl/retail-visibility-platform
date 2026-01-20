'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Upload, Save, Eye, EyeOff, Palette, Type, Image, Settings } from 'lucide-react';

export default function BrandingPage() {
  const [branding, setBranding] = useState({
    platformName: 'Visible Shelf',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#3B82F6',
    secondaryColor: '#64748B',
    accentColor: '#F59E0B',
    customCSS: '',
    footerText: '© 2024 Visible Shelf. All rights reserved.',
    supportEmail: 'support@visibleshelf.store',
    privacyPolicyUrl: '/privacy',
    termsOfServiceUrl: '/terms'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    // Mock data - replace with actual API call
    setLoading(true);
    setTimeout(() => {
      setBranding({
        platformName: 'Visible Shelf',
        logoUrl: '/logo.png',
        faviconUrl: '/favicon.ico',
        primaryColor: '#3B82F6',
        secondaryColor: '#64748B',
        accentColor: '#F59E0B',
        customCSS: '',
        footerText: '© 2024 Visible Shelf. All rights reserved.',
        supportEmail: 'support@visibleshelf.store',
        privacyPolicyUrl: '/privacy',
        termsOfServiceUrl: '/terms'
      });
      setLoading(false);
    }, 1000);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Branding"
          description="Customize platform appearance and communications"
          icon={Icons.Settings}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Branding"
        description="Customize platform appearance and communications"
        icon={Icons.Settings}
      />

      {/* Preview Toggle */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-gray-600" />
              <span className="font-medium">Preview Mode</span>
            </div>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                previewMode ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  previewMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Basic Settings
            </CardTitle>
            <CardDescription>Platform name and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                value={branding.platformName}
                onChange={(e) => setBranding({...branding, platformName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={branding.supportEmail}
                onChange={(e) => setBranding({...branding, supportEmail: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Footer Text
              </label>
              <textarea
                value={branding.footerText}
                onChange={(e) => setBranding({...branding, footerText: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </CardContent>
        </Card>

        {/* Visual Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Visual Assets
            </CardTitle>
            <CardDescription>Logo, favicon, and images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Logo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" className="w-12 h-12" />
                  ) : (
                    <Upload className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favicon
              </label>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                  {branding.faviconUrl ? (
                    <img src={branding.faviconUrl} alt="Favicon" className="w-6 h-6" />
                  ) : (
                    <Upload className="h-3 w-3 text-gray-400" />
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Favicon
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color Scheme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color Scheme
            </CardTitle>
            <CardDescription>Platform colors and theme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({...branding, secondaryColor: e.target.value})}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({...branding, secondaryColor: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) => setBranding({...branding, accentColor: e.target.value})}
                  className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={branding.accentColor}
                  onChange={(e) => setBranding({...branding, accentColor: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Legal & Links
            </CardTitle>
            <CardDescription>Privacy policy and terms of service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Privacy Policy URL
              </label>
              <input
                type="url"
                value={branding.privacyPolicyUrl}
                onChange={(e) => setBranding({...branding, privacyPolicyUrl: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Terms of Service URL
              </label>
              <input
                type="url"
                value={branding.termsOfServiceUrl}
                onChange={(e) => setBranding({...branding, termsOfServiceUrl: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom CSS
              </label>
              <textarea
                value={branding.customCSS}
                onChange={(e) => setBranding({...branding, customCSS: e.target.value})}
                rows={4}
                placeholder="Add custom CSS rules..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="success">Live</Badge>
              <span className="text-sm text-gray-600">Changes are applied immediately</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline">
                Reset to Default
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
