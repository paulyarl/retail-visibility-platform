"use client";

import { useProductLayout, layoutVariantDescriptions } from '@/contexts/ProductLayoutContext';

/**
 * Product Layout Selector Component
 * 
 * Allows users to switch between different product card layout variants
 * Each variant maintains the same data integrity while offering different visual presentations
 */
export default function ProductLayoutSelector() {
  const { variant, setVariant } = useProductLayout();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Product Layout</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Current: {layoutVariantDescriptions[variant as keyof typeof layoutVariantDescriptions].name}
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(layoutVariantDescriptions) as [keyof typeof layoutVariantDescriptions, typeof layoutVariantDescriptions[keyof typeof layoutVariantDescriptions]][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setVariant(key)}
            className={`p-3 rounded-lg border transition-all duration-200 text-left ${
              variant === key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{config.icon}</span>
              <span className={`text-sm font-medium ${
                variant === key
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {config.name}
              </span>
            </div>
            
            <div className="space-y-1">
              {config.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    variant === key
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
      
      <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          {layoutVariantDescriptions[variant as keyof typeof layoutVariantDescriptions].description}
        </p>
      </div>
    </div>
  );
}
