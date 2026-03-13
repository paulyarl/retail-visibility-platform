"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input } from '@/components/ui';
import { googleTaxonomyService, type GoogleTaxonomyCategory } from '@/services/GoogleTaxonomyService';

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
  hasChildren?: boolean;
  children?: CategoryOption[];
}

// Helper function to map GoogleTaxonomyCategory to CategoryOption
const mapToCategoryOption = (googleCategory: GoogleTaxonomyCategory): CategoryOption => ({
  id: googleCategory.id,
  name: googleCategory.name,
  path: googleCategory.path,
  fullPath: googleCategory.path.join(' > '),
  hasChildren: (googleCategory as any).hasChildren || false
});



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
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial categories
  useEffect(() => {
    loadCategories();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((query: string) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      if (query.trim()) {
        searchCategories(query);
      } else {
        setFilteredCategories([]);
      }
    }, 300); // 300ms debounce delay

    searchTimeoutRef.current = timeout;
  }, []); // Empty dependency array - no dependencies needed

  // Filter categories based on search or browse path
  useEffect(() => {
    if (searchMode) {
      debouncedSearch(searchQuery);
    } else {
      // Browse mode: show categories at current path level
      if (browsePath.length === 0) {
        // Show top-level categories
        setFilteredCategories(categories);
      } else {
        // Need to fetch children for the current path
        fetchChildrenForPath(browsePath);
      }
    }
  }, [searchQuery, categories, searchMode, browsePath, debouncedSearch]);

  const fetchChildrenForPath = async (path: string[]) => {
    try {
      setLoading(true);
      const fullPath = path.join(' > ');
      const googleCategories = await googleTaxonomyService.browseGoogleTaxonomy(fullPath);
      
      if (googleCategories) {
        const childCategories = googleCategories.map(mapToCategoryOption);
        setFilteredCategories(childCategories);
      } else {
        setFilteredCategories([]);
      }
    } catch (error) {
      console.error('[CategorySelector] Failed to fetch children:', error);
      setFilteredCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const googleCategories = await googleTaxonomyService.browseGoogleTaxonomy();
      
      if (googleCategories) {
        const categories = googleCategories.map(mapToCategoryOption);
        setCategories(categories);
        setFilteredCategories(categories);
      }
    } catch (error) {
      console.error('[CategorySelector] Failed to load categories:', error);
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
      const googleCategories = await googleTaxonomyService.searchGoogleTaxonomy(query, 50);
      
      if (googleCategories) {
        const categories = googleCategories.map(mapToCategoryOption);
        setFilteredCategories(categories);
      } else {
        setFilteredCategories([]);
      }
    } catch (error) {
      console.error('[CategorySelector] Failed to search categories:', error);
      setFilteredCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSwitch = (newMode: boolean) => {
    // Clear any pending search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    
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

  const handleCategoryClick = (category: CategoryOption, event?: React.MouseEvent) => {
    if (searchMode) {
      // In search mode, directly select the category
      setSelectedCategory(category.path);
    } else {
      // In browse mode, check if this is a selection or navigation
      const isAlreadySelected = JSON.stringify(selectedCategory) === JSON.stringify(category.path);
      
      if (isAlreadySelected) {
        // If already selected, clicking again navigates into children (if any)
        if (category.hasChildren) {
          setBrowsePath(category.path);
        }
      } else {
        // First click selects the category
        setSelectedCategory(category.path);
      }
    }
  };

  const handleChevronClick = (category: CategoryOption) => {
    if (category.hasChildren) {
      setBrowsePath(category.path);
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
    <div className="flex flex-col h-full">
      {/* Search Toggle */}
      <div className="flex gap-2 mb-4">
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
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
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
          className="w-full mb-4"
        />
      )}

      {/* Selected Category Display */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
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

      {/* Category List - Flex grow to fill available space */}
      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg mb-4 min-h-0">
        {loading ? (
          <div className="p-4 text-center text-neutral-500">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mb-2" />
            <p className="text-sm">Loading categories...</p>
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {filteredCategories.map((category) => {
              const isSelected = JSON.stringify(selectedCategory) === JSON.stringify(category.path);
              const hasChildren = category.hasChildren;
              
              return (
                <div
                  key={category.id}
                  className={`flex items-stretch ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(category)}
                    className="flex-1 p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                          {category.name}
                          {hasChildren && (
                            <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {category.fullPath}
                        </p>
                      </div>
                      {hasChildren && (
                        <div className="flex items-center gap-1 text-xs text-blue-500 ml-2">
                          <span>Click to browse</span>
                        </div>
                      )}
                    </div>
                  </button>
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => handleChevronClick(category)}
                      className="px-3 border-l border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center"
                      title="Browse subcategories"
                    >
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
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

      {/* Action Buttons - Sticky at bottom */}
      <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 sticky bottom-0">
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
          disabled={selectedCategory.length === 0}
        >
          Confirm Selection
        </Button>
      </div>
    </div>
  );
}
