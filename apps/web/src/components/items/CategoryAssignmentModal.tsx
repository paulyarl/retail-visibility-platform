import { useState } from 'react';
import { Item } from '@/services/itemsDataService';
import TenantCategorySelector from './TenantCategorySelector';
import { apiRequest } from '@/lib/api';

interface CategoryAssignmentModalProps {
  item: Item;
  onSave: (itemId: string, categoryId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for assigning tenant categories to items
 * Shows the tenant's custom categories, not Google taxonomy
 */
export default function CategoryAssignmentModal({
  item,
  onSave,
  onClose,
}: CategoryAssignmentModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(item.tenantCategoryId || '');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleCategorySelect = async (categoryId: string, googleCategoryPath?: string, googleTaxonomyId?: string) => {
    // If it's a Google taxonomy selection, create a tenant category first
    if (googleCategoryPath && googleTaxonomyId) {
      try {
        setIsCreatingCategory(true);

        // Extract tenant ID from URL
        const tenantId = window.location.pathname.match(/\/t\/([^/]+)/)?.[1];
        if (!tenantId) throw new Error('Could not extract tenant ID');

        // Get the category name (last part of path)
        const categoryName = googleCategoryPath.split(' > ').pop() || 'Unknown Category';

        console.log('[CategoryAssignment] Creating category from Google taxonomy:', {
          googleCategoryPath,
          googleTaxonomyId,
          categoryName
        });

        // Create category with Google taxonomy ID
        const createResponse = await apiRequest(`/api/v1/tenants/${tenantId}/categories/from-enrichment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: categoryName,
            googleCategoryId: googleTaxonomyId,
          }),
        });

        if (createResponse.ok) {
          const createResult = await createResponse.json();
          console.log('[CategoryAssignment] Category created successfully:', createResult);
          setSelectedCategoryId(createResult.data.id);
        } else {
          const errorText = await createResponse.text();
          console.error('[CategoryAssignment] Category creation failed:', {
            status: createResponse.status,
            statusText: createResponse.statusText,
            errorText
          });
          // Fallback: just set the category ID (though it won't work)
          setSelectedCategoryId(categoryId);
        }
      } catch (error) {
        console.error('[CategoryAssignment] Error creating category from Google taxonomy:', error);
        // Fallback: just set the category ID
        setSelectedCategoryId(categoryId);
      } finally {
        setIsCreatingCategory(false);
      }
    } else {
      // Regular tenant category selection
      setSelectedCategoryId(categoryId);
    }
  };

  const handleSave = async () => {
    if (!selectedCategoryId) return;

    try {
      await onSave(item.id, selectedCategoryId);
      onClose();
    } catch (error) {
      console.error('Failed to save category:', error);
      // Error will be handled by the parent component
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

          <TenantCategorySelector
            selectedCategoryId={selectedCategoryId}
            onSelect={handleCategorySelect}
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
