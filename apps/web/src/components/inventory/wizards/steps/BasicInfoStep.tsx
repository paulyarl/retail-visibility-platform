/**
 * Basic Information Step (Step 1)
 * 
 * Core product details including:
 * - Product name
 * - Brand
 * - Condition (new/used/refurbished)
 * - Initial status (draft/active)
 * 
 * First step in the 7-step product creation wizard
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Package, Tag, CheckCircle } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';

interface BasicInfoStepProps {
  data: {
    name: string;
    brand: string;
    manufacturer?: string;
    condition: 'new' | 'used' | 'refurbished';
    mpn?: string;
    status: 'draft' | 'active';
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  productType?: 'physical' | 'digital' | 'hybrid' | 'service';
}

export default function BasicInfoStep({ data, errors, onChange, productType = 'physical' }: BasicInfoStepProps) {
  const [nameError, setNameError] = useState<string>('');
  const [brandError, setBrandError] = useState<string>('');
  const [manufacturerError, setManufacturerError] = useState<string>('');
  const [mpnError, setMpnError] = useState<string>('');

  // Validate name in real-time
  useEffect(() => {
    if (data.name && data.name.trim().length > 0) {
      if (data.name.trim().length < 3) {
        setNameError('Product name must be at least 3 characters');
      } else if (data.name.trim().length > 100) {
        setNameError('Product name must be less than 100 characters');
      } else {
        setNameError('');
      }
    } else {
      setNameError('');
    }
  }, [data.name]);

  // Validate brand in real-time
  useEffect(() => {
    if (data.brand && data.brand.trim().length > 0) {
      if (data.brand.trim().length < 2) {
        setBrandError('Brand name must be at least 2 characters');
      } else if (data.brand.trim().length > 50) {
        setBrandError('Brand name must be less than 50 characters');
      } else {
        setBrandError('');
      }
    } else {
      setBrandError('');
    }
  }, [data.brand]);

  // Validate manufacturer in real-time
  useEffect(() => {
    if (data.manufacturer && data.manufacturer.trim().length > 0) {
      if (data.manufacturer.trim().length < 2) {
        setManufacturerError('Manufacturer name must be at least 2 characters');
      } else if (data.manufacturer.trim().length > 50) {
        setManufacturerError('Manufacturer name must be less than 50 characters');
      } else {
        setManufacturerError('');
      }
    } else {
      setManufacturerError('');
    }
  }, [data.manufacturer]);

  // Validate MPN in real-time
  useEffect(() => {
    if (data.mpn && data.mpn.trim().length > 0) {
      if (data.mpn.trim().length > 50) {
        setMpnError('MPN must be less than 50 characters');
      } else {
        setMpnError('');
      }
    } else {
      setMpnError('');
    }
  }, [data.mpn]);

  const handleNameChange = (value: string) => {
    onChange({
      ...data,
      name: value
    });
  };

  const handleBrandChange = (value: string) => {
    onChange({
      ...data,
      brand: value
    });
  };

  const handleManufacturerChange = (value: string) => {
    onChange({
      ...data,
      manufacturer: value
    });
  };

  const handleMpnChange = (value: string) => {
    onChange({
      ...data,
      mpn: value
    });
  };

  const handleConditionChange = (value: 'new' | 'used' | 'refurbished') => {
    onChange({
      ...data,
      condition: value
    });
  };

  const handleStatusChange = (value: 'draft' | 'active') => {
    onChange({
      ...data,
      status: value
    });
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'new':
        return <Badge className="bg-green-100 text-green-800">New</Badge>;
      case 'used':
        return <Badge className="bg-orange-100 text-orange-800">Used</Badge>;
      case 'refurbished':
        return <Badge className="bg-blue-100 text-blue-800">Refurbished</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'draft':
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      default:
        return null;
    }
  };

  const getConditionDescription = (condition: string) => {
    switch (condition) {
      case 'new':
        return 'Brand new, unused product in original packaging';
      case 'used':
        return 'Previously owned product with signs of use';
      case 'refurbished':
        return 'Restored to working condition, may have minor cosmetic defects';
      default:
        return '';
    }
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'active':
        return 'Product will be immediately visible to customers';
      case 'draft':
        return 'Product will be saved but not visible to customers';
      default:
        return '';
    }
  };

  const isFormValid = () => {
    return (
      data.name.trim().length >= 3 &&
      data.name.trim().length <= 100 &&
      (!data.brand || (data.brand.trim().length >= 2 && data.brand.trim().length <= 50)) &&
      (!data.manufacturer || (data.manufacturer.trim().length >= 2 && data.manufacturer.trim().length <= 50)) &&
      (!data.mpn || data.mpn.trim().length <= 50) &&
      !nameError &&
      !brandError &&
      !manufacturerError &&
      !mpnError
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
              <h4 className="font-medium text-blue-900">Basic Information</h4>
              <p className="text-sm text-blue-700 mt-1">
                Let's start with the essential details about your product. This information helps customers 
                identify and understand your product at a glance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Product Name */}
        <div className="space-y-2">
          <Label htmlFor="product-name" className="text-base font-medium">
            Product Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="product-name"
            value={data.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter product name..."
            className={nameError ? 'border-red-500' : ''}
          />
          {nameError && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{nameError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{data.name.trim().length}/100 characters</span>
            {data.name.trim().length >= 3 && data.name.trim().length <= 100 && !nameError && (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </span>
            )}
          </div>
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand" className="text-base font-medium">
            Brand <span className="text-gray-400">(Optional)</span>
          </Label>
          <Input
            id="brand"
            value={data.brand}
            onChange={(e) => handleBrandChange(e.target.value)}
            placeholder="Enter brand name..."
            className={brandError ? 'border-red-500' : ''}
          />
          {brandError && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{brandError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{data.brand.trim().length}/50 characters</span>
            {data.brand && data.brand.trim().length >= 2 && data.brand.trim().length <= 50 && !brandError && (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid
              </span>
            )}
          </div>
        </div>

        {/* Manufacturer - Only for Physical/Hybrid */}
        {productType !== 'digital' && (
          <div className="space-y-2">
            <Label htmlFor="manufacturer" className="text-base font-medium">
              Manufacturer <span className="text-gray-400">(Optional)</span>
            </Label>
            <Input
              id="manufacturer"
              value={data.manufacturer || ''}
              onChange={(e) => handleManufacturerChange(e.target.value)}
              placeholder="e.g., Nike Inc., Apple Inc..."
              className={manufacturerError ? 'border-red-500' : ''}
            />
            {manufacturerError && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{manufacturerError}</AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{(data.manufacturer || '').trim().length}/50 characters</span>
              {data.manufacturer && data.manufacturer.trim().length >= 2 && data.manufacturer.trim().length <= 50 && !manufacturerError && (
                <span className="text-green-600 flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Valid
                </span>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Condition - Only for Physical/Hybrid */}
        {productType !== 'digital' && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Condition</Label>
            <RadioGroup
              value={data.condition}
              onValueChange={handleConditionChange}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="flex items-center space-x-2 cursor-pointer">
                  <span>New</span>
                  {getConditionBadge('new')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="used" id="used" />
                <Label htmlFor="used" className="flex items-center space-x-2 cursor-pointer">
                  <span>Used</span>
                  {getConditionBadge('used')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="refurbished" id="refurbished" />
                <Label htmlFor="refurbished" className="flex items-center space-x-2 cursor-pointer">
                  <span>Refurbished</span>
                  {getConditionBadge('refurbished')}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-gray-600">
              {getConditionDescription(data.condition)}
            </p>
          </div>
        )}

        {/* MPN - Only for Physical/Hybrid */}
        {productType !== 'digital' && (
          <div className="space-y-2">
            <Label htmlFor="mpn" className="text-base font-medium">
              MPN (Manufacturer Part Number) <span className="text-gray-400">(Optional)</span>
            </Label>
            <Input
              id="mpn"
              value={data.mpn || ''}
              onChange={(e) => handleMpnChange(e.target.value)}
              placeholder="e.g., SKU123, PART-456..."
              className={mpnError ? 'border-red-500' : ''}
            />
            {mpnError && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{mpnError}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-gray-500">
              Manufacturer's part number (helps with Google Shopping)
            </p>
          </div>
        )}

        <Separator />

        {/* Status */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Initial Status</Label>
          <RadioGroup
            value={data.status}
            onValueChange={handleStatusChange}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="draft" id="draft" />
              <Label htmlFor="draft" className="flex items-center space-x-2 cursor-pointer">
                <span>Draft</span>
                {getStatusBadge('draft')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="active" id="active" />
              <Label htmlFor="active" className="flex items-center space-x-2 cursor-pointer">
                <span>Active</span>
                {getStatusBadge('active')}
              </Label>
            </div>
          </RadioGroup>
          <p className="text-sm text-gray-600">
            {getStatusDescription(data.status)}
          </p>
        </div>
      </div>

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Ready to continue' : 'Complete required fields'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'All required information has been provided. You can proceed to the next step.'
                  : 'Please fill in the required fields marked with * to continue.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
