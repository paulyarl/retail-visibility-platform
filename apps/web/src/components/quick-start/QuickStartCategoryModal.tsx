'use client';

import { useState } from 'react';
import { BusinessTypeSelector, BUSINESS_TYPES, getBusinessType, getDefaultCount } from './BusinessTypeSelector';

interface QuickStartCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (businessType: string, categoryCount: number) => Promise<void>;
  title?: string;
  description?: string;
}

/**
 * Reusable Quick Start Category Modal
 * Used for generating categories across admin and tenant pages
 */
export function QuickStartCategoryModal({
  isOpen,
  onClose,
  onGenerate,
  title = '⚡ Quick Start: Generate Categories',
  description = 'Generate Google-aligned categories for your business type',
}: QuickStartCategoryModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [categoryCount, setCategoryCount] = useState<number>(15);
  const [isLoading, setIsLoading] = useState(false);

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    setCategoryCount(getDefaultCount(typeId, 'category'));
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    
    setIsLoading(true);
    try {
      await onGenerate(selectedType, categoryCount);
      onClose();
      setSelectedType(null);
      setCategoryCount(15);
    } catch (error) {
      console.error('[QuickStartCategoryModal] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Type
            </label>
            <BusinessTypeSelector
              value={selectedType}
              onChange={(typeId) => handleTypeChange(typeId)}
              variant="dropdown"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Categories: {categoryCount}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={categoryCount}
              onChange={(e) => setCategoryCount(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-neutral-500 mt-1">
              <span>5 min</span>
              <span>30 max</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>✓ Google-Aligned:</strong> Each category will be automatically mapped to Google's Product Taxonomy for optimal SEO and Google Business Profile sync.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !selectedType}
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLoading ? 'Generating...' : `Generate ${categoryCount} Categories`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickStartCategoryModal;
