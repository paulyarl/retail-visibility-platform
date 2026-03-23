import { useState } from 'react';
import { Item } from '@/services/itemsDataService';
import CategorySelector from './CategorySelector';
import { tenantCategoriesService } from '@/services/TenantCategoriesService';

interface CategoryAssignmentModalProps {
  item: Item;
  onSave: (itemId: string, categoryId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for assigning tenant categories to items
 * When a Google taxonomy category is selected, creates/finds a tenant category
 */
export default function CategoryAssignmentModal({
  item,
  onSave,
  onClose,
}: CategoryAssignmentModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(item.tenantCategoryId || '');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCategorySelect = async (category: { path: string[]; id: string; name: string }) => {
    try {
      setIsCreatingCategory(true);
      
      // Extract tenant ID from URL
      const tenantId = window.location.pathname.match(/\/t\/([^/]+)/)?.[1];
      if (!tenantId) throw new Error('Could not extract tenant ID');

      // The id is the Google taxonomy ID (e.g., "1239")
      const googleTaxonomyId = category.id;
      const categoryName = category.name;
      const categoryPath = category.path.join(' > ');
      
      console.log('[CategoryAssignmentModal] Selected Google category:', {
        googleTaxonomyId,
        categoryName,
        categoryPath
      });

      // First, check if a tenant category with this googleCategoryId already exists
      const existingCategories = await tenantCategoriesService.getTenantCategories(tenantId);
      const existingCategory = existingCategories.find(cat => 
        cat.googleCategoryId === googleTaxonomyId
      );

      if (existingCategory) {
        console.log('[CategoryAssignmentModal] Found existing tenant category:', existingCategory.id);
        setSelectedCategoryId(existingCategory.id);
        setSelectedCategoryName(existingCategory.name);
      } else {
        // Create a new tenant category with the Google taxonomy ID
        console.log('[CategoryAssignmentModal] Creating new tenant category for Google ID:', googleTaxonomyId);
        const newCategory = await tenantCategoriesService.createCategory(tenantId, {
          name: categoryName,
          googleCategoryId: googleTaxonomyId,
          sortOrder: 0,
        } as any);

        console.log('[CategoryAssignmentModal] createCategory response:', newCategory);
        if (newCategory && newCategory.id) {
          console.log('[CategoryAssignmentModal] Created tenant category:', newCategory.id);
          setSelectedCategoryId(newCategory.id);
          setSelectedCategoryName(newCategory.name);
        } else {
          console.error('[CategoryAssignmentModal] createCategory returned invalid response:', newCategory);
        }
      }
    } catch (err) {
      console.error('[CategoryAssignmentModal] Error handling category selection:', err);
      alert('Failed to assign category. Please try again.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCategoryId) return;

    try {
      await onSave(item.id, selectedCategoryId);
      onClose();
    } catch (err) {
      console.error('[CategoryAssignmentModal] Error saving category:', err);
      alert('Failed to save category assignment.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Assign Category
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Item: {item.name}
            </div>
            <div className="text-xs text-neutral-500">
              SKU: {item.sku}
            </div>
          </div>

          {/* Show selected category if one has been selected */}
          {selectedCategoryId && selectedCategoryName && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                Selected: {selectedCategoryName}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                ID: {selectedCategoryId}
              </div>
            </div>
          )}

          <CategorySelector
            currentCategory={[]}
            onCategorySelect={handleCategorySelect}
            onCancel={onClose}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCategoryId || isCreatingCategory}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreatingCategory ? 'Creating Category...' : 'Assign Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
