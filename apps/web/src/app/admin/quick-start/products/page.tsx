'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Badge } from '@/components/ui';
import { motion } from 'framer-motion';

interface Tenant {
  id: string;
  name: string;
  organizationId: string;
}

interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultProductCount: number;
}

// All 19 business types (aligned with backend quick-start scenarios)
const businessTypes: BusinessType[] = [
  { id: 'grocery', name: 'Grocery Store', icon: '🛒', description: 'Fresh produce, dairy, meat, packaged goods', defaultProductCount: 20 },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', description: 'Medications, health products, supplements', defaultProductCount: 15 },
  { id: 'fashion', name: 'Fashion Boutique', icon: '👗', description: 'Clothing, accessories, footwear', defaultProductCount: 15 },
  { id: 'electronics', name: 'Electronics Store', icon: '📱', description: 'Phones, computers, tech accessories', defaultProductCount: 12 },
  { id: 'home_garden', name: 'Home & Garden', icon: '🏡', description: 'Furniture, decor, outdoor supplies', defaultProductCount: 15 },
  { id: 'health_beauty', name: 'Health & Beauty', icon: '💄', description: 'Cosmetics, skincare, personal care', defaultProductCount: 15 },
  { id: 'sports_outdoors', name: 'Sports & Outdoors', icon: '⚽', description: 'Athletic gear, camping, fitness', defaultProductCount: 15 },
  { id: 'toys_games', name: 'Toys & Games', icon: '🎮', description: 'Children\'s toys, board games, puzzles', defaultProductCount: 12 },
  { id: 'automotive', name: 'Automotive', icon: '🚗', description: 'Car parts, accessories, maintenance', defaultProductCount: 12 },
  { id: 'books_media', name: 'Books & Media', icon: '📚', description: 'Books, music, movies, magazines', defaultProductCount: 12 },
  { id: 'pet_supplies', name: 'Pet Supplies', icon: '🐾', description: 'Pet food, toys, accessories', defaultProductCount: 12 },
  { id: 'office_supplies', name: 'Office Supplies', icon: '📎', description: 'Stationery, paper, office equipment', defaultProductCount: 12 },
  { id: 'jewelry', name: 'Jewelry', icon: '💎', description: 'Rings, necklaces, watches, accessories', defaultProductCount: 10 },
  { id: 'baby_kids', name: 'Baby & Kids', icon: '👶', description: 'Baby products, children\'s items', defaultProductCount: 15 },
  { id: 'arts_crafts', name: 'Arts & Crafts', icon: '🎨', description: 'Art supplies, craft materials, hobbies', defaultProductCount: 12 },
  { id: 'hardware_tools', name: 'Hardware & Tools', icon: '🔧', description: 'Power tools, hand tools, building materials', defaultProductCount: 15 },
  { id: 'furniture', name: 'Furniture', icon: '🛋️', description: 'Living room, bedroom, office furniture', defaultProductCount: 12 },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', description: 'Prepared foods, menu items, beverages', defaultProductCount: 15 },
  { id: 'general', name: 'General Store', icon: '🏪', description: 'Mixed merchandise, variety store', defaultProductCount: 20 },
];

