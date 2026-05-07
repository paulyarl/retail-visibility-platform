'use client';

import { useState, useEffect } from 'react';
import { AvailableAttributes, VariantAttributes, MVVariant } from '@/types/variants';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';

interface VariantSelectorProps {
  availableAttributes: AvailableAttributes;
  variants: MVVariant[];
  onVariantSelect?: (variant: MVVariant | null) => void;
  selectedAttributes?: VariantAttributes;
  className?: string;
}

/**
 * VariantSelector - Dynamic attribute selector for product variants
 * 
 * Builds dropdown selectors based on available attributes and finds matching variant.
 * 
 * Usage:
 * <VariantSelector 
 *   availableAttributes={{ color: ['Red', 'Blue'], size: ['S', 'M', 'L'] }}
 *   variants={variantsArray}
 *   onVariantSelect={(variant) => console.log('Selected:', variant)}
 * />
 */
export function VariantSelector({
  availableAttributes,
  variants,
  onVariantSelect,
  selectedAttributes: initialAttributes = {},
  className = ''
}: VariantSelectorProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<VariantAttributes>(initialAttributes);
  const [matchedVariant, setMatchedVariant] = useState<MVVariant | null>(null);

  const attributeKeys = Object.keys(availableAttributes).sort();

  useEffect(() => {
    const allSelected = attributeKeys.every(key => selectedAttributes[key]);
    
    if (!allSelected) {
      setMatchedVariant(null);
      onVariantSelect?.(null);
      return;
    }

    const match = variants.find(variant => {
      if (!variant.attributes) return false;
      
      return attributeKeys.every(key => {
        const variantValue = variant.attributes?.[key];
        const selectedValue = selectedAttributes[key];
        return variantValue === selectedValue;
      });
    });

    setMatchedVariant(match || null);
    onVariantSelect?.(match || null);
  }, [selectedAttributes, variants, attributeKeys, onVariantSelect]);

  const getAvailableOptions = (attributeKey: string): string[] => {
    const allOptions = availableAttributes[attributeKey] || [];
    
    const otherSelectedAttributes = Object.entries(selectedAttributes)
      .filter(([key]) => key !== attributeKey)
      .filter(([, value]) => value);

    if (otherSelectedAttributes.length === 0) {
      return allOptions;
    }

    return allOptions.filter(optionValue => {
      return variants.some(variant => {
        if (!variant.attributes) return false;
        
        const matchesOthers = otherSelectedAttributes.every(([key, value]) => {
          return variant.attributes?.[key] === value;
        });
        
        const matchesThis = variant.attributes[attributeKey] === optionValue;
        
        return matchesOthers && matchesThis && variant.is_active;
      });
    });
  };

  const handleAttributeChange = (attributeKey: string, value: string) => {
    setSelectedAttributes(prev => {
      if (!value) {
        const newAttrs = { ...prev };
        delete newAttrs[attributeKey];
        return newAttrs;
      }
      return {
        ...prev,
        [attributeKey]: value
      };
    });
  };

  const handleReset = () => {
    setSelectedAttributes({});
    setMatchedVariant(null);
    onVariantSelect?.(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-3">
        {attributeKeys.map(attributeKey => {
          const availableOptions = getAvailableOptions(attributeKey);
          const isDisabled = availableOptions.length === 0;
          
          return (
            <div key={attributeKey}>
              <Label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 capitalize">
                {attributeKey}
              </Label>
              <Select
                value={selectedAttributes[attributeKey] || ''}
                onChange={(e) => handleAttributeChange(attributeKey, e.target.value)}
                disabled={isDisabled}
              >
                <option value="">Select {attributeKey}</option>
                {availableOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>

      {matchedVariant && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Variant Available
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {matchedVariant.variant_name || 'Selected variant'}
              </p>
            </div>
            <Badge variant="success">
              In Stock
            </Badge>
          </div>
        </div>
      )}

      {!matchedVariant && attributeKeys.every(key => selectedAttributes[key]) && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            Combination Not Available
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            This combination is not available. Please try different options.
          </p>
        </div>
      )}

      {Object.keys(selectedAttributes).some(key => selectedAttributes[key]) && (
        <button
          onClick={handleReset}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          Reset Selection
        </button>
      )}
    </div>
  );
}
