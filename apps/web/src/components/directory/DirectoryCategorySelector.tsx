'use client';

import { useState, useMemo } from 'react';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';

interface DirectoryCategorySelectorProps {
  primaryCategory?: string;
  secondaryCategories?: string[];
  onPrimaryCategoryChange: (category: string) => void;
  onSecondaryCategoriesChange: (categories: string[]) => void;
  maxSecondaryCategories?: number;
}

export default function DirectoryCategorySelector({
  primaryCategory,
  secondaryCategories = [],
  onPrimaryCategoryChange,
  onSecondaryCategoriesChange,
  maxSecondaryCategories = 5,
}: DirectoryCategorySelectorProps) {
  const { categories, loading } = useDirectoryCategories();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term)
    );
  }, [categories, searchTerm]);

  const handleSecondaryToggle = (categoryName: string) => {
    if (secondaryCategories.includes(categoryName)) {
      onSecondaryCategoriesChange(
        secondaryCategories.filter(c => c !== categoryName)
      );
    } else if (secondaryCategories.length < maxSecondaryCategories) {
      onSecondaryCategoriesChange([...secondaryCategories, categoryName]);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Primary Category *
        </label>
        <select
          value={primaryCategory || ''}
          onChange={(e) => onPrimaryCategoryChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        >
          <option value="">Select a category...</option>
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.name} {cat.count ? `(${cat.count})` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose the category that best describes your business
        </p>
      </div>

      {/* Secondary Categories */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Secondary Categories (Optional)
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Select up to {maxSecondaryCategories} additional categories ({secondaryCategories.length}/{maxSecondaryCategories} selected)
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 mb-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
        />

        {/* Category Grid */}
        <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-2">
          {filteredCategories.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No categories found
            </p>
          ) : (
            filteredCategories.map((cat) => {
              const isSelected = secondaryCategories.includes(cat.name);
              const isPrimary = primaryCategory === cat.name;
              const isDisabled = isPrimary || (!isSelected && secondaryCategories.length >= maxSecondaryCategories);

              return (
                <label
                  key={cat.name}
                  className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  } ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => handleSecondaryToggle(cat.name)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                    {cat.name}
                    {isPrimary && (
                      <span className="ml-2 text-xs text-gray-500">(Primary)</span>
                    )}
                    {cat.count && (
                      <span className="ml-2 text-xs text-gray-400">({cat.count})</span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Selected Secondary Categories */}
        {secondaryCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {secondaryCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => handleSecondaryToggle(cat)}
                  className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
