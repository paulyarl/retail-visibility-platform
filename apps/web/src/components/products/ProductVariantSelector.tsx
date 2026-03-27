/**
 * Product Variant Selector Component
 * 
 * Handles multi-dimensional variant selection with visual feedback
 * Supports color swatches, size dropdowns, format buttons, etc.
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';

// Updated interface to match actual variant structure
interface ProductVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: Record<string, string>;
  sort_order?: number;
  is_active?: boolean;
  is_on_sale?: boolean;
  discount_percentage?: number;
}

interface VariantOption {
  value: string;
  label: string;
  price?: number;
  available: boolean;
  image?: string;
}

interface VariantGroup {
  name: string;
  type: 'swatches' | 'buttons' | 'dropdown' | 'grid';
  options: VariantOption[];
  required?: boolean;
}

interface ProductVariantSelectorProps {
  variants: ProductVariant[];
  onVariantChange: (variant: ProductVariant | null) => void;
  selectedVariant?: ProductVariant | null;
  className?: string;
}

const ProductVariantSelector: React.FC<ProductVariantSelectorProps> = ({
  variants,
  onVariantChange,
  selectedVariant,
  className = ''
}) => {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [availableCombinations, setAvailableCombinations] = useState<Set<string>>(new Set());

  // Debug logging for variants
  console.log('[ProductVariantSelector] Received variants:', variants);
  console.log('[ProductVariantSelector] Variants length:', variants.length);
  console.log('[ProductVariantSelector] First variant structure:', variants[0]);
  console.log('[ProductVariantSelector] First variant keys:', Object.keys(variants[0] || {}));

  // Group variants by dynamic attributes
  const getVariantGroups = (): VariantGroup[] => {
    const groups: VariantGroup[] = [];
    const attributes = new Map<string, Set<string>>();

    // Collect all unique dynamic attributes
    variants.forEach((variant: any) => {
      // Handle dynamic attributes from the attributes object
      const variantAttributes = (variant as ProductVariant).attributes || {};
      
      Object.entries(variantAttributes).forEach(([key, value]) => {
        if (value) {
          if (!attributes.has(key)) attributes.set(key, new Set());
          attributes.get(key)!.add(String(value));
        }
      });
      
      // Also check for variant_name as a fallback for single-attribute variants
      if ((variant as ProductVariant).variant_name && Object.keys(variantAttributes).length === 0) {
        if (!attributes.has('option')) attributes.set('option', new Set());
        attributes.get('option')!.add((variant as ProductVariant).variant_name);
      }
      
      console.log(`[ProductVariantSelector] Processing variant ${(variant as ProductVariant).id}:`, {
        variant_name: (variant as ProductVariant).variant_name,
        attributes: variantAttributes,
        stock: (variant as ProductVariant).stock
      });
    });

    console.log('[ProductVariantSelector] Found attributes:', Array.from(attributes.keys()));

    // Create variant groups for dynamic attributes
    attributes.forEach((values, attributeName) => {
      const options: VariantOption[] = Array.from(values).map(value => {
        // Find variants with this attribute value
        const matchingVariants = variants.filter((v: any) => {
          const variantAttributes = (v as ProductVariant).attributes || {};
          return variantAttributes[attributeName] === value || 
                 (attributeName === 'option' && (v as ProductVariant).variant_name === value);
        });
        
        console.log(`[ProductVariantSelector] Matching variants for ${attributeName}=${value}:`, matchingVariants);
        
        // Check if any matching variant is available - use stock instead of inventory_quantity
        const isAvailable = matchingVariants.some((v: any) => ((v as ProductVariant).stock || 0) > 0);
        
        console.log(`[ProductVariantSelector] Availability for ${value}:`, {
          matchingVariants: matchingVariants.length,
          stock: matchingVariants.map((v: any) => (v as ProductVariant).stock),
          isAvailable
        });
        
        // Get price difference (if any)
        const basePrice = variants[0]?.price_cents || 0;
        const price = matchingVariants[0]?.price_cents;
        const priceDiff = price && basePrice ? price - basePrice : undefined;
        
        // Get image if available
        const image = matchingVariants[0]?.image_url;

        return {
          value,
          label: formatLabel(value),
          available: isAvailable,
          price: priceDiff,
          image
        };
      });

      // Determine display type based on attribute name and options
      let displayType: VariantGroup['type'] = 'buttons';
      if (attributeName === 'color' || attributeName.includes('color')) {
        displayType = 'swatches';
      } else if (values.size > 4) {
        displayType = 'dropdown';
      } else if (attributeName.includes('format') || attributeName.includes('edition')) {
        displayType = 'grid';
      }

      groups.push({
        name: attributeName,
        type: displayType,
        options: options.sort((a, b) => {
          if (a.available !== b.available) {
            return b.available ? 1 : -1;
          }
          return a.label.localeCompare(b.label);
        }),
        required: true
      });
    });

    return groups.sort((a, b) => {
      const priority = ['format', 'color', 'size', 'edition', 'language', 'material', 'option'];
      const aIndex = priority.indexOf(a.name);
      const bIndex = priority.indexOf(b.name);
      
      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  };

  const formatLabel = (value: string): string => {
    return value
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const findMatchingVariant = (currentSelections: Record<string, string>): ProductVariant | null => {
    return variants.find((variant: any) => {
      const variantAttributes = (variant as ProductVariant).attributes || {};
      
      return Object.entries(currentSelections).every(([key, value]) => {
        return variantAttributes[key] === value;
      });
    }) || null;
  };

  const handleSelectionChange = (attributeName: string, value: string) => {
    const newSelections = { ...selections, [attributeName]: value };
    setSelections(newSelections);
    
    const matchingVariant = findMatchingVariant(newSelections);
    onVariantChange(matchingVariant);
  };

  const renderVariantOption = (group: VariantGroup, option: VariantOption) => {
    const isSelected = selections[group.name] === option.value;
    const isDisabled = !option.available;

    switch (group.type) {
      case 'swatches':
        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && handleSelectionChange(group.name, option.value)}
            disabled={isDisabled}
            className={`
              relative w-8 h-8 rounded-full border-2 transition-all duration-200
              ${isSelected ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'border-gray-300'}
              ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-gray-500 cursor-pointer'}
            `}
            title={option.label}
            aria-label={`Select ${option.label}`}
          >
            {option.image ? (
              <img
                src={option.image}
                alt={option.label}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full rounded-full"
                style={{ backgroundColor: getColorHex(option.value) }}
              />
            )}
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </button>
        );

      case 'buttons':
        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && handleSelectionChange(group.name, option.value)}
            disabled={isDisabled}
            className={`
              px-4 py-2 rounded-lg border transition-all duration-200 text-sm font-medium
              ${isSelected 
                ? 'border-gray-900 bg-gray-900 text-white' 
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
              }
              ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {option.label}
            {option.price && option.price !== 0 && (
              <span className={isSelected ? 'text-white' : 'text-gray-500'}>
                {option.price > 0 ? ` +$${(option.price / 100).toFixed(2)}` : ` -$${Math.abs(option.price / 100).toFixed(2)}`}
              </span>
            )}
          </button>
        );

      case 'dropdown':
        return (
          <select
            key={option.value}
            value={selections[group.name] || ''}
            onChange={(e) => handleSelectionChange(group.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="" disabled>
              Select {formatLabel(group.name)}
            </option>
            {group.options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={!opt.available}>
                {opt.label} {!opt.available && '(Out of Stock)'}
              </option>
            ))}
          </select>
        );

      case 'grid':
        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && handleSelectionChange(group.name, option.value)}
            disabled={isDisabled}
            className={`
              p-3 rounded-lg border transition-all duration-200 text-center
              ${isSelected 
                ? 'border-gray-900 bg-gray-50' 
                : 'border-gray-200 bg-white hover:border-gray-400'
              }
              ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {option.image && (
              <img
                src={option.image}
                alt={option.label}
                className="w-full h-16 object-cover rounded mb-2"
              />
            )}
            <div className="text-sm font-medium">{option.label}</div>
            {option.price && option.price !== 0 && (
              <div className="text-xs text-gray-500">
                {option.price > 0 ? `+$${(option.price / 100).toFixed(2)}` : `-$${Math.abs(option.price / 100).toFixed(2)}`}
              </div>
            )}
          </button>
        );

      default:
        return null;
    }
  };

  // Get color hex value for swatches
  const getColorHex = (colorName: string): string => {
    const colors: Record<string, string> = {
      'black': '#000000',
      'white': '#FFFFFF',
      'gray': '#808080',
      'red': '#FF0000',
      'blue': '#0000FF',
      'green': '#008000',
      'yellow': '#FFFF00',
      'purple': '#800080',
      'orange': '#FFA500',
      'pink': '#FFC0CB',
      'brown': '#964B00',
      'navy': '#000080'
    };
    
    return colors[colorName.toLowerCase()] || '#CCCCCC';
  };

  const variantGroups = getVariantGroups();

  if (variantGroups.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">Select Options</h3>
      
      {variantGroups.map(group => (
        <div key={group.name} className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              {formatLabel(group.name)}
              {group.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
          
          <div className={`
            ${group.type === 'swatches' ? 'flex flex-wrap gap-2' : ''}
            ${group.type === 'buttons' ? 'flex flex-wrap gap-2' : ''}
            ${group.type === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-3' : ''}
            ${group.type === 'dropdown' ? 'w-full' : ''}
          `}>
            {group.options.map(option => renderVariantOption(group, option))}
          </div>
        </div>
      ))}
      
      {selectedVariant && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            <div className="font-medium">Selected Variant:</div>
            <div>SKU: {selectedVariant.sku}</div>
            <div>Stock: {selectedVariant.stock} units</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantSelector;
