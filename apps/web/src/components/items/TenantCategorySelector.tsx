import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { tenantCategoriesService } from '@/services/TenantCategoriesService';


interface TenantCategory {
  id: string;
  name: string;
  slug: string;
  googleCategoryId?: string | null;
  parentId?: string | null;
}

interface TaxonomyResult {
  id: string;
  name: string;
  path: string[];
}

interface TenantCategorySelectorProps {
  selectedCategoryId?: string | null;
  categoryPath?: string[]; // From enrichment data
  onSelect: (categoryId: string, googleCategoryPath?: string, googleTaxonomyId?: string) => void; // Allow passing Google category info
  onCancel?: () => void;
  tenantId?: string;
}

/**
 * Reusable component for selecting tenant categories
 * Used in both Edit Item modal and Assign Category modal
 * Features:
 * - Select from tenant's existing categories
 * - Search Google taxonomy
 * - Recent categories
 * - Mapped only filter
 */
export default function TenantCategorySelector({
  selectedCategoryId,
  categoryPath,
  onSelect,
  onCancel,
  tenantId,
}: TenantCategorySelectorProps) {
  // console.log('[TenantCategorySelector] tenantId:', tenantId);
  
  const params = useParams();
  // console.log('[TenantCategorySelector] params:', params);
  const resolvedTenantId = tenantId || (params.tenantId as string);
  // console.log('[TenantCategorySelector] resolved tenantId:', resolvedTenantId);
  const [categories, setCategories] = useState<TenantCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedCategoryId || '');
  const [catSearch, setCatSearch] = useState('');
  const [mappedOnly, setMappedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [taxQuery, setTaxQuery] = useState('');
  const [taxResults, setTaxResults] = useState<TaxonomyResult[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [showGoogleTab, setShowGoogleTab] = useState(false);

  // Fetch tenant categories via TenantCategoriesService
  useEffect(() => {
    async function fetchCategories() {
      try {
        // console.log('[TenantCategorySelector] Fetching categories for tenant:', resolvedTenantId);
        const fetchedCategories = await tenantCategoriesService.getTenantCategories(resolvedTenantId);
        // console.log('[TenantCategorySelector] Fetched categories:', fetchedCategories.length);
        setCategories(fetchedCategories);
        setRecentIds(fetchedCategories.slice(0, 30).map(cat => cat.id));
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, [resolvedTenantId]);

  // Update local selection when prop changes
  useEffect(() => {
    setLocalSelectedId(selectedCategoryId || '');
  }, [selectedCategoryId]);

  // Load recent IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_category_ids');
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent category IDs:', error);
    }
  }, []);

  // Google taxonomy search with debounce
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      if (!taxQuery.trim()) {
        setTaxResults([]);
        return;
      }

      try {
        setTaxLoading(true);

        // First try to search in tenant categories
        const filteredCategories = categories.filter(cat =>
          cat.name.toLowerCase().includes(taxQuery.toLowerCase())
        );

        if (active) {
          setTaxResults(filteredCategories.map(cat => ({
            id: cat.id,
            name: cat.name,
            path: [cat.name]
          })).slice(0, 8));
        }
      } catch (err) {
        console.error('Error searching categories:', err);
      } finally {
        if (active) setTaxLoading(false);
      }
    }, 300);

    return () => { active = false };
  }, [taxQuery, categories]);

  // Filter tenant categories based on search
  const filteredCategories = categories.filter((cat) => {
    if (mappedOnly && !cat.googleCategoryId) return false;
    const q = catSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q)
    );
  });

  const handleSelect = (categoryId: string) => {
    setLocalSelectedId(categoryId);

    // Store in recent IDs
    const next = [categoryId, ...recentIds.filter((id) => id !== categoryId)].slice(0, 30);
    setRecentIds(next);
    localStorage.setItem('recent_category_ids', JSON.stringify(next));

    const selectedTenantCat = categories.find(cat => cat.id === categoryId);
    
    // For tenant categories, construct the path from the category hierarchy
    // For now, just pass the category name as the path (can be enhanced later)
    const categoryPath = selectedTenantCat ? selectedTenantCat.name : undefined;
    
    onSelect(categoryId, categoryPath, selectedTenantCat?.googleCategoryId || undefined);
  };

  const handleGoogleTaxonomySelect = (result: TaxonomyResult) => {
    // For Google taxonomy, we just display the path - user needs to create a tenant category
    setTaxQuery(result.path.join(' > '));
    setTaxResults([]);
    // Note: this doesn't auto-create a tenant category; user must pick from existing or create manually
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => setShowGoogleTab(false)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !showGoogleTab
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Your Categories
        </button>
        <button
          type="button"
          onClick={() => setShowGoogleTab(true)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            showGoogleTab
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          Browse Google Taxonomy
        </button>
      </div>

      {!showGoogleTab ? (
        <>
          {/* Tenant Categories Section */}
          <div>
            {/* Controls */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={catSearch}
                  onChange={(e) => { setCatSearch(e.target.value); setVisibleCount(30) }}
                  placeholder="Search by name or slug"
                  className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <label className="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 select-none">
                  <input
                    type="checkbox"
                    checked={mappedOnly}
                    onChange={(e) => { setMappedOnly(e.target.checked); setVisibleCount(30) }}
                  />
                  Mapped only
                </label>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-neutral-500">
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">No Categories Found</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">You need to create at least one category before you can assign items to it.</p>
                    <a
                      href={`/t/${tenantId}/categories`}
                      target="_blank"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Your First Category
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto border border-neutral-200 dark:border-neutral-700 rounded-lg p-2">
                {/* Recent */}
                {recentIds.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 px-1 mb-1">Recent</div>
                    {categories.filter(c => recentIds.includes(c.id)).map((cat) => (
                      <button
                        key={`recent-${cat.id}`}
                        onClick={() => handleSelect(cat.id)}
                        type="button"
                        className={[
                          'w-full text-left px-3 py-2 rounded-lg transition-colors mb-1',
                          localSelectedId === cat.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                            : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                        ].join(' ')}
                      >
                        <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400">Slug: {cat.slug}</div>
                        {cat.googleCategoryId && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Mapped to Google: {cat.googleCategoryId}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Filtered list */}
                {filteredCategories
                  .slice(0, visibleCount)
                  .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    type="button"
                    className={[
                      'w-full text-left px-3 py-2 rounded-lg transition-colors',
                      localSelectedId === cat.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                        : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700',
                    ].join(' ')}
                  >
                    <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">Slug: {cat.slug}</div>
                    {cat.googleCategoryId && (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Mapped to Google: {cat.googleCategoryId}</div>
                    )}
                  </button>
                ))}
                {/* Show More */}
                {filteredCategories.length > visibleCount && (
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={() => setVisibleCount((c) => c + 30)}
                      type="button"
                      className="px-4 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700"
                    >
                      Show more
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Google Taxonomy Search */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Search Google Taxonomy</label>
            <input
              placeholder="Type to search (e.g. Electronics)"
              value={taxQuery}
              onChange={(e) => setTaxQuery(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {taxLoading && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">Searching...</p>}
            {taxResults.length > 0 && (
              <div className="mt-2 border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-48 overflow-auto">
                {taxResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleGoogleTaxonomySelect(r)}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                  >
                    <div className="text-sm font-medium text-neutral-900 dark:text-white">{r.name}</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">{r.path.join(' > ')}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-neutral-700 dark:text-neutral-300">
                <strong>💡 Tip:</strong> Don't see the right category for this product? Visit the{' '}
                <a
                  href={`/t/${tenantId}/categories`}
                  target="_blank"
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline font-medium"
                >
                  Categories page
                </a>
                {' '}to create and align a new category first, then return here to assign it.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Cancel button if provided */}
      {onCancel && (
        <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
