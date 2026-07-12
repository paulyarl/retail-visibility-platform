'use client';

import { useState, useEffect } from 'react';
import { useCategorySingleton } from '@/providers/data/CategorySingleton';

export default function CategoryNameDisplay({ categoryId }: { categoryId: string }) {
  const [categoryName, setCategoryName] = useState<string>('Loading...');
  const [fullCategoryPath, setFullCategoryPath] = useState<string>('');
  const { state, actions } = useCategorySingleton();

  useEffect(() => {
    async function loadCategoryName() {
      if (!categoryId) {
        setCategoryName('No category');
        return;
      }

      if (state.categories.length > 0) {
        const category = actions.getCategoryById(categoryId);
        if (category) {
          setCategoryName(category.name);
          return;
        }
      } else {
        try {
          await actions.fetchCategories({
            includeChildren: true,
            includeProductCount: false,
          });
          const category = actions.getCategoryById(categoryId);
          if (category) {
            setCategoryName(category.name);
            return;
          }
        } catch {
          // fall through to google taxonomy
        }
      }

      try {
        const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
        const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(categoryId);
        if (data && data.path && Array.isArray(data.path)) {
          const pathString = data.path.join(' > ');
          setCategoryName(data.path[data.path.length - 1]);
          setFullCategoryPath(pathString);
          return;
        }
      } catch {
        // fall through
      }

      setCategoryName('Unknown category');
    }

    loadCategoryName();
  }, [categoryId, state.categories.length]);

  return (
    <div className="space-y-1">
      <div className="font-medium">{categoryName}</div>
      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">ID: {categoryId}</div>
      {fullCategoryPath && categoryName !== 'Unknown category' && categoryName !== 'Loading...' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          Path: {fullCategoryPath}
        </div>
      )}
    </div>
  );
}
