'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Rocket, Package, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ContextBadges } from '@/components/ContextBadges';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import { Badge } from '@/components/ui';
import CreationCapacityWarning from '@/components/capacity/CreationCapacityWarning';

type Scenario = {
  id: string;
  name: string;
  categoryCount: number;
  sampleProductCount: number;
};

type EligibilityResponse = {
  eligible: boolean;
  productCount: number;
  productLimit: number;
  isPlatformAdmin: boolean;
  rateLimitReached: boolean;
  resetAt?: number;
  recommendation: string;
};

export default function QuickStartPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  // Check tier AND role access for full Quick Start wizard (Professional+ tier, MANAGER+ role)
  const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
  const hasFullQuickStart = canAccess('quick_start_wizard_full', 'canManage');
  const hasBarcodeScanning = canAccess('barcode_scan', 'canEdit');
  const wizardBadge = getFeatureBadgeWithPermission('quick_start_wizard_full', 'canManage', 'use Quick Start');
  const scanBadge = getFeatureBadgeWithPermission('barcode_scan', 'canEdit', 'scan products');

  // Fallback scenarios in case API fails
  const fallbackScenarios: Scenario[] = [
    { id: 'grocery', name: 'Grocery Store', categoryCount: 8, sampleProductCount: 50 },
    { id: 'fashion', name: 'Fashion Boutique', categoryCount: 7, sampleProductCount: 40 },
    { id: 'electronics', name: 'Electronics Store', categoryCount: 6, sampleProductCount: 30 },
    { id: 'general', name: 'General Store', categoryCount: 5, sampleProductCount: 35 },
  ];

  const [scenarios, setScenarios] = useState<Scenario[]>(fallbackScenarios);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('grocery');
  const [productCount, setProductCount] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Update product count when scenario changes
  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      setProductCount(scenario.sampleProductCount);
    }
  };

  // Fetch scenarios and eligibility on mount
  useEffect(() => {
    fetchScenarios();
    checkEligibility();
  }, []);

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

  const checkEligibility = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(`${apiUrl}/api/v1/tenants/${tenantId}/quick-start/eligibility`, {
        headers,
        credentials: 'include',
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Unable to check eligibility');
        return;
      }
      
      const data = await res.json();
      setEligibility(data);
    } catch (err: any) {
      console.error('Failed to check eligibility:', err);
      setError('Unable to connect to server');
    }
  };

  const handleGenerate = async () => {
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
      
      const res = await fetch(`${apiUrl}/api/v1/tenants/${tenantId}/quick-start`, {
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

  const handleViewProducts = () => {
    router.push(`/t/${tenantId}/items?filter=inactive`);
  };

  // Show blocked state if there's an error from eligibility check
  if (error && !loading && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <ContextBadges tenant={{ id: tenantId, name: '' }} contextLabel="Quick Start" />
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-red-200 dark:border-red-800">
            {/* Blocked Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Blocked Message */}
            <h1 className="text-3xl font-bold text-center mb-4 text-red-600 dark:text-red-400">
              Quick Start Unavailable
            </h1>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 mb-6">
              <p className="text-center text-gray-700 dark:text-gray-300 mb-2">
                <strong>Reason:</strong>
              </p>
              <p className="text-center text-gray-600 dark:text-gray-400">
                {error}
              </p>
            </div>

            {/* Common Reasons */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Common reasons:
              </h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Authentication:</strong> You must be logged in to use Quick Start</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Permissions:</strong> Only the organization owner or platform admins can use Quick Start</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Rate Limit:</strong> Quick Start can only be used once per 24 hours</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Product Limit:</strong> You already have {eligibility?.productLimit || 500}+ products</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/t/${tenantId}/items`)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Go to Products
              </button>
              <button
                onClick={() => router.push(`/t/${tenantId}/dashboard`)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (success && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <ContextBadges tenant={{ id: tenantId, name: '' }} contextLabel="Quick Start" />
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              🎉 {result.productsCreated} Products Created!
            </h1>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Your products are ready to customize and activate!
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.productsCreated}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Products</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {result.categoriesCreated}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.categorizedProducts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Categorized</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {result.inStockProducts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">In Stock</div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Next Steps
              </h3>
              <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">1.</span>
                  <span>Review each product and customize (name, price, description)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">2.</span>
                  <span>Add your own product photos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">3.</span>
                  <span>Activate products when ready to publish</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">4.</span>
                  <span>Products will appear in feeds only when activated</span>
                </li>
              </ol>
            </div>

            {/* Action Button */}
            <button
              onClick={handleViewProducts}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              View Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show main wizard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ContextBadges tenant={{ id: tenantId, name: '' }} contextLabel="Quick Start" />
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Quick Start: Add Products Fast
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Choose the best method to populate your inventory
          </p>
          {eligibility?.isPlatformAdmin && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-300 dark:border-purple-700 rounded-full">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                Platform Admin: All limits bypassed
              </span>
            </div>
          )}
        </div>

        {/* Two Options: Generate or Scan */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Option 1: Generate Products */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Rocket className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-white">
              Generate Products
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Create 25-100 realistic products instantly with AI
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Perfect for testing and demos</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Auto-categorized with prices</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Ready in 1 second</span>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
              Best for: New stores, testing, demos
            </div>
          </div>

          {/* Option 2: SKU Scanning */}
          <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 ${hasBarcodeScanning ? 'border-green-500 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'} relative ${!hasBarcodeScanning ? 'opacity-60' : ''}`}>
            <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </div>
            {!hasBarcodeScanning && (
              <div className="absolute -top-3 left-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                PRO+
              </div>
            )}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-white">
              Scan Products
              {!hasBarcodeScanning && (
                <span className="ml-2 text-sm text-purple-600 dark:text-purple-400">(Pro+)</span>
              )}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Scan barcodes to add real products with images
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Automatic product info & images</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>USB scanner or manual entry</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span>Real products, real data</span>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
              Best for: Real inventory, existing products
            </div>

            <button
              onClick={() => router.push(`/t/${tenantId}/scan`)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Start Scanning
            </button>
          </div>
        </div>

        {/* Generate Products Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              Generate Products Configuration
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Customize your generated product set
            </p>
          </div>

          {/* Capacity Warning */}
          <div className="mb-6">
            <CreationCapacityWarning 
              type="sku" 
              tenantId={tenantId}
            />
          </div>

          {/* Eligibility Warning */}
          {eligibility && !eligibility.eligible && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {eligibility.rateLimitReached
                    ? 'Rate limit reached. You can use Quick Start once per 24 hours.'
                    : eligibility.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {/* Scenario Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              What type of business do you have?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioChange(scenario.id)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                    selectedScenario === scenario.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    {scenario.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {scenario.categoryCount} categories
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Product Count Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              How many products to start with?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 25, label: 'Small', desc: 'Perfect for testing' },
                { value: 50, label: 'Medium', desc: 'Recommended' },
                { value: 100, label: 'Large', desc: 'Full catalog' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setProductCount(option.value)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-center ${
                    productCount === option.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {option.value}
                  </div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Auto-assign to categories</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Create as drafts (inactive until you review)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Realistic prices and product names</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-3 px-6 rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || (eligibility ? !eligibility.eligible : false)}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Generate Products
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
