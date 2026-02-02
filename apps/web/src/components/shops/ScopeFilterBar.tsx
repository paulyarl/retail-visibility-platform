/**
 * ScopeFilterBar Component
 * Main filter UI for scope-aware discovery
 * Phase 5 UI Implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { Globe, Tag, MapPin, X } from 'lucide-react';
import { ScopeParams, ScopeType } from '@/types/scope';
import CategorySelector from './CategorySelector';
import LocationSearch from './LocationSearch';

interface ScopeFilterBarProps {
  onScopeChange: (scope: ScopeParams) => void;
  initialScope?: ScopeParams;
  className?: string;
}

export default function ScopeFilterBar({ 
  onScopeChange, 
  initialScope,
  className = '' 
}: ScopeFilterBarProps) {
  const [activeTab, setActiveTab] = useState<ScopeType>(initialScope?.scope || 'global');
  const [scopeParams, setScopeParams] = useState<ScopeParams>(
    initialScope || { scope: 'global' }
  );

  // Update internal state when initialScope changes
  useEffect(() => {
    if (initialScope) {
      setActiveTab(initialScope.scope);
      setScopeParams(initialScope);
    }
  }, [initialScope]);

  const handleTabChange = (tab: ScopeType) => {
    setActiveTab(tab);
    
    // Create new scope params based on tab
    const newScope: ScopeParams = { scope: tab };
    
    // Preserve existing params if switching back
    if (tab === 'category' && scopeParams.category) {
      newScope.category = scopeParams.category;
    } else if (tab === 'location' && scopeParams.location) {
      newScope.location = scopeParams.location;
    }
    
    setScopeParams(newScope);
    onScopeChange(newScope);
  };

  const handleCategoryChange = (category: ScopeParams['category']) => {
    const newScope: ScopeParams = {
      scope: 'category',
      category
    };
    setScopeParams(newScope);
    onScopeChange(newScope);
  };

  const handleLocationChange = (location: ScopeParams['location']) => {
    const newScope: ScopeParams = {
      scope: 'location',
      location
    };
    setScopeParams(newScope);
    onScopeChange(newScope);
  };

  const tabs = [
    { id: 'global' as ScopeType, label: 'All Products', icon: Globe },
    { id: 'category' as ScopeType, label: 'By Category', icon: Tag },
    { id: 'location' as ScopeType, label: 'By Location', icon: MapPin },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap
                  border-b-2 transition-colors
                  ${isActive 
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }
                `}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'global' && (
          <div className="text-center py-4">
            <Globe className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-600 dark:text-gray-400">
              Showing products from all shops and categories
            </p>
          </div>
        )}

        {activeTab === 'category' && (
          <CategorySelector
            value={scopeParams.category}
            onChange={handleCategoryChange}
          />
        )}

        {activeTab === 'location' && (
          <LocationSearch
            value={scopeParams.location}
            onChange={handleLocationChange}
          />
        )}
      </div>
    </div>
  );
}
