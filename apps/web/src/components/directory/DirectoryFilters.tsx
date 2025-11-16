"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, SlidersHorizontal, X, MapPin, Navigation } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DirectoryFiltersProps {
  categories: Array<{ name: string; count: number }>;
  locations: Array<{ city: string; state: string; count: number }>;
}

export default function DirectoryFilters({ categories, locations }: DirectoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedLocation, setSelectedLocation] = useState(searchParams.get('city') || '');
  const [zipCode, setZipCode] = useState(searchParams.get('zip') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [gettingLocation, setGettingLocation] = useState(false);

  // Count active filters
  const activeFilters = [
    selectedCategory,
    selectedLocation,
    zipCode,
    searchQuery,
    sortBy !== 'relevance' ? sortBy : null,
  ].filter(Boolean).length;

  // Get user's current location ("Near Me")
  const getNearMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams();
        params.set('lat', position.coords.latitude.toString());
        params.set('lng', position.coords.longitude.toString());
        params.set('sort', 'distance');
        if (searchQuery) params.set('q', searchQuery);
        if (selectedCategory) params.set('category', selectedCategory);
        
        router.push(`/directory?${params.toString()}`);
        setGettingLocation(false);
        setShowFilters(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enable location services.');
        setGettingLocation(false);
      }
    );
  };

  // Apply filters
  const applyFilters = () => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('q', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    if (zipCode) {
      params.set('zip', zipCode);
      // Auto-sort by distance when ZIP is provided
      if (!sortBy || sortBy === 'relevance') {
        params.set('sort', 'distance');
      }
    } else if (selectedLocation) {
      const location = locations.find(l => `${l.city}, ${l.state}` === selectedLocation);
      if (location) {
        params.set('city', location.city);
        params.set('state', location.state);
      }
    }
    if (sortBy && sortBy !== 'relevance') params.set('sort', sortBy);

    router.push(`/directory?${params.toString()}`);
    setShowFilters(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedLocation('');
    setZipCode('');
    setSortBy('relevance');
    setSearchQuery('');
    router.push('/directory');
    setShowFilters(false);
  };

  return (
    <div className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Mobile Filter Toggle */}
        <div className="flex items-center gap-4 lg:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="font-medium">Filters</span>
            {activeFilters > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Desktop Filters - Always Visible */}
        <div className={`${showFilters ? 'block' : 'hidden'} lg:block mt-4 lg:mt-0`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stores..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter - Only show if categories are provided */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ZIP Code or Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => {
                    setZipCode(e.target.value);
                    if (e.target.value) setSelectedLocation(''); // Clear city/state if ZIP entered
                  }}
                  placeholder="Enter ZIP code"
                  maxLength={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <MapPin className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* City/State Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or City/State
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  if (e.target.value) setZipCode(''); // Clear ZIP if city/state selected
                }}
                disabled={!!zipCode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">All Locations</option>
                {locations.slice(0, 50).map((loc) => (
                  <option key={`${loc.city}-${loc.state}`} value={`${loc.city}, ${loc.state}`}>
                    {loc.city}, {loc.state} ({loc.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="relevance">Relevance</option>
                <option value="distance">Distance (Nearest)</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
                <option value="products">Most Products</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={applyFilters}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>

            {/* Near Me Button */}
            <button
              onClick={getNearMe}
              disabled={gettingLocation}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Find stores near your current location"
            >
              <Navigation className={`w-4 h-4 ${gettingLocation ? 'animate-spin' : ''}`} />
              {gettingLocation ? 'Getting Location...' : 'Near Me'}
            </button>

            {activeFilters > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            )}

            {activeFilters > 0 && (
              <span className="text-sm text-gray-600">
                {activeFilters} {activeFilters === 1 ? 'filter' : 'filters'} active
              </span>
            )}
          </div>
        </div>

        {/* Active Filter Tags */}
        {activeFilters > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2 mt-4 lg:hidden">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Search: {searchQuery}
                <button onClick={() => { setSearchQuery(''); applyFilters(); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {selectedCategory}
                <button onClick={() => { setSelectedCategory(''); applyFilters(); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {selectedLocation}
                <button onClick={() => { setSelectedLocation(''); applyFilters(); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { DirectoryFilters };
