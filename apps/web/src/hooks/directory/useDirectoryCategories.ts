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

        const data = await response.json();
        setCategories(data.categories || []);
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
