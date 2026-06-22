'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@mantine/core';
import { Badge } from '@/components/ui';
import { motion } from 'framer-motion';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { itemsService } from '@/services/ItemsService';


interface Tenant {
  id: string;
  name: string;
  organization?: { id: string; name: string } | null;
}

interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultProductCount: number;
}

const businessTypes: BusinessType[] = [
  { id: 'grocery', name: 'Grocery Store', icon: '🛒', description: 'Fresh produce, dairy, meat, packaged goods', defaultProductCount: 20 },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', description: 'Medications, health products, supplements', defaultProductCount: 15 },
  { id: 'fashion', name: 'Fashion Boutique', icon: '👗', description: 'Clothing, accessories, footwear', defaultProductCount: 15 },
  { id: 'electronics', name: 'Electronics Store', icon: '📱', description: 'Phones, computers, tech accessories', defaultProductCount: 12 },
  { id: 'home_garden', name: 'Home & Garden', icon: '🏡', description: 'Furniture, decor, outdoor supplies', defaultProductCount: 15 },
  { id: 'health_beauty', name: 'Health & Beauty', icon: '💄', description: 'Cosmetics, skincare, personal care', defaultProductCount: 15 },
  { id: 'sports_outdoors', name: 'Sports & Outdoors', icon: '⚽', description: 'Athletic gear, camping, fitness', defaultProductCount: 15 },
  { id: 'toys_games', name: 'Toys & Games', icon: '🎮', description: "Children's toys, board games, puzzles", defaultProductCount: 12 },
  { id: 'automotive', name: 'Automotive', icon: '🚗', description: 'Car parts, accessories, maintenance', defaultProductCount: 12 },
  { id: 'books_media', name: 'Books & Media', icon: '📚', description: 'Books, music, movies, magazines', defaultProductCount: 12 },
  { id: 'pet_supplies', name: 'Pet Supplies', icon: '🐾', description: 'Pet food, toys, accessories', defaultProductCount: 12 },
  { id: 'office_supplies', name: 'Office Supplies', icon: '📎', description: 'Stationery, paper, office equipment', defaultProductCount: 12 },
  { id: 'jewelry', name: 'Jewelry', icon: '💎', description: 'Rings, necklaces, watches, accessories', defaultProductCount: 10 },
  { id: 'baby_kids', name: 'Baby & Kids', icon: '👶', description: "Baby products, children's items", defaultProductCount: 15 },
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
  const [textModel, setTextModel] = useState<'openai' | 'google' | 'anthropic' | 'mistral'>('openai');
  const [imageModel, setImageModel] = useState<'openai' | 'google'>('openai');

  useEffect(() => { loadTenants(); }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTenants(tenants.filter(t => t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)));
    }
  }, [searchQuery, tenants]);

  const loadTenants = async () => {
    try {
      const tenants = await platformHomeService.getTenants();
      setTenants(tenants || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    const type = businessTypes.find(t => t.id === typeId);
    if (type) setProductCount(type.defaultProductCount);
  };

  const handleGenerate = async () => {
    if (!selectedType || !selectedTenant) return;
    setIsGenerating(true);
    setError(null);
    try {
      const data = await itemsService.quickStartTenant(selectedTenant, selectedType);
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
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl w-full">
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-4">Products Created Successfully!</h1>
            <p className="text-lg text-neutral-600 mb-2">
              Generated <span className="font-bold text-primary-600">{generatedCount} products</span>
              {categoriesCreated > 0 && <> and <span className="font-bold text-purple-600">{categoriesCreated} categories</span></>}
            </p>
            <p className="text-sm text-neutral-500 mb-2">for <strong>{selectedTenantName}</strong></p>
            <p className="text-xs text-neutral-400 mb-6">Business type: {selectedTypeName}</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => router.push(`/t/${selectedTenant}/items?filter=inactive`)}>View Products</Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${selectedTenant}/categories`)}>View Categories</Button>
              <Button variant="ghost" onClick={() => { setSuccess(false); setSelectedType(null); setSelectedTenant(null); }}>Generate More</Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center mb-12">
          <Badge className="mb-4 bg-gradient-to-r from-red-500 to-orange-600 text-white">Admin Tool</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Product Quick Start<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Admin Panel</span>
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">Generate products for any tenant instantly with AI</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900">1. Select Tenant</h3>
              {!isLoadingTenants && <Badge className="bg-neutral-100 text-neutral-700">{filteredTenants.length} of {tenants.length}</Badge>}
            </div>
            {isLoadingTenants ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-sm text-neutral-600 mt-2">Loading tenants...</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <input type="text" placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                </div>
                {filteredTenants.length === 0 ? (
                  <p className="text-center py-8 text-sm text-neutral-500">No tenants found matching "{searchQuery}"</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredTenants.map((tenant) => (
                        <button key={tenant.id} onClick={() => setSelectedTenant(tenant.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${selectedTenant === tenant.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}`}>
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

        {selectedTenant && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">2. Select Business Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {businessTypes.map((type) => (
                  <button key={type.id} onClick={() => handleTypeChange(type.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${selectedType === type.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}`}>
                    <div className="flex items-start gap-2">
                      <div className="text-2xl">{type.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-neutral-900 text-sm truncate">{type.name}</h4>
                        <p className="text-xs text-neutral-500 line-clamp-2">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {selectedType && selectedTenant && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">3. Adjust Product Count</h3>
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-700">Number of Products</span>
                  <span className="text-2xl font-bold text-primary-600">{productCount}</span>
                </div>
                <input type="range" min="5" max="30" value={productCount} onChange={(e) => setProductCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
                <div className="flex justify-between text-xs text-neutral-500 mt-1"><span>5 min</span><span>30 max</span></div>
                <div className="flex gap-2 mt-4">
                  {[{ value: 5, label: 'Tiny' }, { value: 10, label: 'Small' }, { value: 15, label: 'Medium' }, { value: 20, label: 'Standard' }, { value: 30, label: 'Large' }].map((preset) => (
                    <button key={preset.value} onClick={() => setProductCount(preset.value)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${productCount === preset.value ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {selectedType && selectedTenant && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">4. AI Settings</h3>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-neutral-700 mb-3">AI Provider for Product Generation</label>
                <div className="flex gap-2 mb-2">
                  {[{ id: 'openai', label: '🤖 OpenAI GPT-4', sub: 'Fast & reliable', active: 'from-green-600 to-emerald-600' }, { id: 'google', label: '✨ Google Gemini', sub: 'Free tier available', active: 'from-blue-600 to-cyan-600' }].map(m => (
                    <button key={m.id} onClick={() => setTextModel(m.id as any)}
                      className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all ${textModel === m.id ? `bg-gradient-to-r ${m.active} text-white shadow-md` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      <span className="flex items-center justify-center gap-2">{m.label}</span>
                      <span className="text-xs opacity-75 mt-1 block">{m.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-neutral-700">Generate AI Product Photos</label>
                  <button onClick={() => setGenerateImages(!generateImages)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${generateImages ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${generateImages ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                {generateImages && (
                  <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                    <p className="text-xs text-neutral-600">⚠️ Enabling photos will increase generation time to 2-3 minutes</p>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-2">Image Quality</label>
                      <div className="flex gap-2">
                        {[{ id: 'standard', label: 'Standard', color: 'blue' }, { id: 'hd', label: 'HD (Higher quality)', color: 'purple' }].map(q => (
                          <button key={q.id} onClick={() => setImageQuality(q.id as any)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${imageQuality === q.id ? `bg-${q.color}-600 text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-2">Image AI Model</label>
                      <div className="flex gap-2">
                        {[{ id: 'openai', label: '🎨 DALL-E 3', color: 'green' }, { id: 'google', label: '🖼️ Imagen 3', color: 'blue' }].map(m => (
                          <button key={m.id} onClick={() => setImageModel(m.id as any)}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${imageModel === m.id ? `bg-${m.color}-600 text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</motion.div>}

        <div className="text-center">
          <Button size="lg" disabled={!selectedType || !selectedTenant || isGenerating} onClick={handleGenerate} className="px-12">
            {isGenerating ? 'Generating Products...' : '🚀 Generate Products'}
          </Button>
          {isGenerating && (
            <p className="text-sm text-neutral-500 mt-3">
              {generateImages ? '⏳ AI is generating products with photos. This may take 2-3 minutes...' : '⏳ AI is generating realistic products with descriptions. This may take 30-60 seconds...'}
            </p>
          )}
        </div>

        <div className="text-center mt-6">
          <button onClick={() => router.push('/settings/admin')} className="text-sm text-neutral-600 hover:text-neutral-900">← Back to Admin</button>
        </div>
      </div>
    </div>
  );
}
