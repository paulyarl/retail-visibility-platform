/**
 * Product Type Selector Component
 * Allows merchants to choose between Physical, Digital, or Hybrid products
 */

import React from 'react';
import { Store, Download, Gift, Wrench } from 'lucide-react';

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';

interface ProductTypeSelectorProps {
  value: ProductType;
  onChange: (type: ProductType) => void;
  disabled?: boolean;
  allowedTypes?: ProductType[];
  effectiveTypes?: ProductType[];
}

export default function ProductTypeSelector({ value, onChange, disabled, allowedTypes, effectiveTypes }: ProductTypeSelectorProps) {
  const options = [
    {
      value: 'physical' as ProductType,
      icon: Store,
      label: 'Physical Product',
      description: 'Ships to customers (inventory, shipping)',
    },
    {
      value: 'digital' as ProductType,
      icon: Download,
      label: 'Digital Product',
      description: 'Instant delivery (files, links, licenses)',
    },
    {
      value: 'hybrid' as ProductType,
      icon: Gift,
      label: 'Hybrid Product',
      description: 'Physical item + digital content',
    },
    {
      value: 'service' as ProductType,
      icon: Wrench,
      label: 'Service Product',
      description: 'Bookable services or appointments',
    },
  ];

  const allAllowed = allowedTypes ?? ['physical'];
  const allEffective = effectiveTypes ?? ['physical'];

  const filteredOptions = options.map(option => {
    const isTierAllowed = allAllowed.includes(option.value);
    const isMerchantEnabled = allEffective.includes(option.value);
    const isPhysical = option.value === 'physical';

    return {
      ...option,
      isTierAllowed: isTierAllowed || isPhysical,
      isMerchantEnabled: isMerchantEnabled || (isPhysical && !allowedTypes),
      isDisabled: disabled || !isTierAllowed || (isTierAllowed && !isMerchantEnabled),
    };
  });

  // Auto-switch to first effective type if current type is not available
  React.useEffect(() => {
    if (allowedTypes && value) {
      const currentOption = filteredOptions.find(opt => opt.value === value);
      if (currentOption?.isDisabled && !disabled) {
        const firstAvailable = filteredOptions.find(opt => !opt.isDisabled);
        if (firstAvailable) {
          onChange(firstAvailable.value);
        }
      }
    }
  }, [value, allowedTypes, effectiveTypes, onChange, disabled]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Product Type
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {filteredOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          if (option.isDisabled) {
            const isTierAllowed = option.isTierAllowed;
            const badgeText = isTierAllowed ? 'Not Enabled' : 'Upgrade Required';
            const badgeClass = isTierAllowed
              ? 'bg-gray-100 text-gray-600'
              : 'bg-amber-100 text-amber-800';
            return (
              <div
                key={option.value}
                className="relative flex flex-col items-start p-4 border-2 border-gray-200 rounded-lg opacity-60"
              >
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${badgeClass}`}>
                    {badgeText}
                  </span>
                </div>
                <Icon className="w-6 h-6 text-gray-400 mb-2" />
                <h4 className="font-medium text-gray-500">{option.label}</h4>
                <p className="text-sm text-gray-400 mt-1">{option.description}</p>
              </div>
            );
          }
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.isDisabled && onChange(option.value)}
              disabled={option.isDisabled}
              className={`
                relative flex flex-col items-start p-4 border-2 rounded-lg transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
                ${option.isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                </div>
              )}
              
              {/* Icon */}
              <div className={`
                mb-2 p-2 rounded-lg
                ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
              `}>
                <Icon className={`
                  w-6 h-6
                  ${isSelected ? 'text-blue-600' : 'text-gray-600'}
                `} />
              </div>
              
              {/* Label */}
              <div className="text-left">
                <div className={`
                  text-sm font-semibold mb-1
                  ${isSelected ? 'text-blue-900' : 'text-gray-900'}
                `}>
                  {option.label}
                </div>
                <div className="text-xs text-gray-500">
                  {option.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Helper text */}
      <p className="text-xs text-gray-500 mt-2">
        {value === 'physical' && 'Requires inventory tracking and shipping configuration'}
        {value === 'digital' && 'No inventory needed - instant delivery after purchase'}
        {value === 'hybrid' && 'Combines physical shipping with digital content delivery'}
        {value === 'service' && 'Bookable services - no shipping or inventory needed'}
      </p>
    </div>
  );
}
