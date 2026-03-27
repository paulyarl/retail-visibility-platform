/**
 * Variant Indicator Component
 * 
 * Displays variant information for items with variants
 * Shows:
 * - Variant count
 * - Sample attributes/values
 * - Quick preview of variant data
 */

'use client';

import { Badge, Tooltip } from '@/components/ui';
import { Package, Layers } from 'lucide-react';
import { Item, ProductVariant } from '@/services/itemsDataService';

interface VariantIndicatorProps {
  item: Item;
  compact?: boolean;
  showDetails?: boolean;
}

export default function VariantIndicator({ 
  item, 
  compact = false, 
  showDetails = false 
}: VariantIndicatorProps) {
  // Check if item has variants
  if (!item.has_variants || !item.variants || item.variants.length === 0) {
    return null;
  }

  const variants = item.variants;
  const variantCount = variants.length;

  // Extract unique attribute types from all variants
  const attributeTypes = new Set<string>();
  const sampleAttributes: Record<string, string> = {};

  variants.forEach((variant: ProductVariant) => {
    if (variant.attributes && typeof variant.attributes === 'object') {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        attributeTypes.add(key.toLowerCase());
        // Store first example of each attribute type
        if (!sampleAttributes[key.toLowerCase()] && value) {
          sampleAttributes[key.toLowerCase()] = String(value);
        }
      });
    }
  });

  const attributeTypeArray = Array.from(attributeTypes);

  // Compact version - just shows variant count
  if (compact) {
    const tooltipContent = [
      `${variantCount} Variants`,
      attributeTypeArray.length > 0 ? `Attributes: ${attributeTypeArray.join(', ')}` : '',
      showDetails && Object.entries(sampleAttributes).length > 0 
        ? Object.entries(sampleAttributes).slice(0, 3).map(([key, value]) => `${key}: ${value}`).join('\n')
        : ''
    ].filter(Boolean).join('\n');

    return (
      <Tooltip content={tooltipContent}>
        <Badge 
          variant="outline" 
          className="text-xs bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
        >
          <Layers className="w-3 h-3 mr-1" />
          {variantCount} variants
        </Badge>
      </Tooltip>
    );
  }

  // Full version - shows detailed information
  return (
    <div className="space-y-2">
      {/* Variant count badge */}
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className="text-xs bg-purple-50 text-purple-700 border-purple-200"
        >
          <Package className="w-3 h-3 mr-1" />
          {variantCount} {variantCount === 1 ? 'variant' : 'variants'}
        </Badge>
      </div>

      {/* Attribute types */}
      {attributeTypeArray.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-neutral-700">Attributes:</p>
          <div className="flex flex-wrap gap-1">
            {attributeTypeArray.map(type => (
              <Badge 
                key={type}
                variant="secondary" 
                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Sample attribute values */}
      {showDetails && Object.entries(sampleAttributes).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-neutral-700">Sample Values:</p>
          <div className="space-y-1">
            {Object.entries(sampleAttributes).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-neutral-600 capitalize">{key}:</span>
                <span className="text-neutral-500">{value}</span>
              </div>
            ))}
            {Object.keys(sampleAttributes).length > 3 && (
              <p className="text-xs text-neutral-400">...and more</p>
            )}
          </div>
        </div>
      )}

      {/* Price range if variants have different prices */}
      {variants.some((v: ProductVariant) => v.price_cents !== variants[0].price_cents) && (
        <div className="text-xs text-neutral-600">
          <span className="font-medium">Price range:</span>{' '}
          ${Math.min(...variants.map((v: ProductVariant) => v.price_cents)) / 100} - ${Math.max(...variants.map((v: ProductVariant) => v.price_cents)) / 100}
        </div>
      )}
    </div>
  );
}
