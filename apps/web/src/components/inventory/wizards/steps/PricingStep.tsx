/**
 * Pricing Strategy Step (Step 3)
 * 
 * Advanced pricing configuration with:
 * - Numeric sliders for price adjustment
 * - Sale pricing with percentage calculations
 * - Variant pricing strategies (inherit/override/formula)
 * - Payment gateway selection
 * - Currency formatting and validation
 * 
 * Third step in the 7-step product creation wizard
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Percent, 
  Calculator, 
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Settings
} from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
// import { Slider } from '@/components/ui/Slider'; // Slider component not available
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn-select';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';

interface PricingStepProps {
  data: {
    listPrice: number;
    salePrice?: number;
    variantPricing: {
      enabled: boolean;
      type: 'inherit' | 'override' | 'formula' | 'direct';
      priceAdjustments: any[];
      variantPrices?: Record<string, {
        listPrice: number;
        salePrice?: number;
      }>; // For direct pricing with both list and sale prices
    };
    gatewaySelection: {
      gateway_type: string | null;
      gateway_id: string | null;
    };
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  variants?: any[]; // Receive variants from ProductTypeStep
  tenantId?: string; // Add tenantId for fetching gateways
}

const PAYMENT_GATEWAYS = [
  { id: 'stripe', name: 'Stripe', description: 'Credit cards, Apple Pay, Google Pay' },
  { id: 'paypal', name: 'PayPal', description: 'PayPal, Venmo, credit cards' },
  { id: 'square', name: 'Square', description: 'Square processing, gift cards' },
  { id: 'shopify', name: 'Shopify Payments', description: 'Shopify integrated processing' },
  { id: 'manual', name: 'Manual', description: 'Offline or custom processing' }
];

export default function PricingStep({ data, errors, onChange, variants = [], tenantId }: PricingStepProps) {
  const [priceError, setPriceError] = useState<string>('');
  const [salePriceError, setSalePriceError] = useState<string>('');
  const [loadingGateways, setLoadingGateways] = useState(false);
  const [tenantGateways, setTenantGateways] = useState<any[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Fetch tenant's payment gateways using singleton for caching
  const fetchTenantGateways = async () => {
    if (!tenantId) return;
    
    try {
      setLoadingGateways(true);
      // Use singleton pattern for automatic caching (5-min TTL)
      const { getPaymentGatewaySingleton } = await import('@/lib/singletons/PaymentGatewaySingleton');
      const singleton = getPaymentGatewaySingleton(tenantId);
      
      // Fetch gateways via singleton (cached)
      const gateways = await singleton.fetchGateways();
      setTenantGateways(gateways);
    } catch (error) {
      console.error('Failed to fetch tenant gateways:', error);
    } finally {
      setLoadingGateways(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchTenantGateways();
    }
  }, [tenantId]);

  // Validate prices in real-time
  useEffect(() => {
    if (data.listPrice <= 0) {
      setPriceError('List price must be greater than 0');
    } else if (data.listPrice > 999999) {
      setPriceError('List price cannot exceed $9,999.99');
    } else {
      setPriceError('');
    }
  }, [data.listPrice]);

  useEffect(() => {
    if (data.salePrice && data.salePrice >= data.listPrice) {
      setSalePriceError('Sale price must be less than list price');
    } else if (data.salePrice && data.salePrice < 0) {
      setSalePriceError('Sale price cannot be negative');
    } else {
      setSalePriceError('');
    }
  }, [data.salePrice, data.listPrice]);

  const handleListPriceChange = (value: string) => {
    const priceInCents = parseInt(value || '0') || 0;
    onChange({
      ...data,
      listPrice: priceInCents
    });
  };

  const handleSalePriceChange = (value: string) => {
    const priceInCents = parseInt(value || '0') || 0;
    onChange({
      ...data,
      salePrice: priceInCents === 0 ? undefined : priceInCents
    });
  };

  const handleVariantPricingChange = (field: string, value: any) => {
    onChange({
      ...data,
      variantPricing: {
        ...data.variantPricing,
        [field]: value
      }
    });
  };

  const handleVariantPriceChange = (variantId: string, priceType: 'listPrice' | 'salePrice', price: string) => {
    const priceInCents = parseInt(price || '0') || 0;
    
    const currentVariantPrice = data.variantPricing.variantPrices?.[variantId] || {
      listPrice: data.listPrice,
      salePrice: undefined
    };
    
    const variantPrices = {
      ...data.variantPricing.variantPrices,
      [variantId]: {
        ...currentVariantPrice,
        [priceType]: priceType === 'salePrice' && priceInCents === 0 ? undefined : priceInCents
      }
    };
    
    handleVariantPricingChange('variantPrices', variantPrices);
  };

  const handleGatewayChange = (gateway_type: string) => {
    onChange({
      ...data,
      gatewaySelection: {
        gateway_type,
        gateway_id: gateway_type ? `${gateway_type}_${Date.now()}` : null
      }
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(cents / 100);
  };

  const calculateDiscountPercentage = () => {
    if (!data.salePrice || data.listPrice <= 0) return 0;
    return Math.round(((data.listPrice - data.salePrice) / data.listPrice) * 100);
  };

  const calculateVariantDiscountPercentage = (variantId: string) => {
    const variantPrice = data.variantPricing.variantPrices?.[variantId];
    if (!variantPrice?.salePrice || !variantPrice?.listPrice || variantPrice.listPrice <= 0) return 0;
    return Math.round(((variantPrice.listPrice - variantPrice.salePrice) / variantPrice.listPrice) * 100);
  };

  const calculateProfitMargin = () => {
    // This would typically include cost calculation
    // For now, we'll use a simple margin calculation
    if (!data.salePrice) return 0;
    return Math.round(((data.salePrice - (data.salePrice * 0.7)) / data.salePrice) * 100);
  };

  const getVariantPricingDescription = (type: string) => {
    switch (type) {
      case 'inherit':
        return 'All variants use the same price as the parent product';
      case 'override':
        return 'Set individual prices for each variant';
      case 'formula':
        return 'Calculate variant prices based on a formula (e.g., +$5 for size XL)';
      case 'direct':
        return 'Set custom prices for each variant directly';
      default:
        return '';
    }
  };

  const isFormValid = () => {
    return (
      data.listPrice > 0 &&
      data.listPrice <= 999999 &&
      (!data.salePrice || (data.salePrice > 0 && data.salePrice < data.listPrice)) &&
      !priceError &&
      !salePriceError
    );
  };

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Pricing Strategy</h4>
              <p className="text-sm text-blue-700 mt-1">
                Set competitive pricing with sale options, variant pricing strategies, and payment gateway selection.
                Use the sliders to quickly adjust prices and see real-time calculations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List Price */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">List Price</Label>
            <p className="text-sm text-gray-500">Regular price for your product</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.listPrice)}
            </div>
            <div className="text-xs text-gray-500">Regular price</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Enter price in cents (199 = $1.99)</Label>
          <span className="block text-xs text-blue-600 font-medium">
            💡 Tip: Enter prices in cents for speed (199 = $1.99, 1990 = $19.90)
          </span>
          <Input
            type="number"
            value={data.listPrice || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleListPriceChange(e.target.value)}
            min={0}
            max={100000}
            step={1}
            className="w-full"
            placeholder="199"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>$0.00</span>
          <span>$1,000.00</span>
        </div>

        {priceError && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{priceError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Sale Price */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">Sale Price</Label>
            <p className="text-sm text-gray-500">Optional - for promotions and discounts</p>
          </div>
          <div className="text-right">
            {data.salePrice ? (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(data.salePrice)}
                </div>
                <div className="text-xs text-gray-500">
                  {calculateDiscountPercentage()}% off
                </div>
              </>
            ) : (
              <div className="text-lg text-gray-400">No sale price</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Enter sale price in cents (199 = $1.99)</Label>
          <span className="block text-xs text-blue-600 font-medium">
            💡 Tip: Enter prices in cents for speed (199 = $1.99, 1990 = $19.90)
          </span>
          <Input
            type="number"
            value={data.salePrice || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSalePriceChange(e.target.value)}
            min={0}
            max={data.listPrice}
            step={1}
            className="w-full"
            placeholder="199"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>$0.00</span>
          <span>{formatCurrency(data.listPrice)}</span>
        </div>

        {salePriceError && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{salePriceError}</AlertDescription>
          </Alert>
        )}

        {/* Sale Price Calculations */}
        {data.salePrice && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Discount Amount</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {formatCurrency(data.listPrice - data.salePrice)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Discount Percentage</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {calculateDiscountPercentage()}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Estimated Margin</div>
                  <div className="text-lg font-semibold text-green-600">
                    {calculateProfitMargin()}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Customer Savings</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {calculateDiscountPercentage()}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Variant Pricing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Variant Pricing</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={data.variantPricing.enabled}
              onCheckedChange={(checked) => handleVariantPricingChange('enabled', checked)}
            />
            <Label className="text-sm">
              {data.variantPricing.enabled ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        </div>

        {data.variantPricing.enabled && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Pricing Strategy</Label>
              <p className="text-xs text-gray-600 mb-2">
                {getVariantPricingDescription(data.variantPricing.type)}
              </p>
              <RadioGroup
                value={data.variantPricing.type}
                onValueChange={(value) => handleVariantPricingChange('type', value)}
                className="grid grid-cols-1 gap-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="inherit" id="inherit" />
                  <Label htmlFor="inherit" className="text-sm">
                    <div className="flex items-center space-x-2">
                      <span>Inherit</span>
                      <Badge variant="default" className="text-xs">Simple</Badge>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="override" id="override" />
                  <Label htmlFor="override" className="text-sm">
                    <div className="flex items-center space-x-2">
                      <span>Override</span>
                      <Badge variant="default" className="text-xs">Custom</Badge>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="formula" id="formula" />
                  <Label htmlFor="formula" className="text-sm">
                    <div className="flex items-center space-x-2">
                      <span>Formula</span>
                      <Badge variant="default" className="text-xs">Advanced</Badge>
                    </div>
                  </Label>
                </div>
                {variants.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direct" id="direct" />
                    <Label htmlFor="direct" className="text-sm">
                      <div className="flex items-center space-x-2">
                        <span>Direct</span>
                        <Badge variant="default" className="text-xs">Manual</Badge>
                      </div>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Formula Example */}
            {data.variantPricing.type === 'formula' && (
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calculator className="h-4 w-4 text-purple-600" />
                    <Label className="text-sm font-medium">Formula Examples</Label>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size XL:</span>
                      <code className="bg-purple-100 px-2 py-1 rounded">base + $5.00</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Premium:</span>
                      <code className="bg-purple-100 px-2 py-1 rounded">base × 1.5</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bulk:</span>
                      <code className="bg-purple-100 px-2 py-1 rounded">base - $2.00</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Direct Variant Pricing */}
            {data.variantPricing.type === 'direct' && variants.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <Label className="text-sm font-medium">Direct Variant Pricing</Label>
                  </div>
                  <p className="text-xs text-gray-600 mb-4">
                    Set individual list and sale prices for each variant. Prices can be different from the parent product.
                    <span className="block mt-1 text-blue-600 font-medium">
                      💡 Tip: Enter prices in cents for speed (199 = $1.99, 1990 = $19.90)
                    </span>
                  </p>
                  
                  <div className="space-y-4">
                    {variants.map((variant, index) => {
                      const variantPrice = data.variantPricing.variantPrices?.[variant.id] || {
                        listPrice: data.listPrice,
                        salePrice: undefined
                      };
                      
                      return (
                        <div key={variant.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{variant.name}</div>
                              <div className="text-xs text-gray-500">Variant #{index + 1}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* List Price */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">List Price (cents)</Label>
                              <div className="flex items-center space-x-2">
                                <div className="text-right min-w-[80px]">
                                  <div className="text-sm text-gray-500">Regular</div>
                                  <div className="font-semibold text-green-600">
                                    {formatCurrency(variantPrice.listPrice)}
                                  </div>
                                </div>
                                <Input
                                  type="number"
                                  value={variantPrice.listPrice}
                                  onChange={(e) => handleVariantPriceChange(variant.id, 'listPrice', e.target.value)}
                                  min={0}
                                  max={100000}
                                  step={1}
                                  className="flex-1"
                                  placeholder="199"
                                />
                              </div>
                            </div>
                            
                            {/* Sale Price */}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Sale Price (cents)</Label>
                              <div className="flex items-center space-x-2">
                                <div className="text-right min-w-[80px]">
                                  <div className="text-sm text-gray-500">
                                    {variantPrice.salePrice ? `${calculateVariantDiscountPercentage(variant.id)}% off` : 'No sale'}
                                  </div>
                                  <div className="font-semibold text-orange-600">
                                    {variantPrice.salePrice ? formatCurrency(variantPrice.salePrice) : '—'}
                                  </div>
                                </div>
                                <Input
                                  type="number"
                                  value={variantPrice.salePrice || ''}
                                  onChange={(e) => handleVariantPriceChange(variant.id, 'salePrice', e.target.value)}
                                  min={0}
                                  max={variantPrice.listPrice}
                                  step={1}
                                  className="flex-1"
                                  placeholder="199"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Variant Discount Info */}
                          {variantPrice.salePrice && (
                            <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-orange-700">Discount Amount:</span>
                                <span className="font-semibold text-orange-700">
                                  {formatCurrency(variantPrice.listPrice - variantPrice.salePrice)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs mt-1">
                                <span className="text-orange-700">Customer Savings:</span>
                                <span className="font-semibold text-orange-700">
                                  {calculateVariantDiscountPercentage(variant.id)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Summary */}
                  <div className="mt-4 p-3 bg-green-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-800">Total Variants:</span>
                      <span className="text-sm font-bold text-green-800">{variants.length}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-medium text-green-800">List Price Range:</span>
                      <span className="text-sm font-bold text-green-800">
                        {(() => {
                          const listPrices = variants.map(v => data.variantPricing.variantPrices?.[v.id]?.listPrice || data.listPrice);
                          const min = Math.min(...listPrices);
                          const max = Math.max(...listPrices);
                          return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                        })()}
                      </span>
                    </div>
                    {(() => {
                      const salePrices = variants.map(v => data.variantPricing.variantPrices?.[v.id]?.salePrice).filter((p): p is number => typeof p === 'number');
                      if (salePrices.length > 0) {
                        const min = Math.min(...salePrices);
                        const max = Math.max(...salePrices);
                        return (
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-sm font-medium text-green-800">Sale Price Range:</span>
                            <span className="text-sm font-bold text-green-800">
                              {min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Variants Message */}
            {data.variantPricing.type === 'direct' && variants.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No variants found. Please go back to Step 2 to create variants before using direct pricing.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Payment Gateway */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <Label className="text-base font-medium">Payment Gateway</Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetupModal(true)}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Setup Gateways
          </Button>
        </div>
        
        {loadingGateways ? (
          <div className="h-20 bg-gray-100 rounded animate-pulse"></div>
        ) : tenantGateways.length > 0 ? (
          <Select
            value={data.gatewaySelection.gateway_type || ''}
            onValueChange={handleGatewayChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment gateway" />
            </SelectTrigger>
            <SelectContent>
              {tenantGateways
                .filter(gateway => gateway.is_active)
                .map((gateway) => (
                  <SelectItem key={gateway.id} value={gateway.gateway_type}>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span>{gateway.config?.display_name || gateway.gateway_type}</span>
                        {gateway.is_default && (
                          <Badge variant="default" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {gateway.gateway_type} • {gateway.config?.mode || gateway.config?.environment || 'configured'}
                      </div>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium text-orange-900">No Payment Gateways Configured</div>
                  <div className="text-sm text-orange-700 mt-1">
                    Configure payment gateways to enable checkout for your products
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Button
                  onClick={() => setShowSetupModal(true)}
                  className="w-full"
                  variant="outline"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Setup Payment Gateways
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {data.gatewaySelection.gateway_type && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="font-medium">
                    {tenantGateways.find(g => g.gateway_type === data.gatewaySelection.gateway_type)?.config?.display_name || 
                     PAYMENT_GATEWAYS.find(g => g.id === data.gatewaySelection.gateway_type)?.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Gateway ID: {data.gatewaySelection.gateway_id}
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-800">
                  Configured
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <DollarSign className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Pricing configured' : 'Pricing needs attention'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'Pricing strategy is properly configured with valid prices.'
                  : 'Please fix pricing issues before continuing.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Gateway Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Setup Payment Gateways</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSetupModal(false)}
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Payment Gateway Setup</h3>
                    <p className="text-sm text-blue-800">
                      Configure payment processors to accept online orders. You can set up multiple gateways and choose which one to use as default.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PayPal Setup */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">PayPal</CardTitle>
                    <p className="text-sm text-neutral-600">Accept payments via PayPal</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Connect your PayPal account to accept payments securely.
                      </p>
                      <div className="space-y-2">
                        <Button className="w-full" variant="outline">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Connect PayPal Account
                        </Button>
                        <Button className="w-full" variant="ghost" size="sm">
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Square Setup */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Square</CardTitle>
                    <p className="text-sm text-neutral-600">Accept credit/debit cards via Square</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Connect your Square account to process in-person and online payments.
                      </p>
                      <div className="space-y-2">
                        <Button className="w-full" variant="outline">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Connect Square Account
                        </Button>
                        <Button className="w-full" variant="ghost" size="sm">
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium mb-2">Need Help?</h4>
                <p className="text-sm text-gray-600 mb-3">
                  For detailed setup instructions and advanced configuration options, visit the full payment gateway settings page.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    window.open(`/t/${tenantId}/settings/payment-gateways`, '_blank');
                    setShowSetupModal(false);
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Open Full Settings Page
                </Button>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowSetupModal(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  // Refresh gateways after setup
                  fetchTenantGateways();
                  setShowSetupModal(false);
                }}>
                  Refresh Gateways
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
