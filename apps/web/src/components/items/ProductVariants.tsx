'use client';

import { useState } from 'react';
import { Plus, Trash2, Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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

interface ProductVariantsProps {
  parentItemId?: string;
  tenantId: string;
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  disabled?: boolean;
}

export default function ProductVariants({
  parentItemId,
  tenantId,
  variants,
  onChange,
  disabled = false,
}: ProductVariantsProps) {
  const [attributeTypes, setAttributeTypes] = useState<string[]>(['size', 'color']);
  const [newAttributeType, setNewAttributeType] = useState('');
  const [showAddAttribute, setShowAddAttribute] = useState(false);

  const addVariant = () => {
    const newVariant: ProductVariant = {
      sku: '',
      variant_name: '',
      price_cents: 0,
      stock: 0,
      attributes: {},
      sort_order: variants.length,
      is_active: true,
    };
    onChange([...variants, newVariant]);
  };

  const updateVariant = (index: number, updates: Partial<ProductVariant>) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    onChange(updated);
  };

  const duplicateVariant = (index: number) => {
    const original = variants[index];
    const duplicate: ProductVariant = {
      ...original,
      id: undefined,
      sku: '',
      variant_name: `${original.variant_name} (Copy)`,
      sort_order: variants.length,
    };
    onChange([...variants, duplicate]);
  };

  const addAttributeType = () => {
    if (newAttributeType && !attributeTypes.includes(newAttributeType.toLowerCase())) {
      setAttributeTypes([...attributeTypes, newAttributeType.toLowerCase()]);
      setNewAttributeType('');
      setShowAddAttribute(false);
    }
  };

  const updateAttribute = (variantIndex: number, attributeKey: string, value: string) => {
    const updated = [...variants];
    updated[variantIndex].attributes = {
      ...updated[variantIndex].attributes,
      [attributeKey]: value,
    };
    // Auto-generate variant name from attributes
    const attrs = updated[variantIndex].attributes;
    const name = Object.values(attrs).filter(v => v).join(' - ');
    updated[variantIndex].variant_name = name || 'Variant';
    onChange(updated);
  };

  const bulkUpdatePrice = () => {
    const priceStr = prompt('Enter price for all variants (in dollars):');
    if (priceStr) {
      const priceCents = Math.round(parseFloat(priceStr) * 100);
      const updated = variants.map(v => ({ ...v, price_cents: priceCents }));
      onChange(updated);
    }
  };

  const bulkUpdateStock = () => {
    const stockStr = prompt('Enter stock quantity for all variants:');
    if (stockStr) {
      const stock = parseInt(stockStr, 10);
      const updated = variants.map(v => ({ ...v, stock }));
      onChange(updated);
    }
  };

  if (variants.length === 0) {
    return (
      <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No Variants Yet
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Add variants to offer different options like sizes, colors, or configurations
        </p>
        <Button onClick={addVariant} disabled={disabled}>
          <Plus className="w-4 h-4 mr-2" />
          Add First Variant
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Attribute Types */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-blue-900">Variant Attributes</h4>
          <button
            onClick={() => setShowAddAttribute(!showAddAttribute)}
            disabled={disabled}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            + Add Attribute Type
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {attributeTypes.map(type => (
            <span
              key={type}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full capitalize"
            >
              {type}
            </span>
          ))}
        </div>
        {showAddAttribute && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newAttributeType}
              onChange={(e) => setNewAttributeType(e.target.value)}
              placeholder="e.g., material, style"
              className="flex-1 px-3 py-1 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && addAttributeType()}
            />
            <Button size="sm" onClick={addAttributeType}>
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={bulkUpdatePrice} disabled={disabled}>
          Set All Prices
        </Button>
        <Button size="sm" variant="secondary" onClick={bulkUpdateStock} disabled={disabled}>
          Set All Stock
        </Button>
        <Button size="sm" onClick={addVariant} disabled={disabled}>
          <Plus className="w-4 h-4 mr-1" />
          Add Variant
        </Button>
      </div>

      {/* Variants List */}
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <div
            key={index}
            className="border border-neutral-300 rounded-lg p-4 bg-white hover:border-primary-500 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={variant.variant_name}
                  onChange={(e) => updateVariant(index, { variant_name: e.target.value })}
                  placeholder="Variant name (auto-generated from attributes)"
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => duplicateVariant(index)}
                  disabled={disabled}
                  className="p-2 text-neutral-600 hover:text-primary-600 disabled:opacity-50"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeVariant(index)}
                  disabled={disabled}
                  className="p-2 text-neutral-600 hover:text-red-600 disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Attributes */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {attributeTypes.map(attrType => (
                <div key={attrType}>
                  <label className="block text-xs font-medium text-neutral-700 mb-1 capitalize">
                    {attrType}
                  </label>
                  <input
                    type="text"
                    value={variant.attributes[attrType] || ''}
                    onChange={(e) => updateAttribute(index, attrType, e.target.value)}
                    placeholder={`e.g., ${attrType === 'size' ? 'Small, Medium, Large' : attrType === 'color' ? 'Red, Blue, Green' : attrType}`}
                    disabled={disabled}
                    className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                  />
                </div>
              ))}
            </div>

            {/* SKU, Price, Stock */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                  placeholder="Auto-generate"
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={(variant.price_cents / 100).toFixed(2)}
                  onChange={(e) => updateVariant(index, { price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Sale Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={variant.sale_price_cents ? (variant.sale_price_cents / 100).toFixed(2) : ''}
                  onChange={(e) => updateVariant(index, { sale_price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })}
                  placeholder="Optional"
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Stock
                </label>
                <input
                  type="number"
                  value={variant.stock}
                  onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value || '0', 10) })}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="mt-3 flex items-center">
              <input
                type="checkbox"
                id={`variant-${index}-active`}
                checked={variant.is_active}
                onChange={(e) => updateVariant(index, { is_active: e.target.checked })}
                disabled={disabled}
                className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
              />
              <label htmlFor={`variant-${index}-active`} className="ml-2 text-sm text-neutral-700">
                Active (available for purchase)
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-neutral-900">{variants.length}</div>
            <div className="text-xs text-neutral-600">Total Variants</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {variants.filter(v => v.is_active).length}
            </div>
            <div className="text-xs text-neutral-600">Active</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {variants.reduce((sum, v) => sum + v.stock, 0)}
            </div>
            <div className="text-xs text-neutral-600">Total Stock</div>
          </div>
        </div>
      </div>
    </div>
  );
}
