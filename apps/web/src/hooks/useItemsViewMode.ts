import { useState, useEffect } from 'react';

export type ViewMode = 'grid' | 'list';

const STORAGE_KEY = 'items_view_mode';

interface UseItemsViewModeReturn {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

/**
 * Hook for managing items view mode (grid/list)
 * Persists preference to localStorage
 */
export function useItemsViewMode(): UseItemsViewModeReturn {
  // Always start with 'grid' to prevent hydration mismatch
  const [viewMode, setViewModeState] = useState<ViewMode>('grid');

  // Load saved view mode from localStorage after mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') {
        setViewModeState(saved as ViewMode);
      }
    } catch (error) {
      console.error('[useItemsViewMode] Failed to load view mode:', error);
    }
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, viewMode);
    } catch (error) {
      console.error('[useItemsViewMode] Failed to save view mode:', error);
    }
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewModeState(prev => prev === 'grid' ? 'list' : 'grid');
  };

  return {
    viewMode,
    setViewMode: setViewModeState,
    toggleViewMode,
  };
}
