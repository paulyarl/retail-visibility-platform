"use client";

import { useState, useRef, useEffect } from 'react';
import { Input } from './Input';
import { Badge } from './Badge';

export interface SelectOption {
  value: string;
  label: string;
  group?: string; // For grouping (e.g., "California", "New York")
  metadata?: {
    city?: string;
    state?: string;
    region?: string;
    [key: string]: any;
  };
}

interface AdvancedSearchableSelectProps {
  options: SelectOption[];
  value: string | string[]; // Single or multi-select
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  multiSelect?: boolean;
  showRecent?: boolean;
  showFavorites?: boolean;
  maxRecent?: number;
  storageKey?: string; // For persisting recent/favorites
  groupBy?: 'state' | 'city' | 'region' | 'group' | null;
  onFavoriteToggle?: (value: string) => void;
}

export function AdvancedSearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  disabled = false,
  multiSelect = false,
  showRecent = true,
  showFavorites = true,
  maxRecent = 5,
  storageKey = 'searchable-select',
  groupBy = null,
  onFavoriteToggle,
}: AdvancedSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [recentSelections, setRecentSelections] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  const selectedValues = Array.isArray(value) ? value : [value];
  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value));

  // Load recent and favorites from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${storageKey}-recent`);
      const storedFavorites = localStorage.getItem(`${storageKey}-favorites`);
      if (stored) setRecentSelections(JSON.parse(stored));
      if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
    }
  }, [storageKey]);

  // Filter and group options
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.metadata?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.metadata?.state?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group options
  const groupedOptions = groupBy
    ? filteredOptions.reduce((acc, option) => {
        let groupKey = 'Other';
        if (groupBy === 'group' && option.group) {
          groupKey = option.group;
        } else if (groupBy === 'state' && option.metadata?.state) {
          groupKey = option.metadata.state;
        } else if (groupBy === 'city' && option.metadata?.city) {
          groupKey = option.metadata.city;
        } else if (groupBy === 'region' && option.metadata?.region) {
          groupKey = option.metadata.region;
        }
        
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(option);
        return acc;
      }, {} as Record<string, SelectOption[]>)
    : { 'All': filteredOptions };

  // Get recent options
  const recentOptions = showRecent
    ? options.filter(opt => recentSelections.includes(opt.value)).slice(0, maxRecent)
    : [];

  // Get favorite options
  const favoriteOptions = showFavorites
    ? options.filter(opt => favorites.includes(opt.value))
    : [];

  // Flatten grouped options for keyboard navigation
  const flatOptions = Object.values(groupedOptions).flat();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(0);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < flatOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatOptions[highlightedIndex]) {
            handleSelect(flatOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, flatOptions]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && optionsListRef.current) {
      const highlightedElement = optionsListRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery('');
    }

    // Update recent selections
    if (showRecent) {
      const newRecent = [optionValue, ...recentSelections.filter(v => v !== optionValue)].slice(0, maxRecent);
      setRecentSelections(newRecent);
      localStorage.setItem(`${storageKey}-recent`, JSON.stringify(newRecent));
    }
  };

  const toggleFavorite = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(optionValue)
      ? favorites.filter(v => v !== optionValue)
      : [...favorites, optionValue];
    setFavorites(newFavorites);
    localStorage.setItem(`${storageKey}-favorites`, JSON.stringify(newFavorites));
    onFavoriteToggle?.(optionValue);
  };

  const removeSelection = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiSelect) {
      onChange(selectedValues.filter(v => v !== optionValue));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          {label}
        </label>
      )}
      
      {/* Selected Value Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left border rounded-lg bg-white flex items-center justify-between ${
          disabled
            ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed'
            : 'hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
        } ${isOpen ? 'border-primary-500 ring-2 ring-primary-500' : 'border-neutral-300'}`}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {multiSelect && selectedOptions.length > 0 ? (
            selectedOptions.map(opt => (
              <Badge key={opt.value} variant="info" className="flex items-center gap-1">
                {opt.label}
                <button
                  onClick={(e) => removeSelection(opt.value, e)}
                  className="hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))
          ) : selectedOptions.length > 0 ? (
            <span className="text-neutral-900">{selectedOptions[0].label}</span>
          ) : (
            <span className="text-neutral-500">{placeholder}</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-neutral-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-neutral-200 sticky top-0 bg-white">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search..."
              autoFocus
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div ref={optionsListRef} className="max-h-80 overflow-y-auto">
            {/* Favorites Section */}
            {showFavorites && favoriteOptions.length > 0 && !searchQuery && (
              <div className="border-b border-neutral-200">
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50">
                  ⭐ Favorites
                </div>
                {favoriteOptions.map((option, idx) => (
                  <OptionItem
                    key={`fav-${option.value}`}
                    option={option}
                    isSelected={selectedValues.includes(option.value)}
                    isFavorite={true}
                    isHighlighted={false}
                    onSelect={handleSelect}
                    onToggleFavorite={toggleFavorite}
                    showFavorites={showFavorites}
                    index={-1}
                  />
                ))}
              </div>
            )}

            {/* Recent Section */}
            {showRecent && recentOptions.length > 0 && !searchQuery && (
              <div className="border-b border-neutral-200">
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50">
                  🕒 Recent
                </div>
                {recentOptions.map((option, idx) => (
                  <OptionItem
                    key={`recent-${option.value}`}
                    option={option}
                    isSelected={selectedValues.includes(option.value)}
                    isFavorite={favorites.includes(option.value)}
                    isHighlighted={false}
                    onSelect={handleSelect}
                    onToggleFavorite={toggleFavorite}
                    showFavorites={showFavorites}
                    index={-1}
                  />
                ))}
              </div>
            )}

            {/* Grouped Options */}
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-neutral-500">
                No results found
              </div>
            ) : (
              Object.entries(groupedOptions).map(([groupName, groupOptions]) => {
                let globalIndex = 0;
                return (
                  <div key={groupName}>
                    {groupBy && (
                      <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase bg-neutral-50 sticky top-0">
                        {groupName}
                      </div>
                    )}
                    {groupOptions.map((option) => {
                      const currentIndex = flatOptions.indexOf(option);
                      return (
                        <OptionItem
                          key={option.value}
                          option={option}
                          isSelected={selectedValues.includes(option.value)}
                          isFavorite={favorites.includes(option.value)}
                          isHighlighted={currentIndex === highlightedIndex}
                          onSelect={handleSelect}
                          onToggleFavorite={toggleFavorite}
                          showFavorites={showFavorites}
                          index={currentIndex}
                        />
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Option Item Component
function OptionItem({
  option,
  isSelected,
  isFavorite,
  isHighlighted,
  onSelect,
  onToggleFavorite,
  showFavorites,
  index,
}: {
  option: SelectOption;
  isSelected: boolean;
  isFavorite: boolean;
  isHighlighted: boolean;
  onSelect: (value: string) => void;
  onToggleFavorite: (value: string, e: React.MouseEvent) => void;
  showFavorites: boolean;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      data-index={index}
      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors ${
        isHighlighted ? 'bg-primary-100' : isSelected ? 'bg-primary-50' : 'hover:bg-neutral-100'
      } ${isSelected ? 'text-primary-700 font-medium' : 'text-neutral-900'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{option.label}</span>
          {isSelected && (
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        {option.metadata && (
          <div className="text-xs text-neutral-500 mt-0.5">
            {option.metadata.city && option.metadata.state && (
              <span>{option.metadata.city}, {option.metadata.state}</span>
            )}
            {option.metadata.region && (
              <span className="ml-2">• {option.metadata.region}</span>
            )}
          </div>
        )}
      </div>
      {showFavorites && (
        <button
          onClick={(e) => onToggleFavorite(option.value, e)}
          className={`ml-2 flex-shrink-0 ${isFavorite ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'}`}
        >
          {isFavorite ? '⭐' : '☆'}
        </button>
      )}
    </button>
  );
}
