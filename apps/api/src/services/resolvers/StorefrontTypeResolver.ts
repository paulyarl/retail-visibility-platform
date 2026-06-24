/**
 * Storefront Type Resolver
 *
 * Resolves effective storefront type from tier features + merchant preferences.
 * Reuses StorefrontTypeService for tier-gate logic, then applies merchant selection.
 */

import StorefrontTypeService from '../StorefrontTypeService';
import type {
  EffectiveStorefront,
  StorefrontTypeMerchantSettings,
} from './types';

export type StorefrontTypeValue = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

/**
 * Resolve effective storefront type state.
 */
export async function resolveStorefrontType(
  tenantId: string,
  merchantPrefs: StorefrontTypeMerchantSettings | null
): Promise<EffectiveStorefront> {
  const service = StorefrontTypeService.getInstance();
  const tierState = await service.resolveStorefrontTypeState(tenantId);

  // Merchant preferences (soft toggle, default true when unset)
  const storefrontTypeEnabled = merchantPrefs?.storefront_type_enabled !== false;
  const rawSelected = merchantPrefs?.selected_storefront_type;

  // Validate selected type against tier allowed types
  let selectedStorefrontType: StorefrontTypeValue = tierState.type;
  let hasMerchantSelection = false;

  if (tierState.enabled && tierState.type === 'flexible' && storefrontTypeEnabled && rawSelected) {
    const allowed = tierState.allowedTypes as StorefrontTypeValue[];
    if (allowed.includes(rawSelected as StorefrontTypeValue)) {
      selectedStorefrontType = rawSelected as StorefrontTypeValue;
      hasMerchantSelection = true;
    }
  }

  // Effective type: if merchant has selected a specific type and tier allows it, use it
  let effectiveType: StorefrontTypeValue = tierState.type;
  if (tierState.enabled && tierState.type === 'flexible' && storefrontTypeEnabled) {
    const allowed = tierState.allowedTypes as StorefrontTypeValue[];
    if (selectedStorefrontType !== 'flexible' && allowed.includes(selectedStorefrontType)) {
      effectiveType = selectedStorefrontType;
    }
  }

  return {
    enabled: tierState.enabled && storefrontTypeEnabled,
    type: tierState.type,
    effective_type: effectiveType,
    is_flexible: tierState.isFlexible,
    allowed_types: tierState.allowedTypes as StorefrontTypeValue[],
    has_merchant_selection: hasMerchantSelection,
    merchant_preferences: {
      storefront_type_enabled: storefrontTypeEnabled,
      selected_storefront_type: selectedStorefrontType,
    },
  };
}
