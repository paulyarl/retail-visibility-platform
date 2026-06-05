'use client';

import { useEffect, useState } from 'react';
import { UniversalProvider } from '@/providers/UniversalProvider';

// Client-side only wrapper component
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <UniversalProvider>
      {children}
    </UniversalProvider>
  );
}

// Lazy load the component that uses context
const RandomFeaturedProducts = () => {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    import('@/components/directory/RandomFeaturedProducts').then((module) => {
      setComponent(() => module.default);
    });
  }, []);

  if (!Component) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return <Component />;
};

// Next.js dynamic rendering configuration
export const dynamic = 'force-dynamic';

export default function TestFeaturedProductsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test: Universal API Singleton</h1>
              <p className="text-sm text-gray-500">Random Featured Products with ProductSingleton</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <ClientOnly>
          <RandomFeaturedProducts />
        </ClientOnly>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Universal API Singleton Test</h2>
            <p className="text-gray-600">
              This page demonstrates the new ProductSingleton system for public API data management.
            </p>
            <div className="mt-4 space-y-2 text-sm text-gray-500">
              <p>✅ ProductSingleton provides intelligent caching (15-minute TTL)</p>
              <p>✅ Location-aware featured products</p>
              <p>✅ Automatic error handling and retry</p>
              <p>✅ Performance metrics tracking</p>
              <p>✅ Singleton pattern eliminates duplicate API calls</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
