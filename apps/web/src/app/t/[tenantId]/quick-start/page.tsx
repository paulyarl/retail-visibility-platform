'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Rocket, Package, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type Scenario = {
  id: string;
  name: string;
  categoryCount: number;
  sampleProductCount: number;
};

type EligibilityResponse = {
  eligible: boolean;
  productCount: number;
  rateLimitReached: boolean;
  resetAt?: number;
  recommendation: string;
};

export default function QuickStartPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('grocery');
  const [productCount, setProductCount] = useState<number>(50);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Fetch scenarios and eligibility on mount
  useEffect(() => {
    fetchScenarios();
    checkEligibility();
  }, []);

  const fetchScenarios = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/quick-start/scenarios`);
      const data = await res.json();
      setScenarios(data.scenarios);
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    }
  };

  const checkEligibility = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/tenants/${tenantId}/quick-start/eligibility`);
      const data = await res.json();
      setEligibility(data);
    } catch (err) {
      console.error('Failed to check eligibility:', err);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/v1/tenants/${tenantId}/quick-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Show success state
  if (success && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-12">
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
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Rocket className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Quick Start: Jumpstart Your Inventory
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Get started fast with pre-built product templates. Customize them to match your business!
            </p>
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
                  onClick={() => setSelectedScenario(scenario.id)}
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
