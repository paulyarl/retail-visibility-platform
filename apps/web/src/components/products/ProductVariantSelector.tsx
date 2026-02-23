/**
 * Product Variant Selector Component
 * 
 * Handles multi-dimensional variant selection with visual feedback
 * Supports color swatches, size dropdowns, format buttons, etc.
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ProductVariant } from '../../services/EnhancedProductService';

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

  // Group variants by attributes
  const getVariantGroups = (): VariantGroup[] => {
    const groups: VariantGroup[] = [];
    const attributes = new Map<string, Set<string>>();

    // Collect all unique attribute values
    variants.forEach(variant => {
      // Color
      if (variant.color) {
        if (!attributes.has('color')) attributes.set('color', new Set());
        attributes.get('color')!.add(variant.color);
      }
      
      // Size
      if (variant.size) {
        if (!attributes.has('size')) attributes.set('size', new Set());
        attributes.get('size')!.add(variant.size);
      }
      
      // Format (for books/media)
      if (variant.format) {
        if (!attributes.has('format')) attributes.set('format', new Set());
        attributes.get('format')!.add(variant.format);
      }
      
      // Edition
      if (variant.edition) {
        if (!attributes.has('edition')) attributes.set('edition', new Set());
        attributes.get('edition')!.add(variant.edition);
      }
      
      // Language
      if (variant.language) {
        if (!attributes.has('language')) attributes.set('language', new Set());
        attributes.get('language')!.add(variant.language);
      }
      
      // Material
      if (variant.material) {
        if (!attributes.has('material')) attributes.set('material', new Set());
        attributes.get('material')!.add(variant.material);
      }
    });

    // Create variant groups
    attributes.forEach((values, attributeName) => {
      const options: VariantOption[] = Array.from(values).map(value => {
        // Find variants with this attribute value
        const matchingVariants = variants.filter(v => 
          v[attributeName as keyof ProductVariant] === value
        );
        
        // Check if any matching variant is available
        const isAvailable = matchingVariants.some(v => v.inventory_quantity > 0);
        
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

      // Determine display type
      let displayType: VariantGroup['type'] = 'buttons';
      if (attributeName === 'color') {
        displayType = 'swatches';
      } else if (attributeName === 'size' && options.length > 4) {
        displayType = 'dropdown';
      } else if (attributeName === 'format' || attributeName === 'edition') {
        displayType = 'grid';
      }

      groups.push({
        name: attributeName,
        type: displayType,
        options: options.sort((a, b) => {
          // Sort by availability first, then by label
          if (a.available !== b.available) {
            return b.available ? 1 : -1;
          }
          return a.label.localeCompare(b.label);
        }),
        required: true
      });
    });

    return groups.sort((a, b) => {
      // Priority order: format, color, size, edition, language, material
      const priority = ['format', 'color', 'size', 'edition', 'language', 'material'];
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

  // Find variant based on current selections
  const findMatchingVariant = (currentSelections: Record<string, string>): ProductVariant | null => {
    return variants.find(variant => {
      return Object.entries(currentSelections).every(([key, value]) => {
        const variantValue = variant[key as keyof ProductVariant];
        return variantValue === value;
      });
    }) || null;
  };

  // Update selections and find matching variant
  const handleSelectionChange = (attributeName: string, value: string) => {
    const newSelections = { ...selections, [attributeName]: value };
    setSelections(newSelections);
    
    const matchingVariant = findMatchingVariant(newSelections);
    onVariantChange(matchingVariant);
  };

  // Render variant option based on type
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
            <div>Stock: {selectedVariant.inventory_quantity} units</div>
            {selectedVariant.isbn && <div>ISBN: {selectedVariant.isbn}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantSelector;
