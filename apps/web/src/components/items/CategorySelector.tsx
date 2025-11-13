"use client";

import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';

interface CategorySelectorProps {
  currentCategory: string[];
  onCategorySelect: (category: string[]) => void;
  onCancel: () => void;
}

interface CategoryOption {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
  children?: CategoryOption[];
}

export default function CategorySelector({
  currentCategory,
  onCategorySelect,
  onCancel,
}: CategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string[]>(currentCategory);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [browsePath, setBrowsePath] = useState<string[]>([]); // Track current browse path

  // Load initial categories
  useEffect(() => {
    loadCategories();
  }, []);

  // Filter categories based on search or browse path
  useEffect(() => {
    if (searchMode) {
      if (searchQuery.trim()) {
        searchCategories(searchQuery);
      } else {
        setFilteredCategories([]);
      }
    } else {
      // Browse mode: show categories at current path level
      if (browsePath.length === 0) {
        // Show top-level categories
        setFilteredCategories(categories);
      } else {
        // Show children of current path
        const currentPathStr = browsePath.join(' > ');
        const children = categories.filter(cat => 
          cat.fullPath.startsWith(currentPathStr + ' > ') && 
          cat.path.length === browsePath.length + 1
        );
        setFilteredCategories(children);
      }
    }
  }, [searchQuery, categories, searchMode, browsePath]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('api/google/taxonomy/browse');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.categories) {
          setCategories(data.categories);
          setFilteredCategories(data.categories);
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCategories = async (query: string) => {
    if (!query.trim()) {
      setFilteredCategories([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`api/google/taxonomy/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.categories) {
          setFilteredCategories(data.categories);
        } else {
          setFilteredCategories([]);
        }
      }
    } catch (error) {
      console.error('Failed to search categories:', error);
      setFilteredCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (newMode: boolean) => {
    setSearchMode(newMode);
    setSearchQuery('');
    setBrowsePath([]);
    if (!newMode) {
      // Switching to browse mode
      setFilteredCategories(categories);
    } else {
      // Switching to search mode
      setFilteredCategories([]);
    }
  };

  const handleCategoryClick = (category: CategoryOption) => {
    if (searchMode) {
      // In search mode, directly select the category
      setSelectedCategory(category.path);
    } else {
      // In browse mode, navigate deeper or select if it's a leaf node
      if (category.children && category.children.length > 0) {
        // Navigate to children
        setBrowsePath(category.path);
      } else {
        // Select this category
        setSelectedCategory(category.path);
      }
    }
  };

  const handleBackNavigation = () => {
    if (browsePath.length > 0) {
      setBrowsePath(browsePath.slice(0, -1));
    }
  };

  const handleConfirmSelection = () => {
    onCategorySelect(selectedCategory);
  };

  const handleClearSelection = () => {
    setSelectedCategory([]);
  };

  return (
    <div className="space-y-4">
      {/* Search Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={!searchMode ? "primary" : "secondary"}
          size="sm"
          onClick={() => handleModeSwitch(false)}
        >
          Browse
        </Button>
        <Button
          type="button"
          variant={searchMode ? "primary" : "secondary"}
          size="sm"
          onClick={() => handleModeSwitch(true)}
        >
          Search
        </Button>
      </div>

      {/* Browse Path Breadcrumb */}
      {!searchMode && browsePath.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <button
            type="button"
            onClick={() => setBrowsePath([])}
            className="hover:text-primary-600 font-medium"
          >
            All Categories
          </button>
          {browsePath.map((segment, index) => (
            <span key={index} className="flex items-center">
              <span className="mx-2">›</span>
              {index === browsePath.length - 1 ? (
                <span className="font-medium text-neutral-900 dark:text-white">{segment}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setBrowsePath(browsePath.slice(0, index + 1))}
                  className="hover:text-primary-600"
                >
                  {segment}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      {searchMode && (
        <Input
          placeholder="Search categories (e.g., 'electronics', 'clothing')"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      )}

      {/* Selected Category Display */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
          Selected Category
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {selectedCategory.length > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium rounded border">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {selectedCategory.join(' › ')}
            </span>
          ) : (
            <span className="text-blue-600 dark:text-blue-400 italic">No category selected</span>
          )}
        </p>
      </div>

      {/* Category List */}
      <div className="max-h-64 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
        {loading ? (
          <div className="p-4 text-center text-neutral-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mb-2" />
            <p className="text-sm">Loading categories...</p>
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className={`w-full p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors ${
                  JSON.stringify(selectedCategory) === JSON.stringify(category.path)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {category.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {category.fullPath}
                    </p>
                  </div>
                  {category.children && category.children.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-neutral-400 ml-2">
                      <span>+{category.children.length} subcategories</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-neutral-500">
            <p className="text-sm">
              {searchMode 
                ? (searchQuery ? 'No categories found matching your search.' : 'Start typing to search categories...')
                : 'No categories available.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClearSelection}
          disabled={selectedCategory.length === 0}
        >
          Clear Selection
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleConfirmSelection}
        >
          Confirm Selection
        </Button>
      </div>
    </div>
  );
}
