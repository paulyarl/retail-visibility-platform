'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Sparkles, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  categoryCount?: number;
  sampleProductCount?: number;
  cachedCount?: number;
}

interface QuickStartWizardProps {
  scenarios: Scenario[];
  onGenerate: (params: {
    scenario: string;
    productCount: number;
    assignCategories: boolean;
    createAsDrafts: boolean;
    generateImages: boolean;
    imageQuality: 'standard' | 'hd';
  }) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  success?: boolean;
  result?: any;
  onReset?: () => void;
  showTenantSelector?: boolean;
  tenants?: Array<{ id: string; name: string }>;
  selectedTenant?: string | null;
  onTenantSelect?: (tenantId: string) => void;
}

export default function QuickStartWizard({
  scenarios,
  onGenerate,
  loading = false,
  error = null,
  success = false,
  result = null,
  onReset,
  showTenantSelector = false,
  tenants = [],
  selectedTenant = null,
  onTenantSelect,
}: QuickStartWizardProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [productCount, setProductCount] = useState<number>(25);
  const [generateImages, setGenerateImages] = useState<boolean>(false);
  const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');

  const handleGenerate = async () => {
    if (!selectedScenario) return;
    if (showTenantSelector && !selectedTenant) return;

    await onGenerate({
      scenario: selectedScenario,
      productCount,
      assignCategories: true,
      createAsDrafts: true,
      generateImages,
      imageQuality,
    });
  };

  // Success state
  if (success && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              🎉 {result.productsCreated} Products Created!
            </h1>

            <p className="text-neutral-600 mb-2">
              Your products are ready to customize and activate!
            </p>
            {generateImages && (
              <p className="text-sm text-purple-600 mb-8">
                ✨ Including professional AI-generated images
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{result.categoriesCreated}</div>
                <div className="text-sm text-neutral-600">Categories</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{result.productsCreated}</div>
                <div className="text-sm text-neutral-600">Products</div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={onReset}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                Generate More
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main wizard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-4">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-neutral-700">AI-Powered Quick Start</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Launch Your Store
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              In Minutes
            </span>
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Generate realistic products with AI-powered descriptions and professional images
          </p>
        </motion.div>

        {/* Tenant Selector (Admin only) */}
        {showTenantSelector && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">1. Select Tenant</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {tenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => onTenantSelect?.(tenant.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedTenant === tenant.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-neutral-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold text-neutral-900 truncate">{tenant.name}</div>
                    <div className="text-xs text-neutral-500 mt-1 truncate">{tenant.id}</div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Scenario Selection */}
        {(!showTenantSelector || selectedTenant) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                {showTenantSelector ? '2.' : '1.'} Choose Your Business Type
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario.id)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      selectedScenario === scenario.id
                        ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg'
                        : 'border-neutral-200 hover:border-purple-300 hover:shadow-md'
                    }`}
                  >
                    <div className="text-3xl mb-3">{scenario.icon}</div>
                    <h4 className="font-bold text-neutral-900 mb-2">{scenario.name}</h4>
                    <p className="text-sm text-neutral-600 mb-3">{scenario.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      {scenario.cachedCount !== undefined && scenario.cachedCount > 0 && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                          ✓ {scenario.cachedCount} cached
                        </span>
                      )}
                      {scenario.sampleProductCount && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                          ~{scenario.sampleProductCount} products
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Product Count & Options */}
        {selectedScenario && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-6">
                {showTenantSelector ? '3.' : '2.'} Configure Products
              </h3>
              
              {/* Product Count */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-neutral-700">Number of Products</span>
                  <span className="text-3xl font-bold text-purple-600">{productCount}</span>
                </div>
                
                {/* Quick Presets */}
                <div className="flex gap-2 mb-4 flex-wrap justify-center">
                  {[5, 10, 25, 50, 100, 150, 200].map((count) => (
                    <button
                      key={count}
                      onClick={() => setProductCount(count)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        productCount === count
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                          : 'border-neutral-200 hover:border-purple-300 text-neutral-700'
                      }`}
                    >
                      {count === 5 ? 'Test (5)' : count === 10 ? 'Tiny (10)' : count}
                    </button>
                  ))}
                </div>
                
                {/* Slider */}
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="1"
                  value={productCount}
                  onChange={(e) => setProductCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>5 min</span>
                  <span>200 max</span>
                </div>
              </div>

              {/* Image Generation Options */}
              <div className="pt-6 border-t border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={generateImages}
                    onChange={(e) => setGenerateImages(e.target.checked)}
                    className="w-5 h-5 rounded border-neutral-300 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-neutral-900">Generate AI Product Images</span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">
                      Professional product photography with DALL-E 3
                    </p>
                  </div>
                </label>
                
                {generateImages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="ml-8 space-y-3"
                  >
                    <div>
                      <label className="text-sm font-medium text-neutral-700 mb-2 block">Image Quality:</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setImageQuality('standard')}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            imageQuality === 'standard'
                              ? 'border-green-500 bg-green-50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="font-medium text-neutral-900">Standard</div>
                          <div className="text-xs text-neutral-600">$0.04 per image</div>
                        </button>
                        <button
                          onClick={() => setImageQuality('hd')}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            imageQuality === 'hd'
                              ? 'border-green-500 bg-green-50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="font-medium text-neutral-900">HD</div>
                          <div className="text-xs text-neutral-600">$0.08 per image</div>
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm text-blue-900">
                        <strong>Estimated cost:</strong> ${(productCount * (imageQuality === 'hd' ? 0.08 : 0.04)).toFixed(2)}
                      </div>
                      <div className="text-xs text-blue-700 mt-1">
                        ⏱️ Generation time: ~{Math.ceil(productCount * (generateImages ? 12 : 6) / 60)} minutes
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-red-700">{error}</div>
            </div>
          </motion.div>
        )}

        {/* Generate Button */}
        <div className="text-center">
          <button
            disabled={!selectedScenario || loading || (showTenantSelector && !selectedTenant)}
            onClick={handleGenerate}
            className="px-12 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed text-lg"
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <Loader2 className="animate-spin w-6 h-6" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center gap-3">
                <Rocket className="w-6 h-6" />
                Generate Products
              </span>
            )}
          </button>
          
          {!loading && (
            <p className="text-sm text-neutral-500 mt-4">
              💡 Using AI-powered generation with intelligent caching
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
