'use client';

import { useMemo, useCallback } from 'react';
import CategorySelectorMulti, { CategoryOption } from '@/components/shared/CategorySelectorMulti';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';

interface DirectoryCategorySelectorAdapterProps {
  primary: string;
  secondary: string[];
  onPrimaryChange: (category: string) => void;
  onSecondaryChange: (categories: string[]) => void;
  disabled?: boolean;
}

export default function DirectoryCategorySelectorAdapter({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
}: DirectoryCategorySelectorAdapterProps) {
  console.log('[DirectoryCategorySelectorAdapter] Re-rendering', { primary, secondary: secondary.length });

  const { categories, loading, error } = useDirectoryCategories();

  // Memoize category options to prevent recreation on every render
  const categoryOptions: CategoryOption[] = useMemo(() =>
    categories.map(cat => ({
      id: cat.slug, // Use slug as ID for directory categories
      name: cat.name,
      slug: cat.slug,
    })), [categories]);

  // Memoize primary option to prevent recreation
  const primaryOption: CategoryOption | null = useMemo(() => {
    if (!primary) return null;
    const found = categories.find(c => c.name === primary);
    return {
      id: found?.slug || primary,
      name: primary,
    };
  }, [primary, categories]);

  // Memoize secondary options to prevent recreation
  const secondaryOptions: CategoryOption[] = useMemo(() =>
    secondary.map(name => {
      const found = categories.find(c => c.name === name);
      return {
        id: found?.slug || name,
        name: name,
      };
    }), [secondary, categories]);

  // Memoize event handlers to prevent recreation
  const handlePrimaryChangeAdapter = useCallback((category: CategoryOption | null) => {
    onPrimaryChange(category?.name || '');
  }, [onPrimaryChange]);

  const handleSecondaryChangeAdapter = useCallback((categories: CategoryOption[]) => {
    onSecondaryChange(categories.map(c => c.name));
  }, [onSecondaryChange]);

  // Memoize search function to prevent recreation
  const handleSearch = useCallback(async (query: string): Promise<CategoryOption[]> => {
    try {
      const response = await fetch(`/api/directory/categories/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      if (data.success && data.data.categories) {
        // Convert search results to CategoryOption format
        return data.data.categories.map((cat: any) => ({
          id: cat.slug,
          name: cat.name,
          slug: cat.slug,
        }));
      }
      return [];
    } catch (error) {
      console.error('Directory category search error:', error);
      return [];
    }
  }, []);

  return (
    <CategorySelectorMulti
      primary={primaryOption}
      secondary={secondaryOptions}
      onPrimaryChange={handlePrimaryChangeAdapter}
      onSecondaryChange={handleSecondaryChangeAdapter}
      categories={categoryOptions}
      loading={loading}
      onSearch={handleSearch}
      searchPlaceholder="Search for categories..."
      primaryLabel="Primary Category"
      secondaryLabel="Secondary Categories"
      primaryHelpText="Your main business category (required for directory listing)"
      secondaryHelpText="Additional categories that describe your business (optional, up to 9)"
      tipText="Choose categories that best describe your business. Your primary category is most important for directory search results."
      disabled={disabled}
      maxSecondaryCategories={9}
      showGroupedDropdown={false}
    />
  );
}
