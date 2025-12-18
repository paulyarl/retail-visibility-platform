'use client';

import { BusinessTypeSelector, BUSINESS_TYPES, getDefaultCount } from './BusinessTypeSelector';

export interface ProductGenerationSettings {
  businessType: string | null;
  productCount: number;
  generateImages: boolean;
  imageQuality: 'standard' | 'hd';
  textModel: 'openai' | 'google';
  imageModel: 'openai' | 'google';
}

interface QuickStartProductSettingsProps {
  settings: ProductGenerationSettings;
  onChange: (settings: ProductGenerationSettings) => void;
  minProducts?: number;
  maxProducts?: number;
  showBusinessTypeSelector?: boolean;
  businessTypeSelectorVariant?: 'dropdown' | 'grid';
  className?: string;
}

/**
 * Shared AI Product Generation Settings Component
 * Used by both admin and tenant quick-start pages
 * 
 * Features:
 * - Business type selection (dropdown or grid)
 * - Product count slider with presets
 * - AI provider selection (OpenAI/Google)
 * - Image generation toggle with quality/model options
 */
export function QuickStartProductSettings({
  settings,
  onChange,
  minProducts = 5,
  maxProducts = 25,
  showBusinessTypeSelector = true,
  businessTypeSelectorVariant = 'grid',
  className = '',
}: QuickStartProductSettingsProps) {
  const updateSettings = (partial: Partial<ProductGenerationSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handleTypeChange = (typeId: string) => {
    updateSettings({
      businessType: typeId,
      productCount: getDefaultCount(typeId, 'product'),
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Business Type Selection */}
      {showBusinessTypeSelector && (
        <div>
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Select Business Type</h3>
          <BusinessTypeSelector
            value={settings.businessType}
            onChange={(typeId) => handleTypeChange(typeId)}
            variant={businessTypeSelectorVariant}
            showDescription={businessTypeSelectorVariant === 'grid'}
          />
        </div>
      )}

      {/* Product Count Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-neutral-700">
            Number of Products
          </span>
          <span className="text-2xl font-bold text-primary-600">
            {settings.productCount}
          </span>
        </div>
        <input
          type="range"
          min={minProducts}
          max={maxProducts}
          value={settings.productCount}
          onChange={(e) => updateSettings({ productCount: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
        />
        <div className="flex justify-between text-xs text-neutral-500 mt-1">
          <span>{minProducts} min</span>
          <span>{maxProducts} max</span>
        </div>
        
        {/* Quick Presets */}
        <div className="flex gap-2 mt-4">
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
              onClick={() => updateSettings({ productCount: preset.value })}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                settings.productCount === preset.value
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
        <label className="block text-sm font-semibold text-neutral-700 mb-3">
          AI Provider for Product Generation
        </label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => updateSettings({ textModel: 'openai' })}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              settings.textModel === 'openai'
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
            onClick={() => updateSettings({ textModel: 'google' })}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              settings.textModel === 'google'
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
        
        {settings.textModel === 'google' && (
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
          <label className="block text-sm font-semibold text-neutral-700">
            Generate AI Product Photos
          </label>
          <button
            type="button"
            onClick={() => updateSettings({ generateImages: !settings.generateImages })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.generateImages ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.generateImages ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {settings.generateImages && (
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
                  type="button"
                  onClick={() => updateSettings({ imageQuality: 'standard' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.imageQuality === 'standard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ imageQuality: 'hd' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.imageQuality === 'hd'
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
                  type="button"
                  onClick={() => updateSettings({ imageModel: 'openai' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.imageModel === 'openai'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🎨 DALL-E 3
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ imageModel: 'google' })}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    settings.imageModel === 'google'
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
  );
}

/**
 * Default settings for product generation
 */
export const DEFAULT_PRODUCT_SETTINGS: ProductGenerationSettings = {
  businessType: null,
  productCount: 15,
  generateImages: false,
  imageQuality: 'standard',
  textModel: 'openai',
  imageModel: 'openai',
};

export default QuickStartProductSettings;
