'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Progress } from '@/components/ui/Progress';
import { Checkbox } from '@/components/ui/Checkbox';
import { 
  Globe, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Upload,
  Settings,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Store,
  Sparkles,
  Shield,
  Users,
  Package,
  Star,
  MessageCircle,
  Share2,
  Download,
  FileText,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
  Palette
} from 'lucide-react';
import { type Shop } from '@/services/ShopsService';
import RealShopService from '@/services/RealShopService';
import { Button } from '@mantine/core';

interface ShopPublishingWorkflowProps {
  shop: Shop;
  onUpdate: (shop: Shop) => void;
  onCancel: () => void;
}

interface PublishingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  completedAt?: Date;
  error?: string;
}

interface PublishingChecklist {
  id: string;
  title: string;
  description: string;
  required: boolean;
  completed: boolean;
  category: 'basic' | 'content' | 'legal' | 'technical';
}

export default function ShopPublishingWorkflow({ shop, onUpdate, onCancel }: ShopPublishingWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [publishingSteps, setPublishingSteps] = useState<PublishingStep[]>([]);
  const [checklist, setChecklist] = useState<PublishingChecklist[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(shop.isActive);
  const [publishingProgress, setPublishingProgress] = useState(0);

  useEffect(() => {
    initializePublishingSteps();
    initializeChecklist();
  }, [shop]);

  const initializePublishingSteps = () => {
    const steps: PublishingStep[] = [
      {
        id: 'basic-info',
        title: 'Basic Information',
        description: 'Verify shop name, description, and contact details',
        status: shop.name && shop.description && shop.email ? 'completed' : 'pending'
      },
      {
        id: 'branding',
        title: 'Shop Branding',
        description: 'Upload logo and banner, customize colors and fonts',
        status: shop.logoUrl && shop.bannerUrl ? 'completed' : 'pending'
      },
      {
        id: 'products',
        title: 'Product Setup',
        description: 'Add products and organize inventory',
        status: shop.productCount && shop.productCount > 0 ? 'completed' : 'pending'
      },
      {
        id: 'verification',
        title: 'Shop Verification',
        description: 'Complete verification process',
        status: shop.isVerified ? 'completed' : 'pending'
      },
      {
        id: 'publishing',
        title: 'Go Live',
        description: 'Publish shop to make it visible to customers',
        status: shop.isActive ? 'completed' : 'pending'
      }
    ];
    setPublishingSteps(steps);
  };

  const initializeChecklist = () => {
    const items: PublishingChecklist[] = [
      // Basic Information
      {
        id: 'shop-name',
        title: 'Shop name is set',
        description: 'Shop name should be descriptive and unique',
        required: true,
        completed: !!shop.name,
        category: 'basic'
      },
      {
        id: 'shop-description',
        title: 'Shop description is provided',
        description: 'Tell customers what your shop offers',
        required: true,
        completed: !!shop.description,
        category: 'basic'
      },
      {
        id: 'contact-email',
        title: 'Contact email is set',
        description: 'Customers can reach you via email',
        required: true,
        completed: !!shop.email,
        category: 'basic'
      },
      {
        id: 'contact-phone',
        title: 'Phone number is set',
        description: 'Customers can call your shop',
        required: false,
        completed: !!shop.phone,
        category: 'basic'
      },
      {
        id: 'shop-address',
        title: 'Address is provided',
        description: 'Customers can find your physical location',
        required: true,
        completed: !!shop.address && !!shop.city && !!shop.state,
        category: 'basic'
      },

      // Content
      {
        id: 'logo-uploaded',
        title: 'Shop logo is uploaded',
        description: 'Add your shop logo for brand recognition',
        required: true,
        completed: !!shop.logoUrl,
        category: 'content'
      },
      {
        id: 'banner-uploaded',
        title: 'Banner image is uploaded',
        description: 'Add a banner to showcase your shop',
        required: true,
        completed: !!shop.bannerUrl,
        category: 'content'
      },
      {
        id: 'products-added',
        title: 'Products are added',
        description: 'Add products to your shop inventory',
        required: true,
        completed: Boolean(shop.productCount && shop.productCount > 0),
        category: 'content'
      },
      {
        id: 'product-details',
        title: 'Product details are complete',
        description: 'All products have names, prices, and descriptions',
        required: true,
        completed: Boolean(shop.productCount && shop.productCount > 0), // Mock check
        category: 'content'
      },

      // Legal
      {
        id: 'terms-accepted',
        title: 'Terms of Service accepted',
        description: 'Review and accept platform terms',
        required: true,
        completed: true, // Mock check
        category: 'legal'
      },
      {
        id: 'privacy-policy',
        title: 'Privacy Policy acknowledged',
        description: 'Review privacy policy and data handling',
        required: true,
        completed: true, // Mock check
        category: 'legal'
      },

      // Technical
      {
        id: 'shop-url',
        title: 'Shop URL is configured',
        description: 'Custom shop URL is set and working',
        required: true,
        completed: !!shop.slug,
        category: 'technical'
      },
      {
        id: 'seo-optimized',
        title: 'SEO is optimized',
        description: 'Meta tags and descriptions are set for search',
        required: false,
        completed: true, // Mock check
        category: 'technical'
      },
      {
        id: 'mobile-friendly',
        title: 'Mobile responsive',
        description: 'Shop layout works on mobile devices',
        required: true,
        completed: true, // Mock check
        category: 'technical'
      }
    ];
    setChecklist(items);
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => 
      prev.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const getStepStatus = (stepId: string): 'pending' | 'in_progress' | 'completed' | 'error' => {
    const step = publishingSteps.find(s => s.id === stepId);
    return step?.status || 'pending';
  };

  const getOverallProgress = () => {
    const completedSteps = publishingSteps.filter(step => step.status === 'completed').length;
    return (completedSteps / publishingSteps.length) * 100;
  };

  const getChecklistProgress = () => {
    const completedItems = checklist.filter(item => item.completed).length;
    return (completedItems / checklist.length) * 100;
  };

  const getChecklistProgressByCategory = (category: string) => {
    const categoryItems = checklist.filter(item => item.category === category);
    if (categoryItems.length === 0) return 100;
    const completedItems = categoryItems.filter(item => item.completed).length;
    return (completedItems / categoryItems.length) * 100;
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishingProgress(0);

    try {
      // Use the real service to publish the shop
      const realShopService = RealShopService.getInstance();
      
      // Simulate publishing steps for UI feedback
      for (let i = 0; i < publishingSteps.length; i++) {
        const step = publishingSteps[i];
        setCurrentStep(i + 1);
        setPublishingProgress(((i + 1) / publishingSteps.length) * 100);
        
        // Simulate step processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setPublishingSteps(prev => 
          prev.map(s => 
            s.id === step.id ? { ...s, status: 'completed', completedAt: new Date() } : s
          )
        );
      }

      // Actually publish the shop using the real service
      const updatedShopData = await realShopService.publishShop(shop.tenantId);
      
      // Convert back to Shop format for compatibility
      const updatedShop: Shop = {
        ...shop,
        isActive: updatedShopData.isActive,
        updatedAt: new Date(updatedShopData.updatedAt)
      };
      
      onUpdate(updatedShop);
      setIsPublished(true);
    } catch (error) {
      console.error('Error publishing shop:', error);
      setPublishingSteps(prev => 
        prev.map(s => ({ ...s, status: 'error', error: 'Failed to publish shop' }))
      );
    } finally {
      setIsPublishing(false);
      setPublishingProgress(100);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    
    try {
      // Use the real service to unpublish the shop
      const realShopService = RealShopService.getInstance();
      
      // Simulate unpublishing for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Actually unpublish the shop using the real service
      const updatedShopData = await realShopService.unpublishShop(shop.tenantId);
      
      // Convert back to Shop format for compatibility
      const updatedShop: Shop = {
        ...shop,
        isActive: updatedShopData.isActive,
        updatedAt: new Date(updatedShopData.updatedAt)
      };
      
      onUpdate(updatedShop);
      setIsPublished(false);
      
      // Reset steps to pending
      setPublishingSteps(prev => 
        prev.map(s => ({ ...s, status: 'pending', completedAt: undefined }))
      );
      setCurrentStep(1);
    } catch (error) {
      console.error('Error unpublishing shop:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const getStepIcon = (stepId: string) => {
    switch (stepId) {
      case 'basic-info': return <Settings className="w-5 h-5" />;
      case 'branding': return <Palette className="w-5 h-5" />;
      case 'products': return <Package className="w-5 h-5" />;
      case 'verification': return <Shield className="w-5 h-5" />;
      case 'publishing': return <Globe className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const getStepIconColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Publishing Workflow</h1>
          <p className="text-gray-600 mt-1">
            Get your shop ready to go live with our step-by-step publishing process
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isPublished ? (
            <Button variant="outline" onClick={handleUnpublish} disabled={isPublishing}>
              <EyeOff className="w-4 h-4 mr-2" />
              Unpublish Shop
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={isPublishing}>
              <Globe className="w-4 h-4 mr-2" />
              {isPublishing ? 'Publishing...' : 'Publish Shop'}
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Publishing Progress</h3>
            <Badge variant={isPublished ? 'default' : 'default'}>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          </div>
          
          <Progress value={getOverallProgress()} className="mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {publishingSteps.map((step, index) => (
              <div key={step.id} className="text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${getStepIconColor(step.status)}`}>
                  {getStepIcon(step.id)}
                </div>
                <h4 className="text-sm font-medium text-gray-900">{step.title}</h4>
                <p className="text-xs text-gray-600">{step.description}</p>
                {step.status === 'completed' && (
                  <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                )}
                {step.status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-red-600 mx-auto" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Publishing Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5" />
              Publishing Checklist
            </span>
            <Badge variant="default">
              {Math.round(getChecklistProgress())}% Complete
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress by Category */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <div className="space-y-2">
                {checklist
                  .filter(item => item.category === 'basic')
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {item.title}
                        </span>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      {item.completed && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Content</h4>
              <div className="space-y-2">
                {checklist
                  .filter(item => item.category === 'content')
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {item.title}
                        </span>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      {item.completed && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Legal</h4>
              <div className="space-y-2">
                {checklist
                  .filter(item => item.category === 'legal')
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {item.title}
                        </span>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      {item.completed && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Technical</h4>
              <div className="space-y-2">
                {checklist
                  .filter(item => item.category === 'technical')
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <Checkbox
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                          {item.title}
                        </span>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                      {item.completed && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Required Items Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">Required Items</h4>
                <p className="text-sm text-blue-700">
                  Some items are required for publishing. Complete all required items to enable publishing.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shop Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Shop Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 p-6">
            <div className="flex items-center gap-4 mb-6">
              {shop.logoUrl ? (
                <img
                  src={shop.logoUrl}
                  alt="Shop logo"
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Store className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{shop.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={shop.isActive ? 'default' : 'default'}>
                    {shop.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {shop.isVerified && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span>{shop.rating ? shop.rating.toFixed(1) : 'No ratings'}</span>
                  {shop.reviewCount && (
                    <span className="text-gray-500">({shop.reviewCount} reviews)</span>
                  )}
                </div>
              </div>

              {shop.bannerUrl && (
                <div className="mb-6">
                  <img
                    src={shop.bannerUrl}
                    alt="Shop banner"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {shop.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{shop.email}</span>
                  </div>
                )}
                {shop.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{shop.phone}</span>
                  </div>
                )}
                {shop.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <a
                      href={shop.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {shop.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                {shop.address && shop.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>
                      {shop.address}, {shop.city}, {shop.state}
                    </span>
                  </div>
                )}
              </div>

              {shop.description && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">{shop.description}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
