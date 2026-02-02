'use client';

import { useState } from 'react';
import { Check, X, Tag, DollarSign, Package, Power, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface ProductVariant {
  id?: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: Record<string, string>;
  sort_order: number;
  is_active: boolean;
}

interface VariantBulkOperationsProps {
  parentItemId?: string;
  tenantId: string;
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
  disabled?: boolean;
}

type BulkOperation = 'featured_type' | 'sale_price' | 'stock' | 'activate' | 'deactivate';

interface FeaturedTypeOption {
  type: string;
  label: string;
  description: string;
  priority: number;
  color: string;
}

const featuredTypeOptions: FeaturedTypeOption[] = [
  { type: 'sale', label: 'Sale', description: 'Mark as on sale', priority: 3, color: 'red' },
  { type: 'new_arrival', label: 'New Arrival', description: 'Highlight as new', priority: 5, color: 'green' },
  { type: 'featured', label: 'Featured', description: 'Mark as featured', priority: 4, color: 'blue' },
  { type: 'bestseller', label: 'Bestseller', description: 'Mark as popular', priority: 6, color: 'purple' },
  { type: 'clearance', label: 'Clearance', description: 'Final sale items', priority: 2, color: 'orange' },
  { type: 'store_selection', label: 'Store Selection', description: 'Curated choice', priority: 1, color: 'yellow' },
];

export default function VariantBulkOperations({
  parentItemId,
  tenantId,
  variants,
  onVariantsChange,
  disabled = false,
}: VariantBulkOperationsProps) {
  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null);
  const [operationData, setOperationData] = useState<any>({});
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  const activeVariants = variants.filter(v => v.is_active);
  const inactiveVariants = variants.filter(v => !v.is_active);

  const handleSelectAll = () => {
    if (selectedVariants.size === variants.length) {
      setSelectedVariants(new Set());
    } else {
      setSelectedVariants(new Set(variants.map((_, index) => index)));
    }
  };

  const handleSelectVariant = (index: number) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedVariants(newSelected);
  };

  const applyBulkOperation = async () => {
    if (selectedVariants.size === 0) return;

    setIsApplying(true);
    try {
      const selectedVariantIds = Array.from(selectedVariants).map((index: number) => variants[index].id).filter(Boolean) as string[];

      let response;

      switch (selectedOperation) {
        case 'featured_type':
          response = await fetch('/api/variants/bulk/featured-type', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              variantIds: selectedVariantIds,
              featuredType: operationData.featuredType,
              priority: 3,
              autoUnfeature: true,
            }),
          });
          break;

        case 'sale_price':
          response = await fetch('/api/variants/bulk/sale-price', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              variantIds: selectedVariantIds,
              salePriceCents: operationData.salePriceCents,
            }),
          });
          break;

        case 'stock':
          response = await fetch('/api/variants/bulk/stock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              variantIds: selectedVariantIds,
              stock: operationData.stock,
            }),
          });
          break;

        case 'activate':
        case 'deactivate':
          response = await fetch('/api/variants/bulk/activation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              variantIds: selectedVariantIds,
              isActive: selectedOperation === 'activate',
            }),
          });
          break;
      }

      if (!response?.ok) {
        throw new Error(`Operation failed: ${response?.statusText}`);
      }

      const result = await response?.json();

      if (result?.success) {
        // For local state updates, update the variants
        const updatedVariants = [...variants];

        selectedVariants.forEach((index) => {
          const variant = updatedVariants[index];

          switch (selectedOperation) {
            case 'sale_price':
              variant.sale_price_cents = operationData.salePriceCents;
              break;

            case 'stock':
              variant.stock = operationData.stock;
              break;

            case 'activate':
              variant.is_active = true;
              break;

            case 'deactivate':
              variant.is_active = false;
              break;
          }
        });

        onVariantsChange(updatedVariants);
        
        // Reset state
        setSelectedOperation(null);
        setOperationData({});
        setSelectedVariants(new Set());

        // Show success message
        alert(`✅ ${result.message}`);
      } else {
        throw new Error(result?.message || 'Operation failed');
      }
      
    } catch (error) {
      console.error('Bulk operation failed:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  const renderOperationPanel = () => {
    if (!selectedOperation) return null;

    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-medium mb-4">
          {selectedOperation === 'featured_type' && 'Set Featured Type'}
          {selectedOperation === 'sale_price' && 'Set Sale Price'}
          {selectedOperation === 'stock' && 'Set Stock'}
          {selectedOperation === 'activate' && 'Activate Variants'}
          {selectedOperation === 'deactivate' && 'Deactivate Variants'}
        </h3>

        {selectedOperation === 'featured_type' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {featuredTypeOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => setOperationData({ featuredType: option.type })}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  operationData.featuredType === option.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled={disabled}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Tag className={`w-4 h-4 text-${option.color}-500`} />
                  <span className="font-medium">{option.label}</span>
                </div>
                <div className="text-xs text-gray-600">{option.description}</div>
              </button>
            ))}
          </div>
        )}

        {selectedOperation === 'sale_price' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Sale Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={operationData.salePriceCents ? operationData.salePriceCents / 100 : ''}
              onChange={(e) => setOperationData({ salePriceCents: Math.round(parseFloat(e.target.value) * 100) })}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will set the sale price for {selectedVariants.size} selected variant(s)
            </p>
          </div>
        )}

        {selectedOperation === 'stock' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Stock Quantity</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={operationData.stock || ''}
              onChange={(e) => setOperationData({ stock: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will set stock for {selectedVariants.size} selected variant(s)
            </p>
          </div>
        )}

        {(selectedOperation === 'activate' || selectedOperation === 'deactivate') && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {selectedOperation === 'activate' 
                ? `This will activate ${selectedVariants.size} selected variant(s)`
                : `This will deactivate ${selectedVariants.size} selected variant(s)`
              }
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={applyBulkOperation}
            disabled={disabled || isApplying || selectedVariants.size === 0}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {isApplying ? 'Applying...' : `Apply to ${selectedVariants.size} variant(s)`}
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setSelectedOperation(null);
              setOperationData({});
            }}
            disabled={disabled}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  if (variants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No variants available for bulk operations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bulk Variant Operations</h2>
        <Badge variant="default">
          {variants.length} variants ({activeVariants.length} active)
        </Badge>
      </div>

      {/* Operation Selection */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button
          onClick={() => setSelectedOperation('featured_type')}
          className={`p-3 border rounded-lg text-center transition-colors ${
            selectedOperation === 'featured_type'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={disabled}
        >
          <Tag className="w-5 h-5 mx-auto mb-1" />
          <div className="text-sm font-medium">Featured Type</div>
        </button>

        <button
          onClick={() => setSelectedOperation('sale_price')}
          className={`p-3 border rounded-lg text-center transition-colors ${
            selectedOperation === 'sale_price'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={disabled}
        >
          <DollarSign className="w-5 h-5 mx-auto mb-1" />
          <div className="text-sm font-medium">Sale Price</div>
        </button>

        <button
          onClick={() => setSelectedOperation('stock')}
          className={`p-3 border rounded-lg text-center transition-colors ${
            selectedOperation === 'stock'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={disabled}
        >
          <Package className="w-5 h-5 mx-auto mb-1" />
          <div className="text-sm font-medium">Stock</div>
        </button>

        <button
          onClick={() => setSelectedOperation('activate')}
          className={`p-3 border rounded-lg text-center transition-colors ${
            selectedOperation === 'activate'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={disabled || inactiveVariants.length === 0}
        >
          <Check className="w-5 h-5 mx-auto mb-1 text-green-600" />
          <div className="text-sm font-medium">Activate</div>
        </button>

        <button
          onClick={() => setSelectedOperation('deactivate')}
          className={`p-3 border rounded-lg text-center transition-colors ${
            selectedOperation === 'deactivate'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          disabled={disabled || activeVariants.length === 0}
        >
          <X className="w-5 h-5 mx-auto mb-1 text-red-600" />
          <div className="text-sm font-medium">Deactivate</div>
        </button>
      </div>

      {/* Variant Selection */}
      {selectedOperation && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Select Variants</h3>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {selectedVariants.size === variants.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {variants.map((variant, index) => (
              <label
                key={index}
                className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                  selectedVariants.has(index)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedVariants.has(index)}
                  onChange={() => handleSelectVariant(index)}
                  disabled={disabled}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{variant.variant_name}</div>
                  <div className="text-xs text-gray-500">
                    {variant.sku} • ${(variant.price_cents / 100).toFixed(2)}
                  </div>
                  <Badge
                    variant={variant.is_active ? 'default' : 'warning'}
                    className="text-xs mt-1"
                  >
                    {variant.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </label>
            ))}
          </div>

          {selectedVariants.size > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              {selectedVariants.size} of {variants.length} variants selected
            </div>
          )}
        </div>
      )}

      {/* Operation Panel */}
      {renderOperationPanel()}
    </div>
  );
}
