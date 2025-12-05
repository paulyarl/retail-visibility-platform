# AI Provider Admin Settings

## Overview

Platform admins can configure default AI providers for product generation and image creation. Tenant quick-start actions automatically use the admin-configured defaults.

## Architecture

```
Platform Admin
  ↓
Configure AI Providers (Admin UI)
  ↓
Save to platform_settings table
  ↓
Tenants use quick-start
  ↓
System reads admin defaults
  ↓
Generate products with configured providers
```

## Database Schema

### Add to platform_settings table

```sql
-- Add AI provider configuration to platform_settings
ALTER TABLE platform_settings 
ADD COLUMN IF NOT EXISTS ai_text_provider TEXT DEFAULT 'google',
ADD COLUMN IF NOT EXISTS ai_image_provider TEXT DEFAULT 'google',
ADD COLUMN IF NOT EXISTS ai_fallback_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ai_image_quality TEXT DEFAULT 'standard';

COMMENT ON COLUMN platform_settings.ai_text_provider IS 
'Default AI provider for product text generation: google (Gemini) or openai (GPT-4)';

COMMENT ON COLUMN platform_settings.ai_image_provider IS 
'Default AI provider for product images: google (Imagen) or openai (DALL-E)';

COMMENT ON COLUMN platform_settings.ai_fallback_enabled IS 
'Enable automatic fallback to alternate provider if primary fails';

COMMENT ON COLUMN platform_settings.ai_image_quality IS 
'Default image quality: standard or hd';
```

## Admin UI Component

### Location
`apps/web/src/app/admin/settings/ai-providers/page.tsx`

### Implementation

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Save, Zap, DollarSign, Shield, Info } from 'lucide-react';

interface AIProviderSettings {
  aiTextProvider: 'google' | 'openai';
  aiImageProvider: 'google' | 'openai';
  aiFallbackEnabled: boolean;
  aiImageQuality: 'standard' | 'hd';
}

