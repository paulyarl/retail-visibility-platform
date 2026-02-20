'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { 
  Store, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { type Shop } from '@/services/ShopsService';
import SlugPatternSelector from './SlugPatternSelector';

interface ShopCreationWizardProps {
  tenantId: string;
  onComplete: (shop: Shop) => void;
  onCancel: () => void;
}

interface ShopFormData {
  name: string;
  slug: string;
  description: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  logoUrl: string;
  bannerUrl: string;
}

const initialFormData: ShopFormData = {
  name: '',
  slug: '',
  description: '',
  tagline: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  monday: '9:00 AM - 6:00 PM',
  tuesday: '9:00 AM - 6:00 PM',
  wednesday: '9:00 AM - 6:00 PM',
  thursday: '9:00 AM - 6:00 PM',
  friday: '9:00 AM - 6:00 PM',
  saturday: '10:00 AM - 4:00 PM',
  sunday: 'Closed',
  facebook: '',
  instagram: '',
  twitter: '',
  linkedin: '',
  youtube: '',
  logoUrl: '',
  bannerUrl: ''
};

export default function ShopCreationWizard({ tenantId, onComplete, onCancel }: ShopCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ShopFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const updateFormData = (field: keyof ShopFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          newErrors.name = 'Shop name is required';
        }
        if (!formData.slug.trim()) {
          newErrors.slug = 'Shop slug is required';
        } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formData.slug)) {
          newErrors.slug = 'Slug must be lowercase with hyphens only';
        }
        break;
      
      case 2:
        if (!formData.email.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Invalid email format';
        }
        if (formData.phone && !/^[\d\s\-\(\)]+$/.test(formData.phone)) {
          newErrors.phone = 'Invalid phone format';
        }
        if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
          newErrors.website = 'Website must start with http:// or https://';
        }
        break;
      
      case 3:
        if (!formData.address.trim()) {
          newErrors.address = 'Address is required';
        }
        if (!formData.city.trim()) {
          newErrors.city = 'City is required';
        }
        if (!formData.state.trim()) {
          newErrors.state = 'State is required';
        }
        if (!formData.country.trim()) {
          newErrors.country = 'Country is required';
        }
        if (!formData.postalCode.trim()) {
          newErrors.postalCode = 'Postal code is required';
        }
        break;
      
      case 4:
        // Final validation - all fields should be valid by now
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      // Mock API call - would be actual shop creation
      const newShop: Shop = {
        tenantId,
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        contact: {
          email: formData.email,
          phone: formData.phone,
          website: formData.website
        },
        address: formData.address,
        location: `${formData.city}, ${formData.state}`, // Combine city and state into location
        // Remove individual city, state, country, postalCode as they're not in Shop interface
        // Remove business hours as they're not in Shop interface
        // Remove social media and logoUrl as they're not in Shop interface
        imageUrl: formData.logoUrl, // Map logoUrl to imageUrl
        bannerUrl: formData.bannerUrl,
        autoId: `shop-${Date.now()}`, // Add missing autoId
        category: 'general', // Add missing category
        urls: { // Add missing urls
          slugUrl: `/directory/${formData.slug}`,
          tenantIdUrl: `/directory/${tenantId}`,
          autoIdUrl: `/directory/${tenantId}`,
          canonicalUrl: `/directory/${formData.slug}`
        },
        isVerified: false,
        isActive: true,
        rating: 0,
        reviewCount: 0,
        productCount: 0,
        // Remove followerCount as it's not in Shop interface
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      onComplete(newShop);
    } catch (error) {
      console.error('Error creating shop:', error);
      setErrors({ submit: 'Failed to create shop. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        updateFormData('logoUrl', reader.result as string);
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
        updateFormData('bannerUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="Enter your shop name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) => updateFormData('city', e.target.value)}
                      placeholder="Enter city"
                      className={errors.city ? 'border-red-500' : ''}
                    />
                    {errors.city && (
                      <p className="text-sm text-red-600">{errors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <Input
                      value={formData.state}
                      onChange={(e) => updateFormData('state', e.target.value)}
                      placeholder="Enter state"
                      className={errors.state ? 'border-red-500' : ''}
                    />
                    {errors.city && (
                      <p className="text-sm text-red-600">{errors.state}</p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Tip:</strong> Adding your city and state helps generate better URL options that are easier to find in search results.
                  </p>
                </div>

                <SlugPatternSelector
                  businessName={formData.name}
                  location={{
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                  }}
                  tenantId={tenantId}
                  selectedSlug={formData.slug}
                  onSlugSelect={(slug) => updateFormData('slug', slug)}
                  className={errors.slug ? 'border-red-500 rounded-lg p-4' : ''}
                />
                {errors.slug && (
                  <p className="text-sm text-red-600 mt-2">{errors.slug}</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tagline
                  </label>
                  <Input
                    value={formData.tagline}
                    onChange={(e) => updateFormData('tagline', e.target.value)}
                    placeholder="A short catchy phrase about your shop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder="Tell customers about your shop, what you offer, and what makes you special"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    placeholder="contact@yourshop.com"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <Input
                    value={formData.website}
                    onChange={(e) => updateFormData('website', e.target.value)}
                    placeholder="https://yourshop.com"
                    className={errors.website ? 'border-red-500' : ''}
                  />
                  {errors.website && (
                    <p className="text-sm text-red-600">{errors.website}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => updateFormData('address', e.target.value)}
                    placeholder="123 Main Street"
                    className={errors.address ? 'border-red-500' : ''}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-600">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <Input
                      value={formData.city}
                      onChange={(e) => updateFormData('city', e.target.value)}
                      placeholder="New York"
                      className={errors.city ? 'border-red-500' : ''}
                    />
                    {errors.city && (
                      <p className="text-sm text-red-600">{errors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State *
                    </label>
                    <Input
                      value={formData.state}
                      onChange={(e) => updateFormData('state', e.target.value)}
                      placeholder="NY"
                      className={errors.state ? 'border-red-500' : ''}
                    />
                    {errors.state && (
                      <p className="text-sm text-red-600">{errors.state}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <Input
                      value={formData.country}
                      onChange={(e) => updateFormData('country', e.target.value)}
                      placeholder="United States"
                      className={errors.country ? 'border-red-500' : ''}
                    />
                    {errors.country && (
                      <p className="text-sm text-red-600">{errors.country}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code *
                    </label>
                    <Input
                      value={formData.postalCode}
                      onChange={(e) => updateFormData('postalCode', e.target.value)}
                      placeholder="10001"
                      className={errors.postalCode ? 'border-red-500' : ''}
                    />
                    {errors.postalCode && (
                      <p className="text-sm text-red-600">{errors.postalCode}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Branding</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Logo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
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
                      <p className="text-sm text-gray-500">
                        Recommended: Square image, at least 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden">
                      {bannerPreview ? (
                        <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
                          <Store className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div>
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
                      <p className="text-sm text-gray-500">
                        Recommended: 1200x400px landscape image
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Business Hours</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { day: 'Monday', value: 'monday' },
                      { day: 'Tuesday', value: 'tuesday' },
                      { day: 'Wednesday', value: 'wednesday' },
                      { day: 'Thursday', value: 'thursday' },
                      { day: 'Friday', value: 'friday' },
                      { day: 'Saturday', value: 'saturday' },
                      { day: 'Sunday', value: 'sunday' }
                    ].map(({ day, value }) => (
                      <div key={value} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 w-20">{day}</span>
                        <Input
                          value={formData[value as keyof ShopFormData]}
                          onChange={(e) => updateFormData(value as keyof ShopFormData, e.target.value)}
                          placeholder="9:00 AM - 6:00 PM"
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Social Media</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { icon: 'Facebook', value: 'facebook', placeholder: 'https://facebook.com/yourshop' },
                      { icon: 'Instagram', value: 'instagram', placeholder: 'https://instagram.com/yourshop' },
                      { icon: 'Twitter', value: 'twitter', placeholder: 'https://twitter.com/yourshop' },
                      { icon: 'LinkedIn', value: 'linkedin', placeholder: 'https://linkedin.com/company/yourshop' },
                      { icon: 'YouTube', value: 'youtube', placeholder: 'https://youtube.com/yourshop' }
                    ].map(({ icon, value, placeholder }) => (
                      <div key={value}>
                        <Input
                          value={formData[value as keyof ShopFormData]}
                          onChange={(e) => updateFormData(value as keyof ShopFormData, e.target.value)}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Shop</h1>
          <p className="text-gray-600 mt-1">
            Set up your shop in just a few steps
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progress)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="p-8">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        {currentStep === totalSteps ? (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Shop...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Shop
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Error Display */}
      {errors.submit && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{errors.submit}</span>
          </div>
        </div>
      )}
    </div>
  );
}
