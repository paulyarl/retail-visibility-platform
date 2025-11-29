'use client';

import { useState, useMemo } from 'react';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';
import { Star, Plus, X } from 'lucide-react';

interface DirectoryCategorySelectorMultiProps {
  primary: string;
  secondary: string[];
  onPrimaryChange: (category: string) => void;
  onSecondaryChange: (categories: string[]) => void;
  disabled?: boolean;
}

const MAX_SECONDARY_CATEGORIES = 9;

export default function DirectoryCategorySelectorMulti({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
}: DirectoryCategorySelectorMultiProps) {
  const { categories, loading, error } = useDirectoryCategories();
  
  console.log('[DirectoryCategorySelectorMulti] Categories:', categories.length, 'Loading:', loading, 'Error:', error);
  const [primaryUseSearch, setPrimaryUseSearch] = useState(false);
  const [primarySearchTerm, setPrimarySearchTerm] = useState('');
  const [showSecondaryInput, setShowSecondaryInput] = useState(false);
  const [secondarySearchTerm, setSecondarySearchTerm] = useState('');

  // Filter categories for search
  const filteredPrimaryCategories = useMemo(() => {
    if (!primarySearchTerm) return categories;
    const term = primarySearchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term)
    );
  }, [categories, primarySearchTerm]);

  const filteredSecondaryCategories = useMemo(() => {
    if (!secondarySearchTerm) return categories;
    const term = secondarySearchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term)
    );
  }, [categories, secondarySearchTerm]);

  const handleAddSecondary = (categoryName: string) => {
    if (!secondary.includes(categoryName) && categoryName !== primary && secondary.length < MAX_SECONDARY_CATEGORIES) {
      onSecondaryChange([...secondary, categoryName]);
      setShowSecondaryInput(false);
      setSecondarySearchTerm('');
    }
  };

  const handleRemoveSecondary = (categoryName: string) => {
    onSecondaryChange(secondary.filter(c => c !== categoryName));
  };

  const isCategorySelected = (categoryName: string) => {
    return categoryName === primary || secondary.includes(categoryName);
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
      {/* Primary Category Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            <Star className="inline w-4 h-4 text-yellow-500 mr-1" />
            Primary Category <span className="text-red-500">*</span>
          </label>
          {!primary && (
            <button
              type="button"
              onClick={() => setPrimaryUseSearch(!primaryUseSearch)}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              {primaryUseSearch ? '📋 Use Dropdown' : '🔍 Can\'t find it? Search'}
            </button>
          )}
        </div>

        {primary ? (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Star className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="flex-1 text-sm font-medium text-blue-900 dark:text-blue-100">
              {primary}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onPrimaryChange('')}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {primaryUseSearch ? (
              <div>
                <input
                  type="text"
                  value={primarySearchTerm}
                  onChange={(e) => setPrimarySearchTerm(e.target.value)}
                  placeholder="Search for your primary category..."
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 mb-2"
                />
                {primarySearchTerm && (
                  <div className="max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    {filteredPrimaryCategories.map((cat, index) => (
                      <button
                        key={`${cat.slug}-${index}`}
                        type="button"
                        onClick={() => {
                          onPrimaryChange(cat.name);
                          setPrimarySearchTerm('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {cat.name}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => onPrimaryChange(e.target.value)}
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select primary category... ({categories.length} available)</option>
                {categories.length === 0 ? (
                  <option disabled>No categories available - check console</option>
                ) : (
                  categories.map((cat, index) => {
                    const isSelected = isCategorySelected(cat.name);
                    return (
                      <option 
                        key={`${cat.slug}-${index}`} 
                        value={cat.name}
                        disabled={isSelected}
                        style={isSelected ? { color: '#999' } : undefined}
                      >
                        {cat.name} {isSelected ? '✓ Selected' : ''}
                      </option>
                    );
                  })
                )}
              </select>
            )}
          </>
        )}

        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Your main business category (required for directory listing)
        </p>
      </div>

      {/* Secondary Categories Section */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Secondary Categories ({secondary.length}/{MAX_SECONDARY_CATEGORIES})
        </label>

        {/* Selected Secondary Categories */}
        {secondary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {secondary.map((categoryName) => (
              <div
                key={categoryName}
                className="group flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-600"
              >
                <span className="text-sm text-neutral-900 dark:text-neutral-100">
                  {categoryName}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSecondary(categoryName)}
                    className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Secondary Category */}
        {secondary.length < MAX_SECONDARY_CATEGORIES && (
          showSecondaryInput ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Add secondary category:</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSecondaryInput(false);
                    setSecondarySearchTerm('');
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !isCategorySelected(e.target.value)) {
                    handleAddSecondary(e.target.value);
                  }
                }}
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select from categories... ({categories.length} available)</option>
                {categories.length === 0 ? (
                  <option disabled>No categories available</option>
                ) : (
                  categories.map((cat, index) => {
                    const isSelected = isCategorySelected(cat.name);
                    return (
                      <option 
                        key={`${cat.slug}-${index}`} 
                        value={cat.name}
                        disabled={isSelected}
                        style={isSelected ? { color: '#999' } : undefined}
                      >
                        {cat.name} {isSelected ? '✓ Selected' : ''}
                      </option>
                    );
                  })
                )}
              </select>
              <div>
                <input
                  type="text"
                  value={secondarySearchTerm}
                  onChange={(e) => setSecondarySearchTerm(e.target.value)}
                  placeholder="Or search for other categories..."
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {secondarySearchTerm && (
                  <div className="mt-2 max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    {filteredSecondaryCategories.map((cat, index) => {
                      const isSelected = isCategorySelected(cat.name);
                      return (
                        <button
                          key={`${cat.slug}-${index}`}
                          type="button"
                          onClick={() => !isSelected && handleAddSecondary(cat.name)}
                          disabled={isSelected}
                          className={`w-full text-left px-3 py-2 transition-colors ${
                            isSelected
                              ? 'bg-neutral-100 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {cat.name}
                            </div>
                            {isSelected && (
                              <span className="text-xs text-neutral-500 ml-2">Selected</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecondaryInput(true)}
              disabled={disabled}
              className="w-full px-3 py-2 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-600 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Secondary Category
            </button>
          )
        )}

        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Additional categories that describe your business (optional, up to {MAX_SECONDARY_CATEGORIES})
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>💡 Tip:</strong> Choose categories that best describe your business. Your primary category is most important for directory search results.
        </p>
      </div>
    </div>
  );
}
