"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type LayoutVariant = 'classic' | 'enhanced' | 'compact' | 'premium' | 'zoom';

interface ProductLayoutContextType {
  variant: LayoutVariant;
  setVariant: (variant: LayoutVariant) => void;
  isTransitioning: boolean;
}

const ProductLayoutContext = createContext<ProductLayoutContextType | undefined>(undefined);

interface ProductLayoutProviderProps {
  children: ReactNode;
  defaultVariant?: LayoutVariant;
}

export function ProductLayoutProvider({ 
  children, 
  defaultVariant = 'classic' 
}: ProductLayoutProviderProps) {
  const [variant, setVariantState] = useState<LayoutVariant>(defaultVariant);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load saved preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('productLayoutVariant');
      if (saved && ['classic', 'enhanced', 'compact', 'premium', 'zoom'].includes(saved)) {
        setVariantState(saved as LayoutVariant);
      }
    } catch (error) {
      console.warn('[ProductLayoutProvider] Failed to load layout preference:', error);
    }
  }, []);

  const setVariant = (newVariant: LayoutVariant) => {
    setIsTransitioning(true);
    
    // Simulate transition effect
    setTimeout(() => {
      setVariantState(newVariant);
      setIsTransitioning(false);
      
      // Save to localStorage
      try {
        localStorage.setItem('productLayoutVariant', newVariant);
      } catch (error) {
        console.warn('[ProductLayoutProvider] Failed to save layout preference:', error);
      }
    }, 150);
  };

  const value: ProductLayoutContextType = {
    variant,
    setVariant,
    isTransitioning,
  };

  return (
    <ProductLayoutContext.Provider value={value}>
      <div className={`transition-opacity duration-150 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        {children}
      </div>
    </ProductLayoutContext.Provider>
  );
}

export function useProductLayout() {
  const context = useContext(ProductLayoutContext);
  if (context === undefined) {
    throw new Error('useProductLayout must be used within a ProductLayoutProvider');
  }
  return context;
}

// Layout variant descriptions for UI
export const layoutVariantDescriptions = {
  classic: {
    name: 'Classic',
    description: 'Clean, traditional design with all essential information',
    features: ['All product fields', 'Standard layout', 'High readability'],
    icon: '📋'
  },
  enhanced: {
    name: 'Enhanced',
    description: 'Modern design with improved visual hierarchy and interactions',
    features: ['Gradient borders', 'Hover effects', 'Action buttons'],
    icon: '✨'
  },
  compact: {
    name: 'Compact',
    description: 'Space-efficient design for grid views and mobile',
    features: ['Minimal footprint', 'Essential info only', 'Grid optimized'],
    icon: '📱'
  },
  premium: {
    name: 'Premium',
    description: 'Luxury design with high-end styling and animations',
    features: ['Premium gradients', 'Rich animations', 'Luxury styling'],
    icon: '💎'
  },
  zoom: {
    name: 'Zoom',
    description: 'Small cards with prominent zoom effect on hover',
    features: ['Compact footprint', 'Hover zoom effect', 'High density grid'],
    icon: '🔍'
  }
} as const;
