'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';

interface GBPCategory {
  id: string;
  name: string;
  path: string[];
}

interface GBPCategorySelectorProps {
  tenantId: string;
  value?: { id: string; name: string } | null;
  onChange: (category: { id: string; name: string } | null) => void;
  disabled?: boolean;
}

export default function GBPCategorySelector({
  tenantId,
  value,
  onChange,
  disabled = false,
}: GBPCategorySelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GBPCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [popularCategories, setPopularCategories] = useState<GBPCategory[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [showPopular, setShowPopular] = useState(true);

  // Load popular categories on mount
  useEffect(() => {
    async function loadPopularCategories() {
      try {
        setLoadingPopular(true);
        const response = await api.get(`/api/gbp/categories/popular?tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok) {
          const data = await response.json();
          setPopularCategories(data.items || []);
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Failed to load popular categories:', error);
      } finally {
        setLoadingPopular(false);
      }
    }
    loadPopularCategories();
  }, [tenantId]);

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/gbp/categories?query=${encodeURIComponent(query)}&limit=10&tenantId=${encodeURIComponent(tenantId)}`);
        if (response.ok && active) {
          const data = await response.json();
          setResults(data.items || []);
        } else {
          const errorData = await response.json();
          console.error('[GBPCategorySelector] API error:', errorData);
        }
      } catch (error) {
        console.error('[GBPCategorySelector] Search error:', error);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (category: GBPCategory) => {
    onChange({ id: category.id, name: category.name });
    setQuery(category.name);
    setShowResults(false);
    setShowPopular(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
    setShowPopular(true);
  };

  // Group popular categories by type
  const groupedCategories = useMemo(() => {
    const groups: Record<string, GBPCategory[]> = {
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

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
        Google Business Profile Category
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={value ? value.name : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
            if (!e.target.value) onChange(null);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search for your business category..."
          disabled={disabled}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              Searching...
            </div>
          )}
          {results.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleSelect(category)}
              className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
            >
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {category.name}
              </div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {category.path.join(' > ')}
              </div>
            </button>
          ))}
        </div>
      )}

      {value && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Selected: <span className="font-medium">{value.name}</span> (ID: {value.id})
        </p>
      )}

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Type at least 2 characters to search, or select from popular categories below.
      </p>

      {/* Popular Categories Grid */}
      {showPopular && !value && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Popular Categories
            </h3>
            <button
              type="button"
              onClick={() => setShowPopular(false)}
              className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Hide
            </button>
          </div>

          {loadingPopular ? (
            <div className="animate-pulse space-y-3">
              <div className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
              <div className="h-24 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedCategories).map(([groupName, categories]) => {
                if (categories.length === 0) return null;
                return (
                  <div key={groupName}>
                    <h4 className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {groupName}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelect(cat)}
                          disabled={disabled}
                          className="text-left px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                          <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-primary-700 dark:group-hover:text-primary-300">
                            {cat.name}
                          </div>
                          {cat.path.length > 0 && (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {cat.path[cat.path.length - 1]}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>💡 Tip:</strong> Can't find your category? Use the search box above to find from thousands of Google Business categories.
            </p>
          </div>
        </div>
      )}

      {!showPopular && !value && (
        <button
          type="button"
          onClick={() => setShowPopular(true)}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
        >
          Show popular categories
        </button>
      )}
    </div>
  );
}
