/**
 * Item Creation Wizard Component
 * 
 * 7-step wizard for product creation following shop management patterns:
 * 1. Basic Information - Core product details
 * 2. Product Type & Variant Configuration - Advanced variant setup
 * 3. Pricing Strategy - Numeric sliders and pricing options
 * 4. Content & Marketing - Descriptions and marketing content
 * 5. Media & Visuals - Images and media management
 * 6. Organization & Categories - Categories and organization
 * 7. Review & Publish - Final review and publishing
 * 
 * Progressive disclosure with validation and progress tracking
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  AlertCircle,
  Save,
  Eye,
  Loader2
} from 'lucide-react';

import { Button } from '@mantine/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { itemsService } from '@/services/ItemsSingletonService';
import { useProductOptionsCapability, useProductTypeCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import type { TenantCatalogItem, BarcodeEnrichment } from '@/services/SupplierImportService';

import WizardProgress from './components/WizardProgress';
import WizardNavigation from './components/WizardNavigation';
// import { QualityIndicator } from './components/QualityIndicator';
// import { ProductPreview } from './components/ProductPreview';

// Import step components
import CatalogSearchStep from './steps/CatalogSearchStep';
import BasicInfoStep from './steps/BasicInfoStep';
import ProductTypeStep from './steps/ProductTypeStep';
import PricingStep from './steps/PricingStep';
import ContentStep from './steps/ContentStep';
import MediaStep from './steps/MediaStep';
import OrganizationStep from './steps/OrganizationStep';
import ReviewStep from './steps/ReviewStep';
import ServiceDetailsStep from './steps/ServiceDetailsStep';
import { clientLogger } from '@/lib/client-logger';

interface ItemCreationWizardProps {
  tenantId: string;
  initialData?: any;
  onComplete?: (productData: any) => void;
  onCancel?: () => void;
  allowStepJumping?: boolean;
  productId?: string; // For editing existing products
  onAddToQueue?: (productData: any) => void;
}

interface WizardData {
  // Step 1: Basic Information
  basicInfo: {
    name: string;
    brand: string;
    manufacturer?: string;
    condition: 'new' | 'used' | 'refurbished';
    mpn?: string;
    status: 'draft' | 'active';
    gtin?: string;
  };
  
  // Step 2: Product Type & Variants
  productType: {
    type: 'physical' | 'digital' | 'hybrid' | 'service';
    sku: string;
    hasVariants: boolean;
    stockQuantity: number;
    variants: any[];
    variantConfig: {
      cloningEnabled: boolean;
      individualPhotos: boolean;
      attributeTypes: string[];
    };
    digitalProduct?: {
      deliveryMethod: 'direct_download' | 'external_link' | 'license_key' | 'access_grant';
      assets: any[];
      licenseType?: 'personal' | 'commercial' | 'educational' | 'enterprise';
      accessDurationDays?: number | null;
      downloadLimit?: number | null;
      externalUrl?: string;
      assetName?: string;
      accessInstructions?: string;
    };
    serviceProduct?: {
      bookingMethod: 'external_url' | 'phone' | 'in_store' | 'contact_only';
      bookingUrl?: string;
      bookingPhone?: string;
      durationMinutes?: number | null;
      sessionLength?: string;
      availabilitySchedule?: string;
      serviceLocation: 'on_site' | 'remote' | 'customer_location';
      serviceArea?: string;
      travelRadius?: number | null;
      pricingModel: 'per_session' | 'per_hour' | 'fixed' | 'deposit';
      depositAmount?: number | null;
      requiresDeposit: boolean;
    };
  };
  
  // Step 3: Pricing Strategy
  pricing: {
    listPrice: number;
    salePrice?: number;
    variantPricing: {
      enabled: boolean;
      type: 'inherit' | 'override' | 'formula';
      priceAdjustments: any[];
      variantPrices?: Record<string, { listPrice: number; salePrice?: number }>;
    };
    gatewaySelection: {
      gateway_type: string | null;
      gateway_id: string | null;
    };
  };
  
  // Step 4: Content & Marketing
  content: {
    description: string;
    enhancedDescription: string;
    features: string[];
    specifications: Record<string, any>;
    seoTitle?: string;
    seoDescription?: string;
    tags: string[];
    // Structured enrichment data stored as metadata.* in inventory_items
    // Aligns with scan.ts extractStructuredMetadata and item detail page reader
    enrichedMetadata?: Record<string, any>;
  };
  
  // Step 5: Media & Visuals
  media: {
    primaryImage: any;
    galleryImages: any[];
    variantMedia: {
      cloningStrategy: 'clone_all' | 'clone_some' | 'upload_all' | 'mixed';
      parentImagesToClone: string[];
      variantSpecificImages: Record<string, any>;
    };
    videoUrl?: string;
    videoThumbnail?: string;
  };
  
  // Step 6: Organization & Categories
  organization: {
    categoryId: string;
    categoryName?: string;
    googleCategoryId?: string;
    shopCategoryId?: string;
    categoryPath?: string;
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
      searchable: boolean;
    };
    channels: {
      storefront: boolean;
      directory: boolean;
      googleShopping: boolean;
      facebook: boolean;
      instagram: boolean;
    };
  };
  
  // Step 7: Review & Publish
  review: {
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
  // Catalog match metadata (from Step 0)
  catalogMatch?: {
    supplier_catalog_item_id?: string;
    supplier_id?: string;
    supplier_sku?: string;
    source_type: 'supplier_catalog' | 'barcode_enrichment';
  };
}

const INITIAL_DATA: WizardData = {
  basicInfo: {
    name: '',
    brand: '',
    manufacturer: '',
    condition: 'new',
    mpn: '',
    status: 'draft',
  },
  productType: {
    type: 'physical',
    sku: '',
    hasVariants: false,
    stockQuantity: 0,
    variants: [],
    variantConfig: {
      cloningEnabled: false,
      individualPhotos: false,
      attributeTypes: []
    },
    digitalProduct: {
      deliveryMethod: 'direct_download',
      assets: [],
      licenseType: 'personal',
      accessDurationDays: null,
      downloadLimit: null,
      externalUrl: '',
      assetName: '',
      accessInstructions: ''
    },
    serviceProduct: {
      bookingMethod: 'contact_only',
      bookingUrl: '',
      bookingPhone: '',
      durationMinutes: null,
      sessionLength: '',
      availabilitySchedule: '',
      serviceLocation: 'on_site',
      serviceArea: '',
      travelRadius: null,
      pricingModel: 'fixed',
      depositAmount: null,
      requiresDeposit: false
    }
  },
  pricing: {
    listPrice: 0,
    variantPricing: {
      enabled: false,
      type: 'inherit',
      priceAdjustments: [],
      variantPrices: {} // Structure: { variantId: { listPrice: number, salePrice?: number } }
    },
    gatewaySelection: {
      gateway_type: null,
      gateway_id: null
    }
  },
  content: {
    description: '',
    enhancedDescription: '',
    features: [],
    specifications: {},
    tags: [],
    enrichedMetadata: {}
  },
  media: {
    primaryImage: null,
    galleryImages: [],
    variantMedia: {
      cloningStrategy: 'clone_all',
      parentImagesToClone: [],
      variantSpecificImages: {}
    },
    videoUrl: '',
    videoThumbnail: ''
  },
  organization: {
    categoryId: '',
    googleCategoryId: '',
    shopCategoryId: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: [],
    inventorySettings: {
      trackInventory: false,
      allowBackorder: false,
      lowStockThreshold: 5,
      reorderPoint: 10,
      maxStockLevel: 1000
    },
    organizationSettings: {
      featured: false,
      priority: 0,
      visibility: 'public',
      searchable: true
    },
    channels: {
      storefront: true,
      directory: true,
      googleShopping: false,
      facebook: false,
      instagram: false
    }
  },
  review: {
    publishingOptions: {
      publishImmediately: false,
      notifyCustomers: false,
      createPromotion: false,
      publishVariants: 'all'
    },
    featuringOptions: {
      isFeatured: false,
      featuredDuration: 30,
      featuredPriority: 0,
      featuredTypes: [],
      autoFeature: false
    }
  },
  catalogMatch: undefined,
};

const BASE_STEPS = [
  { id: 'basic-info', title: 'Basic Information', description: 'Core product details' },
  { id: 'product-type', title: 'Product Type & Variants', description: 'Configure product type and variants' },
  { id: 'pricing', title: 'Pricing Strategy', description: 'Set pricing and payment options' },
  { id: 'content', title: 'Content & Marketing', description: 'Create compelling content' },
  { id: 'media', title: 'Media & Visuals', description: 'Upload images and media' },
  { id: 'organization', title: 'Organization & Categories', description: 'Organize with categories' },
  { id: 'review', title: 'Review & Publish', description: 'Final review and publishing' }
];

const CATALOG_STEP = { id: 'catalog-search', title: 'Catalog Search', description: 'Search supplier catalogs for a match' };

export default function ItemCreationWizard({ 
  tenantId, 
  initialData, 
  onComplete, 
  onCancel,
  allowStepJumping = false,
  productId,
  onAddToQueue
}: ItemCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_DATA);
  const [stepValidation, setStepValidation] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasRecoveredData, setHasRecoveredData] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const isEditing = !!productId;

  // Capability gate: show catalog search step 0 when supplier catalog is enabled
  const { data: productOptionsCap } = useProductOptionsCapability(tenantId);
  const { data: productTypeCap } = useProductTypeCapability(tenantId);
  // Constraint: supplier catalog excludes service product type.
  // If service product type is in effective types, hide the catalog step.
  const serviceTypeEnabled = (productTypeCap?.effectiveTypes ?? []).includes('service');
  const catalogEnabled = !isEditing && !!productOptionsCap?.effectiveShowsSupplierCatalog && !serviceTypeEnabled;
  const STEPS = catalogEnabled ? [CATALOG_STEP, ...BASE_STEPS] : BASE_STEPS;
  const stepOffset = catalogEnabled ? 1 : 0;

  // Auto-save to localStorage on data change
  useEffect(() => {
    if (!isEditing && wizardData) {
      // Don't save if it's just the initial empty data
      const hasMeaningfulData = JSON.stringify(wizardData) !== JSON.stringify(INITIAL_DATA);
      if (hasMeaningfulData) {
        const draftData = {
          wizardData,
          currentStep,
          stepValidation,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };
        localStorage.setItem('item-creation-draft', JSON.stringify(draftData));
        setLastSaveTime(new Date());
      }
    }
  }, [wizardData, currentStep, stepValidation, isEditing]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!isEditing) {
      const savedDraft = localStorage.getItem('item-creation-draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          const draftAge = Date.now() - new Date(draft.timestamp).getTime();
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          
          // Only recover if draft is less than 7 days old
          if (draftAge < maxAge && draft.version === '1.0') {
            setWizardData(draft.wizardData);
            setCurrentStep(draft.currentStep || 0);
            setStepValidation(draft.stepValidation || {});
            setHasRecoveredData(true);
            setLastSaveTime(new Date(draft.timestamp));
            
            console.log('Recovered draft from', new Date(draft.timestamp));
          } else {
            // Clear old draft
            localStorage.removeItem('item-creation-draft');
          }
        } catch (error) {
          clientLogger.error('Error loading draft:', { detail: error });
          localStorage.removeItem('item-creation-draft');
        }
      }
    }
  }, [isEditing]);

  // Load existing product data if productId is provided
  useEffect(() => {
    if (productId) {
      loadExistingProduct();
    }
  }, [productId]);

  const loadExistingProduct = async () => {
    if (!productId) return;
    
    setIsLoading(true);
    try {
      // Fetch product via service
      const productData = await itemsService.getItem(productId);
      
      if (!productData) {
        throw new Error('Failed to load product');
      }
      
      console.log('[ItemCreationWizard] Loaded product for editing:', productData);
      
      // Extract metadata fields
      const metadata = productData.metadata || {};
      
      // Map existing product data to wizard data structure
      setWizardData({
        ...INITIAL_DATA,
        basicInfo: {
          name: productData.name || '',
          brand: productData.brand || '',
          manufacturer: productData.manufacturer || '',
          condition: (productData.condition?.replace('brand_new', 'new') || 'new') as 'new' | 'used' | 'refurbished',
          mpn: productData.mpn || '',
          status: productData.item_status === 'active' ? 'active' : 'draft'
        },
        productType: {
          type: productData.product_type || 'physical',
          sku: productData.sku || '',
          hasVariants: productData.has_variants || false,
          stockQuantity: productData.stock || 0,
          variants: productData.variants || productData.product_variants || [],
          variantConfig: {
            ...INITIAL_DATA.productType.variantConfig,
            ...metadata.variantConfig,
            // Extract attribute types from variant attributes if not in metadata
            attributeTypes: metadata.variantConfig?.attributeTypes?.length
              ? metadata.variantConfig.attributeTypes
              : productData.variants?.reduce((types: string[], variant: any) => {
                  const attrKeys = Object.keys(variant.attributes || {});
                  attrKeys.forEach(key => {
                    if (!types.includes(key)) types.push(key);
                  });
                  return types;
                }, []) || []
          },
          digitalProduct: {
            deliveryMethod: (productData.digital_delivery_method || 'direct_download') as 'direct_download' | 'external_link' | 'license_key' | 'access_grant',
            assets: productData.digital_assets || [],
            licenseType: (productData.license_type || 'personal') as 'personal' | 'commercial' | 'educational' | 'enterprise',
            accessDurationDays: productData.access_duration_days || null,
            downloadLimit: productData.download_limit || null,
            externalUrl: '',
            assetName: '',
            accessInstructions: ''
          },
          serviceProduct: {
            bookingMethod: (metadata.bookingMethod || metadata.booking_method || 'contact_only') as 'external_url' | 'phone' | 'in_store' | 'contact_only',
            bookingUrl: metadata.bookingUrl || metadata.booking_url || '',
            bookingPhone: metadata.bookingPhone || metadata.booking_phone || '',
            durationMinutes: metadata.durationMinutes ?? metadata.duration_minutes ?? null,
            sessionLength: metadata.sessionLength || metadata.session_length || '',
            availabilitySchedule: metadata.availabilitySchedule || metadata.availability_schedule || '',
            serviceLocation: (metadata.serviceLocation || metadata.service_location || 'on_site') as 'on_site' | 'remote' | 'customer_location',
            serviceArea: metadata.serviceArea || metadata.service_area || '',
            travelRadius: metadata.travelRadius ?? metadata.travel_radius ?? null,
            pricingModel: (metadata.pricingModel || metadata.pricing_model || 'fixed') as 'per_session' | 'per_hour' | 'fixed' | 'deposit',
            depositAmount: metadata.depositAmount ?? metadata.deposit_amount ?? null,
            requiresDeposit: metadata.requiresDeposit ?? metadata.requires_deposit ?? false
          }
        },
        pricing: {
          listPrice: productData.priceCents || productData.price_cents || 0,
          salePrice: metadata.sale_price_cents || productData.salePriceCents || undefined,
          variantPricing: INITIAL_DATA.pricing.variantPricing,
          gatewaySelection: {
            gateway_type: metadata.payment_gateway_type || productData.payment_gateway_type || null,
            gateway_id: metadata.payment_gateway_id || productData.payment_gateway_id || null
          }
        },
        content: {
          description: productData.description || '',
          enhancedDescription: productData.marketing_description || '',
          features: productData.features || metadata.features || [],
          specifications: productData.specifications || metadata.specifications || {},
          tags: metadata.tags || []
        },
        media: {
          primaryImage: productData.imageUrl || productData.image_url ? {
            id: `existing-primary-${Date.now()}`,
            url: productData.imageUrl || productData.image_url,
            path: '', // No path for existing images
            name: 'Primary Image',
            size: 0,
            type: 'image/jpeg',
            uploadedAt: new Date()
          } : null,
          galleryImages: (productData.imageGallery || productData.image_gallery || []).map((item: any, idx: number) => ({
            id: `existing-gallery-${idx}-${Date.now()}`,
            url: typeof item === 'string' ? item : item.url,
            path: '', // No path for existing images
            name: typeof item === 'string' ? `Gallery Image ${idx + 1}` : (item.alt || `Gallery Image ${idx + 1}`),
            size: 0,
            type: 'image/jpeg',
            uploadedAt: new Date()
          })),
          variantMedia: metadata.variantMedia || INITIAL_DATA.media.variantMedia,
          videoUrl: productData.videoUrl || metadata.videoUrl || '',
          videoThumbnail: metadata.videoThumbnail || ''
        },
        organization: {
          categoryId: productData.directory_category_id || productData.tenantCategoryId || '',
          categoryName: productData.tenantCategory?.name || '',
          googleCategoryId: productData.tenantCategory?.googleCategoryId || '',
          categoryPath: productData.category_path?.[0] || '',
          seoTitle: metadata.seo_title || '',
          seoDescription: metadata.seo_description || '',
          seoKeywords: metadata.seo_keywords || [],
          inventorySettings: {
            trackInventory: metadata.track_inventory ?? metadata.inventorySettings?.trackInventory ?? true,
            allowBackorder: metadata.allow_backorder ?? metadata.inventorySettings?.allowBackorder ?? false,
            lowStockThreshold: metadata.low_stock_threshold || metadata.inventorySettings?.lowStockThreshold || 5,
            reorderPoint: metadata.inventorySettings?.reorderPoint || 10,
            maxStockLevel: metadata.inventorySettings?.maxStockLevel || 1000
          },
          organizationSettings: metadata.organizationSettings || {
            featured: productData.is_featured || false,
            priority: productData.featured_priority || 0,
            visibility: productData.visibility || 'public',
            searchable: true
          },
          channels: INITIAL_DATA.organization.channels
        },
        review: {
          publishingOptions: metadata.publishingOptions || INITIAL_DATA.review.publishingOptions,
          featuringOptions: {
            isFeatured: productData.is_featured || false,
            featuredDuration: 30,
            featuredPriority: productData.featured_priority || 0,
            featuredTypes: productData.featured_type ? [productData.featured_type] : metadata.featuringOptions?.featuredTypes || [],
            autoFeature: false
          }
        }
      });
    } catch (error) {
      clientLogger.error('Error loading product:', { detail: error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepJump = (stepIndex: number) => {
    if (allowStepJumping) {
      setCurrentStep(stepIndex);
    }
  };

  const handleAddToQueue = () => {
    if (onAddToQueue) {
      // Prepare product data for queue
      const queueData = {
        ...wizardData,
        id: productId || `new-${Date.now()}`,
        name: wizardData.basicInfo?.name || 'Untitled Product',
        brand: wizardData.basicInfo?.brand || 'Unknown Brand',
        isEditing: !!productId
      };
      
      onAddToQueue(queueData);
      
      // Show success feedback
      console.log('Added to queue:', queueData);
    }
  };

  // Initialize with initial data if provided
  useEffect(() => {
    if (initialData) {
      setWizardData(prev => ({
        ...prev,
        ...initialData,
        // Ensure productType has all required fields
        productType: {
          ...prev.productType,
          ...initialData.productType,
          stockQuantity: initialData.productType?.stockQuantity ?? prev.productType.stockQuantity
        }
      }));
    }
  }, [initialData]);

  // Validate current step
  useEffect(() => {
    validateStep(currentStep);
  }, [currentStep, wizardData]);

  const validateStep = (stepIndex: number) => {
    let isValid = true;
    const stepErrors: Record<string, string> = {};
    const step = stepIndex - stepOffset;

    // Catalog search step (step 0 when enabled) is always valid
    if (catalogEnabled && stepIndex === 0) {
      setStepValidation(prev => ({ ...prev, [stepIndex]: true }));
      return;
    }

    switch (step) {
      case 0: // Basic Information
        if (!wizardData.basicInfo.name || wizardData.basicInfo.name.trim().length < 3) {
          stepErrors.name = 'Product name must be at least 3 characters';
          isValid = false;
        }
        break;
      
      case 1: // Product Type & Variants
        if (wizardData.productType.hasVariants && wizardData.productType.variants.length === 0) {
          stepErrors.variants = 'At least one variant is required when variants are enabled';
          isValid = false;
        }
        break;
      
      case 2: // Pricing Strategy
        // Check if variants have their own pricing (from step 2)
        const hasVariantsWithPricing = wizardData.productType.variants && 
          wizardData.productType.variants.length > 0 && 
          wizardData.productType.variants.some((v: any) => v.price_cents || v.priceCents);
        
        // Only validate parent product pricing if variants don't have their own pricing
        if (!hasVariantsWithPricing) {
          if (wizardData.pricing.listPrice <= 0) {
            stepErrors.listPrice = 'List price must be greater than 0';
            isValid = false;
          }
          if (wizardData.pricing.salePrice && wizardData.pricing.salePrice >= wizardData.pricing.listPrice) {
            stepErrors.salePrice = 'Sale price must be less than list price';
            isValid = false;
          }
        }
        break;
      
      case 4: // Media & Visuals
        if (!wizardData.media.primaryImage && !wizardData.productType.hasVariants) {
          stepErrors.primaryImage = 'Primary image is required for products without variants';
          isValid = false;
        }
        break;
      
      case 6: // Organization & Categories
        if (!wizardData.organization.categoryId) {
          stepErrors.categoryId = 'Primary category is required';
          isValid = false;
        }
        break;
    }

    setStepValidation(prev => ({
      ...prev,
      [stepIndex]: isValid
    }));
    setErrors(stepErrors);
  };

  const handleStepData = (stepData: any) => {
    // Auto-populate SEO fields when relevant data changes
    const updatedData = { ...wizardData, ...stepData };
    
    // Sync SEO Title from Product Name (Step 1 -> Step 6)
    if (stepData.basicInfo?.name && !updatedData.organization.seoTitle) {
      updatedData.organization.seoTitle = stepData.basicInfo.name.length > 60 
        ? stepData.basicInfo.name.substring(0, 57) + '...' 
        : stepData.basicInfo.name;
    }
    
    // Sync SEO Keywords from Product Tags (Step 4 -> Step 6)
    if (stepData.content?.tags && (!updatedData.organization.seoKeywords || updatedData.organization.seoKeywords.length === 0)) {
      updatedData.organization.seoKeywords = [...stepData.content.tags];
    }
    
    // Sync SEO Description from Product Description (Step 4 -> Step 6)
    if (stepData.content?.description && !updatedData.organization.seoDescription) {
      updatedData.organization.seoDescription = stepData.content.description.length > 160 
        ? stepData.content.description.substring(0, 157) + '...' 
        : stepData.content.description;
    }
    
    // Sync Product Tags from Content Step (Step 4 -> Step 6) for consistency
    if (stepData.content?.tags) {
      updatedData.organization.tags = [...stepData.content.tags];
    }
    
    setWizardData(updatedData);
  };

  const handleNext = async () => {
    if (!stepValidation[currentStep]) {
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceedToNextStep = () => {
    return stepValidation[currentStep] !== false;
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Save current wizard data to localStorage (already auto-saved)
      console.log('Saving wizard data:', wizardData);
      
      // Show success feedback
      setLastSaveTime(new Date());
      
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsSubmitting(false);
    } catch (error) {
      clientLogger.error('Error saving wizard data:', { detail: error });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    let allValid = true;
    let allErrors: Record<string, string> = {};
    
    for (let i = 0; i < STEPS.length; i++) {
      validateStep(i);
      if (!stepValidation[i]) {
        allValid = false;
        allErrors = { ...allErrors, ...errors };
      }
    }

    if (!allValid) {
      // Show error for the first invalid step
      const firstInvalidStep = Object.keys(stepValidation).findIndex(isValid => !isValid);
      if (firstInvalidStep !== -1) {
        setCurrentStep(firstInvalidStep);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare product data with proper category mapping
      // Map categoryId to tenantCategoryId to match /items edit modal behavior
      // Backend will automatically create both directory_category_id and category_path
      const productData = {
        ...wizardData,
        // Map categoryId to tenantCategoryId for backend API compatibility
        tenantCategoryId: wizardData.organization.categoryId || null,
        // Include other organization fields
        organization: {
          ...wizardData.organization,
          // Keep categoryId for internal wizard state
        },
        // Include digital product fields if product type is digital or hybrid
        ...(wizardData.productType.type === 'digital' || wizardData.productType.type === 'hybrid' ? {
          digital_delivery_method: wizardData.productType.digitalProduct?.deliveryMethod,
          digital_assets: wizardData.productType.digitalProduct?.assets,
          license_type: wizardData.productType.digitalProduct?.licenseType,
          access_duration_days: wizardData.productType.digitalProduct?.accessDurationDays,
          download_limit: wizardData.productType.digitalProduct?.downloadLimit,
        } : {}),
        // Include service product metadata if product type is service
        ...(wizardData.productType.type === 'service' ? {
          metadata: {
            bookingMethod: wizardData.productType.serviceProduct?.bookingMethod,
            bookingUrl: wizardData.productType.serviceProduct?.bookingUrl,
            bookingPhone: wizardData.productType.serviceProduct?.bookingPhone,
            durationMinutes: wizardData.productType.serviceProduct?.durationMinutes,
            sessionLength: wizardData.productType.serviceProduct?.sessionLength,
            availabilitySchedule: wizardData.productType.serviceProduct?.availabilitySchedule,
            serviceLocation: wizardData.productType.serviceProduct?.serviceLocation,
            serviceArea: wizardData.productType.serviceProduct?.serviceArea,
            travelRadius: wizardData.productType.serviceProduct?.travelRadius,
            pricingModel: wizardData.productType.serviceProduct?.pricingModel,
            depositAmount: wizardData.productType.serviceProduct?.depositAmount,
            requiresDeposit: wizardData.productType.serviceProduct?.requiresDeposit,
          },
          // Services have unlimited stock
          stock: 9999,
          track_inventory: false,
        } : {}),
        // Include supplier catalog source info when product came from catalog match
        ...(wizardData.catalogMatch ? {
          source_type: wizardData.catalogMatch.source_type,
          ...(wizardData.catalogMatch.supplier_catalog_item_id ? {
            supplier_catalog_item_id: wizardData.catalogMatch.supplier_catalog_item_id,
          } : {})
        } : {})
      };

      // Submit the complete product data
      if (onComplete) {
        await onComplete(productData);
      }
      
      // Clear draft after successful submission
      localStorage.removeItem('item-creation-draft');
      setHasRecoveredData(false);
      setLastSaveTime(null);
      
      setIsSubmitting(false);
    } catch (error) {
      clientLogger.error('Error submitting product:', { detail: error });
      setIsSubmitting(false);
    }
  };

  // Function to clear draft manually
  const clearDraft = () => {
    localStorage.removeItem('item-creation-draft');
    setWizardData(INITIAL_DATA);
    setCurrentStep(0);
    setStepValidation({});
    setHasRecoveredData(false);
    setLastSaveTime(null);
    setErrors({});
  };

  const handleCatalogMatch = (item: TenantCatalogItem) => {
    // Auto-populate wizard data from supplier catalog item
    setWizardData(prev => ({
      ...prev,
      basicInfo: {
        ...prev.basicInfo,
        name: item.name || prev.basicInfo.name,
        brand: item.brand || prev.basicInfo.brand,
        gtin: item.gtin || prev.basicInfo.gtin,
      },
      content: {
        ...prev.content,
        description: item.description || prev.content.description,
        specifications: item.attrs || prev.content.specifications,
      },
      media: {
        ...prev.media,
        primaryImage: item.image_url ? {
          id: `catalog-${item.id}`,
          url: item.image_url,
          path: '',
          name: 'Catalog Image',
          size: 0,
          type: 'image/jpeg',
          uploadedAt: new Date()
        } : prev.media.primaryImage,
      },
      pricing: {
        ...prev.pricing,
        listPrice: item.msrp_cents || prev.pricing.listPrice,
      },
      catalogMatch: {
        supplier_catalog_item_id: item.id,
        supplier_id: item.supplier_id,
        supplier_sku: item.supplier_sku,
        source_type: 'supplier_catalog',
      },
    }));
    // Jump to Review step (last step)
    setCurrentStep(STEPS.length - 1);
  };

  const handleEnrichmentMatch = (enrichment: BarcodeEnrichment, barcode: string) => {
    const meta = enrichment.metadata || {};
    const specs = meta.specifications || {};
    const features: string[] = Array.isArray(meta.features) ? meta.features : [];
    const allImages: string[] = Array.isArray(meta.images)
      ? meta.images
      : meta.images && typeof meta.images === 'object'
        ? Object.values(meta.images).filter(Boolean) as string[]
        : [];
    const primaryImageUrl = enrichment.imageUrl || allImages[0] || null;
    const galleryUrls = allImages.filter((url: string) => url && url !== primaryImageUrl);

    // Split enrichment metadata into two buckets:
    // 1. specEntries — simple scalar values for the Specifications UI (weight, dimensions, etc.)
    // 2. enrichedMetadata — structured objects stored as metadata.* in inventory_items,
    //    aligned with scan.ts extractStructuredMetadata and the item detail page reader
    const toSpecValue = (v: any): string | number | undefined => {
      if (v == null) return undefined;
      if (typeof v === 'string' || typeof v === 'number') return v;
      if (typeof v === 'boolean') return String(v);
      if (Array.isArray(v)) return v.join(', ');
      return JSON.stringify(v);
    };

    // Structured enrichment fields that must stay as objects/arrays for metadata.* storage
    const STRUCTURED_KEYS = new Set([
      'nutrition', 'environmental', 'ingredients_analysis', 'allergens_tags',
      'labels_tags', 'traces_tags', 'additives_tags', 'ingredients_tags',
      'images', 'specifications', 'features',
    ]);

    const specEntries: Record<string, any> = {};
    const enrichedMeta: Record<string, any> = {};

    // Simple spec fields (scalars from specs sub-object)
    if (specs.weight) specEntries.weight = toSpecValue(specs.weight);
    if (specs.length) specEntries.length = toSpecValue(specs.length);
    if (specs.width) specEntries.width = toSpecValue(specs.width);
    if (specs.height) specEntries.height = toSpecValue(specs.height);
    if (specs.color) specEntries.color = toSpecValue(specs.color);
    if (specs.size) specEntries.size = toSpecValue(specs.size);
    if (specs.material) specEntries.material = toSpecValue(specs.material);

    // Scalar metadata fields → specifications for UI display
    if (meta.manufacturer) specEntries.manufacturer = toSpecValue(meta.manufacturer);
    if (meta.warranty) specEntries.warranty = toSpecValue(meta.warranty);
    if (meta.quantity) specEntries.quantity = toSpecValue(meta.quantity);
    if (meta.labels) specEntries.labels = toSpecValue(meta.labels);
    if (meta.stores) specEntries.stores = toSpecValue(meta.stores);

    // Structured metadata fields → enrichedMetadata for metadata.* storage
    // These align with scan.ts extractStructuredMetadata and item detail page reader
    if (meta.nutrition) enrichedMeta.nutrition = meta.nutrition;
    if (meta.ingredients) enrichedMeta.ingredients = meta.ingredients;
    if (meta.allergens) enrichedMeta.allergens = meta.allergens;
    if (meta.allergens_tags) enrichedMeta.allergens_tags = meta.allergens_tags;
    if (meta.environmental) enrichedMeta.environmental = meta.environmental;
    if (meta.nova_group) enrichedMeta.nova_group = meta.nova_group;
    if (meta.ingredients_analysis) enrichedMeta.ingredients_analysis = meta.ingredients_analysis;
    if (meta.labels_tags) enrichedMeta.labels_tags = meta.labels_tags;
    if (meta.traces) enrichedMeta.traces = meta.traces;
    if (meta.traces_tags) enrichedMeta.traces_tags = meta.traces_tags;
    if (meta.additives_tags) enrichedMeta.additives_tags = meta.additives_tags;
    if (meta.ingredients_tags) enrichedMeta.ingredients_tags = meta.ingredients_tags;
    if (meta.completeness) enrichedMeta.completeness = meta.completeness;
    if (meta.countries) enrichedMeta.countries = meta.countries;
    if (meta.packaging) enrichedMeta.packaging = meta.packaging;
    if (meta.origins) enrichedMeta.origins = meta.origins;
    if (meta.images) enrichedMeta.images = meta.images;
    if (meta.created_t) enrichedMeta.created_t = meta.created_t;
    if (meta.last_modified_t) enrichedMeta.last_modified_t = meta.last_modified_t;
    if (meta.barcode) enrichedMeta.barcode = meta.barcode;

    // Catch-all: any remaining keys not explicitly handled
    const HANDLED_KEYS = new Set([
      ...STRUCTURED_KEYS,
      'manufacturer', 'warranty', 'quantity', 'labels', 'stores',
      'allergens', 'nutrition', 'environmental', 'nova_group',
      'ingredients_analysis', 'allergens_tags', 'labels_tags',
      'traces', 'traces_tags', 'additives_tags', 'ingredients_tags',
      'completeness', 'countries', 'packaging', 'origins', 'images',
      'created_t', 'last_modified_t', 'barcode',
      'features', 'upc', 'ean', 'asin', 'isbn', 'mpn', 'model', 'elid',
      'pricing', 'offers',
    ]);
    Object.entries(meta).forEach(([key, value]) => {
      if (!HANDLED_KEYS.has(key) && value != null) {
        if (typeof value === 'object') {
          enrichedMeta[key] = value;
        } else {
          const sv = toSpecValue(value);
          if (sv != null) specEntries[key] = sv;
        }
      }
    });

    // Category from enrichment suggestion
    const catSuggestion = enrichment.categorySuggestion;
    const existingCat = catSuggestion?.existingTenantCategory;

    // Auto-populate wizard data from barcode enrichment data
    setWizardData(prev => ({
      ...prev,
      basicInfo: {
        ...prev.basicInfo,
        name: enrichment.name || prev.basicInfo.name,
        brand: enrichment.brand || prev.basicInfo.brand,
        gtin: barcode || prev.basicInfo.gtin,
        manufacturer: meta.manufacturer || prev.basicInfo.manufacturer,
        mpn: meta.mpn || meta.model || prev.basicInfo.mpn,
      },
      content: {
        ...prev.content,
        description: enrichment.description || prev.content.description,
        features: features.length > 0 ? features : prev.content.features,
        specifications: Object.keys(specEntries).length > 0 ? specEntries : prev.content.specifications,
        enrichedMetadata: Object.keys(enrichedMeta).length > 0 ? enrichedMeta : prev.content.enrichedMetadata,
        tags: [
          ...prev.content.tags,
          ...(meta.labels && typeof meta.labels === 'string' ? meta.labels.split(',').map((l: string) => l.trim()) : []),
        ].filter((tag, i, arr) => arr.indexOf(tag) === i), // dedupe
      },
      media: {
        ...prev.media,
        primaryImage: primaryImageUrl ? {
          id: `enrichment-${barcode}`,
          url: primaryImageUrl,
          path: '',
          name: 'Enrichment Image',
          size: 0,
          type: 'image/jpeg',
          uploadedAt: new Date()
        } : prev.media.primaryImage,
        galleryImages: [
          ...prev.media.galleryImages,
          ...galleryUrls.map((url: string, i: number) => ({
            id: `enrichment-gallery-${barcode}-${i}`,
            url,
            path: '',
            name: `Enrichment Image ${i + 2}`,
            size: 0,
            type: 'image/jpeg',
            uploadedAt: new Date()
          })),
        ],
      },
      pricing: {
        ...prev.pricing,
        listPrice: enrichment.priceCents || prev.pricing.listPrice,
      },
      organization: {
        ...prev.organization,
        categoryId: existingCat?.id || prev.organization.categoryId,
        categoryName: existingCat?.name || catSuggestion?.suggestedName || prev.organization.categoryName,
        googleCategoryId: existingCat?.googleCategoryId || catSuggestion?.googleCategoryId || prev.organization.googleCategoryId,
        categoryPath: catSuggestion?.categoryPath?.join(' > ') || prev.organization.categoryPath,
      },
      catalogMatch: {
        supplier_catalog_item_id: undefined,
        supplier_id: undefined,
        supplier_sku: undefined,
        source_type: 'barcode_enrichment',
      },
    }));
    // Jump to Review step (last step)
    setCurrentStep(STEPS.length - 1);
  };

  const handleCatalogSkip = () => {
    // Proceed to Basic Info step (step 1 when catalog enabled, step 0 otherwise)
    setCurrentStep(stepOffset);
  };

  const renderStep = () => {
    // Catalog search step (step 0 when feature flag enabled)
    if (catalogEnabled && currentStep === 0) {
      return (
        <CatalogSearchStep
          tenantId={tenantId}
          onUseProduct={handleCatalogMatch}
          onUseEnrichment={handleEnrichmentMatch}
          onSkip={handleCatalogSkip}
        />
      );
    }

    const step = currentStep - stepOffset;
    switch (step) {
      case 0:
        return (
          <BasicInfoStep
            data={wizardData.basicInfo}
            errors={errors}
            onChange={(data) => handleStepData({ basicInfo: data })}
            productType={wizardData.productType.type}
            gtinReadOnly={!!wizardData.catalogMatch}
          />
        );
      case 1:
        return (
          <div className="space-y-6">
            <ProductTypeStep
              data={wizardData.productType}
              errors={errors}
              onChange={(data) => handleStepData({ productType: data })}
              tenantId={tenantId}
              parentSku={wizardData.productType.sku}
              fromCatalog={!!wizardData.catalogMatch && wizardData.catalogMatch.source_type === 'supplier_catalog'}
            />
            {wizardData.productType.type === 'service' && wizardData.productType.serviceProduct && (
              <ServiceDetailsStep
                data={wizardData.productType.serviceProduct}
                errors={errors}
                onChange={(serviceProduct) =>
                  handleStepData({
                    productType: {
                      ...wizardData.productType,
                      serviceProduct,
                    },
                  })
                }
              />
            )}
          </div>
        );
      case 2:
        return (
          <PricingStep
            data={wizardData.pricing}
            errors={errors}
            variants={wizardData.productType.variants}
            tenantId={tenantId}
            productType={wizardData.productType.type}
            onChange={(data) => handleStepData({ pricing: data })}
          />
        );
      case 3:
        return (
          <ContentStep
            data={wizardData.content}
            errors={errors}
            onChange={(data) => handleStepData({ content: data })}
          />
        );
      case 4:
        return (
          <MediaStep
            data={wizardData.media}
            errors={errors}
            productType={wizardData.productType}
            variants={wizardData.productType.variants}
            onChange={(data) => handleStepData({ media: data })}
          />
        );
      case 5:
        return (
          <OrganizationStep
            data={wizardData.organization}
            errors={errors}
            onChange={(data) => handleStepData({ organization: data })}
            tenantId={tenantId}
            productType={wizardData.productType.type}
          />
        );
      case 6:
        return (
          <ReviewStep
            data={{
              basicInfo: wizardData.basicInfo,
              productType: wizardData.productType,
              pricing: wizardData.pricing,
              content: wizardData.content,
              media: wizardData.media,
              // Organization step data from nested organization object
              categoryId: wizardData.organization.categoryId,
              categoryName: wizardData.organization.categoryName,
              googleCategoryId: wizardData.organization.googleCategoryId,
              shopCategoryId: wizardData.organization.shopCategoryId,
              tags: wizardData.content.tags, // Tags from content step
              seoTitle: wizardData.organization.seoTitle,
              seoDescription: wizardData.organization.seoDescription,
              seoKeywords: wizardData.organization.seoKeywords,
              inventorySettings: wizardData.organization.inventorySettings,
              organizationSettings: wizardData.organization.organizationSettings,
              channels: wizardData.organization.channels,
              publishingOptions: wizardData.review.publishingOptions,
              featuringOptions: wizardData.review.featuringOptions
            }}
            errors={errors}
            onChange={(data) => handleStepData({ review: data })}
            onComplete={onComplete ? () => onComplete(wizardData) : () => {}}
            tenantId={tenantId}
          />
        );
      default:
        return <div>Step not found</div>;
    }
  };

  const getStepIcon = (stepIndex: number) => {
    if (stepValidation[stepIndex]) {
      return <Check className="h-4 w-4 text-green-500" />;
    } else if (errors[Object.keys(errors)[0]] && Object.keys(errors)[0] !== '') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStepColor = (stepIndex: number) => {
    if (stepValidation[stepIndex]) {
      return 'text-green-600';
    } else if (currentStep === stepIndex) {
      return 'text-blue-600';
    } else if (stepValidation[stepIndex] === false) {
      return 'text-red-600';
    } else {
      return 'text-gray-400';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Product' : 'Create New Product'}
        </h1>
        <p className="text-gray-600">
          {isEditing 
            ? 'Update product information across all available steps'
            : 'Follow the steps to create a new product with advanced variant support'
          }
        </p>
      </div>

      {/* Recovery Notification */}
      {hasRecoveredData && !isEditing && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Work recovered!</strong> Your previous progress has been restored from {lastSaveTime?.toLocaleDateString()} {lastSaveTime?.toLocaleTimeString()}.
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearDraft}
                className="ml-4"
              >
                Clear Draft
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-save Status */}
      {!isEditing && lastSaveTime && !hasRecoveredData && (
        <div className="mb-4 text-sm text-gray-500 flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          Auto-saved at {lastSaveTime.toLocaleTimeString()}
        </div>
      )}

      {/* Progress */}
      <WizardProgress
        steps={STEPS}
        currentStep={currentStep}
        validation={stepValidation}
        onStepClick={handleStepJump}
        allowJumping={allowStepJumping}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wizard Steps */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStepIcon(currentStep)}
                {STEPS[currentStep].title}
                <Badge variant={currentStep === 0 ? 'default' : 'info'}>
                  Step {currentStep + 1} of {STEPS.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {STEPS[currentStep].description}
              </p>
              
              {/* Step Content */}
              <div className="min-h-[400px]">
                {renderStep()}
              </div>

              {/* Step Errors */}
              {Object.keys(errors).length > 0 && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please fix the following errors before continuing:
                    <ul className="list-disc list-inside ml-4 mt-2">
                      {Object.entries(errors).map(([field, error]) => (
                        <li key={field}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Wizard Navigation */}
          <WizardNavigation
            currentStep={currentStep}
            totalSteps={STEPS.length}
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === STEPS.length - 1}
            canGoPrevious={currentStep > 0}
            canGoNext={canProceedToNextStep()}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSave={handleSave}
            onSubmit={handleSubmit}
            onAddToQueue={handleAddToQueue}
            hasSku={!!(wizardData.productType.sku && wizardData.productType.sku.trim().length >= 2)}
          />
          
          {/* Product Preview */}
          {/* <ProductPreview
            data={wizardData}
            currentStep={currentStep}
          /> */}
          
          {/* Quality Indicator */}
          {/* <QualityIndicator
          */}
        </div>
      </div>
    </div>
  );
}
