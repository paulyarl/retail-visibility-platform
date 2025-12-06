'use client';

import { useState, useEffect, useMemo } from 'react';
import CategorySelectorMulti, { CategoryOption } from '@/components/shared/CategorySelectorMulti';
import { api } from '@/lib/api';

interface SelectedCategory {
  id: string;
  name: string;
}

interface GBPCategorySelectorAdapterProps {
  tenantId: string;
  primary?: SelectedCategory | null;
  secondary?: SelectedCategory[];
  onPrimaryChange: (category: SelectedCategory | null) => void;
  onSecondaryChange: (categories: SelectedCategory[]) => void;
  disabled?: boolean;
}

interface GBPCategory {
  id: string;
  name: string;
  path: string[];
}

export default function GBPCategorySelectorAdapter({
  tenantId,
  primary,
  secondary = [],
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
}: GBPCategorySelectorAdapterProps) {
  const [popularCategories, setPopularCategories] = useState<CategoryOption[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // Load popular categories on mount
  useEffect(() => {
    async function loadPopularCategories() {
      try {
        setLoadingPopular(true);
        const response = await api.get(`/api/gbp/categories/popular?tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok) {
          const data = await response.json();
          const items = (data.items || []) as GBPCategory[];
          setPopularCategories(items.map(cat => ({
            id: cat.id,
            name: cat.name,
            path: cat.path,
          })));
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Failed to load popular categories:', error);
      } finally {
        setLoadingPopular(false);
      }
    }
    loadPopularCategories();
  }, [tenantId]);

  // Group popular categories by type
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CategoryOption[]> = {
      'Food & Beverage': [],
      'General Retail': [],
      'Health & Beauty': [],
      'Specialty Stores': [],
      'Other': [],
    };

    popularCategories.forEach(cat => {
      const name = cat.name.toLowerCase();
      if (name.includes('grocery') || name.includes('convenience') || name.includes('supermarket') || name.includes('liquor') || name.includes('food')) {
        groups['Food & Beverage'].push(cat);
      } else if (name.includes('clothing') || name.includes('shoe') || name.includes('electronics') || name.includes('furniture') || name.includes('hardware')) {
        groups['General Retail'].push(cat);
      } else if (name.includes('pharmacy') || name.includes('beauty') || name.includes('cosmetics') || name.includes('health')) {
        groups['Health & Beauty'].push(cat);
      } else if (name.includes('book') || name.includes('pet') || name.includes('toy') || name.includes('sporting') || name.includes('gift')) {
        groups['Specialty Stores'].push(cat);
      } else {
        groups['Other'].push(cat);
      }
    });

    return groups;
  }, [popularCategories]);

  // Search function for GBP categories
  const handleSearch = async (query: string): Promise<CategoryOption[]> => {
    try {
      const response = await api.get(`/api/gbp/categories?query=${encodeURIComponent(query)}&limit=10&tenantId=${encodeURIComponent(tenantId)}`);
      if (response.ok) {
        const data = await response.json();
        const items = (data.items || []) as GBPCategory[];
        return items.map(cat => ({
          id: cat.id,
          name: cat.name,
          path: cat.path,
        }));
      }
    } catch (error) {
      console.error('[GBPCategorySelector] Search error:', error);
    }
    return [];
  };

  // Convert between CategoryOption and SelectedCategory
  const primaryOption: CategoryOption | null = primary ? {
    id: primary.id,
    name: primary.name,
  } : null;

  const secondaryOptions: CategoryOption[] = secondary.map(s => ({
    id: s.id,
    name: s.name,
  }));

  const handlePrimaryChangeAdapter = (category: CategoryOption | null) => {
    onPrimaryChange(category ? { id: category.id, name: category.name } : null);
  };

  const handleSecondaryChangeAdapter = (categories: CategoryOption[]) => {
    onSecondaryChange(categories.map(c => ({ id: c.id, name: c.name })));
  };

  return (
    <CategorySelectorMulti
      primary={primaryOption}
      secondary={secondaryOptions}
      onPrimaryChange={handlePrimaryChangeAdapter}
      onSecondaryChange={handleSecondaryChangeAdapter}
      categories={popularCategories}
      loading={loadingPopular}
      onSearch={handleSearch}
      searchPlaceholder="Search for your primary business category..."
      primaryLabel="Primary Category"
      secondaryLabel="Secondary Categories"
      primaryHelpText="Your main business category (required for Google Business Profile)"
      secondaryHelpText="Additional categories that describe your business (optional, up to 9)"
      tipText="Choose categories that best describe your business. Your primary category is most important for Google search results."
      disabled={disabled}
      maxSecondaryCategories={9}
      showGroupedDropdown={true}
      categoryGroups={categoryGroups}
    />
  );
}
