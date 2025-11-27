'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Badge } from '@/components/ui';
import { motion } from 'framer-motion';
import { Rocket, Package, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  organizationId: string;
}

type Scenario = {
  id: string;
  name: string;
  categoryCount: number;
  sampleProductCount: number;
};

export default function AdminProductQuickStartPage() {
  const router = useRouter();

  // Fallback scenarios
  const fallbackScenarios: Scenario[] = [
    { id: 'grocery', name: 'Grocery Store', categoryCount: 8, sampleProductCount: 50 },
    { id: 'fashion', name: 'Fashion Boutique', categoryCount: 7, sampleProductCount: 40 },
    { id: 'electronics', name: 'Electronics Store', categoryCount: 6, sampleProductCount: 30 },
    { id: 'general', name: 'General Store', categoryCount: 5, sampleProductCount: 35 },
  ];

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>(fallbackScenarios);
  const [selectedScenario, setSelectedScenario] = useState<string>('grocery');
  const [productCount, setProductCount] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Load tenants on mount
  useEffect(() => {
    loadTenants();
    fetchScenarios();
  }, []);

  // Filter tenants based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTenants(
        tenants.filter(
          (tenant) =>
            tenant.name.toLowerCase().includes(query) ||
            tenant.id.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, tenants]);

  const loadTenants = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/tenants`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load tenants');
      }

      const data = await response.json();
      setTenants(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const fetchScenarios = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${apiUrl}/api/v1/scenarios`, {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      setScenarios(data.scenarios);
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  };

  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      setProductCount(scenario.sampleProductCount);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTenant) return;

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${apiUrl}/api/v1/tenants/${selectedTenant}/quick-start`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          scenario: selectedScenario,
          productCount,
          assignCategories: true,
          createAsDrafts: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to generate products');
      }

      setResult(data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success && result) {
    const selectedTenantName = tenants.find(t => t.id === selectedTenant)?.name || 'tenant';
    return (
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              🎉 {result.productsCreated} Products Created!
            </h1>

            <p className="text-neutral-600 mb-2">
              Products created for <strong>{selectedTenantName}</strong>
            </p>
            <p className="text-sm text-neutral-500 mb-8">
              Your products are ready to customize and activate!
            </p>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push(`/t/${selectedTenant}/items?filter=inactive`)}>
                View Products
              </Button>
              <Button variant="secondary" onClick={() => {
                setSuccess(false);
                setResult(null);
                setSelectedTenant(null);
                setSelectedScenario('grocery');
              }}>
                Generate More
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-gradient-to-r from-red-500 to-orange-600 text-white">
            Admin Tool
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Product Quick Start
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Admin Panel
            </span>
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Generate sample products for any tenant instantly
          </p>
        </motion.div>

        {/* Tenant Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900">1. Select Tenant</h3>
              {!isLoadingTenants && (
                <Badge className="bg-neutral-100 text-neutral-700">
                  {filteredTenants.length} of {tenants.length}
                </Badge>
              )}
            </div>
            
            {isLoadingTenants ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-sm text-neutral-600 mt-2">Loading tenants...</p>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tenant Grid */}
                {filteredTenants.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No tenants found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredTenants.map((tenant) => (
                        <button
                          key={tenant.id}
                          onClick={() => setSelectedTenant(tenant.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            selectedTenant === tenant.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-neutral-200 hover:border-primary-300'
                          }`}
                        >
                          <div className="font-semibold text-neutral-900 truncate">{tenant.name}</div>
                          <div className="text-xs text-neutral-500 mt-1 truncate">{tenant.id}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </motion.div>

        {/* Scenario Selection */}
        {selectedTenant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">2. Select Business Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => handleScenarioChange(scenario.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedScenario === scenario.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-neutral-900">{scenario.name}</h4>
                      {selectedScenario === scenario.id && (
                        <CheckCircle2 className="w-5 h-5 text-primary-600" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge className="text-xs bg-blue-100 text-blue-800">
                        {scenario.sampleProductCount} products
                      </Badge>
                      <Badge className="text-xs bg-purple-100 text-purple-800">
                        {scenario.categoryCount} categories
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Product Count Slider */}
        {selectedScenario && selectedTenant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">3. Adjust Product Count</h3>
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700">
                    Number of Products
                  </span>
                  <span className="text-2xl font-bold text-primary-600">
                    {productCount}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={productCount}
                  onChange={(e) => setProductCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>10 min</span>
                  <span>100 max</span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
          >
            {error}
          </motion.div>
        )}

        {/* Generate Button */}
        <div className="text-center">
          <Button
            size="lg"
            disabled={!selectedScenario || !selectedTenant || loading}
            onClick={handleGenerate}
            className="px-12"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Generating...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5 mr-2" />
                Generate Products
              </>
            )}
          </Button>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/settings/admin')}
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Back to Admin
          </button>
        </div>
      </div>
    </div>
  );
}
