'use client';

import { useState, useEffect, useMemo } from 'react';
import CategorySelectorMulti, { CategoryOption } from '@/components/shared/CategorySelectorMulti';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';
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
  // Use the same hook as DirectoryCategorySelectorAdapter for robust category list
  const { categories: directoryCategories, loading: loadingDirectory } = useDirectoryCategories();
  
  // Also load GBP-specific popular categories for grouped dropdown
  const [gbpCategories, setGbpCategories] = useState<CategoryOption[]>([]);
  const [loadingGbp, setLoadingGbp] = useState(true);

  // Load GBP popular categories on mount
  useEffect(() => {
    async function loadGbpCategories() {
      try {
        setLoadingGbp(true);
        const response = await api.get(`/api/gbp/categories/popular?tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok) {
          const data = await response.json();
          const items = (data.items || []) as GBPCategory[];
          setGbpCategories(items.map(cat => ({
            id: cat.id,
            name: cat.name,
            path: cat.path,
          })));
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Failed to load GBP categories:', error);
      } finally {
        setLoadingGbp(false);
      }
    }
    loadGbpCategories();
  }, [tenantId]);

  // Merge directory categories with GBP categories for comprehensive list
  const allCategories = useMemo(() => {
    const categoryMap = new Map<string, CategoryOption>();
    
    // Add directory categories first (these are platform categories)
    directoryCategories.forEach(cat => {
      // Use slug as ID for consistency with directory
      const id = `gcid:${cat.slug}`;
      categoryMap.set(id, {
        id,
        name: cat.name,
        slug: cat.slug,
      });
    });
    
    // Add GBP categories (may have different IDs)
    gbpCategories.forEach(cat => {
      if (!categoryMap.has(cat.id)) {
        categoryMap.set(cat.id, cat);
      }
    });
    
    return Array.from(categoryMap.values());
  }, [directoryCategories, gbpCategories]);

  // Group categories by type for dropdown
  const categoryGroups = useMemo(() => {
    const groups: Record<string, CategoryOption[]> = {
      'Food & Beverage': [],
      'General Retail': [],
      'Health & Beauty': [],
      'Specialty Stores': [],
      'Other': [],
    };

    allCategories.forEach(cat => {
      const name = cat.name.toLowerCase();
      if (name.includes('grocery') || name.includes('convenience') || name.includes('supermarket') || name.includes('liquor') || name.includes('food') || name.includes('bakery') || name.includes('butcher') || name.includes('produce') || name.includes('wine')) {
        groups['Food & Beverage'].push(cat);
      } else if (name.includes('clothing') || name.includes('shoe') || name.includes('electronics') || name.includes('furniture') || name.includes('hardware') || name.includes('department') || name.includes('discount') || name.includes('variety') || name.includes('home goods')) {
        groups['General Retail'].push(cat);
      } else if (name.includes('pharmacy') || name.includes('beauty') || name.includes('cosmetics') || name.includes('health')) {
        groups['Health & Beauty'].push(cat);
      } else if (name.includes('book') || name.includes('pet') || name.includes('toy') || name.includes('sporting') || name.includes('gift') || name.includes('florist') || name.includes('jewelry')) {
        groups['Specialty Stores'].push(cat);
      } else {
        groups['Other'].push(cat);
      }
    });

    return groups;
  }, [allCategories]);

  // Search function for GBP categories - searches both local and API
  const handleSearch = async (query: string): Promise<CategoryOption[]> => {
    const lowerQuery = query.toLowerCase();
    
    // First, filter local categories
    const localResults = allCategories.filter(cat => 
      cat.name.toLowerCase().includes(lowerQuery)
    );
    
    // Then search API for additional results
    try {
      const response = await api.get(`/api/gbp/categories?query=${encodeURIComponent(query)}&limit=20&tenantId=${encodeURIComponent(tenantId)}`);
      if (response.ok) {
        const data = await response.json();
        const items = (data.items || []) as GBPCategory[];
        const apiResults = items.map(cat => ({
          id: cat.id,
          name: cat.name,
          path: cat.path,
        }));
        
        // Merge results, avoiding duplicates
        const resultMap = new Map<string, CategoryOption>();
        localResults.forEach(cat => resultMap.set(cat.id, cat));
        apiResults.forEach(cat => {
          if (!resultMap.has(cat.id)) {
            resultMap.set(cat.id, cat);
          }
        });
        
        return Array.from(resultMap.values()).slice(0, 20);
      }
    } catch (error) {
      console.error('[GBPCategorySelector] Search error:', error);
    }
    
    return localResults.slice(0, 20);
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

  const isLoading = loadingDirectory || loadingGbp;

  return (
    <CategorySelectorMulti
      primary={primaryOption}
      secondary={secondaryOptions}
      onPrimaryChange={handlePrimaryChangeAdapter}
      onSecondaryChange={handleSecondaryChangeAdapter}
      categories={allCategories}
      loading={isLoading}
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