export default function AdminQuickStartProductsPage() {
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number>(15);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [categoriesCreated, setCategoriesCreated] = useState(0);
  const [generateImages, setGenerateImages] = useState<boolean>(false);
  const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');
  const [textModel, setTextModel] = useState<'openai' | 'google'>('openai');
  const [imageModel, setImageModel] = useState<'openai' | 'google'>('openai');

  // Load tenants on mount
  useEffect(() => {
    loadTenants();
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

  // Update product count when business type changes
  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    const type = businessTypes.find(t => t.id === typeId);
    if (type) {
      setProductCount(type.defaultProductCount);
    }
  };

  const handleGenerate = async () => {
    if (!selectedType || !selectedTenant) return;

    setIsGenerating(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Use the existing tenant-scoped quick-start endpoint (platform admin bypasses rate limits)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1/tenants/${selectedTenant}/quick-start`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          scenario: selectedType,
          productCount,
          assignCategories: true,
          createAsDrafts: true,
          generateImages,
          imageQuality,
          textModel,
          imageModel,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401 || response.status === 403) {
          setError(data.message || 'You do not have permission to use Product Quick Start');
          setIsGenerating(false);
          return;
        }
        throw new Error(data.message || 'Failed to generate products');
      }

      const data = await response.json();
      setGeneratedCount(data.productsCreated || 0);
      setCategoriesCreated(data.categoriesCreated || 0);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (success) {
    const selectedTenantName = tenants.find(t => t.id === selectedTenant)?.name || 'tenant';
    const selectedTypeName = businessTypes.find(t => t.id === selectedType)?.name || 'products';
    return (
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-4">
              Products Created Successfully!
            </h1>
            <p className="text-lg text-neutral-600 mb-2">
              Generated <span className="font-bold text-primary-600">{generatedCount} products</span>
              {categoriesCreated > 0 && (
                <> and <span className="font-bold text-purple-600">{categoriesCreated} categories</span></>
              )}
            </p>
            <p className="text-sm text-neutral-500 mb-2">
              for <strong>{selectedTenantName}</strong>
            </p>
            <p className="text-xs text-neutral-400 mb-6">
              Business type: {selectedTypeName}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => router.push(`/t/${selectedTenant}/items?filter=inactive`)}>
                View Products
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${selectedTenant}/categories`)}>
                View Categories
              </Button>
              <Button variant="ghost" onClick={() => {
                setSuccess(false);
                setSelectedType(null);
                setSelectedTenant(null);
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
            Generate products for any tenant instantly with AI
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

        {/* Business Type Selection */}
        {selectedTenant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">2. Select Business Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {businessTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeChange(type.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedType === type.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="text-2xl">{type.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-neutral-900 text-sm truncate">
                          {type.name}
                        </h4>
                        <p className="text-xs text-neutral-500 line-clamp-2">
                          {type.description}
                        </p>
                      </div>
                      {selectedType === type.id && (
                        <div className="text-primary-600 flex-shrink-0">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Product Count Slider */}
        {selectedType && selectedTenant && (
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
                  min="5"
                  max="30"
                  value={productCount}
                  onChange={(e) => setProductCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>5 min</span>
                  <span>30 max</span>
                </div>
                
                {/* Quick Presets */}
                <div className="flex gap-2 mt-4">
                  {[
                    { value: 5, label: 'Tiny' },
                    { value: 10, label: 'Small' },
                    { value: 15, label: 'Medium' },
                    { value: 20, label: 'Standard' },
                    { value: 30, label: 'Large' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setProductCount(preset.value)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        productCount === preset.value
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* AI Provider Selection */}
        {selectedType && selectedTenant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">4. AI Settings</h3>
              
              {/* Text Model Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-neutral-700 mb-3">
                  AI Provider for Product Generation
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setTextModel('openai')}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      textModel === 'openai'
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      🤖 OpenAI GPT-4
                    </span>
                    <span className="text-xs opacity-75 mt-1 block">Fast & reliable</span>
                  </button>
                  <button
                    onClick={() => setTextModel('google')}
                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      textModel === 'google'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      ✨ Google Gemini
                    </span>
                    <span className="text-xs opacity-75 mt-1 block">Free tier available</span>
                  </button>
                </div>
                
                {textModel === 'google' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 flex items-start gap-2">
                      <span className="text-amber-500">⏳</span>
                      <span>
                        <strong>Slower generation:</strong> Google Gemini has rate limits. 
                        If limits are hit, the system will wait ~40 seconds before retrying.
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Photo Generation Toggle */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-neutral-700">
                    Generate AI Product Photos
                  </label>
                  <button
                    onClick={() => setGenerateImages(!generateImages)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      generateImages ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        generateImages ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {generateImages && (
                  <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                    <p className="text-xs text-neutral-600">
                      ⚠️ Enabling photos will increase generation time to 2-3 minutes
                    </p>
                    
                    {/* Image Quality */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-2">
                        Image Quality
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImageQuality('standard')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            imageQuality === 'standard'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          onClick={() => setImageQuality('hd')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            imageQuality === 'hd'
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          HD (Higher quality)
                        </button>
                      </div>
                    </div>
                    
                    {/* Image Model */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-2">
                        Image AI Model
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImageModel('openai')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            imageModel === 'openai'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🎨 DALL-E 3
                        </button>
                        <button
                          onClick={() => setImageModel('google')}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            imageModel === 'google'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🖼️ Imagen 3
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
            disabled={!selectedType || !selectedTenant || isGenerating}
            onClick={handleGenerate}
            className="px-12"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Products...
              </>
            ) : (
              <>🚀 Generate Products</>
            )}
          </Button>
          
          {isGenerating && (
            <p className="text-sm text-neutral-500 mt-3">
              {generateImages 
                ? '⏳ AI is generating products with photos. This may take 2-3 minutes...'
                : '⏳ AI is generating realistic products with descriptions. This may take 30-60 seconds...'
              }
            </p>
          )}
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
