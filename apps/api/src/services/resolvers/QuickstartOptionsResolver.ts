/**
 * Quickstart Options Resolver
 *
 * Resolves effective quickstart options state from tier features + merchant preferences.
 */

import type {
  EffectiveQuickstart,
  QuickstartOptionsMerchantSettings,
} from './types';

export type QuickstartProductType = 'wizard' | 'image_gen';
export type QuickstartCategoryType = 'category_generator';
export type QuickstartAIType = 'ai_openai' | 'ai_gemini' | 'wizard_ai' | 'image_hd';

export function resolveQuickstartOptions(
  features: Record<string, boolean>,
  merchantPrefs: QuickstartOptionsMerchantSettings | null
): EffectiveQuickstart {
  const disabled = !!features.quickstart_disabled;
  const enabled = !disabled && !!features.quickstart_enabled;
  const flexible = !!features.quickstart_flexible;

  const productEnabled = flexible || !!features.quickstart_product_enabled;
  const categoryEnabled = flexible || !!features.quickstart_category_enabled;
  const aiEnabled = flexible || !!features.quickstart_ai_enabled;

  const allowedProductTypes: QuickstartProductType[] = [];
  if (flexible || productEnabled) {
    allowedProductTypes.push('wizard', 'image_gen');
  } else {
    if (features.quickstart_wizard) allowedProductTypes.push('wizard');
    if (features.quickstart_image_gen) allowedProductTypes.push('image_gen');
  }

  const allowedCategoryTypes: QuickstartCategoryType[] = [];
  if (flexible || categoryEnabled) {
    allowedCategoryTypes.push('category_generator');
  } else {
    if (features.quickstart_category_generator) allowedCategoryTypes.push('category_generator');
  }

  const allowedAITypes: QuickstartAIType[] = [];
  if (flexible || aiEnabled) {
    allowedAITypes.push('ai_openai', 'ai_gemini', 'wizard_ai', 'image_hd');
  } else {
    if (features.quickstart_ai_openai) allowedAITypes.push('ai_openai');
    if (features.quickstart_ai_gemini) allowedAITypes.push('ai_gemini');
    if (features.quickstart_wizard_ai) allowedAITypes.push('wizard_ai');
    if (features.quickstart_image_hd) allowedAITypes.push('image_hd');
  }

  const prefs = {
    quickstart_enabled: merchantPrefs?.quickstart_enabled !== false,
    quickstart_wizard: merchantPrefs?.quickstart_wizard !== false,
    quickstart_image_gen: merchantPrefs?.quickstart_image_gen !== false,
    quickstart_category_generator: merchantPrefs?.quickstart_category_generator !== false,
    quickstart_wizard_ai: merchantPrefs?.quickstart_wizard_ai !== false,
    quickstart_ai_openai: merchantPrefs?.quickstart_ai_openai !== false,
    quickstart_ai_gemini: merchantPrefs?.quickstart_ai_gemini !== false,
    quickstart_image_hd: merchantPrefs?.quickstart_image_hd !== false,
    default_text_model: merchantPrefs?.default_text_model || 'openai',
    default_image_model: merchantPrefs?.default_image_model || 'openai',
    default_image_quality: merchantPrefs?.default_image_quality || 'standard',
  };

  const canUseWizard = enabled && allowedProductTypes.includes('wizard') && prefs.quickstart_wizard;
  const canGenerateImages = enabled && allowedProductTypes.includes('image_gen') && prefs.quickstart_image_gen;
  const canUseAIWizard = canUseWizard && allowedAITypes.includes('wizard_ai') && prefs.quickstart_wizard_ai;

  return {
    enabled: enabled,
    is_flexible: flexible,
    product_enabled: enabled && productEnabled,
    allowed_product_types: allowedProductTypes,
    category_enabled: enabled && categoryEnabled,
    allowed_category_types: allowedCategoryTypes,
    ai_enabled: enabled && aiEnabled,
    allowed_ai_types: allowedAITypes,
    can_use_wizard: canUseWizard,
    can_use_ai_wizard: canUseAIWizard,
    can_use_category_generator: enabled && allowedCategoryTypes.includes('category_generator') && prefs.quickstart_category_generator,
    can_generate_images: canGenerateImages,
    can_use_openai: enabled && allowedAITypes.includes('ai_openai') && prefs.quickstart_ai_openai,
    can_use_gemini: enabled && allowedAITypes.includes('ai_gemini') && prefs.quickstart_ai_gemini,
    can_use_hd_images: enabled && allowedAITypes.includes('image_hd') && prefs.quickstart_image_hd,
    merchant_preferences: prefs,
  };
}
