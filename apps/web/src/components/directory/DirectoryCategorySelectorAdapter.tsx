'use client';

import { useMemo, useCallback, useEffect, useState } from 'react';
import CategorySelectorMulti, { CategoryOption } from '@/components/shared/CategorySelectorMulti';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';
import { recommendationsService } from '@/services/RecommendationsSingletonService';
import { clientLogger } from '@/lib/client-logger';

interface DirectoryCategorySelectorAdapterProps {
  primary: string;
  secondary: string[];
  onPrimaryChange: (category: string) => void;
  onSecondaryChange: (categories: string[]) => void;
  disabled?: boolean;
  // Allow operators to create categories not in the platform vocab. The 414
  // directory categories are a starter list; every category-consuming surface
  // (seed create/edit, directory options, campaign form, claim editor) is a
  // discovery surface that may need to introduce a new category. Default
  // true — opt out with allowCreateNew={false} if a surface should be
  // restricted to the existing vocab.
  allowCreateNew?: boolean;
}

export default function DirectoryCategorySelectorAdapter({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
  allowCreateNew = true,
}: DirectoryCategorySelectorAdapterProps) {
  const { categories, loading, error } = useDirectoryCategories();

  // Registered category vocab (mkt_service_categories_list). The category-
  // identification act flow registers new labels there, but this dropdown
  // reads platform_categories — merge both so a registered label is
  // selectable. The service-categories endpoint is admin-authed, so on
  // public surfaces (claim editor) the fetch fails and the selector
  // silently falls back to the directory vocab alone.
  const [vocabCategories, setVocabCategories] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const m = await import('@/services/MarketingOpsService');
        const rows = await m.default.getServiceCategories();
        if (!cancelled) setVocabCategories(rows ?? []);
        return;
      } catch { /* admin endpoint unreachable — fall through to public vocab */ }
      try {
        const m = await import('@/services/PlacesBrowsePublicService');
        const rows = await m.default.getCategoryVocab();
        if (!cancelled) setVocabCategories((rows ?? []).map(r => ({ value: r.value, label: r.label })));
      } catch { /* no vocab available — directory categories only */ }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Merge directory categories + registered vocab, deduped by normalized
  // name. Registered-only options use the label as id/slug so they match
  // the name-keyed primaryOption/secondaryOptions lookups below.
  const categoryOptions: CategoryOption[] = useMemo(() => {
    const merged: CategoryOption[] = categories.map(cat => ({
      id: cat.slug, // Use slug as ID for directory categories
      name: cat.name,
      slug: cat.slug,
    }));
    const seen = new Set(merged.map(c => c.name.trim().toLowerCase()));
    for (const row of vocabCategories) {
      const name = row.label?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      merged.push({ id: name, name, slug: name, path: ['Registered category'] });
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, vocabCategories]);

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

  // Memoize search function to prevent recreation. Remote search only sees
  // platform_categories — append matching registered-vocab labels it missed.
  const handleSearch = useCallback(async (query: string): Promise<CategoryOption[]> => {
    let remote: CategoryOption[] = [];
    try {
      const data = await recommendationsService.searchCategories(query);
      if (data?.success && data?.data?.categories) {
        // Convert search results to CategoryOption format
        remote = data.data.categories.map((cat: any) => ({
          id: cat.slug,
          name: cat.name,
          slug: cat.slug,
        }));
      }
    } catch (error) {
      clientLogger.error('Directory category search error:', { detail: error });
    }
    const q = query.trim().toLowerCase();
    const remoteNames = new Set(remote.map(c => c.name.trim().toLowerCase()));
    const local: CategoryOption[] = vocabCategories
      .map(r => r.label?.trim())
      .filter((n): n is string => !!n && n.toLowerCase().includes(q) && !remoteNames.has(n.toLowerCase()))
      .map(n => ({ id: n, name: n, slug: n, path: ['Registered category'] }));
    return [...remote, ...local];
  }, [vocabCategories]);

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
      allowCreateNew={allowCreateNew}
    />
  );
}
