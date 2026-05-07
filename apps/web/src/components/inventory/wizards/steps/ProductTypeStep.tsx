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

import { useState, useEffect } from 'react';
import { Package, Download, Layers, Settings, Plus, Trash2, Copy, AlertTriangle, AlertCircle, Wand2, CheckCircle } from 'lucide-react';
import { generateSKU, generateTenantKey } from '@/lib/sku-generator';

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

interface ProductTypeStepProps {
  data: {
    type: 'physical' | 'digital' | 'hybrid';
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

  const handleTypeChange = (type: 'physical' | 'digital' | 'hybrid') => {
    // Auto-adjust stock quantity based on product type
    let newStockQuantity = data.stockQuantity;
    
    // Digital products get unlimited stock (9999)
    if (type === 'digital') {
      newStockQuantity = 9999;
    }
    // Physical products default to 0 if coming from digital
    else if (type === 'physical' && data.type === 'digital') {
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
        attributes: {},
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'physical':
        return <Package className="h-5 w-5" />;
      case 'digital':
        return <Download className="h-5 w-5" />;
      case 'hybrid':
        return <Layers className="h-5 w-5" />;
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
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
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
          SKU will be auto-generated by the API if left empty. {data.sku && `Will include product type: ${data.type === 'physical' ? 'PHYS' : data.type === 'digital' ? 'DIGI' : 'HYBR'}`}
        </p>
      </div>

      <Separator />

      {/* Stock Quantity */}
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

      {/* Variants Configuration */}
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
                  <div className="space-y-2">
                    {data.variants.map((variant, index) => (
                      <div key={variant.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-500">
                              #{index + 1}
                            </span>
                            <span className="font-medium">{variant.name}</span>
                            {variant.isActive && (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicateVariant(variant.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(variant.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Variant SKU */}
                        <div className="flex items-center space-x-2 mb-3">
                          <Label className="text-sm text-gray-600 min-w-[60px]">SKU:</Label>
                          <Input
                            value={variant.sku || ''}
                            onChange={(e) => updateVariantSku(variant.id, e.target.value)}
                            placeholder="Enter SKU or auto-generate..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => autoGenerateVariantSku(variant.id)}
                            title="Auto-generate SKU"
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Variant Stock Quantity */}
                        <div className="flex items-center space-x-4">
                          <Label className="text-sm text-gray-600">Stock:</Label>
                          <Input
                            type="number"
                            value={variant.stock || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateVariantStock(variant.id, parseInt(e.target.value) || 0)}
                            min={0}
                            max={999999}
                            step={1}
                            className="w-24"
                            placeholder="0"
                          />
                          <div className="text-sm text-gray-500">
                            {variant.stock > 0 
                              ? `${variant.stock} units`
                              : 'Out of stock'
                            }
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

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
