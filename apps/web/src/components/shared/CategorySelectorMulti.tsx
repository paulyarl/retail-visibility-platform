'use client';

import { useState, useEffect, useMemo } from 'react';
import { Star, Plus, X, GripVertical } from 'lucide-react';

/**
 * Generic category type that can represent both GBP and Directory categories
 */
export interface CategoryOption {
  id: string;
  name: string;
  path?: string[]; // Optional breadcrumb path (used by GBP)
  slug?: string;    // Optional slug (used by Directory)
}

export interface CategorySelectorMultiProps {
  // Selection state
  primary: CategoryOption | null;
  secondary: CategoryOption[];
  onPrimaryChange: (category: CategoryOption | null) => void;
  onSecondaryChange: (categories: CategoryOption[]) => void;
  
  // Category data source
  categories: CategoryOption[];
  loading?: boolean;
  
  // Search functionality (optional)
  onSearch?: (query: string) => Promise<CategoryOption[]>;
  searchPlaceholder?: string;
  
  // UI customization
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryHelpText?: string;
  secondaryHelpText?: string;
  tipText?: string;
  disabled?: boolean;
  
  // Behavior
  maxSecondaryCategories?: number;
  showGroupedDropdown?: boolean; // For GBP-style grouped categories
  categoryGroups?: Record<string, CategoryOption[]>;
}

const DEFAULT_MAX_SECONDARY = 9;

