'use client';

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
  const { categories, loading, error } = useDirectoryCategories();

  // Convert directory categories to CategoryOption format
  const categoryOptions: CategoryOption[] = categories.map(cat => ({
    id: cat.slug, // Use slug as ID for directory categories
    name: cat.name,
    slug: cat.slug,
  }));

  // Convert between string names and CategoryOption
  const primaryOption: CategoryOption | null = primary ? {
    id: categories.find(c => c.name === primary)?.slug || primary,
    name: primary,
  } : null;

  const secondaryOptions: CategoryOption[] = secondary.map(name => ({
    id: categories.find(c => c.name === name)?.slug || name,
    name: name,
  }));

  const handlePrimaryChangeAdapter = (category: CategoryOption | null) => {
    onPrimaryChange(category?.name || '');
  };

  const handleSecondaryChangeAdapter = (categories: CategoryOption[]) => {
    onSecondaryChange(categories.map(c => c.name));
  };

  return (
    <CategorySelectorMulti
      primary={primaryOption}
      secondary={secondaryOptions}
      onPrimaryChange={handlePrimaryChangeAdapter}
      onSecondaryChange={handleSecondaryChangeAdapter}
      categories={categoryOptions}
      loading={loading}
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
