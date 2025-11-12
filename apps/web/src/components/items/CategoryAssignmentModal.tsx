import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Item } from '@/services/itemsDataService';

interface GoogleCategory {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
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
  const [selectedCategory, setSelectedCategory] = useState<GoogleCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleCategory[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const timer = setTimeout(() => {
      searchGoogleCategories(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Mock categories - in real implementation, fetch from API
  const mockCategories = [
    { 
      id: '1', 
      name: 'Electronics', 
      children: [
        { id: '1-1', name: 'Phones' },
        { id: '1-2', name: 'Laptops' },
        { id: '1-3', name: 'Tablets' }
      ]
    },
    { 
      id: '2', 
      name: 'Clothing', 
      children: [
        { id: '2-1', name: 'Shirts' },
        { id: '2-2', name: 'Pants' },
        { id: '2-3', name: 'Shoes' }
      ]
    },
    { 
      id: '3', 
      name: 'Home & Garden', 
      children: [
        { id: '3-1', name: 'Furniture' },
        { id: '3-2', name: 'Decor' },
        { id: '3-3', name: 'Tools' }
      ]
    },
  ];

  const handleSave = async () => {
    if (!selectedCategory) return;

    setSaving(true);
    setError(null);

    try {
      await onSave(item.id, selectedCategory.id, selectedCategory.name);
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

          {/* Search Input */}
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
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-600 last:border-b-0 ${
                        selectedCategory?.id === category.id
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

          {/* Selected Category Display */}
          {selectedCategory && (
            <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg">
              <div className="text-xs text-primary-600 dark:text-primary-400 mb-1">Selected Category:</div>
              <div className="text-sm font-medium text-primary-900 dark:text-primary-100">
                {selectedCategory.name}
              </div>
              <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                {selectedCategory.fullPath}
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
            disabled={!selectedCategory || saving}
            loading={saving}
          >
            {saving ? 'Assigning...' : 'Assign Category'}
          </Button>
        </div>
      </div>
    </div>
  );
}
