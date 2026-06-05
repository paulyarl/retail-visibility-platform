"use client";
import React, { useEffect, useState } from "react";
import RealShopService, { type GBPCategory } from "@/services/RealShopService";

interface ShopCategorySelectorProps {
  tenantId: string;
  selectedCategoryId?: string;
  onCategoryChange: (category: GBPCategory | null) => void;
  disabled?: boolean;
}

export default function ShopCategorySelector({ 
  tenantId, 
  selectedCategoryId, 
  onCategoryChange, 
  disabled = false 
}: ShopCategorySelectorProps) {
  const [categories, setCategories] = useState<GBPCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const shopService = RealShopService.getInstance();
        const availableCategories = await shopService.getAvailableCategories();
        
        setCategories(availableCategories);
      } catch (error) {
        console.error('Error loading categories:', error);
        setError('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Filter categories based on search term
  const filteredCategories = categories.filter(category =>
    category.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find selected category
  const selectedCategory = categories.find(cat => cat.categoryId === selectedCategoryId);

  const handleCategorySelect = (category: GBPCategory) => {
    if (!disabled) {
      onCategoryChange(category);
    }
  };

  const handleClearSelection = () => {
    if (!disabled) {
      onCategoryChange(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <div className="text-red-800">
          <p className="font-medium">Error loading categories</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Shop Category</h3>
        <p className="text-sm text-gray-600 mb-3">
          Select a Google Business Profile category for your shop. This helps customers find you and affects your shop's visibility.
        </p>
        
        {selectedCategory && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="font-medium text-blue-900">{selectedCategory.display_name}</span>
            </div>
            {!disabled && (
              <button
                onClick={handleClearSelection}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Clear
              </button>
            )}
          </div>
        )}
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filteredCategories.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm ? 'No categories found matching your search.' : 'No categories available.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCategories.map((category) => (
              <div
                key={category.categoryId}
                onClick={() => handleCategorySelect(category)}
                className={`p-3 cursor-pointer transition-colors ${
                  disabled 
                    ? 'bg-gray-50 cursor-not-allowed' 
                    : 'hover:bg-gray-50'
                } ${
                  selectedCategoryId === category.categoryId 
                    ? 'bg-blue-50 border-l-4 border-blue-500' 
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{category.display_name}</h4>
                    <p className="text-sm text-gray-500 mt-1">ID: {category.categoryId}</p>
                    
                    {category.serviceTypes && category.serviceTypes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Service Types:</p>
                        <div className="flex flex-wrap gap-1">
                          {category.serviceTypes.slice(0, 3).map((serviceType, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {serviceType}
                            </span>
                          ))}
                          {category.serviceTypes.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                              +{category.serviceTypes.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedCategoryId === category.categoryId && (
                    <div className="ml-3">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Showing {filteredCategories.length} of {categories.length} available categories
        </p>
      </div>
    </div>
  );
}
