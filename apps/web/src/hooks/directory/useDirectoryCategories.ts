'use client';

import { useState, useEffect } from 'react';

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

        const response = await fetch('/api/directory/categories');

        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }

        const result = await response.json();
        
        // Handle different response formats
        // New format: { success: true, data: { categories: [...] } }
        // Old format: { categories: [...] }
        const categoriesData = result.success 
          ? (result.data?.categories || [])
          : (result.categories || []);
        
        // Map to expected format if needed
        const mappedCategories = categoriesData.map((cat: any) => ({
          name: cat.name || '',
          slug: cat.slug || cat.name?.toLowerCase().replace(/\s+/g, '-') || '',
          count: cat.storeCount || cat.count || 0,
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
