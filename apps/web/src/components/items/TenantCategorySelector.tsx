import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api, apiRequest, API_BASE_URL } from '@/lib/api';
import GoogleTaxonomySuggestions from '@/components/scan/GoogleTaxonomySuggestions';

interface TenantCategory {
  id: string;
  name: string;
  slug: string;
  googleCategoryId?: string | null;
  parentId?: string | null;
}

interface TenantCategorySelectorProps {
  selectedCategoryId?: string | null;
  categoryPath?: string[]; // From enrichment data
  onSelect: (categoryId: string, googleCategoryPath?: string, googleTaxonomyId?: string) => void; // Allow passing Google category info
  onCancel?: () => void;
}

/**
 * Reusable component for selecting tenant categories
 * Used in both Edit Item modal and Assign Category modal
 */
export default function TenantCategorySelector({
  selectedCategoryId,
  categoryPath,
  onSelect,
  onCancel,
}: TenantCategorySelectorProps) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [categories, setCategories] = useState<TenantCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedCategoryId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGoogleCategory, setSelectedGoogleCategory] = useState<string>('');
  const [googleTaxonomyMode, setGoogleTaxonomyMode] = useState(false);
  const [googleCategories, setGoogleCategories] = useState<Array<{id: string, path: string[]}>>([]);
  const [googleIdQuery, setGoogleIdQuery] = useState('');
  const [googleIdLoading, setGoogleIdLoading] = useState(false);
  const [googleIdPath, setGoogleIdPath] = useState<string | null>(null);

  // Taxonomy search state (matching Categories page)
  const [taxQuery, setTaxQuery] = useState('');
  const [taxResults, setTaxResults] = useState<Array<{ id: string; name: string; path: string[] }>>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [showTaxResults, setShowTaxResults] = useState(false);
  
  // Taxonomy browse state
  const [taxBrowseMode, setTaxBrowseMode] = useState(false);
  const [taxBrowsePath, setTaxBrowsePath] = useState<string[]>([]);
  const [taxBrowseCategories, setTaxBrowseCategories] = useState<Array<{ id: string; name: string; path: string[]; hasChildren?: boolean }>>([]);
  const [taxBrowseLoading, setTaxBrowseLoading] = useState(false);

  // Handle Google ID lookup
  const handleGoogleIdLookup = async () => {
    if (!googleIdQuery.trim()) return;

    setGoogleIdLoading(true);
    setGoogleIdPath(null);

    try {
      // Use the public Google taxonomy endpoint (no auth required)
      const response = await fetch(`${API_BASE_URL}/public/google-taxonomy/${googleIdQuery.trim()}`);
      if (response.ok) {
        const data = await response.json();
        // data.path is an array like ["Food", "Bakery", "Bread"]
        if (data.path) {
          const pathString = Array.isArray(data.path) ? data.path.join(' > ') : data.path;
          setGoogleIdPath(pathString);

          // Switch to Google taxonomy mode and load categories under this branch
          setSelectedGoogleCategory(pathString);
          setGoogleTaxonomyMode(true);
          setSearchQuery(''); // Clear search when switching modes

          // Load Google taxonomy categories under this branch
          try {
            const taxResponse = await fetch(`/api/taxonomy/search?branch=${encodeURIComponent(pathString)}&limit=500`);
            if (taxResponse.ok) {
              const taxData = await taxResponse.json();
              setGoogleCategories(taxData.categories || []);
              console.log('[GoogleID] Loaded', taxData.categories?.length || 0, 'Google taxonomy categories');
            } else {
              console.error('[GoogleID] Failed to load Google taxonomy categories');
              // Fall back to tenant categories
              setGoogleTaxonomyMode(false);
            }
          } catch (error) {
            console.error('[GoogleID] Error loading Google taxonomy:', error);
            // Fall back to tenant categories
            setGoogleTaxonomyMode(false);
          }
        } else {
          setGoogleIdPath('Category not found');
        }
      } else {
        setGoogleIdPath('Category not found');
      }
    } catch (error) {
      console.error('Failed to lookup Google category:', error);
      setGoogleIdPath('Lookup failed');
    } finally {
      setGoogleIdLoading(false);
    }
  };

  // Handle Google taxonomy suggestion selection - switch to Google taxonomy mode
  const handleGoogleSuggestionSelect = async (googleCategoryPath: string) => {
    console.log('[GoogleSuggestion] Switching to Google taxonomy mode for:', googleCategoryPath);
    
    setSelectedGoogleCategory(googleCategoryPath);
    setGoogleTaxonomyMode(true);
    setSearchQuery(''); // Clear search when switching modes
    
    // Load Google taxonomy categories under this branch
    try {
      const response = await fetch(`/api/taxonomy/search?branch=${encodeURIComponent(googleCategoryPath)}&limit=500`);
      if (response.ok) {
        const data = await response.json();
        setGoogleCategories(data.categories || []);
        console.log('[GoogleSuggestion] Loaded', data.categories?.length || 0, 'Google taxonomy categories');
      } else {
        console.error('[GoogleSuggestion] Failed to load Google taxonomy categories');
        // Fall back to tenant categories
        setGoogleTaxonomyMode(false);
      }
    } catch (error) {
      console.error('[GoogleSuggestion] Error loading Google taxonomy:', error);
      // Fall back to tenant categories
      setGoogleTaxonomyMode(false);
    }
  };

  // Fetch tenant categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await apiRequest(`/api/tenant/${tenantId}/categories`);
        if (response.ok) {
          const result = await response.json();
          setCategories(result.data || []);
        } else {
          console.error('Failed to fetch categories:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, [tenantId]);

  // Update local selection when prop changes
  useEffect(() => {
    setLocalSelectedId(selectedCategoryId || '');
  }, [selectedCategoryId]);

  // Debounced taxonomy search (matching Categories page)
  useEffect(() => {
    if (!taxQuery || taxQuery.trim().length < 2) { setTaxResults([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      try {
        setTaxLoading(true);
        const res = await api.get(`${API_BASE_URL}/api/categories/search?q=${encodeURIComponent(taxQuery)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          if (active) setTaxResults(data.results || []);
        }
      } finally {
        setTaxLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [taxQuery]);

  // Load taxonomy browse categories for a specific parent path
  async function loadTaxBrowseCategories(parentPath?: string) {
    try {
      setTaxBrowseLoading(true);
      const url = parentPath 
        ? `${API_BASE_URL}/api/google/taxonomy/browse?parent=${encodeURIComponent(parentPath)}`
        : `${API_BASE_URL}/api/google/taxonomy/browse`;
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.categories) {
          setTaxBrowseCategories(data.categories);
        }
      }
    } catch (error) {
      console.error('Failed to load taxonomy categories:', error);
    } finally {
      setTaxBrowseLoading(false);
    }
  }

  // Navigate to a category path and load its children
  async function navigateToPath(newPath: string[]) {
    setTaxBrowsePath(newPath);
    if (newPath.length === 0) {
      await loadTaxBrowseCategories();
    } else {
      await loadTaxBrowseCategories(newPath.join(' > '));
    }
  }

  // Handle selecting a taxonomy category (creates tenant category)
  const handleTaxonomySelect = async (taxCat: { id: string; name: string; path: string[] }) => {
    // Pass the Google taxonomy info to the parent - it will create the tenant category
    onSelect(taxCat.id, taxCat.path.join(' > '), taxCat.id);
  };

  // Filter categories based on search and mode
  const filteredCategories = googleTaxonomyMode 
    ? googleCategories.filter(cat => 
        cat.path.join(' > ').toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.path[cat.path.length - 1]?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleSelect = (categoryId: string) => {
    setLocalSelectedId(categoryId);
    
    if (googleTaxonomyMode) {
      // In Google taxonomy mode, find the selected category and pass its path and ID
      const selectedGoogleCat = googleCategories.find(cat => cat.id === categoryId);
      if (selectedGoogleCat) {
        onSelect(categoryId, selectedGoogleCat.path.join(' > '), selectedGoogleCat.id);
      } else {
        onSelect(categoryId);
      }
    } else {
      // In tenant mode, just pass the category ID
      onSelect(categoryId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Google Taxonomy Suggestions - show when we have enrichment data */}
      {categoryPath && categoryPath.length > 0 && (
        <GoogleTaxonomySuggestions
          categoryPath={categoryPath}
          onSelectSuggestion={handleGoogleSuggestionSelect}
          selectedGoogleCategory={selectedGoogleCategory}
        />
      )}

      {/* Google Taxonomy Search & Browse - matching Categories page */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Find Google Category
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setTaxBrowseMode(false)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${!taxBrowseMode ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
          >
            🔍 Search
          </button>
          <button
            type="button"
            onClick={() => { setTaxBrowseMode(true); if (taxBrowseCategories.length === 0) loadTaxBrowseCategories(); }}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${taxBrowseMode ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'}`}
          >
            📂 Browse Tree
          </button>
        </div>

        {!taxBrowseMode ? (
          <>
            {/* Search by name */}
            <div className="relative">
              <input
                placeholder="Search taxonomy by name (e.g. Electronics, Pizza)"
                value={taxQuery}
                onChange={(e) => { setTaxQuery(e.target.value); setShowTaxResults(true); }}
                onFocus={() => setShowTaxResults(true)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showTaxResults && (taxResults.length > 0 || taxLoading) && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-64 overflow-auto">
                  {taxLoading && <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>}
                  {taxResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleTaxonomySelect(r)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{r.path.join(' > ')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Browse tree */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
              {/* Breadcrumb */}
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center gap-1 flex-wrap text-sm">
                <button
                  type="button"
                  onClick={() => navigateToPath([])}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Root
                </button>
                {taxBrowsePath.map((segment, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <span className="text-gray-400">&gt;</span>
                    <button
                      type="button"
                      onClick={() => navigateToPath(taxBrowsePath.slice(0, idx + 1))}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {segment}
                    </button>
                  </span>
                ))}
              </div>
              {/* Category list */}
              <div className="max-h-48 overflow-auto">
                {taxBrowseLoading ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">Loading categories...</div>
                ) : taxBrowseCategories.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">No subcategories</div>
                ) : (
                  taxBrowseCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <button
                        type="button"
                        onClick={() => handleTaxonomySelect(cat)}
                        className={`flex-1 text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${localSelectedId === cat.id ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{cat.id}</div>
                      </button>
                      {cat.hasChildren && (
                        <button
                          type="button"
                          onClick={() => navigateToPath([...taxBrowsePath, cat.name])}
                          className="px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          title="Browse subcategories"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Click a category to select it, or click the arrow to browse subcategories
            </p>
          </>
        )}

        {/* OR divider */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
          <span className="text-xs text-gray-500 font-medium">OR</span>
          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
        </div>

        {/* Direct ID input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Enter Google Category ID directly</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 543543, 5904, 499989"
              value={googleIdQuery}
              onChange={(e) => setGoogleIdQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoogleIdLookup()}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleGoogleIdLookup}
              disabled={googleIdLoading || !googleIdQuery.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {googleIdLoading ? 'Looking up...' : 'Lookup'}
            </button>
          </div>
          {googleIdPath && (
            <div className="text-sm mt-2">
              {googleIdPath.startsWith('Category') || googleIdPath === 'Lookup failed' ? (
                <span className="text-red-600 dark:text-red-400">{googleIdPath}</span>
              ) : (
                <span className="text-green-600 dark:text-green-400">✓ Found: {googleIdPath}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode indicator */}
      {googleTaxonomyMode && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Google Taxonomy Catalog
              </span>
            </div>
            <button
              onClick={() => {
                setGoogleTaxonomyMode(false);
                setGoogleCategories([]);
                setSelectedGoogleCategory('');
                setSearchQuery('');
                setGoogleIdQuery('');
                setGoogleIdPath(null);
              }}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm underline"
            >
              Back to My Categories
            </button>
          </div>
          {selectedGoogleCategory && (
            <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Showing categories under: <span className="font-medium">{selectedGoogleCategory}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder={googleTaxonomyMode ? "Search Google taxonomy..." : "Search categories..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Categories List */}
      {(googleTaxonomyMode ? googleCategories.length === 0 : loading) ? (
        <div className="text-center py-8 text-neutral-500">
          {googleTaxonomyMode ? 'Loading Google taxonomy categories...' : 'Loading categories...'}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          No categories match your search.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredCategories.map((category) => {
            // Handle different category types based on mode
            if (googleTaxonomyMode) {
              const googleCat = category as {id: string, path: string[], isCustom?: boolean};
              const displayName = googleCat.path[googleCat.path.length - 1];
              const displayPath = googleCat.path.join(' > ');
              const categoryId = googleCat.id;
              const isCustom = googleCat.isCustom || categoryId.startsWith('custom-');
              
              return (
                <button
                  key={categoryId}
                  onClick={() => handleSelect(categoryId)}
                  type="button"
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    localSelectedId === categoryId
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700'
                  } ${isCustom ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                        {displayName}
                        {isCustom && (
                          <span className="text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded">
                            Suggested
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono">
                        {displayPath}
                      </div>
                    </div>
                    {localSelectedId === categoryId && (
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            } else {
              const tenantCat = category as TenantCategory;
              const displayName = tenantCat.name;
              const categoryId = tenantCat.id;
              
              return (
                <button
                  key={categoryId}
                  onClick={() => handleSelect(categoryId)}
                  type="button"
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    localSelectedId === categoryId
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-neutral-900 dark:text-white">
                        {displayName}
                      </div>
                      {tenantCat.googleCategoryId && (
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          Google ID: <span className="font-mono">{tenantCat.googleCategoryId}</span>
                        </div>
                      )}
                    </div>
                    {localSelectedId === categoryId && (
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            }
          })}
        </div>
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
