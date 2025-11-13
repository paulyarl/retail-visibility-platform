import { useState } from 'react';
import { Item } from '@/services/itemsDataService';
import CategorySelector from './CategorySelector';

interface CategoryAssignmentModalProps {
  item: Item;
  onSave: (itemId: string, categoryId: string, categoryPath: string[]) => Promise<void>;
  onClose: () => void;
}

/**
 * Modal for assigning categories to items
 * Uses CategorySelector for consistent category selection experience
 */
export default function CategoryAssignmentModal({
  item,
  onSave,
  onClose,
}: CategoryAssignmentModalProps) {
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string[]>([]);

  const handleCategorySelect = (categoryPath: string[]) => {
    setSelectedCategoryPath(categoryPath);
  };

  const handleSave = async () => {
    if (selectedCategoryPath.length === 0) return;

    try {
      // Find the selected category details to get the ID
      // For now, we'll use a placeholder ID since the CategorySelector
      // doesn't provide the category ID directly
      const categoryId = selectedCategoryPath[selectedCategoryPath.length - 1] || 'unknown';

      await onSave(item.id, categoryId, selectedCategoryPath);
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="mb-4">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Item: {item.name}
            </div>
            <div className="text-xs text-neutral-500">
              SKU: {item.sku}
            </div>
          </div>

          <CategorySelector
            currentCategory={item.categoryPath || []}
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
            disabled={selectedCategoryPath.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Assign Category
          </button>
        </div>
      </div>
    </div>
  );
}
