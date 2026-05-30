'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Rocket, Sparkles, Bot, Image, Save, AlertCircle, LayoutGrid, CheckCircle2, ArrowRight, Zap, Plus, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { useQuickstartOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { tenantInfoService } from '@/services/TenantInfoService';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';

interface QuickstartOptionsSettings {
  quickstart_enabled: boolean;
  quickstart_wizard: boolean;
  quickstart_wizard_ai: boolean;
  quickstart_category_generator: boolean;
  quickstart_ai_openai: boolean;
  quickstart_ai_gemini: boolean;
  quickstart_image_gen: boolean;
  quickstart_image_hd: boolean;
  default_text_model: string;
  default_image_model: string;
  default_image_quality: string;
}

interface QuickstartOptionsSettingsClientProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: QuickstartOptionsSettings = {
  quickstart_enabled: true,
  quickstart_wizard: true,
  quickstart_wizard_ai: true,
  quickstart_category_generator: true,
  quickstart_ai_openai: true,
  quickstart_ai_gemini: true,
  quickstart_image_gen: true,
  quickstart_image_hd: true,
  default_text_model: 'openai',
  default_image_model: 'openai',
  default_image_quality: 'standard',
};

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Rocket;
  variant: 'general' | 'wizard' | 'category';
}

function getQuickActions(settings: QuickstartOptionsSettings, tenantId: string): QuickAction[] {
  const actions: QuickAction[] = [];
  if (!settings.quickstart_enabled) return actions;

  if (settings.quickstart_wizard || settings.quickstart_wizard_ai) {
    actions.push({
      id: 'quick-start',
      label: 'Launch Quick Start',
      description: 'Generate products with the wizard',
      href: `/t/${tenantId}/quick-start`,
      icon: Rocket,
      variant: 'wizard',
    });
  }

  if (settings.quickstart_category_generator) {
    actions.push({
      id: 'categories',
      label: 'Manage Categories',
      description: 'Auto-generate categories for your store',
      href: `/t/${tenantId}/categories`,
      icon: FolderOpen,
      variant: 'category',
    });
  }

  if (settings.quickstart_wizard || settings.quickstart_wizard_ai || settings.quickstart_category_generator) {
    actions.push({
      id: 'create-item',
      label: 'Create New Item',
      description: 'Add a new product to your catalog',
      href: `/t/${tenantId}/items/create`,
      icon: Plus,
      variant: 'general',
    });
  }

  return actions;
}

