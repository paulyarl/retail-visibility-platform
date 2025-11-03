'use client';

import { useState, useEffect } from 'react';
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
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setResults([]);
  };

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
        This category will be used for your Google Business Profile listing.
      </p>
    </div>
  );
}