export default function AIProviderSettingsPage() {
  const [settings, setSettings] = useState<AIProviderSettings>({
    aiTextProvider: 'google',
    aiImageProvider: 'google',
    aiFallbackEnabled: true,
    aiImageQuality: 'standard',
  });
  
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load current settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/ai-providers');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    
    try {
      const response = await fetch('/api/admin/settings/ai-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate cost per product
  const calculateCost = () => {
    const textCost = settings.aiTextProvider === 'google' ? 0.001 : 0.004;
    const imageCost = settings.aiImageProvider === 'google' 
      ? (settings.aiImageQuality === 'hd' ? 0.020 : 0.010)
      : (settings.aiImageQuality === 'hd' ? 0.080 : 0.040);
    return (textCost + imageCost).toFixed(3);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          AI Provider Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure default AI providers for product generation across all tenants
        </p>
      </div>

      {/* Cost Summary Card */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 mb-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Current Cost Per Product
          </h3>
        </div>
        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
          ${calculateCost()}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Includes product data + image generation
        </p>
      </div>

      <div className="space-y-6">
        {/* Text Provider Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Product Data Generation
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Text Provider
              </label>
              <div className="grid grid-cols-2 gap-4">
                {/* Google Gemini Option */}
                <button
                  onClick={() => setSettings({ ...settings, aiTextProvider: 'google' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.aiTextProvider === 'google'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    Google Gemini 2.0
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                    $0.001 per product
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    • Faster generation<br/>
                    • 75% cheaper<br/>
                    • Excellent quality
                  </div>
                </button>

                {/* OpenAI GPT-4 Option */}
                <button
                  onClick={() => setSettings({ ...settings, aiTextProvider: 'openai' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.aiTextProvider === 'openai'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    OpenAI GPT-4
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">
                    $0.004 per product
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    • Proven reliability<br/>
                    • High quality<br/>
                    • Well-established
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Image Provider Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Product Image Generation
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image Provider
              </label>
              <div className="grid grid-cols-2 gap-4">
                {/* Google Imagen Option */}
                <button
                  onClick={() => setSettings({ ...settings, aiImageProvider: 'google' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.aiImageProvider === 'google'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    Google Imagen 3
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                    $0.01 standard / $0.02 HD
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    • 75% cheaper<br/>
                    • Excellent for products<br/>
                    • Fast generation
                  </div>
                </button>

                {/* OpenAI DALL-E Option */}
                <button
                  onClick={() => setSettings({ ...settings, aiImageProvider: 'openai' })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    settings.aiImageProvider === 'openai'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    OpenAI DALL-E 3
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">
                    $0.04 standard / $0.08 HD
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    • Proven quality<br/>
                    • Creative images<br/>
                    • Reliable
                  </div>
                </button>
              </div>
            </div>

            {/* Image Quality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image Quality
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSettings({ ...settings, aiImageQuality: 'standard' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.aiImageQuality === 'standard'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                    Standard Quality
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Good for testing • Lower cost
                  </div>
                </button>

                <button
                  onClick={() => setSettings({ ...settings, aiImageQuality: 'hd' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    settings.aiImageQuality === 'hd'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                    HD Quality
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Best quality • Higher cost
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fallback Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Reliability Settings
            </h2>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.aiFallbackEnabled}
              onChange={(e) => setSettings({ ...settings, aiFallbackEnabled: e.target.checked })}
              className="mt-1 rounded"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                Enable Automatic Fallback
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                If primary provider fails, automatically try alternate provider. 
                Ensures quick-start always works even if one provider is down.
              </div>
            </div>
          </label>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Note:</strong> These settings apply to all tenant quick-start operations. 
              Tenants will automatically use the configured providers when generating products. 
              Changes take effect immediately.
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Settings'}
          </button>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Settings saved successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Backend API Endpoints

### GET /api/admin/settings/ai-providers

```typescript
// apps/api/src/routes/admin/ai-provider-settings.ts

import { Router } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requirePlatformAdmin } from '../../middleware/permissions';

const router = Router();

/**
 * GET /api/admin/settings/ai-providers
 * Get current AI provider settings
 */
router.get('/settings/ai-providers', 
  authenticateToken, 
  requirePlatformAdmin, 
  async (req, res) => {
    try {
      const settings = await prisma.platform_settings.findFirst();
      
      if (!settings) {
        // Return defaults if no settings exist
        return res.json({
          aiTextProvider: 'google',
          aiImageProvider: 'google',
          aiFallbackEnabled: true,
          aiImageQuality: 'standard',
        });
      }
      
      res.json({
        aiTextProvider: settings.ai_text_provider || 'google',
        aiImageProvider: settings.ai_image_provider || 'google',
        aiFallbackEnabled: settings.ai_fallback_enabled ?? true,
        aiImageQuality: settings.ai_image_quality || 'standard',
      });
    } catch (error: any) {
      console.error('[Admin] Failed to get AI provider settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
);

/**
 * PUT /api/admin/settings/ai-providers
 * Update AI provider settings
 */
router.put('/settings/ai-providers', 
  authenticateToken, 
  requirePlatformAdmin, 
  async (req, res) => {
    try {
      const { aiTextProvider, aiImageProvider, aiFallbackEnabled, aiImageQuality } = req.body;
      
      // Validate providers
      if (!['google', 'openai'].includes(aiTextProvider)) {
        return res.status(400).json({ error: 'Invalid text provider' });
      }
      if (!['google', 'openai'].includes(aiImageProvider)) {
        return res.status(400).json({ error: 'Invalid image provider' });
      }
      if (!['standard', 'hd'].includes(aiImageQuality)) {
        return res.status(400).json({ error: 'Invalid image quality' });
      }
      
      // Update or create settings
      const settings = await prisma.platform_settings.upsert({
        where: { id: 'default' }, // Assuming single settings record
        create: {
          id: 'default',
          ai_text_provider: aiTextProvider,
          ai_image_provider: aiImageProvider,
          ai_fallback_enabled: aiFallbackEnabled,
          ai_image_quality: aiImageQuality,
        },
        update: {
          ai_text_provider: aiTextProvider,
          ai_image_provider: aiImageProvider,
          ai_fallback_enabled: aiFallbackEnabled,
          ai_image_quality: aiImageQuality,
          updated_at: new Date(),
        },
      });
      
      console.log('[Admin] AI provider settings updated:', {
        textProvider: aiTextProvider,
        imageProvider: aiImageProvider,
        fallback: aiFallbackEnabled,
        quality: aiImageQuality,
      });
      
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error('[Admin] Failed to update AI provider settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

export default router;
```

## Integration with Quick-Start

### Read Admin Settings

```typescript
// In ProductCacheService or quick-start handler

async function getAIProviderConfig(): Promise<{
  textProvider: 'google' | 'openai';
  imageProvider: 'google' | 'openai';
  fallbackEnabled: boolean;
  imageQuality: 'standard' | 'hd';
}> {
  try {
    const settings = await prisma.platform_settings.findFirst();
    
    return {
      textProvider: (settings?.ai_text_provider as any) || 'google',
      imageProvider: (settings?.ai_image_provider as any) || 'google',
      fallbackEnabled: settings?.ai_fallback_enabled ?? true,
      imageQuality: (settings?.ai_image_quality as any) || 'standard',
    };
  } catch (error) {
    console.error('[AI] Failed to get provider config, using defaults');
    return {
      textProvider: 'google',
      imageProvider: 'google',
      fallbackEnabled: true,
      imageQuality: 'standard',
    };
  }
}

// Use in quick-start
const aiConfig = await getAIProviderConfig();
const products = await aiProviderService.generateProductData(
  businessType,
  categoryName,
  count,
  aiConfig.textProvider // Uses admin setting!
);
```

## Admin Navigation

Add to admin menu:

```typescript
// In admin layout or navigation
{
  name: 'AI Providers',
  href: '/admin/settings/ai-providers',
  icon: Zap,
  description: 'Configure AI providers for product generation'
}
```

## Summary

**Admin configures:**
- ✅ Text provider (Gemini or GPT-4)
- ✅ Image provider (Imagen or DALL-E)
- ✅ Image quality (standard or HD)
- ✅ Fallback behavior (auto-retry)

**Tenants automatically use:**
- ✅ Admin-configured defaults
- ✅ No tenant-level configuration needed
- ✅ Consistent experience across platform
- ✅ Admin controls costs centrally

**Benefits:**
- 💰 **Cost Control** - Admin optimizes for entire platform
- ⚡ **Performance** - Choose fastest providers
- 🎯 **Quality** - Standardize quality across tenants
- 🛡️ **Reliability** - Automatic fallback ensures uptime

**This gives you centralized control over AI costs and quality! 🎯**
