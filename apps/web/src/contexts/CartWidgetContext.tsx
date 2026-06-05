'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type CartWidgetState = 'hidden' | 'minimized' | 'expanded';

interface CartWidgetContextType {
  widgetState: CartWidgetState;
  setWidgetState: (state: CartWidgetState) => void;
  toggleExpanded: () => void;
  minimize: () => void;
  hide: () => void;
  show: () => void;
}

const CartWidgetContext = createContext<CartWidgetContextType | undefined>(undefined);

export function CartWidgetProvider({ children }: { children: ReactNode }) {
  const [widgetState, setWidgetState] = useState<CartWidgetState>('minimized');

  const toggleExpanded = () => {
    setWidgetState(prev => prev === 'expanded' ? 'minimized' : 'expanded');
  };

  const minimize = () => setWidgetState('minimized');
  const hide = () => setWidgetState('hidden');
  const show = () => setWidgetState('minimized');

  return (
    <CartWidgetContext.Provider
      value={{
        widgetState,
        setWidgetState,
        toggleExpanded,
        minimize,
        hide,
        show,
      }}
    >
      {children}
    </CartWidgetContext.Provider>
  );
}

export function useCartWidget() {
  const context = useContext(CartWidgetContext);
  if (context === undefined) {
    throw new Error('useCartWidget must be used within a CartWidgetProvider');
  }
  return context;
}
