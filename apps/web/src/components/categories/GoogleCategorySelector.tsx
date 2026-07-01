'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Check, X, Loader2 } from 'lucide-react';
import { googleProductTaxonomyService, GoogleTaxonomyCategory } from '@/services/GoogleProductTaxonomyService';

interface GoogleCategorySelectorProps {
  value: string;
  onChange: (googleCategoryId: string, categoryPath?: string) => void;
  placeholder?: string;
}

export default function GoogleCategorySelector({
  value,
  onChange,
  placeholder = 'Search Google product categories...',
}: GoogleCategorySelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleTaxonomyCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GoogleTaxonomyCategory | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the selected category's display name when value changes
  useEffect(() => {
    if (value && !selectedCategory) {
      // Try to find it in results first
      const found = results.find(r => r.id === value);
      if (found) {
        setSelectedCategory(found);
      }
    }
    if (!value) {
      setSelectedCategory(null);
    }
  }, [value, selectedCategory, results]);

  // Debounced search
  const handleSearch = useCallback((searchQuery: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const cats = await googleProductTaxonomyService.searchGoogleCategories(searchQuery, 30);
        setResults(cats);
      } catch (err) {
        console.error('[GoogleCategorySelector] Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (category: GoogleTaxonomyCategory) => {
    setSelectedCategory(category);
    onChange(category.id, category.path);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSelectedCategory(null);
    onChange('');
    setQuery('');
    setResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selectedCategory || (value && !query)) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{value}</span>
          {selectedCategory && (
            <p className="text-sm text-gray-900 dark:text-white truncate">
              {selectedCategory.path}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
        <button
          type="button"
          onClick={() => { setSelectedCategory(null); setShowDropdown(true); }}
          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 px-2 py-1"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={placeholder}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
          {results.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelect(cat)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono text-gray-400 flex-shrink-0 mt-0.5">{cat.id}</span>
                <span className="text-sm text-gray-900 dark:text-white">{cat.path}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && query && !loading && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow-lg p-3 text-sm text-gray-500 dark:text-gray-400">
          No categories found. Try a different search term.
        </div>
      )}
    </div>
  );
}
