/**
 * Review & Publish Step (Step 7)
 * 
 * Final review and publishing with:
 * - Complete product summary
 * - Publishing options (immediate, scheduled, draft)
 * - Featuring configuration
 * - Validation and error checking
 * - Final confirmation
 * - Success states
 * 
 * Seventh and final step in the 7-step product creation wizard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Eye, 
  Star,
  Calendar,
  Send,
  Save,
  FileText,
  Package,
  Camera,
  FolderTree,
  DollarSign,
  Settings,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';
import { Progress } from '@/components/ui/Progress';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn-select';
import { useCategorySingleton } from '@/providers/data/CategorySingleton';

// Helper component to display category name by ID using CategorySingleton for caching
function CategoryNameDisplay({ categoryId, categoryName: providedName, googleCategoryId }: { categoryId: string; categoryName?: string; googleCategoryId?: string }) {
  const [categoryName, setCategoryName] = useState<string>(providedName || 'Loading...');
  const [fullCategoryPath, setFullCategoryPath] = useState<string>('');
  const { state, actions } = useCategorySingleton();

  useEffect(() => {
    async function loadCategoryName() {
      if (!categoryId) {
        setCategoryName('No category');
        return;
      }

      // If name was provided directly, use it
      if (providedName) {
        setCategoryName(providedName);
        // Still try to get taxonomy path if we have googleCategoryId
        if (googleCategoryId) {
          try {
            const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
            const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(googleCategoryId);
            if (data && data.path && Array.isArray(data.path)) {
              setFullCategoryPath(data.path.join(' > '));
            }
          } catch {
            // Ignore taxonomy fetch errors
          }
        }
        return;
      }

      // console.log('[CategoryNameDisplay] Looking for category:', categoryId, 'googleCategoryId:', googleCategoryId);

      // First try to find in tenant categories (using CategorySingleton)
      if (state.categories.length > 0) {
        const category = actions.getCategoryById(categoryId);
        if (category) {
          // console.log('[CategoryNameDisplay] Found in tenant categories:', category.name);
          setCategoryName(category.name);
          // Use the category's googleCategoryId or the provided one for taxonomy path
          const gcid =  googleCategoryId;
          if (gcid) {
            try {
              const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
              const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(gcid);
              if (data && data.path && Array.isArray(data.path)) {
                setFullCategoryPath(data.path.join(' > '));
              }
            } catch {
              // Ignore taxonomy fetch errors
            }
          }
          return;
        }
      } else {
        // Load tenant categories if not already loaded
        try {
          await actions.fetchCategories({
            includeChildren: true,
            includeProductCount: false
          });

          const category = actions.getCategoryById(categoryId);
          if (category) {
            // console.log('[CategoryNameDisplay] Found in tenant categories after load:', category.name);
            setCategoryName(category.name);
            // Use the category's googleCategoryId or the provided one for taxonomy path
            const gcid =  googleCategoryId;
            if (gcid) {
              try {
                const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
                const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(gcid);
                if (data && data.path && Array.isArray(data.path)) {
                  setFullCategoryPath(data.path.join(' > '));
                }
              } catch {
                // Ignore taxonomy fetch errors
              }
            }
            return;
          }
        } catch (error) {
          console.error('[CategoryNameDisplay] Error loading tenant categories:', error);
        }
      }

      // If not found in tenant categories but we have googleCategoryId, use it for taxonomy lookup
      if (googleCategoryId) {
        // console.log('[CategoryNameDisplay] Using googleCategoryId for taxonomy lookup:', googleCategoryId);
        try {
          const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
          const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(googleCategoryId);

          if (data && data.path && Array.isArray(data.path)) {
            const pathString = data.path.join(' > ');
            const finalCategoryName = data.path[data.path.length - 1];
            // console.log('[CategoryNameDisplay] Found in Google taxonomy:', pathString);
            setCategoryName(finalCategoryName);
            setFullCategoryPath(pathString);
            return;
          }
        } catch (error) {
          console.error('[CategoryNameDisplay] Error fetching Google taxonomy:', error);
        }
      }

      // If still not found, show unknown category
      console.log('[CategoryNameDisplay] Category not found anywhere:', categoryId);
      setCategoryName('Unknown category');
    }

    loadCategoryName();
  }, [categoryId, providedName, googleCategoryId, state.categories.length]);

  return (
    <div className="space-y-1">
      <div className="font-medium">{categoryName}</div>
      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">ID: {categoryId}</div>
      {fullCategoryPath && categoryName !== 'Unknown category' && categoryName !== 'Loading...' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          Path: {fullCategoryPath}
        </div>
      )}
    </div>
  );
}

interface ReviewStepProps {
  data: {
    basicInfo: any;
    productType: any;
    pricing: any;
    content: any;
    media: any;
    categoryId?: string;
    categoryName?: string;
    googleCategoryId?: string;
    shopCategoryId?: string;
    tags: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    inventorySettings: {
      trackInventory: boolean;
      allowBackorder: boolean;
      lowStockThreshold: number;
      reorderPoint: number;
      maxStockLevel: number;
    };
    organizationSettings: {
      featured: boolean;
      priority: number;
      visibility: 'public' | 'private' | 'draft';
    };
    channels: {
      storefront: boolean;
      directory: boolean;
      googleShopping: boolean;
      facebook: boolean;
      instagram: boolean;
    };
    publishingOptions: {
      publishImmediately: boolean;
      schedulePublishing?: Date;
      notifyCustomers: boolean;
      createPromotion: boolean;
      publishVariants: 'all' | 'selected' | 'none';
    };
    featuringOptions: {
      isFeatured: boolean;
      featuredDuration?: number;
      featuredPriority: number;
      featuredTypes: string[];
      autoFeature: boolean;
    };
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  onComplete: () => void;
  tenantId?: string;
}

interface FeaturedLimits {
  store_selection: number;
  new_arrival: number;
  seasonal: number;
  sale: number;
  staff_pick: number;
}

interface FeaturedCounts {
  store_selection: number;
  new_arrival: number;
  seasonal: number;
  sale: number;
  staff_pick: number;
}

const PUBLISHING_OPTIONS = [
  {
    id: 'immediate',
    title: 'Publish Immediately',
    description: 'Product goes live right away',
    icon: <Send className="h-4 w-4" />,
    recommended: true
  },
  {
    id: 'scheduled',
    title: 'Schedule Publishing',
    description: 'Publish at a specific date and time',
    icon: <Calendar className="h-4 w-4" />
  },
  {
    id: 'draft',
    title: 'Save as Draft',
    description: 'Save without publishing',
    icon: <Save className="h-4 w-4" />
  }
];

// Platform-standard featured types - aligned with both Directory and Storefront implementations
const FEATURED_TYPES = [
  { 
    id: 'store_selection', 
    name: 'Directory Featured', 
    description: 'Premium placement in directory listings',
    color: 'bg-blue-100 text-blue-800' 
  },
  { 
    id: 'new_arrival', 
    name: 'New Arrivals', 
    description: 'Recently added products',
    color: 'bg-green-100 text-green-800' 
  },
  { 
    id: 'seasonal', 
    name: 'Seasonal Favorites', 
    description: 'Seasonal product highlights',
    color: 'bg-orange-100 text-orange-800' 
  },
  { 
    id: 'sale', 
    name: 'Sale Items', 
    description: 'Products on sale or promotion',
    color: 'bg-red-100 text-red-800' 
  },
  { 
    id: 'staff_pick', 
    name: 'Staff Picks', 
    description: 'Hand-picked favorites by your team',
    color: 'bg-purple-100 text-purple-800' 
  }
];

export default function ReviewStep({ data, errors, onChange, onComplete, tenantId }: ReviewStepProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Debug: Log the data structure when component renders
  // console.log('[ReviewStep] Component rendering with data:', {
  //   categoryId: data.categoryId,
  //   googleCategoryId: data.googleCategoryId,
  //   tags: data.tags,
  //   hasCategoryId: !!data.categoryId
  // });
  const [isComplete, setIsComplete] = useState(false);
  
  // Tier-based limits - using singleton for caching
  const [featuredLimits, setFeaturedLimits] = useState<FeaturedLimits | null>(null);
  const [featuredCounts, setFeaturedCounts] = useState<FeaturedCounts | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(true);

  // Fetch tier-based featured product limits via singleton
  useEffect(() => {
    async function fetchLimits() {
      if (!tenantId) return;
      
      try {
        setLoadingLimits(true);
        // Use singleton pattern for automatic caching
        const { getTenantFeaturedProductsSingleton } = await import('@/lib/singletons/TenantFeaturedProductsSingleton');
        const singleton = getTenantFeaturedProductsSingleton(tenantId);
        
        // Fetch limits via singleton (cached)
        await singleton.fetchFeaturedLimits();
        const state = singleton.getState();
        
        // Map singleton limits to FeaturedLimits type
        if (state.featuredLimits && Object.keys(state.featuredLimits).length > 0) {
          setFeaturedLimits({
            store_selection: state.featuredLimits.store_selection || 0,
            new_arrival: state.featuredLimits.new_arrival || 0,
            seasonal: state.featuredLimits.seasonal || 0,
            sale: state.featuredLimits.sale || 0,
            staff_pick: state.featuredLimits.staff_pick || 0
          });
        }
        
        // Get current counts from featured products
        const counts: FeaturedCounts = {
          store_selection: state.featuredProducts?.store_selection?.length || 0,
          new_arrival: state.featuredProducts?.new_arrival?.length || 0,
          seasonal: state.featuredProducts?.seasonal?.length || 0,
          sale: state.featuredProducts?.sale?.length || 0,
          staff_pick: state.featuredProducts?.staff_pick?.length || 0
        };
        setFeaturedCounts(counts);
      } catch (error) {
        console.error('Error fetching featured limits:', error);
      } finally {
        setLoadingLimits(false);
      }
    }
    
    fetchLimits();
  }, [tenantId]);

  // Validate all steps
  useEffect(() => {
    const errors: string[] = [];

    // Basic Info Validation
    if (!data.basicInfo.name || data.basicInfo.name.trim().length < 3) {
      errors.push('Product name is required (min 3 characters)');
    }
    // if (!data.productType.sku || data.productType.sku.trim().length < 2) {
    //   errors.push('SKU is required (min 2 characters)');
    // }

    // Product Type Validation
    if (data.productType.hasVariants && data.productType.variants.length === 0) {
      errors.push('At least one variant is required when variants are enabled');
    }

    // Pricing Validation - skip parent price check if variants have their own pricing
    const variants = data.productType?.variants || [];
    const hasVariantsWithPricing = variants.length > 0 && variants.some((v: any) => v.price_cents || v.priceCents);
    
    if (!hasVariantsWithPricing) {
      // Parent pricing validation (only when variants don't have pricing)
      if (!data.pricing.listPrice || data.pricing.listPrice <= 0) {
        errors.push('List price must be greater than 0');
      }
      if (data.pricing.salePrice && data.pricing.salePrice >= data.pricing.listPrice) {
        errors.push('Sale price must be less than list price');
      }
    } else {
      // Variant pricing validation
      const variantsWithoutPrice = variants.filter((v: any) => !(v.price_cents || v.priceCents));
      if (variantsWithoutPrice.length > 0) {
        errors.push(`${variantsWithoutPrice.length} variant(s) are missing list price`);
      }
    }

    // Content Validation
    if (!data.content.description || data.content.description.trim().length < 10) {
      errors.push('Description is required (min 10 characters)');
    }

    // Media Validation
    if (!data.productType.hasVariants && !data.media.primaryImage) {
      errors.push('Primary image is required for products without variants');
    }

    // Organization Validation
    if (!data.categoryId) {
      errors.push('Product category is required');
    }

    setValidationErrors(errors);
  }, [data]);

  const handlePublishingOptionChange = (option: string) => {
    const publishImmediately = option === 'immediate';
    const schedulePublishing = option === 'scheduled' ? new Date() : undefined;

    onChange({
      ...data,
      publishingOptions: {
        ...data.publishingOptions,
        publishImmediately,
        schedulePublishing
      }
    });
  };

  const handlePublishingSettingsChange = (field: string, value: any) => {
    onChange({
      ...data,
      publishingOptions: {
        ...data.publishingOptions,
        [field]: value
      }
    });
  };

  const handleFeaturingChange = (field: string, value: any) => {
    onChange({
      ...data,
      featuringOptions: {
        ...data.featuringOptions,
        [field]: value
      }
    });
  };

  const handleFeaturedTypeToggle = (typeId: string) => {
    const currentTypes = data.featuringOptions.featuredTypes || [];
    const newTypes = currentTypes.includes(typeId)
      ? currentTypes.filter(id => id !== typeId)
      : [...currentTypes, typeId];
    
    handleFeaturingChange('featuredTypes', newTypes);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishProgress(0);

    try {
      // Simulate publishing process
      const steps = [
        { message: 'Validating product data...', progress: 20 },
        { message: 'Processing images...', progress: 40 },
        { message: 'Setting up pricing...', progress: 60 },
        { message: 'Configuring categories...', progress: 80 },
        { message: 'Publishing product...', progress: 100 }
      ];

      for (const step of steps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setPublishProgress(step.progress);
      }

      setIsComplete(true);
      onComplete();
    } catch (error) {
      console.error('Publishing error:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const getCompletionScore = () => {
    let score = 0;
    const maxScore = 100;

    // Basic Info (20 points)
    if (data.basicInfo.name && data.basicInfo.name.length >= 3) score += 10;
    if (data.basicInfo.sku && data.basicInfo.sku.length >= 2) score += 5;
    if (data.basicInfo.brand) score += 5;

    // Product Type (15 points)
    if (data.productType.hasVariants) {
      score += 10;
      if (data.productType.variants.length > 0) score += 5;
    } else {
      score += 15;
    }

    // Pricing (15 points)
    if (data.pricing.listPrice > 0) score += 10;
    if (data.pricing.salePrice) score += 5;

    // Content (20 points)
    if (data.content.description && data.content.description.length >= 10) score += 10;
    if (data.content.enhancedDescription && data.content.enhancedDescription.length >= 50) score += 5;
    if (data.content.features.length >= 3) score += 5;

    // Media (15 points)
    if (data.media.primaryImage) score += 10;
    if (data.media.galleryImages.length > 0) score += 5;

    // Organization (15 points)
    if (data.categoryId) score += 10;
    if (data.tags.length >= 3) score += 5;

    return Math.min(score, maxScore);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  const completionScore = getCompletionScore();
  const isValid = validationErrors.length === 0;

  if (isComplete) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-900 mb-2">Product Published Successfully!</h2>
            <p className="text-green-700 mb-6">
              Your product "{data.basicInfo.name}" has been published and is now live.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button onClick={onComplete} className="bg-green-600 hover:bg-green-700">
                View Product
              </Button>
              <Button variant="default" onClick={() => window.location.reload()}>
                Create Another Product
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Eye className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Review & Publish</h4>
              <p className="text-sm text-blue-700 mt-1">
                Review your complete product setup and configure publishing options. Choose featuring settings
                and finalize your product before publishing to your storefront.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Completion Score */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Product Completion</div>
                <div className="text-sm text-gray-600">
                  {completionScore}% Complete
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={getScoreColor(completionScore)}>
                {getScoreBadge(completionScore)}
              </Badge>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionScore}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Please fix the following issues:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Product Summary */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Product Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Basic Info</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Name:</span>
                <span className="text-sm font-medium">{data.basicInfo.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">SKU:</span>
                <span className="text-sm font-medium">{data.basicInfo.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Brand:</span>
                <span className="text-sm font-medium">{data.basicInfo.brand || 'Not set'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Product Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Product Type</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Type:</span>
                <span className="text-sm font-medium">
                  {data.productType.hasVariants ? 'With Variants' : 'Simple Product'}
                </span>
              </div>
              {data.productType.hasVariants && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Variants:</span>
                  <span className="text-sm font-medium">{data.productType.variants.length}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <DollarSign className="h-4 w-4" />
                <span>Pricing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                // Check if variants have their own pricing
                const variants = data.productType?.variants || [];
                const hasVariantsWithPricing = variants.length > 0 && variants.some((v: any) => v.price_cents || v.priceCents);
                
                if (hasVariantsWithPricing) {
                  // Show variant pricing range
                  const listPrices = variants
                    .map((v: any) => v.price_cents || v.priceCents || 0)
                    .filter((p: number) => p > 0);
                  const salePrices = variants
                    .map((v: any) => v.sale_price_cents || v.salePriceCents)
                    .filter((p: any): p is number => typeof p === 'number' && p > 0);
                  
                  const minList = listPrices.length > 0 ? Math.min(...listPrices) : 0;
                  const maxList = listPrices.length > 0 ? Math.max(...listPrices) : 0;
                  const minSale = salePrices.length > 0 ? Math.min(...salePrices) : 0;
                  const maxSale = salePrices.length > 0 ? Math.max(...salePrices) : 0;
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variant Prices:</span>
                        <span className="text-sm font-medium">
                          {minList === maxList 
                            ? `$${(minList / 100).toFixed(2)}`
                            : `$${(minList / 100).toFixed(2)} - $${(maxList / 100).toFixed(2)}`
                          }
                        </span>
                      </div>
                      {salePrices.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Sale Prices:</span>
                          <span className="text-sm font-medium text-orange-600">
                            {minSale === maxSale 
                              ? `$${(minSale / 100).toFixed(2)}`
                              : `$${(minSale / 100).toFixed(2)} - $${(maxSale / 100).toFixed(2)}`
                            }
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Variants:</span>
                        <span className="text-sm font-medium">{variants.length} variants</span>
                      </div>
                    </>
                  );
                }
                
                // Show parent pricing (no variants with pricing)
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">List Price:</span>
                      <span className="text-sm font-medium">${(data.pricing.listPrice / 100).toFixed(2)}</span>
                    </div>
                    {data.pricing.salePrice && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Sale Price:</span>
                        <span className="text-sm font-medium text-orange-600">
                          ${(data.pricing.salePrice / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Camera className="h-4 w-4" />
                <span>Media</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Primary Image:</span>
                <Badge variant={data.media.primaryImage ? 'default' : 'error'}>
                  {data.media.primaryImage ? 'Uploaded' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Gallery:</span>
                <span className="text-sm font-medium">{data.media.galleryImages.length} images</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Video:</span>
                <Badge variant={data.media.videoUrl ? 'default' : 'secondary'}>
                  {data.media.videoUrl ? 'Added' : 'None'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <FolderTree className="h-4 w-4" />
                <span>Organization</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600 pt-2">Category:</span>
                {(() => {
                  // console.log('[ReviewStep] About to render category display:', {
                  //   hasCategoryId: !!data.categoryId,
                  //   categoryId: data.categoryId,
                  //   googleCategoryId: data.googleCategoryId
                  // });
                  return data.categoryId ? (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/20">
                      <CategoryNameDisplay categoryId={data.categoryId} categoryName={data.categoryName} googleCategoryId={data.googleCategoryId} />
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-400">Not set</span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tags:</span>
                <span className="text-sm font-medium">{data.tags.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Content</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Description:</span>
                <Badge variant={data.content.description ? 'default' : 'error'}>
                  {data.content.description ? 'Added' : 'Missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Features:</span>
                <span className="text-sm font-medium">{data.content.features.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Publishing Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Publishing Options</h3>
        
        <RadioGroup
          value={data.publishingOptions.publishImmediately ? 'immediate' : 
                 data.publishingOptions.schedulePublishing ? 'scheduled' : 'draft'}
          onValueChange={handlePublishingOptionChange}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {PUBLISHING_OPTIONS.map((option) => (
            <div key={option.id} className="flex items-start space-x-3">
              <RadioGroupItem value={option.id} id={option.id} />
              <Label htmlFor={option.id} className="cursor-pointer">
                <div className="flex items-center space-x-2 mb-1">
                  {option.icon}
                  <span className="font-medium">{option.title}</span>
                  {option.recommended && (
                    <Badge variant="info" className="text-xs">Recommended</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{option.description}</p>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Notify Customers</Label>
              <Switch
                checked={data.publishingOptions.notifyCustomers}
                onCheckedChange={(checked) => handlePublishingSettingsChange('notifyCustomers', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Create Promotion</Label>
              <Switch
                checked={data.publishingOptions.createPromotion}
                onCheckedChange={(checked) => handlePublishingSettingsChange('createPromotion', checked)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Publish Variants</Label>
              <Select
                value={data.publishingOptions.publishVariants}
                onValueChange={(value) => handlePublishingSettingsChange('publishVariants', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Variants</SelectItem>
                  <SelectItem value="selected">Selected Variants</SelectItem>
                  <SelectItem value="none">No Variants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Featuring Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Featuring Options</h3>
          <div className="flex items-center space-x-2">
            <Switch
              checked={data.featuringOptions.isFeatured}
              onCheckedChange={(checked) => handleFeaturingChange('isFeatured', checked)}
            />
            <Label className="text-sm">
              {data.featuringOptions.isFeatured ? 'Featured' : 'Not Featured'}
            </Label>
          </div>
        </div>

        {data.featuringOptions.isFeatured && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Featured Duration</Label>
                <Select
                  value={data.featuringOptions.featuredDuration?.toString() || 'indefinite'}
                  onValueChange={(value) => handleFeaturingChange('featuredDuration', 
                    value === 'indefinite' ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="indefinite">Indefinite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Priority (0-100)</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={data.featuringOptions.featuredPriority}
                    onChange={(e) => handleFeaturingChange('featuredPriority', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-10">{data.featuringOptions.featuredPriority}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Featured Product Types</Label>
                {!loadingLimits && featuredLimits && featuredCounts && (
                  <span className="text-xs text-gray-500">
                    Tier-based limits apply
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Select which featured collections this product should appear in
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FEATURED_TYPES.map((type) => {
                  const typeKey = type.id as keyof FeaturedLimits;
                  const currentCount = featuredCounts?.[typeKey] || 0;
                  const limit = featuredLimits?.[typeKey] || 0;
                  const isAtLimit = currentCount >= limit;
                  const isNearLimit = currentCount >= limit * 0.8;
                  const isChecked = (data.featuringOptions.featuredTypes || []).includes(type.id);
                  
                  return (
                    <div 
                      key={type.id} 
                      className={`flex items-start space-x-3 p-3 border rounded-lg ${
                        isAtLimit && !isChecked ? 'bg-red-50 border-red-200' : 
                        isNearLimit && !isChecked ? 'bg-amber-50 border-amber-200' : 
                        'hover:bg-gray-50'
                      }`}
                    >
                      <Checkbox
                        id={`type-${type.id}`}
                        checked={isChecked}
                        onCheckedChange={() => handleFeaturedTypeToggle(type.id)}
                        disabled={isAtLimit && !isChecked}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label 
                            htmlFor={`type-${type.id}`} 
                            className={`text-sm font-medium cursor-pointer ${
                              isAtLimit && !isChecked ? 'text-red-700' : ''
                            }`}
                          >
                            {type.name}
                          </Label>
                          {!loadingLimits && featuredLimits && (
                            <span className={`text-xs font-medium ${
                              isAtLimit ? 'text-red-600' : 
                              isNearLimit ? 'text-amber-600' : 
                              'text-gray-500'
                            }`}>
                              {currentCount}/{limit}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                        {isAtLimit && !isChecked && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Limit reached - upgrade to feature more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 <strong>Directory Featured</strong> appears in directory listings. <strong>Staff Picks</strong> appears on storefront.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-feature</Label>
                <p className="text-xs text-gray-500">Automatically feature based on performance</p>
              </div>
              <Switch
                checked={data.featuringOptions.autoFeature}
                onCheckedChange={(checked) => handleFeaturingChange('autoFeature', checked)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Publishing Action */}
      <div className="space-y-4">
        <Card className={isValid ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <div>
                  <h4 className="font-medium">
                    {isValid ? 'Ready to publish' : 'Needs attention'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {isValid 
                      ? 'Your product is ready to be published.'
                      : 'Please fix validation errors before publishing.'
                    }
                  </p>
                </div>
              </div>
              <Button
                onClick={handlePublish}
                disabled={!isValid || isPublishing}
                size="lg"
                className="min-w-[120px]"
              >
                {isPublishing ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Publishing...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Send className="h-4 w-4" />
                    <span>Publish Product</span>
                  </div>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isPublishing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Publishing progress...</span>
              <span>{publishProgress}%</span>
            </div>
            <Progress value={publishProgress} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