export default function QuickstartOptionsSettingsClient({ tenantId }: QuickstartOptionsSettingsClientProps) {
  const quickstartCap = useQuickstartOptionsCapability(tenantId, { forTenant: true });
  const allCaps = useAllCapabilities(tenantId, { forTenant: true });

  // Tier-level gates: what the plan allows (not effective/merged state)
  // Settings page must show toggles for everything the tier permits so merchant can control them
  const tierAllowsWizard = quickstartCap.data?.allowedProductTypes.includes('wizard') ?? false;
  const tierAllowsImageGen = quickstartCap.data?.allowedProductTypes.includes('image_gen') ?? false;
  const tierAllowsAnyAI = (quickstartCap.data?.allowedAITypes.length ?? 0) > 0;
  const tierAllowsOpenAI = quickstartCap.data?.allowedAITypes.includes('ai_openai') ?? false;
  const tierAllowsGemini = quickstartCap.data?.allowedAITypes.includes('ai_gemini') ?? false;
  const tierAllowsAIWizard = quickstartCap.data?.allowedAITypes.includes('wizard_ai') ?? false;
  const tierAllowsHDImages = quickstartCap.data?.allowedAITypes.includes('image_hd') ?? false;

  const [settings, setSettings] = useState<QuickstartOptionsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings from backend
  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await tenantInfoService.getQuickstartOptionsSettings(tenantId);
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
    } catch (err) {
      console.error('Failed to load quickstart options settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof QuickstartOptionsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleModelChange = (key: 'default_text_model' | 'default_image_model', value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleQualityChange = (value: string) => {
    setSettings(prev => ({ ...prev, default_image_quality: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const result = await tenantInfoService.updateQuickstartOptionsSettings(tenantId, settings);

      if (!result) {
        throw new Error('Failed to save quickstart options settings');
      }

      setMessage({ type: 'success', text: 'Quickstart options saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Plan Summary */}
      <PlanSummaryPanel
        capabilities={allCaps.data}
        loading={allCaps.loading}
        highlightCapability="quickstart_options"
        tenantId={tenantId}
      />

      {/* Master Switch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-600" />
            Quickstart Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium">Enable Quickstart Features</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Master switch for all quickstart features
              </p>
            </div>
            <Switch
              checked={settings.quickstart_enabled}
              onCheckedChange={() => handleToggle('quickstart_enabled')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Group — gated by quickstart_product feature gate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-green-600" />
            Product Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tierAllowsWizard && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Product Wizard</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generate products from pre-built templates (no AI cost)
                </p>
              </div>
              <Switch
                checked={settings.quickstart_wizard}
                onCheckedChange={() => handleToggle('quickstart_wizard')}
                disabled={!settings.quickstart_enabled}
              />
            </div>
          )}

          {tierAllowsImageGen && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Image className="w-4 h-4" /> Image Generation
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Attach images to products during generation (cached or AI-generated)
                </p>
              </div>
              <Switch
                checked={settings.quickstart_image_gen}
                onCheckedChange={() => handleToggle('quickstart_image_gen')}
                disabled={!settings.quickstart_enabled}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-purple-600" />
            Category Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Category Generator</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Auto-generate categories from business type templates
              </p>
            </div>
            <Switch
              checked={settings.quickstart_category_generator}
              onCheckedChange={() => handleToggle('quickstart_category_generator')}
              disabled={!settings.quickstart_enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Group — gated by quickstart_ai feature gate */}
      {tierAllowsAnyAI && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              AI Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Model Toggles */}
            {tierAllowsOpenAI && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Bot className="w-4 h-4" /> OpenAI (GPT-4 / DALL-E 3)
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Fast and reliable AI generation
                  </p>
                </div>
                <Switch
                  checked={settings.quickstart_ai_openai}
                  onCheckedChange={() => handleToggle('quickstart_ai_openai')}
                  disabled={!settings.quickstart_enabled}
                />
              </div>
            )}

            {tierAllowsGemini && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Google Gemini / Imagen 3
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cost-effective AI generation
                  </p>
                </div>
                <Switch
                  checked={settings.quickstart_ai_gemini}
                  onCheckedChange={() => handleToggle('quickstart_ai_gemini')}
                  disabled={!settings.quickstart_enabled}
                />
              </div>
            )}

            {tierAllowsAIWizard && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AI Product Wizard</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Generate products using AI (requires product feature gate)
                  </p>
                </div>
                <Switch
                  checked={settings.quickstart_wizard_ai}
                  onCheckedChange={() => handleToggle('quickstart_wizard_ai')}
                  disabled={!settings.quickstart_enabled}
                />
              </div>
            )}

            {tierAllowsHDImages && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">HD Image Quality</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    High-definition AI-generated photos (requires image gen)
                  </p>
                </div>
                <Switch
                  checked={settings.quickstart_image_hd}
                  onCheckedChange={() => handleToggle('quickstart_image_hd')}
                  disabled={!settings.quickstart_enabled || !settings.quickstart_image_gen}
                />
              </div>
            )}

            {/* Default Model Preferences */}
            <div className="border-t pt-4 mt-4 space-y-4">
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Default Preferences</h4>

              {/* Default Text Model */}
              {(tierAllowsOpenAI && tierAllowsGemini) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Default Text Model
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleModelChange('default_text_model', 'openai')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_text_model === 'openai'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      🤖 OpenAI GPT-4
                    </button>
                    <button
                      onClick={() => handleModelChange('default_text_model', 'google')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_text_model === 'google'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      ✨ Google Gemini
                    </button>
                  </div>
                </div>
              )}

              {/* Default Image Model */}
              {(tierAllowsOpenAI && tierAllowsGemini && tierAllowsImageGen) && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Default Image Model
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleModelChange('default_image_model', 'openai')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_image_model === 'openai'
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      🤖 DALL-E 3
                    </button>
                    <button
                      onClick={() => handleModelChange('default_image_model', 'google')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_image_model === 'google'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      🎨 Imagen 3
                    </button>
                  </div>
                </div>
              )}

              {/* Default Image Quality */}
              {tierAllowsImageGen && tierAllowsHDImages && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Default Image Quality
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQualityChange('standard')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_image_quality === 'standard'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => handleQualityChange('hd')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        settings.default_image_quality === 'hd'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      HD
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier-limited notice */}
      {!tierAllowsAnyAI && !tierAllowsImageGen && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">AI features not available on your plan</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Upgrade to Professional or higher to unlock AI-powered product generation, image generation, and model selection.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between">
        <div>
          {message && (
            <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Next Steps — contextual destinations based on saved preferences */}
      {(() => {
        const actions = getQuickActions(settings, tenantId);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue setup for the quickstart features you just enabled
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map(action => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    wizard: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    category: 'bg-purple-50 border-purple-200 hover:border-purple-300 text-purple-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    wizard: 'text-blue-600',
                    category: 'text-purple-600',
                    general: 'text-neutral-600',
                  };
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${variantStyles[action.variant]}`}
                    >
                      <IconComp className={`h-5 w-5 shrink-0 ${iconStyles[action.variant]}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{action.label}</p>
                        <p className="text-xs opacity-80 truncate">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
