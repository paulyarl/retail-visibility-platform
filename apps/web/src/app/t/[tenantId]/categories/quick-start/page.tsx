'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, Badge } from '@/components/ui';
import { motion } from 'framer-motion';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

type BusinessType = 'grocery' | 'fashion' | 'electronics' | 'general';

const businessTypes = [
  {
    id: 'grocery' as BusinessType,
    name: 'Grocery Store',
    icon: '🛒',
    description: 'Fresh produce, dairy, meat, bakery, beverages',
    categoryCount: 15,
    examples: ['Fresh Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Beverages'],
  },
  {
    id: 'fashion' as BusinessType,
    name: 'Fashion Retail',
    icon: '👗',
    description: 'Clothing, shoes, accessories, jewelry',
    categoryCount: 12,
    examples: ['Women\'s Clothing', 'Men\'s Clothing', 'Shoes', 'Accessories', 'Jewelry'],
  },
  {
    id: 'electronics' as BusinessType,
    name: 'Electronics Store',
    icon: '📱',
    description: 'Phones, computers, audio, gaming, accessories',
    categoryCount: 10,
    examples: ['Mobile Phones', 'Computers', 'Audio', 'Gaming', 'Smart Home'],
  },
  {
    id: 'general' as BusinessType,
    name: 'General Retail',
    icon: '🏪',
    description: 'Mixed merchandise, variety store',
    categoryCount: 20,
    examples: ['Home & Garden', 'Health & Beauty', 'Sports', 'Toys', 'Books'],
  },
];

export default function CategoryQuickStartPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId as string;

  // Check tier AND role access for category quick start (Starter+ tier, MANAGER+ role)
  const { canAccess, getFeatureBadgeWithPermission } = useTenantTier(tenantId);
  const hasCategoryQuickStart = canAccess('category_quick_start', 'canManage');
  const quickStartBadge = getFeatureBadgeWithPermission('category_quick_start', 'canManage', 'generate categories');

  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [categoryCount, setCategoryCount] = useState<number>(15);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Update category count when business type changes
  const handleTypeChange = (typeId: BusinessType) => {
    setSelectedType(typeId);
    const type = businessTypes.find(t => t.id === typeId);
    if (type) {
      setCategoryCount(type.categoryCount);
    }
  };

  const handleGenerate = async () => {
    if (!selectedType) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Get access token from localStorage
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1/tenants/${tenantId}/categories/quick-start`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          businessType: selectedType,
          categoryCount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // Check if it's an auth/permission error
        if (response.status === 401 || response.status === 403) {
          setError(data.message || 'You do not have permission to use Category Quick Start');
          setIsGenerating(false);
          return;
        }
        throw new Error(data.message || 'Failed to generate categories');
      }

      const data = await response.json();
      setGeneratedCount(data.categoriesCreated);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Show tier gate for Google-Only users
  if (quickStartBadge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 border-2 border-blue-200">
            <div className="text-6xl mb-4 text-center">🔒</div>
            <h1 className="text-3xl font-bold text-center mb-4 text-gray-900">
              Category Quick Start
              <span className={`ml-3 text-sm px-3 py-1 rounded ${quickStartBadge.colorClass} text-white font-semibold`}>
                {quickStartBadge.text}
              </span>
            </h1>
            
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <p className="text-center text-gray-700 text-lg">
                {quickStartBadge.tooltip}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                What you get when you upgrade:
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span><strong>AI Category Generation:</strong> Instantly create categories for your business type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span><strong>Public Storefront:</strong> Share your products with customers online</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span><strong>Enhanced SEO:</strong> Better visibility on search engines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">✓</span>
                  <span><strong>Mobile-Responsive Design:</strong> Perfect on any device</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => router.push(`/t/${tenantId}/categories`)}
                variant="secondary"
              >
                Add Categories Manually
              </Button>
              <Button
                onClick={() => router.push(`/t/${tenantId}/settings`)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                View Upgrade Options
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Show blocked state if there's an error
  if (error && !isGenerating && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 border-2 border-red-200">
            <div className="text-6xl mb-4 text-center">🚫</div>
            <h1 className="text-3xl font-bold text-center mb-4 text-red-600">
              Category Quick Start Unavailable
            </h1>
            
            <div className="bg-red-50 rounded-lg p-6 mb-6">
              <p className="text-center text-gray-700 mb-2">
                <strong>Reason:</strong>
              </p>
              <p className="text-center text-gray-600">
                {error}
              </p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Common reasons:
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Authentication:</strong> You must be logged in to use Category Quick Start</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Permissions:</strong> Only the organization owner or platform admins can use this feature</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span><strong>Server Error:</strong> Unable to connect to the server</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-center">
              <Button 
                variant="secondary"
                onClick={() => router.push(`/t/${tenantId}/categories`)}
              >
                Go to Categories
              </Button>
              <Button 
                variant="primary"
                onClick={() => router.push(`/t/${tenantId}/dashboard`)}
              >
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-4">
              Categories Created Successfully!
            </h1>
            <p className="text-lg text-neutral-600 mb-6">
              Generated <span className="font-bold text-primary-600">{generatedCount} categories</span> for your store
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push(`/t/${tenantId}/categories`)}>
                View Categories
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/items`)}>
                Manage Products
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            Category Quick Start
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Generate Product Categories
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              In 1 Second
            </span>
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Select your business type and we'll create a complete category structure instantly
          </p>
        </motion.div>

        {/* Business Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {businessTypes.map((type, index) => (
            <motion.div
              key={type.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className="cursor-pointer"
                onClick={() => handleTypeChange(type.id)}
              >
                <Card
                  className={`p-6 transition-all ${
                    selectedType === type.id
                      ? 'ring-2 ring-primary-500 shadow-lg scale-105'
                      : 'hover:shadow-md hover:scale-102'
                  }`}
                >
                  <div className="flex items-start gap-4">
                  <div className="text-5xl">{type.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-neutral-900 mb-2">
                      {type.name}
                    </h3>
                    <p className="text-sm text-neutral-600 mb-3">
                      {type.description}
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="text-xs bg-purple-100 text-purple-800">
                        {type.categoryCount} categories
                      </Badge>
                    </div>
                    <div className="text-xs text-neutral-500">
                      <strong>Examples:</strong> {type.examples.join(', ')}
                    </div>
                  </div>
                  {selectedType === type.id && (
                    <div className="text-primary-600">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                </Card>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Category Count Slider */}
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 max-w-md mx-auto"
          >
            <Card className="p-6">
              <label className="block mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700">
                    Number of Categories
                  </span>
                  <span className="text-2xl font-bold text-primary-600">
                    {categoryCount}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={categoryCount}
                  onChange={(e) => setCategoryCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>5 min</span>
                  <span>30 max</span>
                </div>
              </label>
              <p className="text-xs text-neutral-600 text-center">
                We'll generate {categoryCount} categories based on your {businessTypes.find(t => t.id === selectedType)?.name.toLowerCase()} selection
              </p>
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
            disabled={!selectedType || isGenerating}
            onClick={handleGenerate}
            className="px-12"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>⚡ Generate Categories</>
            )}
          </Button>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push(`/t/${tenantId}/categories`)}
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Back to Categories
          </button>
        </div>
      </div>
    </div>
  );
}
