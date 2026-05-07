'use client';

import { useState, useEffect } from 'react';
import { categoriesService } from '@/services/CategoriesSingletonService';

export interface DirectoryCategory {
  name: string;
  slug: string;
  count?: number;
}

export interface DirectoryCategoriesHook {
  categories: DirectoryCategory[];
  loading: boolean;
  error: string | null;
}

export function useDirectoryCategories(): DirectoryCategoriesHook {
  const [categories, setCategories] = useState<DirectoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the singleton service instead of direct fetch to leverage caching
        const categoriesData = await categoriesService.getCategories(false); // Don't include children for directory listing

        // Map to expected format
        const mappedCategories = categoriesData.map((cat: any) => ({
          name: cat.name || '',
          slug: cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-') || '',
          count: cat.storeCount || cat.productCount || 0,
        }));

        setCategories(mappedCategories);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    error,
  };
}
