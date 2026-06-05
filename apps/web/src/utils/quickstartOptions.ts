/**
 * Quickstart Options Utility
 *
 * Domain helpers for working with the quickstart_options capability.
 * Provides classification, display, and filtering logic for quickstart types
 * across tenant, admin, and public scopes.
 */

import {
  QuickstartProductType as QuickstartProductTypeInternal,
  QuickstartCategoryType as QuickstartCategoryTypeInternal,
  QuickstartAIType as QuickstartAITypeInternal,
  QuickstartOptionsState,
} from '@/services/CapabilityResolutionService';

// Re-export types for consumers
export type QuickstartProductType = QuickstartProductTypeInternal;
export type QuickstartCategoryType = QuickstartCategoryTypeInternal;
export type QuickstartAIType = QuickstartAITypeInternal;

// ====================
// CLASSIFICATION
// ====================

/** Product group quickstart types — gated by quickstart_product feature gate */
export const PRODUCT_QUICKSTART_TYPES: QuickstartProductType[] = ['wizard', 'image_gen'];

/** Category group quickstart types — gated by quickstart_category feature gate */
export const CATEGORY_QUICKSTART_TYPES: QuickstartCategoryType[] = ['category_generator'];

/** AI group quickstart types — gated by quickstart_ai feature gate */
export const AI_QUICKSTART_TYPES: QuickstartAIType[] = ['ai_openai', 'ai_gemini', 'wizard_ai', 'image_hd'];

// ====================
// TYPE GUARDS
// ====================

export function isProductType(type: string): type is QuickstartProductType {
  return PRODUCT_QUICKSTART_TYPES.includes(type as QuickstartProductType);
}

export function isCategoryType(type: string): type is QuickstartCategoryType {
  return CATEGORY_QUICKSTART_TYPES.includes(type as QuickstartCategoryType);
}

export function isAIType(type: string): type is QuickstartAIType {
  return AI_QUICKSTART_TYPES.includes(type as QuickstartAIType);
}

// ====================
// DISPLAY HELPERS
// ====================

export interface QuickstartTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'product' | 'category' | 'ai';
  icon: string;
  color: string;
}

const QUICKSTART_TYPE_META: Record<string, QuickstartTypeMeta> = {
  wizard: {
    key: 'wizard',
    label: 'Product Quick Start',
    description: 'Static template-based product generation',
    group: 'product',
    icon: '🚀',
    color: 'blue',
  },
  image_gen: {
    key: 'image_gen',
    label: 'Image Generation',
    description: 'Attach images to products during generation (cached or AI)',
    group: 'product',
    icon: '🖼️',
    color: 'indigo',
  },
  category_generator: {
    key: 'category_generator',
    label: 'Category Quick Start',
    description: 'Template-based category creation',
    group: 'category',
    icon: '📁',
    color: 'green',
  },
  ai_openai: {
    key: 'ai_openai',
    label: 'OpenAI',
    description: 'GPT-4 text and DALL-E 3 image models',
    group: 'ai',
    icon: '🤖',
    color: 'emerald',
  },
  ai_gemini: {
    key: 'ai_gemini',
    label: 'Google Gemini',
    description: 'Gemini text and Imagen 3 image models',
    group: 'ai',
    icon: '💎',
    color: 'blue',
  },
  wizard_ai: {
    key: 'wizard_ai',
    label: 'AI Product Quick Start',
    description: 'AI-powered product generation',
    group: 'ai',
    icon: '✨',
    color: 'purple',
  },
  image_hd: {
    key: 'image_hd',
    label: 'HD Image Quality',
    description: 'High-definition AI-generated photos (requires image gen)',
    group: 'ai',
    icon: '📸',
    color: 'amber',
  },
};

export function getQuickstartTypeMeta(type: string): QuickstartTypeMeta {
  return QUICKSTART_TYPE_META[type] || {
    key: type,
    label: type,
    description: '',
    group: 'product',
    icon: '❓',
    color: 'gray',
  };
}

export function getQuickstartTypeLabel(type: string): string {
  return QUICKSTART_TYPE_META[type]?.label || type;
}

export function getQuickstartTypeIcon(type: string): string {
  return QUICKSTART_TYPE_META[type]?.icon || '❓';
}

// ====================
// CAPABILITY-AWARE FILTERING
// ====================

/**
 * Get allowed product types from capability state.
 */
export function getAllowedProductTypes(state: QuickstartOptionsState): QuickstartProductType[] {
  if (!state.enabled) return [];
  return state.allowedProductTypes;
}

/**
 * Get allowed category types from capability state.
 */
export function getAllowedCategoryTypes(state: QuickstartOptionsState): QuickstartCategoryType[] {
  if (!state.enabled) return [];
  return state.allowedCategoryTypes;
}

/**
 * Get allowed AI types from capability state.
 */
