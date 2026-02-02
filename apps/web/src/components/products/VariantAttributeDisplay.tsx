'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface VariantAttributeDisplayProps {
  variant: {
    id: string;
    variant_name: string;
    sku: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, string>;
    sort_order: number;
    is_active: boolean;
    is_on_sale?: boolean;
    discount_percentage?: number;
  };
  showAllAttributes?: boolean;
  maxAttributes?: number;
  className?: string;
}

/**
 * VariantAttributeDisplay - Shows rich variant information including all attributes
 * This component displays the distinguishing features that make each variant unique
 */
export default function VariantAttributeDisplay({
  variant,
  showAllAttributes = false,
  maxAttributes = 4,
  className = '',
}: VariantAttributeDisplayProps) {
  const { attributes, variant_name, sku, is_on_sale, discount_percentage } = variant;

  // Extract attribute entries and sort them
  const attributeEntries = Object.entries(attributes).sort(([keyA], [keyB]) => {
    // Prioritize common attributes
    const priority = ['size', 'color', 'material', 'style', 'length', 'fit'];
    const priorityA = priority.indexOf(keyA.toLowerCase());
    const priorityB = priority.indexOf(keyB.toLowerCase());
    
    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    if (priorityA !== -1) return -1;
    if (priorityB !== -1) return 1;
    
    return keyA.localeCompare(keyB);
  });

  // Limit attributes if requested
  const displayAttributes = showAllAttributes 
    ? attributeEntries 
    : attributeEntries.slice(0, maxAttributes);

  const hasMoreAttributes = attributeEntries.length > maxAttributes && !showAllAttributes;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Variant Name */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 leading-tight">
            {variant_name}
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            SKU: {sku}
          </p>
        </div>
        
        {/* Sale Badge */}
        {is_on_sale && (
          <Badge variant="error" className="text-xs ml-2">
            SALE {discount_percentage && `-${discount_percentage}%`}
          </Badge>
        )}
      </div>

      {/* Variant Attributes */}
      {displayAttributes.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {displayAttributes.map(([key, value]) => (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border border-gray-300 rounded-full text-sm"
              >
                <span className="font-medium text-gray-700 capitalize">
                  {key}:
                </span>
                <span className="text-gray-900">
                  {value}
                </span>
              </div>
            ))}
            
            {/* Show more indicator */}
            {hasMoreAttributes && (
              <div className="inline-flex items-center px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-600">
                +{attributeEntries.length - maxAttributes} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Status */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {variant.stock > 0 ? (
            <span className="text-green-600 font-medium">
              {variant.stock} in stock
            </span>
          ) : (
            <span className="text-red-600 font-medium">
              Out of stock
            </span>
          )}
        </div>
        
        {/* Price */}
        <div className="text-right">
          <div className="font-bold text-gray-900">
            ${((variant.sale_price_cents || variant.price_cents) / 100).toFixed(2)}
          </div>
          {variant.sale_price_cents && (
            <div className="text-sm text-gray-500 line-through">
              ${(variant.price_cents / 100).toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CompactVariantAttributeDisplay - Minimal version for tight spaces
 */
interface CompactVariantAttributeDisplayProps {
  variant: {
    variant_name: string;
    attributes: Record<string, string>;
    is_on_sale?: boolean;
  };
  className?: string;
}

export function CompactVariantAttributeDisplay({
  variant,
  className = '',
}: CompactVariantAttributeDisplayProps) {
  const { attributes, variant_name, is_on_sale } = variant;

  // Get top 2 most important attributes
  const topAttributes = Object.entries(attributes)
    .sort(([keyA], [keyB]) => {
      const priority = ['size', 'color', 'material'];
      const priorityA = priority.indexOf(keyA.toLowerCase());
      const priorityB = priority.indexOf(keyB.toLowerCase());
      
      if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
      if (priorityA !== -1) return -1;
      if (priorityB !== -1) return 1;
      return 0;
    })
    .slice(0, 2);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-medium text-gray-900 text-sm">
        {variant_name}
      </span>
      
      {topAttributes.map(([key, value]) => (
        <Badge key={key} variant="default" className="text-xs">
          {value}
        </Badge>
      ))}
      
      {is_on_sale && (
        <Badge variant="error" className="text-xs">
          Sale
        </Badge>
      )}
    </div>
  );
}

/**
 * VariantComparisonGrid - Shows multiple variants side by side with full attributes
 */
interface VariantComparisonGridProps {
  variants: Array<{
    id: string;
    variant_name: string;
    sku: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, string>;
    sort_order: number;
    is_active: boolean;
    is_on_sale?: boolean;
    discount_percentage?: number;
  }>;
  onVariantSelect?: (variant: any) => void;
  selectedVariantId?: string;
  className?: string;
}

export function VariantComparisonGrid({
  variants,
  onVariantSelect,
  selectedVariantId,
  className = '',
}: VariantComparisonGridProps) {
  // Get all unique attribute types across all variants
  const allAttributeTypes = Array.from(
    new Set(
      variants.flatMap(v => Object.keys(v.attributes))
    )
  ).sort();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Variant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {variants
          .filter(v => v.is_active)
          .sort((a, b) => {
            // Respect store owner's sort_order first, then variant_name as fallback
            if (a.sort_order !== b.sort_order) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            }
            return a.variant_name.localeCompare(b.variant_name);
          })
          .map((variant) => (
            <div
              key={variant.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-gray-400 hover:shadow-md ${
                selectedVariantId === variant.id
                  ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-200'
                  : 'border-gray-300 bg-white'
              }`}
              onClick={() => onVariantSelect?.(variant)}
            >
              {/* Variant Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 leading-tight">
                    {variant.variant_name}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {variant.sku}
                  </p>
                </div>
                
                {variant.is_on_sale && (
                  <Badge variant="error" className="text-xs">
                    {variant.discount_percentage ? `-${variant.discount_percentage}%` : 'SALE'}
                  </Badge>
                )}
              </div>

              {/* Image */}
              {variant.image_url && (
                <div className="mb-3">
                  <img
                    src={variant.image_url}
                    alt={variant.variant_name}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}

              {/* Attributes Grid */}
              <div className="space-y-2 mb-3">
                {allAttributeTypes.map(attrType => {
                  const value = variant.attributes[attrType];
                  if (!value) return null;
                  
                  return (
                    <div key={attrType} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {attrType}:
                      </span>
                      <span className="text-sm text-gray-900 font-medium">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Price and Stock */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div>
                  <div className="font-bold text-gray-900">
                    ${((variant.sale_price_cents || variant.price_cents) / 100).toFixed(2)}
                  </div>
                  {variant.sale_price_cents && (
                    <div className="text-sm text-gray-500 line-through">
                      ${(variant.price_cents / 100).toFixed(2)}
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  {variant.stock > 0 ? (
                    <Badge variant="success" className="text-xs">
                      {variant.stock} available
                    </Badge>
                  ) : (
                    <Badge variant="error" className="text-xs">
                      Out of stock
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
