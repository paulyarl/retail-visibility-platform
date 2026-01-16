'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export interface ProductVariant {
  id: string;
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

interface VariantSelectorProps {
  variants: ProductVariant[];
  onVariantSelect: (variant: ProductVariant | null) => void;
  selectedVariantId?: string;
  className?: string;
}

export default function VariantSelector({
  variants,
  onVariantSelect,
  selectedVariantId,
  className = '',
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Get all unique attribute types from variants
  const attributeTypes = Array.from(
    new Set(
      variants.flatMap(v => Object.keys(v.attributes))
    )
  ).sort();

  // Get available values for each attribute type
  const getAttributeValues = (attributeType: string): string[] => {
    const values = new Set<string>();
    variants.forEach(variant => {
      if (variant.is_active && variant.attributes[attributeType]) {
        values.add(variant.attributes[attributeType]);
      }
    });
    return Array.from(values).sort();
  };

  // Check if a specific attribute value is available given current selections
  const isAttributeValueAvailable = (attributeType: string, value: string): boolean => {
    const testSelection = { ...selectedAttributes, [attributeType]: value };
    
    return variants.some(variant => {
      if (!variant.is_active || variant.stock <= 0) return false;
      
      return Object.entries(testSelection).every(([key, val]) => {
        return variant.attributes[key] === val;
      });
    });
  };

  // Handle attribute selection
  const handleAttributeSelect = (attributeType: string, value: string) => {
    const newSelection = { ...selectedAttributes, [attributeType]: value };
    setSelectedAttributes(newSelection);

    // Find matching variant
    const matchingVariant = variants.find(variant => {
      if (!variant.is_active) return false;
      
      return Object.entries(newSelection).every(([key, val]) => {
        return variant.attributes[key] === val;
      });
    });

    setSelectedVariant(matchingVariant || null);
    onVariantSelect(matchingVariant || null);
  };

  // Initialize with selected variant if provided
  useEffect(() => {
    if (selectedVariantId) {
      const variant = variants.find(v => v.id === selectedVariantId);
      if (variant) {
        setSelectedAttributes(variant.attributes);
        setSelectedVariant(variant);
      }
    }
  }, [selectedVariantId, variants]);

  if (variants.length === 0 || attributeTypes.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {attributeTypes.map(attributeType => {
        const values = getAttributeValues(attributeType);
        const selectedValue = selectedAttributes[attributeType];

        return (
          <div key={attributeType}>
            <label className="block text-sm font-medium text-gray-900 mb-2 capitalize">
              {attributeType}
              {selectedValue && (
                <span className="ml-2 text-gray-600 font-normal">
                  - {selectedValue}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {values.map(value => {
                const isSelected = selectedValue === value;
                const isAvailable = isAttributeValueAvailable(attributeType, value);

                return (
                  <button
                    key={value}
                    onClick={() => handleAttributeSelect(attributeType, value)}
                    disabled={!isAvailable}
                    className={`
                      relative px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all
                      ${isSelected
                        ? 'border-primary-600 bg-primary-50 text-primary-900'
                        : isAvailable
                          ? 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                      }
                    `}
                  >
                    {value}
                    {isSelected && (
                      <Check className="absolute top-1 right-1 w-4 h-4 text-primary-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selected variant info */}
      {selectedVariant && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900">
                {selectedVariant.variant_name}
              </p>
              <p className="text-xs text-green-700 mt-1">
                SKU: {selectedVariant.sku}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-green-900">
                ${((selectedVariant.sale_price_cents || selectedVariant.price_cents) / 100).toFixed(2)}
              </p>
              {selectedVariant.sale_price_cents && (
                <p className="text-xs text-green-700 line-through">
                  ${(selectedVariant.price_cents / 100).toFixed(2)}
                </p>
              )}
              <p className="text-xs text-green-700 mt-1">
                {selectedVariant.stock > 0 
                  ? `${selectedVariant.stock} in stock`
                  : 'Out of stock'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete selection message */}
      {!selectedVariant && Object.keys(selectedAttributes).length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Please select all options to see availability and pricing
          </p>
        </div>
      )}

      {/* No selection message */}
      {!selectedVariant && Object.keys(selectedAttributes).length === 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Please select your preferred options
          </p>
        </div>
      )}
    </div>
  );
}
