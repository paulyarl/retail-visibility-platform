import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { tenantCategoriesService } from '@/services/TenantCategoriesService';

interface TenantCategory {
  id: string;
  name: string;
  slug: string;
  googleCategoryId?: string | null;
  parentId?: string | null;
}

interface TenantCategorySelectorProps {
  selectedCategoryId?: string | null;
  categoryPath?: string[]; // From enrichment data
  onSelect: (categoryId: string, googleCategoryPath?: string, googleTaxonomyId?: string) => void; // Allow passing Google category info
  onCancel?: () => void;
}

/**
 * Reusable component for selecting tenant categories
 * Used in both Edit Item modal and Assign Category modal
 */
export default function TenantCategorySelector({
  selectedCategoryId,
  categoryPath,
  onSelect,
  onCancel,
}: TenantCategorySelectorProps) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [categories, setCategories] = useState<TenantCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedCategoryId || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch tenant categories via TenantCategoriesService
  useEffect(() => {
    async function fetchCategories() {
      try {
        const fetchedCategories = await tenantCategoriesService.getTenantCategories(tenantId);
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, [tenantId]);

  // Update local selection when prop changes
  useEffect(() => {
    setLocalSelectedId(selectedCategoryId || '');
  }, [selectedCategoryId]);

  
  // Filter categories based on search
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (categoryId: string) => {
    setLocalSelectedId(categoryId);
    
    // In tenant mode, just pass the category ID
    const selectedTenantCat = categories.find(cat => cat.id === categoryId);
    
    onSelect(categoryId);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Categories List */}
      {loading ? (
        <div className="text-center py-8 text-neutral-500">
          Loading categories...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          No categories match your search.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredCategories.map((category) => {
            const tenantCat = category as TenantCategory;
            const displayName = tenantCat.name;
            const categoryId = tenantCat.id;
            
            return (
              <button
                key={categoryId}
                onClick={() => handleSelect(categoryId)}
                type="button"
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                  localSelectedId === categoryId
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                      {displayName}
                    </div>
                    {tenantCat.googleCategoryId && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Google ID: <span className="font-mono">{tenantCat.googleCategoryId}</span>
                      </div>
                    )}
                  </div>
                  {localSelectedId === categoryId && (
                    <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Cancel button if provided */}
      {onCancel && (
        <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
