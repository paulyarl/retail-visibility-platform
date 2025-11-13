import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';

interface GoogleCategory {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
  children?: GoogleCategory[];
}

interface CategoryAssignmentModalProps {
  item: Item;
  onSave: (itemId: string, googleCategoryId: string, categoryName: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for assigning categories to items
 * Allows selection of category hierarchy
 */
export default function CategoryAssignmentModal({
  item,
  onSave,
  onClose,
}: CategoryAssignmentModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleCategory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useSearchMode, setUseSearchMode] = useState(false);
  const [googleCategories, setGoogleCategories] = useState<GoogleCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Load Google taxonomy categories on mount
  useEffect(() => {
    const loadGoogleCategories = async () => {
      try {
        // Load top-level categories first (level 1)
        const response = await fetch('/api/google/taxonomy/browse?level=1');
        if (response.ok) {
          const data = await response.json();
          setGoogleCategories(data.categories || []);
        } else {
          // Fallback to search for common categories
          const fallbackResponse = await fetch('/api/google/taxonomy/search?q=electronics&limit=50');
          if (fallbackResponse.ok) {
            const data = await fallbackResponse.json();
            // Group by top-level category
            const grouped = (data.categories || []).reduce((acc: any, cat: any) => {
              const topLevel = cat.path[0];
              if (!acc[topLevel]) {
                acc[topLevel] = { id: topLevel, name: topLevel, path: [topLevel], fullPath: topLevel, children: [] };
              }
              if (cat.path.length > 1) {
                acc[topLevel].children.push(cat);
              }
              return acc;
            }, {});
            setGoogleCategories(Object.values(grouped));
          }
        }
      } catch (error) {
        console.error('Error loading Google categories:', error);
        // Fallback to original mock categories
        setGoogleCategories([
          { id: '267', name: 'Mobile Phones', path: ['Electronics', 'Mobile Phones'], fullPath: 'Electronics > Mobile Phones' },
          { id: '5', name: 'Laptops', path: ['Electronics', 'Computers', 'Laptops'], fullPath: 'Electronics > Computers > Laptops' },
          { id: '2271', name: 'Pants', path: ['Apparel & Accessories', 'Clothing', 'Pants'], fullPath: 'Apparel & Accessories > Clothing > Pants' },
          { id: '187', name: 'Shoes', path: ['Apparel & Accessories', 'Shoes'], fullPath: 'Apparel & Accessories > Shoes' },
          { id: '1604', name: 'Furniture', path: ['Home & Garden', 'Furniture'], fullPath: 'Home & Garden > Furniture' },
        ]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadGoogleCategories();
  }, []);

  // Search Google taxonomy
  const searchGoogleCategories = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/google/taxonomy/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.categories || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching Google taxonomy:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!useSearchMode) return;
    
    const timer = setTimeout(() => {
      searchGoogleCategories(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, useSearchMode]);

  const handleSave = async () => {
    if (!selectedCategoryId) return;

    setSaving(true);
    setError(null);

    try {
      // Send the Google category ID as categorySlug
      await onSave(item.id, selectedCategoryId, 'Category');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Assign Google Category
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Item: {item.name}
            </div>
            <div className="text-xs text-neutral-500">
              SKU: {item.sku}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={() => {
                setUseSearchMode(false);
                setSelectedCategoryId('');
                setSearchQuery('');
              }}
              className={`px-3 py-1 text-sm rounded-md ${
                !useSearchMode
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
              }`}
            >
              Browse Categories
            </button>
            <button
              onClick={() => {
                setUseSearchMode(true);
                setSelectedCategoryId('');
                setSearchQuery('');
              }}
              className={`px-3 py-1 text-sm rounded-md ${
                useSearchMode
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
              }`}
            >
              Search Categories
            </button>
          </div>

          {useSearchMode ? (
            /* Search Mode */
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Search Google Product Categories
              </label>
              
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for categories (e.g., phones, clothing, electronics)"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white"
              />

              {/* Search Results */}
              {searchQuery && (
                <div className="max-h-60 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  {isSearching ? (
                    <div className="p-4 text-center text-neutral-500">
                      Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-600 last:border-b-0 ${
                          selectedCategoryId === category.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'
                            : ''
                        }`}
                      >
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {category.name}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {category.fullPath}
                        </div>
                      </button>
                    ))
                  ) : searchQuery.length > 2 ? (
                    <div className="p-4 text-center text-neutral-500">
                      No categories found
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            /* Browse Mode - Google Taxonomy Categories */
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Browse Google Product Categories
              </label>
              
              {loadingCategories ? (
                <div className="p-4 text-center text-neutral-500">
                  Loading categories...
                </div>
              ) : googleCategories.length > 0 ? (
                googleCategories.slice(0, 10).map((category) => (
                  <div key={category.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                    <button
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={`w-full text-left font-medium mb-2 ${
                        selectedCategoryId === category.id
                          ? 'text-primary-600'
                          : 'text-neutral-900 dark:text-white'
                      }`}
                    >
                      {category.name}
                    </button>
                    
                    {/* Show some subcategories if available */}
                    {selectedCategoryId === category.id && category.children && category.children.length > 0 && (
                      <div className="pl-4 space-y-1">
                        {category.children.slice(0, 5).map((child: any) => (
                          <button
                            key={child.id}
                            onClick={() => setSelectedCategoryId(child.id)}
                            className={`block w-full text-left text-sm py-1 ${
                              selectedCategoryId === child.id
                                ? 'text-primary-600 font-medium'
                                : 'text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            {child.name}
                          </button>
                        ))}
                        {category.children.length > 5 && (
                          <div className="text-xs text-neutral-400 mt-2">
                            +{category.children.length - 5} more categories...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-neutral-500">
                  No categories available
                </div>
              )}
            </div>
          )}

          {/* Selected Category Display */}
          {selectedCategoryId && (
            <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div className="text-xs text-neutral-500 mb-1">Selected:</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-white">
                {(() => {
                  if (useSearchMode) {
                    const selected = searchResults.find(cat => cat.id === selectedCategoryId);
                    return selected ? `${selected.name} (${selected.fullPath})` : `Category ID: ${selectedCategoryId}`;
                  } else {
                    // Browse mode - find in loaded Google categories
                    for (const category of googleCategories) {
                      if (category.id === selectedCategoryId) {
                        return category.name;
                      }
                      if (category.children) {
                        const child = category.children.find((c: any) => c.id === selectedCategoryId);
                        if (child) {
                          return `${child.name} (${child.fullPath})`;
                        }
                      }
                    }
                    return `Category ID: ${selectedCategoryId}`;
                  }
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!selectedCategoryId || saving}
            loading={saving}
          >
            {saving ? 'Assigning...' : 'Assign Category'}
          </Button>
        </div>
      </div>
    </div>
  );
}
