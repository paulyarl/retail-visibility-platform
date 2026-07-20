'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  onValidationChange?: (errors: string[]) => void;
  attributeTypes?: string[]; // Pre-loaded attribute types
  onAttributeTypesChange?: (attributeTypes: string[]) => void; // Callback when attribute types change
}

export default function ProductVariants({
  parentItemId,
  tenantId,
  variants,
  onChange,
  disabled = false,
  onValidationChange,
  attributeTypes: initialAttributeTypes = [
    'format',      // Grid layout for books/media
    'color',       // Swatches for visual selection
    'size',        // Buttons or dropdown
    'edition',     // Grid layout for book editions
    'language',    // Buttons for language selection
    'material',    // Buttons for material selection
    'weight',      // Buttons for weight/size selection
    'style',       // Buttons for style variants
    'length',      // Buttons for length variants
    'width',       // Buttons for width variants
    'height',      // Buttons for height variants
    'capacity',    // Buttons for capacity variants
    'volume',      // Buttons for volume variants
    'finish',      // Buttons for finish variants
    'pattern',     // Buttons for pattern variants
    'brand',       // Buttons for brand variants
    'model',       // Buttons for model variants
    'version',     // Buttons for version variants
    'type',        // Buttons for type variants
    'category'     // Buttons for category variants
  ],
  onAttributeTypesChange,
}: ProductVariantsProps) {
  const [attributeTypes, setAttributeTypes] = useState<string[]>(initialAttributeTypes);
  const [newAttributeType, setNewAttributeType] = useState('');
  const [showAddAttribute, setShowAddAttribute] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [salePriceInputs, setSalePriceInputs] = useState<Record<string, string>>({});

  // Sync attributeTypes when initialAttributeTypes prop changes
  useEffect(() => {
    setAttributeTypes(initialAttributeTypes);
  }, [initialAttributeTypes]);

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

  const handlePriceInputChange = (index: number, value: string) => {
    setPriceInputs(prev => ({ ...prev, [index]: value }));
    // Only update the actual variant if the input is valid
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      const priceCents = value ? Math.round(parseFloat(value) * 100) : 0;
      updateVariant(index, { price_cents: priceCents });
    }
  };

  const handleSalePriceInputChange = (index: number, value: string) => {
    setSalePriceInputs(prev => ({ ...prev, [index]: value }));
    // Only update the actual variant if the input is valid
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      const salePriceCents = value ? Math.round(parseFloat(value) * 100) : undefined;
      updateVariant(index, { sale_price_cents: salePriceCents });
    }
  };

  const handlePriceBlur = (index: number) => {
    const formattedValue = (variants[index].price_cents / 100).toFixed(2);
    setPriceInputs(prev => ({ ...prev, [index]: formattedValue }));
  };

  const handleSalePriceBlur = (index: number) => {
    const value = variants[index].sale_price_cents;
    const formattedValue = value ? (value / 100).toFixed(2) : '';
    setSalePriceInputs(prev => ({ ...prev, [index]: formattedValue }));
  };

  const validateVariants = () => {
    const errors: string[] = [];
    
    variants.forEach((variant, index) => {
      if (!variant.variant_name || variant.variant_name.trim() === '') {
        errors.push(`Variant ${index + 1}: Name is required`);
      }
      if (!variant.sku || variant.sku.trim() === '') {
        errors.push(`Variant ${index + 1}: SKU is required`);
      }
      if (variant.price_cents < 0) {
        errors.push(`Variant ${index + 1}: Price must be non-negative`);
      }
      if (variant.stock < 0) {
        errors.push(`Variant ${index + 1}: Stock must be non-negative`);
      }
    });

    return errors;
  };

  const getCleanVariants = () => {
    return variants.map(variant => ({
      variant_name: variant.variant_name || 'Variant',
      sku: variant.sku || `variant-${variants.indexOf(variant) + 1}`,
      price_cents: variant.price_cents || 0,
      sale_price_cents: variant.sale_price_cents || undefined,
      stock: variant.stock || 0,
      attributes: variant.attributes || {},
      sort_order: variant.sort_order || 0,
      is_active: variant.is_active !== false, // default to true
    }));
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
      const updatedTypes = [...attributeTypes, newAttributeType.toLowerCase()];
      setAttributeTypes(updatedTypes);
      setNewAttributeType('');
      setShowAddAttribute(false);
      // Notify parent of attribute types change
      if (onAttributeTypesChange) {
        onAttributeTypesChange(updatedTypes);
      }
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
    const variantName = name || 'Variant';
    
    // Use updateVariant to ensure SKU auto-generation
    updateVariant(variantIndex, { 
      variant_name: variantName,
      attributes: updated[variantIndex].attributes 
    });
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
                <Input
                  label="SKU"
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, { sku: e.target.value })}
                  placeholder="Auto-generate"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>
              <div>
                <Input
                  label="Price ($)"
                  type="number"
                  step="1"
                  min="0"
                  value={priceInputs[index] !== undefined ? priceInputs[index] : (variants[index].price_cents / 100).toFixed(2)}
                  onChange={(e) => handlePriceInputChange(index, e.target.value)}
                  onBlur={() => handlePriceBlur(index)}
                  disabled={disabled}
                  className="text-sm"
                />
              </div>
              <div>
                <Input
                  label="Sale Price ($)"
                  type="number"
                  step="1"
                  min="0"
                  value={salePriceInputs[index] !== undefined ? salePriceInputs[index] : (variants[index].sale_price_cents ? (variants[index].sale_price_cents / 100).toFixed(2) : '')}
                  onChange={(e) => handleSalePriceInputChange(index, e.target.value)}
                  onBlur={() => handleSalePriceBlur(index)}
                  placeholder="Optional"
                  disabled={disabled}
                  className="text-sm"
                />
              </div>
              <div>
                <Input
                  label="Stock"
                  type="number"
                  step="1"
                  min="0"
                  value={variant.stock}
                  onChange={(e) => updateVariant(index, { stock: parseInt(e.target.value || '0', 10) })}
                  disabled={disabled}
                  className="text-sm"
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