export default function CategorySelectorMulti({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  categories,
  loading = false,
  onSearch,
  searchPlaceholder = 'Search for categories...',
  primaryLabel = 'Primary Category',
  secondaryLabel = 'Secondary Categories',
  primaryHelpText = 'Your main category (required)',
  secondaryHelpText = 'Additional categories that describe your business (optional)',
  tipText = 'Choose categories that best describe your business. Your primary category is most important for search results.',
  disabled = false,
  maxSecondaryCategories = DEFAULT_MAX_SECONDARY,
  showGroupedDropdown = false,
  categoryGroups,
}: CategorySelectorMultiProps) {
  const [primaryUseSearch, setPrimaryUseSearch] = useState(false);
  const [primarySearchTerm, setPrimarySearchTerm] = useState('');
  const [primarySearchResults, setPrimarySearchResults] = useState<CategoryOption[]>([]);
  const [primarySearching, setPrimarySearching] = useState(false);
  
  const [showSecondaryInput, setShowSecondaryInput] = useState(false);
  const [secondarySearchTerm, setSecondarySearchTerm] = useState('');
  const [secondarySearchResults, setSecondarySearchResults] = useState<CategoryOption[]>([]);
  const [secondarySearching, setSecondarySearching] = useState(false);

  // Filter categories for local search
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

  // Debounced search for primary (if onSearch provided)
  useEffect(() => {
    if (!onSearch || !primarySearchTerm || primarySearchTerm.trim().length < 2) {
      setPrimarySearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setPrimarySearching(true);
        const results = await onSearch(primarySearchTerm);
        if (active) {
          setPrimarySearchResults(results);
        }
      } catch (error) {
        console.error('[CategorySelector] Primary search error:', error);
      } finally {
        if (active) setPrimarySearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [primarySearchTerm, onSearch]);

  // Debounced search for secondary (if onSearch provided)
  useEffect(() => {
    if (!onSearch || !secondarySearchTerm || secondarySearchTerm.trim().length < 2) {
      setSecondarySearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSecondarySearching(true);
        const results = await onSearch(secondarySearchTerm);
        if (active) {
          setSecondarySearchResults(results);
        }
      } catch (error) {
        console.error('[CategorySelector] Secondary search error:', error);
      } finally {
        if (active) setSecondarySearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [secondarySearchTerm, onSearch]);

  const handleAddSecondary = (category: CategoryOption) => {
    if (!isCategorySelected(category.id) && secondary.length < maxSecondaryCategories) {
      onSecondaryChange([...secondary, category]);
      setShowSecondaryInput(false);
      setSecondarySearchTerm('');
    }
  };

  const handleRemoveSecondary = (index: number) => {
    const newSecondary = [...secondary];
    newSecondary.splice(index, 1);
    onSecondaryChange(newSecondary);
  };

  const isCategorySelected = (categoryId: string) => {
    return primary?.id === categoryId || secondary.some(s => s.id === categoryId);
  };

  // Get the appropriate search results or filtered categories
  const primaryDisplayCategories = onSearch && primarySearchTerm 
    ? primarySearchResults 
    : filteredPrimaryCategories;

  const secondaryDisplayCategories = onSearch && secondarySearchTerm 
    ? secondarySearchResults 
    : filteredSecondaryCategories;

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
            {primaryLabel} <span className="text-red-500">*</span>
          </label>
          {!primary && onSearch && (
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
              {primary.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onPrimaryChange(null)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {primaryUseSearch || !onSearch ? (
              <div className="relative">
                <input
                  type="text"
                  value={primarySearchTerm}
                  onChange={(e) => setPrimarySearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 mb-2"
                />
                {primarySearchTerm && (
                  <div className="max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                    {primarySearching && (
                      <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Searching...
                      </div>
                    )}
                    {primaryDisplayCategories.map((cat) => {
                      const isSelected = isCategorySelected(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => !isSelected && onPrimaryChange(cat)}
                          disabled={isSelected}
                          className={`w-full text-left px-3 py-2 transition-colors ${
                            isSelected
                              ? 'bg-neutral-100 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {cat.name}
                              </div>
                              {cat.path && (
                                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                  {cat.path.join(' > ')}
                                </div>
                              )}
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
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const selected = categories.find(cat => cat.id === e.target.value);
                  if (selected) {
                    onPrimaryChange(selected);
                  }
                }}
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select primary category... ({categories.length} available)</option>
                {showGroupedDropdown && categoryGroups ? (
                  Object.entries(categoryGroups).map(([groupName, groupCategories]) => {
                    if (groupCategories.length === 0) return null;
                    return (
                      <optgroup key={groupName} label={groupName}>
                        {groupCategories.map((cat) => (
                          <option 
                            key={cat.id} 
                            value={cat.id}
                            disabled={isCategorySelected(cat.id)}
                          >
                            {cat.name} {isCategorySelected(cat.id) ? '✓ Selected' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                ) : (
                  categories.map((cat) => {
                    const isSelected = isCategorySelected(cat.id);
                    return (
                      <option 
                        key={cat.id} 
                        value={cat.id}
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
          {primaryHelpText}
        </p>
      </div>

      {/* Secondary Categories Section */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {secondaryLabel} ({secondary.length}/{maxSecondaryCategories})
        </label>

        {/* Selected Secondary Categories */}
        {secondary.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {secondary.map((cat, index) => (
              <div
                key={cat.id}
                className="group flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-700 rounded-lg border border-neutral-200 dark:border-neutral-600"
              >
                <GripVertical className="w-3 h-3 text-neutral-400 flex-shrink-0 cursor-move" />
                <span className="text-sm text-neutral-900 dark:text-neutral-100">
                  {cat.name}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSecondary(index)}
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
        {secondary.length < maxSecondaryCategories && (
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
                  const selected = categories.find(cat => cat.id === e.target.value);
                  if (selected && !isCategorySelected(selected.id)) {
                    handleAddSecondary(selected);
                  }
                }}
                disabled={disabled || loading}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select from categories... ({categories.length} available)</option>
                {showGroupedDropdown && categoryGroups ? (
                  Object.entries(categoryGroups).map(([groupName, groupCategories]) => {
                    if (groupCategories.length === 0) return null;
                    return (
                      <optgroup key={groupName} label={groupName}>
                        {groupCategories.map((cat) => (
                          <option 
                            key={cat.id} 
                            value={cat.id}
                            disabled={isCategorySelected(cat.id)}
                          >
                            {cat.name} {isCategorySelected(cat.id) ? '✓ Selected' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                ) : (
                  categories.map((cat) => {
                    const isSelected = isCategorySelected(cat.id);
                    return (
                      <option 
                        key={cat.id} 
                        value={cat.id}
                        disabled={isSelected}
                        style={isSelected ? { color: '#999' } : undefined}
                      >
                        {cat.name} {isSelected ? '✓ Selected' : ''}
                      </option>
                    );
                  })
                )}
              </select>
              {onSearch && (
                <div className="relative">
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
                      {secondarySearching && (
                        <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                          Searching...
                        </div>
                      )}
                      {secondaryDisplayCategories.map((cat) => {
                        const isSelected = isCategorySelected(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => !isSelected && handleAddSecondary(cat)}
                            disabled={isSelected}
                            className={`w-full text-left px-3 py-2 transition-colors ${
                              isSelected
                                ? 'bg-neutral-100 dark:bg-neutral-700 opacity-50 cursor-not-allowed'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {cat.name}
                                </div>
                                {cat.path && (
                                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                    {cat.path.join(' > ')}
                                  </div>
                                )}
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
              )}
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
          {secondaryHelpText}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>💡 Tip:</strong> {tipText}
        </p>
      </div>
    </div>
  );
}