export function getAllowedAITypes(state: QuickstartOptionsState): QuickstartAIType[] {
  if (!state.enabled) return [];
  return state.allowedAITypes;
}

/**
 * Check if a specific quickstart type is allowed by capability state.
 */
export function isQuickstartTypeAllowed(
  type: QuickstartProductType | QuickstartCategoryType | QuickstartAIType,
  state: QuickstartOptionsState
): boolean {
  if (!state.enabled) return false;
  if (isProductType(type)) return state.allowedProductTypes.includes(type);
  if (isCategoryType(type)) return state.allowedCategoryTypes.includes(type);
  if (isAIType(type)) return state.allowedAITypes.includes(type);
  return false;
}

/**
 * Group allowed types by control group.
 */
export function groupAllowedTypes(state: QuickstartOptionsState): {
  product: QuickstartTypeMeta[];
  category: QuickstartTypeMeta[];
  ai: QuickstartTypeMeta[];
} {
  return {
    product: state.allowedProductTypes.map(getQuickstartTypeMeta),
    category: state.allowedCategoryTypes.map(getQuickstartTypeMeta),
    ai: state.allowedAITypes.map(getQuickstartTypeMeta),
  };
}

// ====================
// FEATURE KEY MAPPING
// ====================

/**
 * Map a QuickstartType to its corresponding feature key in the capability system.
 */
export function quickstartTypeToFeatureKey(type: string): string {
  return `quickstart_${type}`;
}

/**
 * Map a feature key back to a QuickstartType, if it matches.
 */
export function featureKeyToQuickstartType(key: string): string | null {
  if (!key.startsWith('quickstart_')) return null;
  const suffix = key.slice('quickstart_'.length);
  const allTypes = [
    ...PRODUCT_QUICKSTART_TYPES,
    ...CATEGORY_QUICKSTART_TYPES,
    ...AI_QUICKSTART_TYPES,
  ];
  if (allTypes.includes(suffix as any)) {
    return suffix;
  }
  return null;
}

// ====================
// BADGE / DISPLAY HELPERS
// ====================

/**
 * Get the CSS color class for a quickstart type badge.
 */
export function getQuickstartBadgeColorClass(type: string): string {
  const meta = QUICKSTART_TYPE_META[type];
  if (!meta) return 'bg-gray-100 text-gray-700 border-gray-300';

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
    green: 'bg-green-100 text-green-700 border-green-300',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
  };

  return colorMap[meta.color] || 'bg-gray-100 text-gray-700 border-gray-300';
}

// ====================
// WIZARD UI HELPERS
// ====================

/**
 * Determine the effective wizard mode based on capability state.
 * Returns 'ai' if AI wizard is available and AI group is enabled,
 * 'static' if only static wizard is available, or 'none' if no wizard.
 */
export function getEffectiveWizardMode(state: QuickstartOptionsState): 'ai' | 'static' | 'none' {
  if (!state.enabled) return 'none';
  if (state.canUseAIWizard) return 'ai';
  if (state.canUseWizard) return 'static';
  return 'none';
}

/**
 * Determine which AI text models are available based on capability state.
 */
export function getAvailableTextModels(state: QuickstartOptionsState): Array<'openai' | 'google'> {
  if (!state.enabled) return [];
  const models: Array<'openai' | 'google'> = [];
  if (state.canUseOpenAI) models.push('openai');
  if (state.canUseGemini) models.push('google');
  return models;
}

/**
 * Determine which AI image models are available based on capability state.
 */
export function getAvailableImageModels(state: QuickstartOptionsState): Array<'openai' | 'google'> {
  if (!state.enabled || !state.canGenerateImages) return [];
  const models: Array<'openai' | 'google'> = [];
  if (state.canUseOpenAI) models.push('openai');
  if (state.canUseGemini) models.push('google');
  return models;
}

/**
 * Determine available image quality options based on capability state.
 */
export function getAvailableImageQualities(state: QuickstartOptionsState): Array<'standard' | 'hd'> {
  if (!state.enabled || !state.canGenerateImages) return [];
  const qualities: Array<'standard' | 'hd'> = ['standard'];
  if (state.canUseHDImages) qualities.push('hd');
  return qualities;
}

/**
 * Get the default text model based on capability state.
 * Prefers OpenAI (more reliable), falls back to Gemini, then 'openai' as ultimate fallback.
 */
export function getDefaultTextModel(state: QuickstartOptionsState): 'openai' | 'google' {
  const available = getAvailableTextModels(state);
  if (available.includes('openai')) return 'openai';
  if (available.includes('google')) return 'google';
  return 'openai';
}

/**
 * Get the default image model based on capability state.
 */
export function getDefaultImageModel(state: QuickstartOptionsState): 'openai' | 'google' {
  const available = getAvailableImageModels(state);
  if (available.includes('openai')) return 'openai';
  if (available.includes('google')) return 'google';
  return 'openai';
}
