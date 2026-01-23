/**
 * Singleton Migration Test Page
 * 
 * Phase 1: Featured Products, Directory Categories, Featured Stores
 * Phase 2: Producer-Consumer Integration, Live Testing, Performance Monitoring
 */

'use client';

import { useEffect, useState } from 'react';
import { UniversalProvider } from '@/providers/UniversalProvider';

// Client-side only wrapper
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
          <p className="text-gray-600">Loading migration test...</p>
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

// Phase 1 Components
const FeaturedProductsTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/FeaturedProductsTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const DirectoryCategoriesTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/DirectoryCategoriesTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const FeaturedStoresTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/FeaturedStoresTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

// Phase 2 Components
const ProducerConsumerTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/ProducerConsumerTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const StorefrontIntegrationTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/StorefrontIntegrationTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const CachePerformanceTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/CachePerformanceTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const ErrorRecoveryTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/ErrorRecoveryTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

const StorePublishTestComponent = () => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      import('@/components/test/StorePublishTest').then((module) => {
        setComponent(() => module.default);
      });
    }
  }, [loaded]);

  return Component ? <Component onTestComplete={(results: any) => {}} /> : (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
};

// Next.js dynamic rendering configuration
export const dynamic = 'force-dynamic';

export default function SingletonMigrationTestPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'stores' | 'producer-consumer' | 'storefront' | 'cache' | 'error-recovery' | 'store-publish' | 'metrics'>('producer-consumer');
  const [testResults, setTestResults] = useState<any>({});

  // MigrationMetrics component defined inside main component to access testResults
  const MigrationMetricsComponent = () => {
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      if (!loaded) {
        setLoaded(true);
        import('@/components/test/MigrationMetrics').then((module) => {
          setComponent(() => module.default);
        });
      }
    }, [loaded]);

    return Component ? <Component testResults={testResults} /> : (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  };

  const tabs = [
    // Phase 1 Tabs
    { id: 'products', label: 'Featured Products', icon: '🛍️', phase: 1 },
    { id: 'categories', label: 'Categories', icon: '📂', phase: 1 },
    { id: 'stores', label: 'Featured Stores', icon: '🏪', phase: 1 },
    
    // Phase 2 Tabs
    { id: 'producer-consumer', label: 'Producer-Consumer', icon: '🔄', phase: 2 },
    { id: 'storefront', label: 'Storefront Integration', icon: '🏬', phase: 2 },
    { id: 'cache', label: 'Cache Performance', icon: '⚡', phase: 2 },
    { id: 'error-recovery', label: 'Error Recovery', icon: '🛡️', phase: 2 },
    { id: 'store-publish', label: 'Store Publish', icon: '📢', phase: 2 },
    
    // Metrics Tab
    { id: 'metrics', label: 'Performance Metrics', icon: '📊', phase: 0 },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'products':
        return <FeaturedProductsTestComponent />;
      case 'categories':
        return <DirectoryCategoriesTestComponent />;
      case 'stores':
        return <FeaturedStoresTestComponent />;
      case 'producer-consumer':
        return <ProducerConsumerTestComponent />;
      case 'storefront':
        return <StorefrontIntegrationTestComponent />;
      case 'cache':
        return <CachePerformanceTestComponent />;
      case 'error-recovery':
        return <ErrorRecoveryTestComponent />;
      case 'store-publish':
        return <StorePublishTestComponent />;
      case 'metrics':
        return <MigrationMetricsComponent />;
      default:
        return null;
    }
  };

  const getTabStatus = (tabId: string) => {
    const result = testResults[tabId];
    if (!result) return 'pending';
    if (result.success) return 'success';
    return 'error';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPhaseBadgeColor = (phase: number) => {
    switch (phase) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Singleton Migration Test</h1>
              <p className="text-sm text-gray-500">Phase 1 & 2: Producer-Consumer Integration & Live Testing</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Status: <span className="font-medium">Phase 2 Testing</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const status = getTabStatus(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`
                    flex items-center space-x-2 py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.phase > 0 && (
                    <span className={`px-1.5 py-0.5 text-xs rounded ${getPhaseBadgeColor(tab.phase)}`}>
                      P{tab.phase}
                    </span>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)}`}>
                    {status === 'success' ? '✅' : status === 'error' ? '❌' : '⏳'}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main>
        <ClientOnly>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Test Progress Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-blue-900 mb-4">Migration Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {tabs.map((tab) => {
                  const status = getTabStatus(tab.id);
                  const result = testResults[tab.id];
                  return (
                    <div key={tab.id} className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{tab.label}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)}`}>
                          {status === 'success' ? '✅ Passed' : status === 'error' ? '❌ Failed' : '⏳ Pending'}
                        </span>
                      </div>
                      {result && (
                        <div className="text-sm text-gray-600">
                          <div>Response Time: {result.responseTime}ms</div>
                          <div>Cache Hit: {result.fromCache ? 'Yes' : 'No'}</div>
                          <div>Items Loaded: {result.itemCount || 0}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase 2 Features Banner */}
            {activeTab !== 'metrics' && tabs.find(t => t.id === activeTab)?.phase === 2 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">🚀 Phase 2 Testing</h3>
                <p className="text-purple-700">
                  Testing advanced producer-consumer patterns, real-time storefront integration, 
                  cache performance optimization, and error recovery mechanisms.
                </p>
              </div>
            )}

            {/* Active Tab Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                {renderActiveTab()}
              </div>
            </div>
          </div>
        </ClientOnly>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Singleton Migration Test Suite</h2>
            <p className="text-gray-600">
              Testing the migration from direct API calls to singleton middleware system with producer-consumer architecture.
            </p>
            <div className="mt-4 space-y-2 text-sm text-gray-500">
              <p>✅ Phase 1: ProductSingleton, CategorySingleton, StoreSingleton</p>
              <p>🚀 Phase 2: Producer-Consumer Integration, Live Testing, Performance Monitoring</p>
              <p>⚡ Cache Performance: Intelligent caching with TTL and invalidation</p>
              <p>🛡️ Error Recovery: Graceful fallback and retry mechanisms</p>
              <p>🏬 Storefront Integration: Real-time admin-to-storefront data flow</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
