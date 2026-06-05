/**
 * Product Type Selector with Capability Gating
 * 
 * Example implementation showing how capability gating controls
 * which product types users can create based on their tier
 */

import React from 'react';
import { CapabilityFeature } from '@/components/features/CapabilityGate';
import { useCapabilityGate } from '@/hooks/useCapabilityGate';

interface ProductTypeSelectorProps {
  selectedType?: string;
  onTypeChange: (type: string) => void;
  className?: string;
}

export function ProductTypeSelector({ selectedType, onTypeChange, className = '' }: ProductTypeSelectorProps) {
  const productTypesCapability = useCapabilityGate('product_types');
  const availableTypes = productTypesCapability.capabilities 
    ? Object.values(productTypesCapability.capabilities).map(cap => cap.features || []).flat()
    : [];

  return (
    <div className={`product-type-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Product Type
      </label>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Physical Products - Available to all tiers */}
        <CapabilityFeature capabilityType="product_types" feature="physical_product">
          <button
            type="button"
            onClick={() => onTypeChange('physical')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              selectedType === 'physical'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-lg mb-1">📦</div>
            <div className="text-sm font-medium">Physical</div>
            <div className="text-xs text-gray-500">Tangible goods</div>
          </button>
        </CapabilityFeature>

        {/* Digital Products - Available from Storefront tier */}
        <CapabilityFeature 
          capabilityType="product_types" 
          feature="digital_product"  // Explicit naming convention
          fallback={
            <div className="p-3 border border-gray-200 rounded-lg text-center opacity-50">
              <div className="text-lg mb-1">💻</div>
              <div className="text-sm font-medium text-gray-400">Digital</div>
              <div className="text-xs text-gray-400">Storefront tier</div>
            </div>
          }
        >
          <button
            type="button"
            onClick={() => onTypeChange('digital')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              selectedType === 'digital'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-lg mb-1">💻</div>
            <div className="text-sm font-medium">Digital</div>
            <div className="text-xs text-gray-500">Downloads & files</div>
          </button>
        </CapabilityFeature>

        {/* Hybrid Products - Available from Professional tier */}
        <CapabilityFeature 
          capabilityType="product_types" 
          feature="hybrid_product"  // Explicit naming convention
          fallback={
            <div className="p-3 border border-gray-200 rounded-lg text-center opacity-50">
              <div className="text-lg mb-1">🔄</div>
              <div className="text-sm font-medium text-gray-400">Hybrid</div>
              <div className="text-xs text-gray-400">Professional tier</div>
            </div>
          }
        >
          <button
            type="button"
            onClick={() => onTypeChange('hybrid')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              selectedType === 'hybrid'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-lg mb-1">🔄</div>
            <div className="text-sm font-medium">Hybrid</div>
            <div className="text-xs text-gray-500">Physical + Digital</div>
          </button>
        </CapabilityFeature>

        {/* Custom Products - Available from Professional tier */}
        <CapabilityFeature 
          capabilityType="product_types" 
          feature="custom_product"  // Explicit naming convention
          fallback={
            <div className="p-3 border border-gray-200 rounded-lg text-center opacity-50">
              <div className="text-lg mb-1">⚙️</div>
              <div className="text-sm font-medium text-gray-400">Custom</div>
              <div className="text-xs text-gray-400">Professional tier</div>
            </div>
          }
        >
          <button
            type="button"
            onClick={() => onTypeChange('custom')}
            className={`p-3 border rounded-lg text-center transition-colors ${
              selectedType === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-lg mb-1">⚙️</div>
            <div className="text-sm font-medium">Custom</div>
            <div className="text-xs text-gray-500">Custom attributes</div>
          </button>
        </CapabilityFeature>
      </div>

      {/* Show current tier information */}
      <div className="mt-3 text-sm text-gray-600">
        Available types: {availableTypes.join(', ') || 'None'}
        {productTypesCapability.restrictions?.maxItems && (
          <span className="ml-2">
            (Limit: {productTypesCapability.restrictions.maxItems})
          </span>
        )}
      </div>
    </div>
  );
}
