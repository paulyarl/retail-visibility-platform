'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Upload, 
  Eye, 
  EyeOff, 
  Palette, 
  Type, 
  Image as ImageIcon,
  Save,
  RotateCcw,
  Download,
  Trash2,
  Plus,
  Settings,
  Store,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Check,
  AlertCircle,
  Sparkles,
  Share2,
  CheckCircle
} from 'lucide-react';
import { SiFacebook, SiInstagram, SiX, SiYoutube } from '@icons-pack/react-simple-icons';

function SiLinkedin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { type Shop } from '@/services/ShopsService';
import { clientLogger } from '@/lib/client-logger';

interface ShopBrandingCustomizerProps {
  shop: Shop;
  onUpdate: (shop: Shop) => void;
  onCancel: () => void;
}

interface BrandingData {
  logoUrl: string;
  bannerUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  tagline: string;
  description: string;
  socialLinks: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    youtube: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  businessHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

const colorPresets = [
  { name: 'Ocean Blue', primary: '#0EA5E9', secondary: '#0284C7', accent: '#0369A1' },
  { name: 'Forest Green', primary: '#10B981', secondary: '#059669', accent: '#047857' },
  { name: 'Sunset Orange', primary: '#F97316', secondary: '#EA580C', accent: '#DC2626' },
  { name: 'Royal Purple', primary: '#7C3AED', secondary: '#6D28D9', accent: '#5B21B6' },
  { name: 'Rose Pink', primary: '#EC4899', secondary: '#DB2777', accent: '#BE185D' },
  { name: 'Slate Gray', primary: '#64748B', secondary: '#475569', accent: '#334155' },
];

const fontFamilies = [
  { name: 'Inter', value: 'Inter, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
];

export default function ShopBrandingCustomizer({ shop, onUpdate, onCancel }: ShopBrandingCustomizerProps) {
  const [activeTab, setActiveTab] = useState('visual');
  const [branding, setBranding] = useState<BrandingData>({
    logoUrl: shop.imageUrl || '',
    bannerUrl: shop.bannerUrl || '',
    primaryColor: '#0EA5E9',
    secondaryColor: '#0284C7',
    accentColor: '#0369A1',
    fontFamily: 'Inter, sans-serif',
    tagline: shop.description || '', // Use description as tagline fallback
    description: shop.description || '',
    socialLinks: {
      facebook: '', // Social links not available in current Shop interface
      instagram: '',
      twitter: '',
      linkedin: '',
      youtube: '',
    },
    contactInfo: {
      email: shop.contact?.email || '',
      phone: shop.contact?.phone || '',
      website: shop.contact?.website || '',
      address: shop.address || '',
      city: shop.location?.split(',')[1] || '', // Extract city from location
      state: '',
      country: '',
      postalCode: '',
    },
    businessHours: {
      monday: '9:00 AM - 6:00 PM',
      tuesday: '9:00 AM - 6:00 PM',
      wednesday: '9:00 AM - 6:00 PM',
      thursday: '9:00 AM - 6:00 PM',
      friday: '9:00 AM - 6:00 PM',
      saturday: '10:00 AM - 4:00 PM',
      sunday: 'Closed',
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(branding.logoUrl);
  const [bannerPreview, setBannerPreview] = useState(branding.bannerUrl);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Mock save - would be actual API call
      const updatedShop: Shop = {
        ...shop,
        ...branding,
        updatedAt: new Date().toISOString()
      };
      onUpdate(updatedShop);
    } catch (error) {
      clientLogger.error('Error saving branding:', { detail: error });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setBranding(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
        setBranding(prev => ({ ...prev, bannerUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const applyColorPreset = (preset: typeof colorPresets[0]) => {
    setBranding(prev => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    }));
  };

  const resetToDefaults = () => {
    setBranding({
      logoUrl: shop.imageUrl || '',
      bannerUrl: shop.bannerUrl || '',
      primaryColor: '#0EA5E9',
      secondaryColor: '#0284C7',
      accentColor: '#0369A1',
      fontFamily: 'Inter, sans-serif',
      tagline: shop.description || '',
      description: shop.description || '',
      socialLinks: {
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
        youtube: '',
      },
      contactInfo: {
        email: shop.contact?.email || '',
        phone: shop.contact?.phone || '',
        website: shop.contact?.website || '',
        address: shop.address || '',
        city: shop.location?.split(',')[1] || '',
        state: '',
        country: '',
        postalCode: '',
      },
      businessHours: {
        monday: '9:00 AM - 6:00 PM',
        tuesday: '9:00 AM - 6:00 PM',
        wednesday: '9:00 AM - 6:00 PM',
        thursday: '9:00 AM - 6:00 PM',
        friday: '9:00 AM - 6:00 PM',
        saturday: '10:00 AM - 4:00 PM',
        sunday: 'Closed',
      },
    });
  };

  const renderVisualTab = () => (
    <div className="space-y-6">
      {/* Logo and Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Shop Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-32 h-32 object-cover rounded-lg"
                />
              ) : (
                <div className="text-center">
                  <Store className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No logo uploaded</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="logo-upload" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </label>
              </Button>
              {logoPreview && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setLogoPreview('');
                    setBranding(prev => ({ ...prev, logoUrl: '' }));
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-500 text-center">
              Recommended: Square image, at least 200x200px
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Banner Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
              {bannerPreview ? (
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
                id="banner-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="banner-upload" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Banner
                </label>
              </Button>
              {bannerPreview && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setBannerPreview('');
                    setBranding(prev => ({ ...prev, bannerUrl: '' }));
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-500 text-center">
              Recommended: 1200x400px landscape image
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Color Scheme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Color Presets</label>
            <div className="grid grid-cols-3 gap-3">
              {colorPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  onClick={() => applyColorPreset(preset)}
                  className="h-16"
                  style={{
                    background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.secondary} 100%)`
                  }}
                >
                  <span className="text-white font-medium">{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <Input
                  value={branding.primaryColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, primaryColor: e.target.value }))}
                  placeholder="#0EA5E9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <Input
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  placeholder="#0284C7"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <Input
                  value={branding.accentColor}
                  onChange={(e) => setBranding(prev => ({ ...prev, accentColor: e.target.value }))}
                  placeholder="#0369A1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
            <Select value={branding.fontFamily} onChange={(e) => setBranding(prev => ({ ...prev, fontFamily: e.target.value }))}>
              {fontFamilies.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContentTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shop Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
            <Input
              value={branding.tagline}
              onChange={(e) => setBranding(prev => ({ ...prev, tagline: e.target.value }))}
              placeholder="A catchy phrase about your shop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <Textarea
              value={branding.description}
              onChange={(e) => setBranding(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Tell customers about your shop, what you offer, and what makes you special"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <Input
                value={branding.contactInfo.email}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, email: e.target.value }
                }))}
                placeholder="contact@yourshop.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <Input
                value={branding.contactInfo.phone}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, phone: e.target.value }
                }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <Input
                value={branding.contactInfo.website}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, website: e.target.value }
                }))}
                placeholder="https://yourshop.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
              <Input
                value={branding.contactInfo.address}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, address: e.target.value }
                }))}
                placeholder="123 Main Street"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <Input
                value={branding.contactInfo.city}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, city: e.target.value }
                }))}
                placeholder="New York"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <Input
                value={branding.contactInfo.state}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, state: e.target.value }
                }))}
                placeholder="NY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <Input
                value={branding.contactInfo.country}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, country: e.target.value }
                }))}
                placeholder="United States"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
              <Input
                value={branding.contactInfo.postalCode}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  contactInfo: { ...prev.contactInfo, postalCode: e.target.value }
                }))}
                placeholder="10001"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSocialTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Social Media Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: SiFacebook, name: 'Facebook', key: 'facebook' },
            { icon: SiInstagram, name: 'Instagram', key: 'instagram' },
            { icon: SiX, name: 'Twitter', key: 'twitter' },
            { icon: SiLinkedin, name: 'LinkedIn', key: 'linkedin' },
            { icon: SiYoutube, name: 'YouTube', key: 'youtube' }
          ].map(({ icon: Icon, name, key }) => (
            <div key={key} className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{name}</label>
                <Input
                  value={branding.socialLinks[key as keyof typeof branding.socialLinks]}
                  onChange={(e) => setBranding(prev => {
                    const newSocialLinks = { ...prev.socialLinks };
                    newSocialLinks[key as keyof typeof branding.socialLinks] = e.target.value;
                    return {
                      ...prev,
                      socialLinks: newSocialLinks
                    };
                  })}
                  placeholder={`https://${name.toLowerCase()}.com/yourshop`}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Business Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { day: 'Monday', key: 'monday' },
            { day: 'Tuesday', key: 'tuesday' },
            { day: 'Wednesday', key: 'wednesday' },
            { day: 'Thursday', key: 'thursday' },
            { day: 'Friday', key: 'friday' },
            { day: 'Saturday', key: 'saturday' },
            { day: 'Sunday', key: 'sunday' }
          ].map(({ day, key }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 w-20">{day}</span>
              <Input
                value={branding.businessHours[key as keyof typeof branding.businessHours]}
                onChange={(e) => setBranding(prev => ({
                  ...prev,
                  businessHours: { ...prev.businessHours, [key]: e.target.value }
                }))}
                placeholder="9:00 AM - 6:00 PM"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branding Customizer</h1>
          <p className="text-gray-600 mt-1">
            Customize the look and feel of {shop.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Preview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg p-8 border-2"
            style={{
              backgroundColor: branding.primaryColor,
              color: 'white',
              fontFamily: branding.fontFamily
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Shop logo"
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
                  <Store className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">{shop.name}</h2>
                {branding.tagline && (
                  <p className="text-lg opacity-90">{branding.tagline}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default">
                    {getShopStatus(shop)}
                  </Badge>
                  {shop.isVerified && (
                    <Badge variant="default" className="text-white border-white">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {bannerPreview && (
              <div className="mb-6">
                <img
                  src={bannerPreview}
                  alt="Shop banner"
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>{branding.contactInfo.website || 'No website'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{branding.contactInfo.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>{branding.contactInfo.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>
                  {branding.contactInfo.address && branding.contactInfo.city
                    ? `${branding.contactInfo.address}, ${branding.contactInfo.city}`
                    : 'No address'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visual">
                <Palette className="w-4 h-4 mr-2" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="content">
                <Type className="w-4 h-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="social">
                <Share2 className="w-4 h-4 mr-2" />
                Social
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual">{renderVisualTab()}</TabsContent>
            <TabsContent value="content">{renderContentTab()}</TabsContent>
            <TabsContent value="social">{renderSocialTab()}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to get shop status
function getShopStatus(shop: Shop): string {
  if (!shop.isActive) return 'Inactive';
  if (!shop.isVerified) return 'Pending';
  return 'Active';
}
