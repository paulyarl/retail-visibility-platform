/**
 * Product Type Step (Step 2)
 * 
 * Product type and variant configuration including:
 * - Product type (physical/digital/hybrid)
 * - Variant enable/disable
 * - Variant configuration options
 * - Attribute type selection
 * 
 * Second step in the 7-step product creation wizard
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Download, Layers, Settings, Plus, Trash2, Copy, AlertTriangle, AlertCircle, Wand2, CheckCircle, Upload, Image, Loader2, X, Wrench } from 'lucide-react';
import { generateSKU, generateTenantKey } from '@/lib/sku-generator';
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Switch } from '@/components/ui/Switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn-select';
import DigitalProductConfig, { DigitalProductData } from '@/components/items/DigitalProductConfig';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { itemsService } from '@/services/ItemsSingletonService';

interface ProductTypeStepProps {
  data: {
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
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  tenantId?: string;
  parentSku?: string;
}

const ATTRIBUTE_TYPES = [
  { id: 'size', label: 'Size', icon: '📏' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'material', label: 'Material', icon: '🧵' },
  { id: 'style', label: 'Style', icon: '👔' },
  { id: 'weight', label: 'Weight', icon: '⚖️' },
  { id: 'dimensions', label: 'Dimensions', icon: '📐' },
  { id: 'flavor', label: 'Flavor', icon: '🍦' },
  { id: 'scent', label: 'Scent', icon: '🌸' },
  { id: 'capacity', label: 'Capacity', icon: '📦' },
  { id: 'voltage', label: 'Voltage', icon: '⚡' },
  { id: 'compatibility', label: 'Compatibility', icon: '🔌' },
  { id: 'warranty', label: 'Warranty', icon: '🛡️' }
];

export default function ProductTypeStep({ data, errors, onChange, tenantId, parentSku }: ProductTypeStepProps) {
  const [showVariantConfig, setShowVariantConfig] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [newAttributeType, setNewAttributeType] = useState('');
  const [showAddAttribute, setShowAddAttribute] = useState(false);
  const [skuError, setSkuError] = useState<string>('');
  const [uploadingVariantId, setUploadingVariantId] = useState<string | null>(null);
  const variantImageInputRef = useRef<HTMLInputElement | null>(null);

  // Product options capability gating
  const productOptionsCap = useProductOptionsCapability(tenantId || null, { forTenant: true });
  const allowedTypes = productOptionsCap.data?.allowedTypes ?? ['physical', 'digital', 'hybrid', 'service'];
  const showsVariants = productOptionsCap.data?.showsVariants ?? true;
  const isProductEnabled = productOptionsCap.data?.enabled ?? true;

  // Auto-switch to physical if current type is not available
  useEffect(() => {
    if (data.type === 'digital' && !allowedTypes.includes('digital')) {
      handleTypeChange('physical');
    } else if (data.type === 'hybrid' && !allowedTypes.includes('hybrid')) {
      handleTypeChange('physical');
    } else if (data.type === 'service' && !allowedTypes.includes('service')) {
      handleTypeChange('physical');
    }
  }, [data.type, allowedTypes]);

  const handleTypeChange = (type: 'physical' | 'digital' | 'hybrid' | 'service') => {
    // Auto-adjust stock quantity based on product type
    let newStockQuantity = data.stockQuantity;
    
    // Digital products get unlimited stock (9999)
    if (type === 'digital') {
      newStockQuantity = 9999;
    }
    // Service products get unlimited stock
    else if (type === 'service') {
      newStockQuantity = 9999;
    }
    // Physical products default to 0 if coming from digital/service
    else if (type === 'physical' && (data.type === 'digital' || data.type === 'service')) {
      newStockQuantity = 0;
    }
    // Hybrid keeps current value or defaults to 0
    else if (type === 'hybrid' && data.stockQuantity === 9999) {
      newStockQuantity = 0;
    }

    onChange({
      ...data,
      type,
      stockQuantity: newStockQuantity
    });
  };

  const handleSkuChange = (value: string) => {
    onChange({
      ...data,
      sku: value
    });
  };

  const handleAutoGenerateSKU = () => {
    const generatedSKU = generateSKU({
      tenantKey: tenantId ? generateTenantKey(tenantId) : undefined,
      productType: data.type,
    });
    handleSkuChange(generatedSKU);
  };

  // Validate SKU in real-time
  useEffect(() => {
    if (data.sku && data.sku.trim().length > 0) {
      if (data.sku.trim().length < 2) {
        setSkuError('SKU must be at least 2 characters');
      } else if (data.sku.trim().length > 50) {
        setSkuError('SKU must be less than 50 characters');
      } else {
        setSkuError('');
      }
    } else {
      setSkuError('');
    }
  }, [data.sku]);

  const handleStockQuantityChange = (stockQuantity: number) => {
    onChange({
      ...data,
      stockQuantity
    });
  };

  const handleDigitalProductChange = (digitalProduct: DigitalProductData) => {
    onChange({
      ...data,
      digitalProduct
    });
  };

  const handleVariantsToggle = (hasVariants: boolean) => {
    onChange({
      ...data,
      hasVariants,
      // Reset variants if disabling
      variants: hasVariants ? data.variants : [],
      variantConfig: hasVariants ? data.variantConfig : {
        cloningEnabled: false,
        individualPhotos: false,
        attributeTypes: []
      }
    });
  };

  const handleVariantConfigChange = (config: any) => {
    onChange({
      ...data,
      variantConfig: {
        ...data.variantConfig,
        ...config
      }
    });
  };

  const handleAttributeTypeToggle = (attributeType: string, checked: boolean) => {
    const attributeTypes = checked
      ? [...data.variantConfig.attributeTypes, attributeType]
      : data.variantConfig.attributeTypes.filter(type => type !== attributeType);
    
    handleVariantConfigChange({ attributeTypes });
  };

  const addCustomAttributeType = () => {
    if (newAttributeType.trim()) {
      const normalizedType = newAttributeType.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Check if attribute type already exists
      if (!data.variantConfig.attributeTypes.includes(normalizedType)) {
        handleAttributeTypeToggle(normalizedType, true);
      }
      
      setNewAttributeType('');
      setShowAddAttribute(false);
    }
  };

  const addVariant = () => {
    if (newVariantName.trim()) {
      const newVariant = {
        id: `variant_${Date.now()}`,
        name: newVariantName.trim(),
        sku: '',
        priceCents: 0,
        stock: 0,
        attributes: data.variantConfig.attributeTypes.length > 0 ? {} : {
          // For single-attribute variants, store the name as an attribute
          option: newVariantName.trim()
        },
        isActive: true,
        sortOrder: data.variants.length
      };
      
      onChange({
        ...data,
        variants: [...data.variants, newVariant]
      });
      
      setNewVariantName('');
    }
  };

  const removeVariant = (variantId: string) => {
    onChange({
      ...data,
      variants: data.variants.filter(v => v.id !== variantId)
    });
  };

  const updateVariantStock = (variantId: string, stock: number) => {
    onChange({
      ...data,
      variants: data.variants.map(v => 
        v.id === variantId ? { ...v, stock } : v
      )
    });
  };

  const updateVariantSku = (variantId: string, sku: string) => {
    onChange({
      ...data,
      variants: data.variants.map(v => 
        v.id === variantId ? { ...v, sku } : v
      )
    });
  };

  const autoGenerateVariantSku = (variantId: string) => {
    const variant = data.variants.find(v => v.id === variantId);
    if (!variant) return;

    let generatedSKU = '';
    
    // If parent SKU exists, use it as base
    if (parentSku && parentSku.trim()) {
      // Generate variant SKU: ParentSKU-AttributeValues
      const attrValues = Object.values(variant.attributes || {})
        .filter(val => val)
        .map((val: any) => val.toString().toUpperCase().substring(0, 3))
        .join('-');
      generatedSKU = `${parentSku}-${attrValues || `VAR${data.variants.findIndex(v => v.id === variantId) + 1}`}`;
    } else {
      // Generate standalone SKU for variant
      generatedSKU = generateSKU({
        tenantKey: tenantId ? generateTenantKey(tenantId) : undefined,
        productType: data.type,
      });
    }
    
    updateVariantSku(variantId, generatedSKU);
  };

  const duplicateVariant = (variantId: string) => {
    const variant = data.variants.find(v => v.id === variantId);
    if (variant) {
      const duplicated = {
        ...variant,
        id: `variant_${Date.now()}`,
        name: `${variant.name} (Copy)`,
        sku: `${variant.sku}_copy`,
        sortOrder: data.variants.length
      };
      
      onChange({
        ...data,
        variants: [...data.variants, duplicated]
      });
    }
  };

  // Handle variant image upload
  const handleVariantImageUpload = async (variantId: string, file: File) => {
    if (!tenantId) return;
    
    setUploadingVariantId(variantId);
    try {
      // Step 1: Compress image
      const result = await uploadImage(file, ImageUploadPresets.product);
      
      if (result.error) {
        console.error('[ProductTypeStep] Image compression error:', result.error);
        return;
      }
      
      // Step 2: Upload to Supabase
      const uploadResult = await itemsService.uploadTempPhoto({
        tenantId,
        dataUrl: result.dataUrl,
      });
      
      if (uploadResult?.url) {
        const updatedVariants = data.variants.map(v =>
          v.id === variantId ? { ...v, image_url: uploadResult.url, image_path: uploadResult.path } : v
        );
        onChange({ ...data, variants: updatedVariants });
      }
    } catch (error) {
      console.error('[ProductTypeStep] Variant image upload error:', error);
    } finally {
      setUploadingVariantId(null);
    }
  };

  // Remove variant image
  const handleRemoveVariantImage = async (variantId: string) => {
    const variant = data.variants.find(v => v.id === variantId);
    if (variant?.image_path) {
      try {
        await itemsService.deleteTempPhoto(variant.image_path);
      } catch (error) {
        console.error('[ProductTypeStep] Failed to delete variant image:', error);
      }
    }
    
    const updatedVariants = data.variants.map(v =>
      v.id === variantId ? { ...v, image_url: null, image_path: null } : v
    );
    onChange({ ...data, variants: updatedVariants });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'physical':
        return <Package className="h-5 w-5" />;
      case 'digital':
        return <Download className="h-5 w-5" />;
      case 'hybrid':
        return <Layers className="h-5 w-5" />;
      case 'service':
        return <Wrench className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'physical':
        return 'Tangible product that requires shipping and inventory management';
      case 'digital':
        return 'Digital product that can be downloaded or accessed online';
      case 'hybrid':
        return 'Product with both physical and digital components';
      case 'service':
        return 'Bookable service, appointment, or consultation';
      default:
        return '';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'physical':
        return <Badge className="bg-blue-100 text-blue-800">Physical</Badge>;
      case 'digital':
        return <Badge className="bg-purple-100 text-purple-800">Digital</Badge>;
      case 'hybrid':
        return <Badge className="bg-green-100 text-green-800">Hybrid</Badge>;
      case 'service':
        return <Badge className="bg-orange-100 text-orange-800">Service</Badge>;
      default:
        return null;
    }
  };

  const isFormValid = () => {
    // SKU is optional - API will auto-generate if empty
    // Only validate SKU if user has entered something
    const skuValid = !data.sku || data.sku.trim().length === 0 || (
      data.sku.trim().length >= 2 &&
      data.sku.trim().length <= 50 &&
      !skuError
    );

    return (
      data.type &&
      skuValid &&
      (!data.hasVariants || data.variants.length > 0) &&
      (!data.hasVariants || data.variantConfig.attributeTypes.length > 0)
    );
  };

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Package className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Product Type & Variants</h4>
              <p className="text-sm text-blue-700 mt-1">
                Define your product type and configure variants if applicable. Variants allow you to 
                sell the same product in different sizes, colors, or other variations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Type */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Product Type</Label>
        <RadioGroup
          value={data.type}
          onValueChange={handleTypeChange}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Physical - always available as default */}
          <Card className={`cursor-pointer transition-all ${data.type === 'physical' ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'}`}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="physical" id="physical" />
                <Label htmlFor="physical" className="cursor-pointer flex-1">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon('physical')}
                    <span className="font-medium">Physical</span>
                  </div>
                  {getTypeBadge('physical')}
                </Label>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {getTypeDescription('physical')}
              </p>
            </CardContent>
          </Card>

          {/* Digital Product Type - Gated by allowedTypes */}
          {allowedTypes.includes('digital') ? (
            <Card className={`cursor-pointer transition-all ${data.type === 'digital' ? 'border-purple-500 bg-purple-50' : 'hover:border-gray-300'}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="digital" id="digital" />
                  <Label htmlFor="digital" className="cursor-pointer flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('digital')}
                      <span className="font-medium">Digital</span>
                    </div>
                    {getTypeBadge('digital')}
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {getTypeDescription('digital')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-50 cursor-not-allowed border-gray-200 bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('digital')}
                      <span className="font-medium text-gray-500">Digital</span>
                      <Badge variant="outline" className="text-xs">Upgrade Required</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Digital products require a higher tier subscription
                </p>
              </CardContent>
            </Card>
          )}

          {/* Hybrid Product Type - Gated by allowedTypes */}
          {allowedTypes.includes('hybrid') ? (
            <Card className={`cursor-pointer transition-all ${data.type === 'hybrid' ? 'border-green-500 bg-green-50' : 'hover:border-gray-300'}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="hybrid" id="hybrid" />
                  <Label htmlFor="hybrid" className="cursor-pointer flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('hybrid')}
                      <span className="font-medium">Hybrid</span>
                    </div>
                    {getTypeBadge('hybrid')}
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {getTypeDescription('hybrid')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-50 cursor-not-allowed border-gray-200 bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('hybrid')}
                      <span className="font-medium text-gray-500">Hybrid</span>
                      <Badge variant="outline" className="text-xs">Upgrade Required</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Hybrid products require a higher tier subscription
                </p>
              </CardContent>
            </Card>
          )}

          {/* Service Product Type - Gated by allowedTypes */}
          {allowedTypes.includes('service') ? (
            <Card className={`cursor-pointer transition-all ${data.type === 'service' ? 'border-orange-500 bg-orange-50' : 'hover:border-gray-300'}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="service" id="service" />
                  <Label htmlFor="service" className="cursor-pointer flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('service')}
                      <span className="font-medium">Service</span>
                    </div>
                    {getTypeBadge('service')}
                  </Label>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {getTypeDescription('service')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="opacity-50 cursor-not-allowed border-gray-200 bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon('service')}
                      <span className="font-medium text-gray-500">Service</span>
                      <Badge variant="outline" className="text-xs">Upgrade Required</Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Service products require a higher tier subscription
                </p>
              </CardContent>
            </Card>
          )}
        </RadioGroup>
      </div>

      <Separator />

      {/* SKU Field - After Product Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="sku" className="text-base font-medium">
          Product SKU <span className="text-gray-400 text-sm font-normal">(optional - auto-generated if empty)</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="sku"
            value={data.sku || ''}
            onChange={(e) => handleSkuChange(e.target.value)}
            placeholder="Leave empty to auto-generate..."
            className={skuError ? 'border-red-500' : ''}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoGenerateSKU}
            title="Auto-generate SKU based on product type"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
        {skuError && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{skuError}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{(data.sku || '').trim().length}/50 characters</span>
          {(data.sku || '').trim().length >= 2 && (data.sku || '').trim().length <= 50 && !skuError && (
            <span className="text-green-600 flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          SKU will be auto-generated by the API if left empty. {data.sku && `Will include product type: ${data.type === 'physical' ? 'PHYS' : data.type === 'digital' ? 'DIGI' : data.type === 'service' ? 'SERV' : 'HYBR'}`}
        </p>
      </div>

      <Separator />

      {/* Stock Quantity - Only show if no variants with stock */}
      {(() => {
        const hasVariantsWithStock = data.hasVariants && data.variants.length > 0 && data.variants.some(v => v.stock !== undefined && v.stock !== null);
        
        return !hasVariantsWithStock && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-green-600" />
              <Label className="text-base font-medium">Stock Quantity</Label>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">
                {data.type === 'digital' 
                  ? 'Set available units (for digital products, this represents download/licenses available)'
                  : 'Set initial stock quantity (units available for sale)'
                }
              </Label>
              <div className="flex items-center space-x-4">
                <Input
                  type="number"
                  value={data.stockQuantity || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStockQuantityChange(parseInt(e.target.value) || 0)}
                  min={0}
                  max={999999}
                  step={1}
                  className="w-32"
                  placeholder="0"
                />
                <div className="text-sm text-gray-500">
                  {data.stockQuantity > 0 
                    ? `${data.stockQuantity} units available`
                    : 'Out of stock'
                  }
                </div>
              </div>
            </div>

            {data.type === 'physical' && data.stockQuantity === 0 && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Product will be marked as out of stock. Consider adding inventory to enable sales.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );
      })()}

      {/* Digital Product Configuration - Only for Digital/Hybrid */}
      {(data.type === 'digital' || data.type === 'hybrid') && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Download className="h-4 w-4 text-purple-600" />
              <Label className="text-base font-medium">Digital Product Settings</Label>
            </div>
            <DigitalProductConfig
              value={data.digitalProduct || {
                deliveryMethod: 'direct_download',
                assets: [],
                licenseType: 'personal',
                accessDurationDays: null,
                downloadLimit: null,
                externalUrl: '',
                assetName: '',
                accessInstructions: ''
              }}
              onChange={handleDigitalProductChange}
              disabled={false}
            />
          </div>
        </>
      )}

      <Separator />

      {/* Variants Configuration - Gated by showsVariants capability */}
      {showsVariants && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Product Variants</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="has-variants"
              checked={data.hasVariants}
              onCheckedChange={handleVariantsToggle}
            />
            <Label htmlFor="has-variants" className="text-sm">
              {data.hasVariants ? 'Variants enabled' : 'Variants disabled'}
            </Label>
          </div>
        </div>

        {data.hasVariants && (
          <div className="space-y-4">
            {/* Variant Configuration Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Variant Configuration</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cloning Enabled */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Enable Cloning</Label>
                    <p className="text-sm text-gray-600">
                      Clone parent product data to variants automatically
                    </p>
                  </div>
                  <Switch
                    checked={data.variantConfig.cloningEnabled}
                    onCheckedChange={(checked) => handleVariantConfigChange({ cloningEnabled: checked })}
                  />
                </div>

                {/* Individual Photos */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Individual Photos</Label>
                    <p className="text-sm text-gray-600">
                      Allow different photos for each variant
                    </p>
                  </div>
                  <Switch
                    checked={data.variantConfig.individualPhotos}
                    onCheckedChange={(checked) => handleVariantConfigChange({ individualPhotos: checked })}
                  />
                </div>

                <Separator />

                {/* Attribute Types */}
                <div>
                  <Label className="font-medium">Attribute Types</Label>
                  <p className="text-sm text-gray-600 mb-3">
                    Select the attributes that will define your variants
                  </p>
                  
                  {/* Preset Attribute Types */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {ATTRIBUTE_TYPES.map((attrType) => (
                      <div key={attrType.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`attr-${attrType.id}`}
                          checked={data.variantConfig.attributeTypes.includes(attrType.id)}
                          onCheckedChange={(checked: boolean) => handleAttributeTypeToggle(attrType.id, checked)}
                        />
                        <Label htmlFor={`attr-${attrType.id}`} className="cursor-pointer">
                          <span className="mr-1">{attrType.icon}</span>
                          <span className="text-sm">{attrType.label}</span>
                        </Label>
                      </div>
                    ))}
                  </div>

                  {/* Custom Attribute Types */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium text-gray-700">Custom Attributes</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddAttribute(!showAddAttribute)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Custom
                      </Button>
                    </div>

                    {/* Custom Attribute Input */}
                    {showAddAttribute && (
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg mb-3">
                        <Input
                          placeholder="e.g., width, length, height..."
                          value={newAttributeType}
                          onChange={(e) => setNewAttributeType(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addCustomAttributeType();
                            }
                          }}
                        />
                        <Button onClick={addCustomAttributeType} disabled={!newAttributeType.trim()}>
                          Add
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddAttribute(false);
                          setNewAttributeType('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    )}

                    {/* Display Custom Attributes */}
                    {data.variantConfig.attributeTypes.filter(type => 
                      !ATTRIBUTE_TYPES.find(preset => preset.id === type)
                    ).length > 0 && (
                      <div className="space-y-2">
                        {data.variantConfig.attributeTypes
                          .filter(type => !ATTRIBUTE_TYPES.find(preset => preset.id === type))
                          .map(customType => (
                            <div key={customType} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`custom-${customType}`}
                                  checked={true}
                                  onCheckedChange={(checked: boolean) => handleAttributeTypeToggle(customType, checked)}
                                />
                                <Label htmlFor={`custom-${customType}`} className="cursor-pointer text-sm">
                                  <span className="mr-1">🏷️</span>
                                  <span className="capitalize">{customType.replace(/_/g, ' ')}</span>
                                </Label>
                              </div>
                              <Badge variant="default" className="text-xs">Custom</Badge>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Help Text */}
                    <p className="text-xs text-gray-500 mt-2">
                      Add custom attributes like "width", "length", "height", or any other property that varies between your product variants.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variants List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Variants ({data.variants.length})</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVariantConfig(!showVariantConfig)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Variant
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Label className="text-sm text-gray-600">Enter price in cents (199 = $1.99)</Label>
                <span className="block text-xs text-blue-600 font-medium">
                  💡 Tip: Enter prices in cents for speed (80 = $0.80, 1499 = $14.99, 19599 = $195.99)
                </span>
                {showVariantConfig && (
                  <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <Input
                      placeholder="Variant name..."
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={addVariant} disabled={!newVariantName.trim()}>
                      Add
                    </Button>
                    <Button variant="outline" onClick={() => setShowVariantConfig(false)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {data.variants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No variants added yet</p>
                    <p className="text-sm">Click "Add Variant" to create your first variant</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.variants.map((variant, index) => (
                      <div key={variant.id} className="p-4 bg-gray-50 rounded-lg border">
                        {/* Header Row: Name, Active Toggle, Actions */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-500">
                              #{index + 1}
                            </span>
                            <Input
                              value={variant.variant_name || variant.name || ''}
                              onChange={(e) => {
                                const updatedVariants = data.variants.map(v =>
                                  v.id === variant.id ? { ...v, variant_name: e.target.value, name: e.target.value } : v
                                );
                                onChange({ ...data, variants: updatedVariants });
                              }}
                              placeholder="Variant name"
                              className="w-48"
                            />
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`active-${variant.id}`}
                                checked={variant.is_active !== false && variant.isActive !== false}
                                onCheckedChange={(checked: boolean) => {
                                  const updatedVariants = data.variants.map(v =>
                                    v.id === variant.id ? { ...v, is_active: checked, isActive: checked } : v
                                  );
                                  onChange({ ...data, variants: updatedVariants });
                                }}
                              />
                              <Label htmlFor={`active-${variant.id}`} className="text-sm">
                                Active
                              </Label>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateVariant(variant.id)}
                              title="Duplicate variant"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(variant.id)}
                              title="Delete variant"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Grid Layout for Variant Fields */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {/* SKU */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">SKU</Label>
                            <div className="flex items-center space-x-1">
                              <Input
                                value={variant.sku || ''}
                                onChange={(e) => updateVariantSku(variant.id, e.target.value)}
                                placeholder="SKU"
                                className="flex-1 text-sm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => autoGenerateVariantSku(variant.id)}
                                title="Auto-generate SKU"
                              >
                                <Wand2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* List Price (cents) */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">List Price (cents)</Label>
                            <Input
                              type="number"
                              value={variant.price_cents || variant.priceCents || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const priceCents = parseInt(e.target.value) || 0;
                                const updatedVariants = data.variants.map(v =>
                                  v.id === variant.id ? { ...v, price_cents: priceCents, priceCents } : v
                                );
                                onChange({ ...data, variants: updatedVariants });
                              }}
                              min={0}
                              step={1}
                              placeholder="1499 = $14.99"
                              className="text-sm"
                            />
                          </div>

                          {/* Sale Price (cents) */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">Sale Price (cents)</Label>
                            <Input
                              type="number"
                              value={variant.sale_price_cents || variant.salePriceCents || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const salePriceCents = e.target.value ? parseInt(e.target.value) : null;
                                const updatedVariants = data.variants.map(v =>
                                  v.id === variant.id ? { ...v, sale_price_cents: salePriceCents, salePriceCents } : v
                                );
                                onChange({ ...data, variants: updatedVariants });
                              }}
                              min={0}
                              step={1}
                              placeholder="Optional"
                              className="text-sm"
                            />
                          </div>

                          {/* Stock */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">Stock</Label>
                            <Input
                              type="number"
                              value={variant.stock ?? 0}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariantStock(variant.id, parseInt(e.target.value) || 0)}
                              min={0}
                              max={999999}
                              step={1}
                              placeholder="0"
                              className="text-sm"
                            />
                          </div>

                          {/* Sort Order */}
                          <div>
                            <Label className="text-xs text-gray-500 mb-1 block">Sort Order</Label>
                            <Input
                              type="number"
                              value={variant.sort_order ?? index}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const sortOrder = parseInt(e.target.value) || 0;
                                const updatedVariants = data.variants.map(v =>
                                  v.id === variant.id ? { ...v, sort_order: sortOrder } : v
                                );
                                onChange({ ...data, variants: updatedVariants });
                              }}
                              min={0}
                              placeholder="0"
                              className="text-sm"
                            />
                          </div>

                          {/* Variant Image */}
                          <div className="col-span-2">
                            <Label className="text-xs text-gray-500 mb-1 block">Variant Image</Label>
                            <div className="flex items-center space-x-3">
                              {variant.image_url ? (
                                <div className="flex items-center space-x-3">
                                  <img
                                    src={variant.image_url}
                                    alt={variant.variant_name || variant.name}
                                    className="w-12 h-12 object-cover rounded border"
                                  />
                                  <span className="text-xs text-gray-500 truncate max-w-[150px]">
                                    {variant.image_url.split('/').pop()}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveVariantImage(variant.id)}
                                    title="Remove image"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <input
                                    ref={variantImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleVariantImageUpload(variant.id, file);
                                    }}
                                    className="hidden"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingVariantId === variant.id}
                                    onClick={() => {
                                      variantImageInputRef.current?.click();
                                    }}
                                  >
                                    {uploadingVariantId === variant.id ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Upload className="h-3 w-3 mr-1" />
                                    )}
                                    Upload
                                  </Button>
                                  <span className="text-xs text-gray-400">No image</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Attributes Section */}
                        {(() => {
                          // Get all attribute keys from both config and variant's existing attributes
                          const configAttrs = data.variantConfig.attributeTypes || [];
                          const variantAttrKeys = Object.keys(variant.attributes || {});
                          const allAttrKeys = [...new Set([...configAttrs, ...variantAttrKeys])];
                          
                          return allAttrKeys.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Label className="text-xs text-gray-500 mb-2 block">Attributes</Label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {allAttrKeys.map((attrKey) => (
                                  <div key={attrKey}>
                                    <Label className="text-xs text-gray-400 capitalize mb-1 block">
                                      {attrKey.replace(/_/g, ' ')}
                                    </Label>
                                    <Input
                                      value={variant.attributes?.[attrKey] || ''}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const updatedVariants = data.variants.map(v =>
                                          v.id === variant.id
                                            ? { ...v, attributes: { ...v.attributes, [attrKey]: e.target.value } }
                                            : v
                                        );
                                        onChange({ ...data, variants: updatedVariants });
                                      }}
                                      placeholder={attrKey}
                                      className="text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      )}

      {!showsVariants && (
        <Card className="opacity-50 border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Copy className="h-5 w-5 text-gray-400" />
              <div>
                <h4 className="font-medium text-gray-500">Product Variants</h4>
                <p className="text-sm text-gray-400">
                  Variants are not available on your current plan. Upgrade to enable product variants.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <Package className="h-5 w-5 text-green-600" />
            ) : (
              <Settings className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Configuration complete' : 'Configuration needed'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'Product type and variants are properly configured.'
                  : data.hasVariants && data.variants.length === 0
                  ? 'Add at least one variant to continue.'
                  : data.hasVariants && data.variantConfig.attributeTypes.length === 0
                  ? 'Select at least one attribute type for variants.'
                  : 'Configuration is ready to continue.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
