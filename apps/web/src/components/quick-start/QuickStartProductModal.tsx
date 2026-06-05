'use client';

import { useState } from 'react';
import { BusinessTypeSelector, BUSINESS_TYPES, getBusinessType, getDefaultCount } from './BusinessTypeSelector';

export interface QuickStartProductConfig {
  businessType: string;
  productCount: number;
  generateImages: boolean;
  imageQuality: 'standard' | 'hd';
  textModel: 'openai' | 'google';
  imageModel: 'openai' | 'google';
}

interface QuickStartProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: QuickStartProductConfig) => Promise<void>;
  title?: string;
  description?: string;
  minProducts?: number;
  maxProducts?: number;
}

/**
 * Reusable Quick Start Product Modal
 * Used for generating AI products across admin and tenant pages
 */
export function QuickStartProductModal({
  isOpen,
  onClose,
  onGenerate,
  title = '🚀 Quick Start: Generate Products',
  description = 'Generate AI-powered products for your business type',
  minProducts = 5,
  maxProducts = 25,
}: QuickStartProductModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number>(15);
  const [generateImages, setGenerateImages] = useState<boolean>(false);
  const [imageQuality, setImageQuality] = useState<'standard' | 'hd'>('standard');
  const [textModel, setTextModel] = useState<'openai' | 'google'>('openai');
  const [imageModel, setImageModel] = useState<'openai' | 'google'>('openai');
  const [isLoading, setIsLoading] = useState(false);

  const handleTypeChange = (typeId: string) => {
    setSelectedType(typeId);
    setProductCount(getDefaultCount(typeId, 'product'));
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    
    setIsLoading(true);
    try {
      await onGenerate({
        businessType: selectedType,
        productCount,
        generateImages,
        imageQuality,
        textModel,
        imageModel,
      });
      onClose();
      // Reset state
      setSelectedType(null);
      setProductCount(15);
      setGenerateImages(false);
      setImageQuality('standard');
      setTextModel('openai');
      setImageModel('openai');
    } catch (error) {
      console.error('[QuickStartProductModal] Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Business Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Type
            </label>
            <BusinessTypeSelector
              value={selectedType}
              onChange={(typeId) => handleTypeChange(typeId)}
              variant="dropdown"
            />
          </div>

          {/* Product Count Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Number of Products
              </label>
              <span className="text-lg font-bold text-primary-600">
                {productCount}
              </span>
            </div>
            <input
              type="range"
              min={minProducts}
              max={maxProducts}
              value={productCount}
              onChange={(e) => setProductCount(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{minProducts} min</span>
              <span>{maxProducts} max</span>
            </div>
            
            {/* Quick Presets */}
            <div className="flex gap-2 mt-3">
              {[
                { value: 5, label: 'Tiny' },
                { value: 10, label: 'Small' },
                { value: 15, label: 'Medium' },
                { value: 20, label: 'Standard' },
                { value: 30, label: 'Large' },
              ].filter(p => p.value >= minProducts && p.value <= maxProducts).map((preset) => (
                <button
                  key={preset.value}
                  type="button"
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

          {/* AI Provider Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              AI Provider for Product Generation
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
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
                type="button"
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
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Generate AI Product Photos
              </label>
              <button
                type="button"
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
                <p className="text-xs text-gray-600">
                  ⚠️ Enabling photos will increase generation time to 2-3 minutes
                </p>
                
                {/* Image Quality */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Image Quality
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
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
                      type="button"
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
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Image AI Model
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
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
                      type="button"
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
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || !selectedType}
            className="px-4 py-2 text-sm rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isLoading 
              ? (generateImages ? 'Generating (2-3 min)...' : 'Generating...') 
              : `🚀 Generate ${productCount} Products`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuickStartProductModal;
