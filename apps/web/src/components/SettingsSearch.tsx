"use client";

import React, { useState, useMemo } from 'react';

interface SettingsSearchProps {
  settings: Array<{
    title: string;
    description: string;
    href: string;
    items?: Array<{
      title: string;
      description: string;
      href: string;
    }>;
  }>;
  onResultClick?: (href: string) => void;
}

export function SettingsSearch({ settings, onResultClick }: SettingsSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Flatten all settings and their items for search
  const allItems = useMemo(() => {
    const items: Array<{
      title: string;
      description: string;
      href: string;
      category: string;
      type: 'group' | 'item';
    }> = [];

    settings.forEach(group => {
      // Add the group itself
      items.push({
        title: group.title,
        description: group.description,
        href: group.href,
        category: group.title,
        type: 'group'
      });

      // Add individual items
      group.items?.forEach(item => {
        items.push({
          title: item.title,
          description: item.description,
          href: item.href,
          category: group.title,
          type: 'item'
        });
      });
    });

    return items;
  }, [settings]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return allItems.filter(item =>
      item.title.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm)
    ).slice(0, 8); // Limit to 8 results
  }, [allItems, query]);

  const handleItemClick = (href: string) => {
    setQuery('');
    setIsOpen(false);
    onResultClick?.(href);
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(e.target.value.length > 0);
          }}
          onFocus={() => query && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search settings..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && filteredItems.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {filteredItems.map((item, index) => (
            <button
              key={`${item.href}-${index}`}
              onClick={() => handleItemClick(item.href)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.title}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      item.type === 'group'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {item.type === 'group' ? 'Category' : 'Setting'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {item.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    in {item.category}
                  </p>
                </div>
                <svg className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isOpen && query && filteredItems.length === 0 && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
          <div className="text-center">
            <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              No settings found for "{query}"
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Try searching for different keywords
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsSearch;
