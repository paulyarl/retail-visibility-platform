'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { X, Plus, GripVertical, Star } from 'lucide-react';

interface GBPCategory {
  id: string;
  name: string;
  path: string[];
}

interface SelectedCategory {
  id: string;
  name: string;
}

interface GBPCategorySelectorMultiProps {
  tenantId: string;
  primary?: SelectedCategory | null;
  secondary?: SelectedCategory[];
  onPrimaryChange: (category: SelectedCategory | null) => void;
  onSecondaryChange: (categories: SelectedCategory[]) => void;
  disabled?: boolean;
}

const MAX_SECONDARY_CATEGORIES = 9;

export default function GBPCategorySelectorMulti({
  tenantId,
  primary,
  secondary = [],
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
}: GBPCategorySelectorMultiProps) {
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [primaryResults, setPrimaryResults] = useState<GBPCategory[]>([]);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [showPrimaryResults, setShowPrimaryResults] = useState(false);
  const [primaryUseSearch, setPrimaryUseSearch] = useState(false);
  
  const [secondaryQuery, setSecondaryQuery] = useState('');
  const [secondaryResults, setSecondaryResults] = useState<GBPCategory[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [showSecondaryResults, setShowSecondaryResults] = useState(false);
  const [showSecondaryInput, setShowSecondaryInput] = useState(false);
  
  const [popularCategories, setPopularCategories] = useState<GBPCategory[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // Load popular categories on mount
  useEffect(() => {
    async function loadPopularCategories() {
      try {
        setLoadingPopular(true);
        const response = await api.get(`/api/gbp/categories/popular?tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok) {
          const data = await response.json();
          setPopularCategories(data.items || []);
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Failed to load popular categories:', error);
      } finally {
        setLoadingPopular(false);
      }
    }
    loadPopularCategories();
  }, [tenantId]);

  // Debounced search for primary
  useEffect(() => {
    if (!primaryQuery || primaryQuery.trim().length < 2) {
      setPrimaryResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setPrimaryLoading(true);
        const response = await api.get(`/api/gbp/categories?query=${encodeURIComponent(primaryQuery)}&limit=10&tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok && active) {
          const data = await response.json();
          setPrimaryResults(data.items || []);
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Primary search error:', error);
      } finally {
        if (active) setPrimaryLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [primaryQuery, tenantId]);

  // Debounced search for secondary
  useEffect(() => {
    if (!secondaryQuery || secondaryQuery.trim().length < 2) {
      setSecondaryResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSecondaryLoading(true);
        const response = await api.get(`/api/gbp/categories?query=${encodeURIComponent(secondaryQuery)}&limit=10&tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok && active) {
          const data = await response.json();
          setSecondaryResults(data.items || []);
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Secondary search error:', error);
      } finally {
        if (active) setSecondaryLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [secondaryQuery, tenantId]);

  const handleSelectPrimary = (category: GBPCategory) => {
    if (isCategorySelected(category.id)) return;
    onPrimaryChange({ id: category.id, name: category.name });
    setPrimaryQuery('');
    setShowPrimaryResults(false);
  };

  const handleSelectSecondary = (category: GBPCategory) => {
    if (isCategorySelected(category.id)) return;
    if (secondary.length < MAX_SECONDARY_CATEGORIES) {
      onSecondaryChange([...secondary, { id: category.id, name: category.name }]);
      setSecondaryQuery('');
      setShowSecondaryInput(false);
      setShowSecondaryResults(false);
    }
  };

  const handleRemoveSecondary = (index: number) => {
    const newSecondary = [...secondary];
    newSecondary.splice(index, 1);
    onSecondaryChange(newSecondary);
  };

  const handleClearPrimary = () => {
    onPrimaryChange(null);
    setPrimaryQuery('');
  };

  // Group popular categories by type
  const groupedCategories = useMemo(() => {
    const groups: Record<string, GBPCategory[]> = {
      'Food & Beverage': [],
      'General Retail': [],
      'Health & Beauty': [],
      'Specialty Stores': [],
      'Other': [],
    };

    popularCategories.forEach(cat => {
      const name = cat.name.toLowerCase();
      if (name.includes('grocery') || name.includes('convenience') || name.includes('supermarket') || name.includes('liquor') || name.includes('food')) {
        groups['Food & Beverage'].push(cat);
      } else if (name.includes('clothing') || name.includes('shoe') || name.includes('electronics') || name.includes('furniture') || name.includes('hardware')) {
        groups['General Retail'].push(cat);
      } else if (name.includes('pharmacy') || name.includes('beauty') || name.includes('cosmetics') || name.includes('health')) {
        groups['Health & Beauty'].push(cat);
      } else if (name.includes('book') || name.includes('pet') || name.includes('toy') || name.includes('sporting') || name.includes('gift')) {
        groups['Specialty Stores'].push(cat);
      } else {
        groups['Other'].push(cat);
      }
    });

    return groups;
  }, [popularCategories]);

  // Check if category is already selected
  const isCategorySelected = (categoryId: string) => {
    return primary?.id === categoryId || secondary.some(s => s.id === categoryId);
  };

  return (
    <div className="space-y-6">
      {/* Primary Category Section */}
      <div className="relative">
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
              {primary.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearPrimary}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {primaryUseSearch ? (
              <div className="relative">
                <input
                  type="text"
                  value={primaryQuery}
                  onChange={(e) => {
                    setPrimaryQuery(e.target.value);
                    setShowPrimaryResults(true);
                  }}
                  onFocus={() => setShowPrimaryResults(true)}
                  placeholder="Search for your primary business category..."
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                />
                {showPrimaryResults && (primaryResults.length > 0 || primaryLoading) && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                    {primaryLoading && (
                      <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Searching...
                      </div>
                    )}
                    {primaryResults.map((category) => {
                      const isSelected = isCategorySelected(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => !isSelected && handleSelectPrimary(category)}
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
                                {category.name}
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                {category.path.join(' > ')}
                              </div>
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
                  const selected = popularCategories.find(cat => cat.id === e.target.value);
                  if (selected) {
                    handleSelectPrimary(selected);
                  }
                }}
                disabled={disabled || loadingPopular}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select primary category...</option>
                {Object.entries(groupedCategories).map(([groupName, categories]) => {
                  if (categories.length === 0) return null;
                  return (
                    <optgroup key={groupName} label={groupName}>
                      {categories.map((cat) => (
                        <option 
                          key={cat.id} 
                          value={cat.id}
                          disabled={isCategorySelected(cat.id)}
                        >
                          {cat.name} {isCategorySelected(cat.id) ? '(Selected)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            )}
          </>
        )}

        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Your main business category (required for Google Business Profile)
        </p>
      </div>

      {/* Secondary Categories Section */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Secondary Categories
            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
              ({secondary.length}/{MAX_SECONDARY_CATEGORIES})
            </span>
          </label>
        </div>

        {/* Selected Secondary Categories */}
        {secondary.length > 0 && (
          <div className="space-y-2 mb-3">
            {secondary.map((cat, index) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 p-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg group"
              >
                <GripVertical className="w-4 h-4 text-neutral-400 flex-shrink-0 cursor-move" />
                <span className="flex-1 text-sm text-neutral-900 dark:text-neutral-100">
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

        {/* Add Secondary Category - Dropdown with Search Fallback */}
        {secondary.length < MAX_SECONDARY_CATEGORIES && (
          showSecondaryInput ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Add secondary category:</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSecondaryInput(false);
                    setSecondaryQuery('');
                    setShowSecondaryResults(false);
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
              <select
                value=""
                onChange={(e) => {
                  const selected = popularCategories.find(cat => cat.id === e.target.value);
                  if (selected) {
                    handleSelectSecondary(selected);
                  }
                }}
                disabled={disabled || loadingPopular}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Select from popular categories...</option>
                {Object.entries(groupedCategories).map(([groupName, categories]) => {
                  if (categories.length === 0) return null;
                  return (
                    <optgroup key={groupName} label={groupName}>
                      {categories.map((cat) => (
                        <option 
                          key={cat.id} 
                          value={cat.id}
                          disabled={isCategorySelected(cat.id)}
                        >
                          {cat.name} {isCategorySelected(cat.id) ? '(Selected)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              <div className="relative">
                <input
                  type="text"
                  value={secondaryQuery}
                  onChange={(e) => {
                    setSecondaryQuery(e.target.value);
                    setShowSecondaryResults(true);
                  }}
                  onFocus={() => setShowSecondaryResults(true)}
                  placeholder="Or search for other categories..."
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {showSecondaryResults && (secondaryResults.length > 0 || secondaryLoading) && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                    {secondaryLoading && (
                      <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
                        Searching...
                      </div>
                    )}
                    {secondaryResults.map((category) => {
                      const isSelected = isCategorySelected(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => !isSelected && handleSelectSecondary(category)}
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
                                {category.name}
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                {category.path.join(' > ')}
                              </div>
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
          Additional categories that describe your business (optional, up to 9)
        </p>
      </div>


      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>💡 Tip:</strong> Choose categories that best describe your business. Your primary category is most important for Google search results.
        </p>
      </div>
    </div>
  );
}
