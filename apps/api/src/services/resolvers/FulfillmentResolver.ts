/**
 * Fulfillment Resolver
 *
 * Resolves effective fulfillment state from tier features + merchant preferences.
 */

import type {
  EffectiveFulfillment,
  FulfillmentMerchantSettings,
} from './types';

export function resolveFulfillment(
  features: Record<string, boolean>,
  merchantPrefs: FulfillmentMerchantSettings | null
): EffectiveFulfillment {
  const enabled = !!features.fulfillment_enabled;
  const flexible = !!features.fulfillment_flexible;
  const pickup = !!features.fulfillment_pickup;
  const delivery = !!features.fulfillment_delivery;
  const shipping = !!features.fulfillment_shipping;
  const service = !!features.fulfillment_service;

  const showsPickup = flexible || pickup;
  const showsDelivery = flexible || delivery;
  const showsShipping = flexible || shipping;
  const showsService = flexible || service;

  const prefs = {
    pickup_enabled: merchantPrefs?.pickup_enabled !== false,
    delivery_enabled: merchantPrefs?.delivery_enabled !== false,
    shipping_enabled: merchantPrefs?.shipping_enabled !== false,
  };

  return {
    enabled,
    shows_pickup: showsPickup,
    shows_delivery: showsDelivery,
    shows_shipping: showsShipping,
    shows_service: showsService,
    effective_shows_pickup: showsPickup && prefs.pickup_enabled,
    effective_shows_delivery: showsDelivery && prefs.delivery_enabled,
    effective_shows_shipping: showsShipping && prefs.shipping_enabled,
    merchant_preferences: prefs,
    is_flexible: flexible,
    delivery_radius_miles: merchantPrefs?.delivery_radius_miles ?? null,
    delivery_fee_cents: merchantPrefs?.delivery_fee_cents ?? 0,
    delivery_min_free_cents: merchantPrefs?.delivery_min_free_cents ?? null,
    delivery_time_hours: merchantPrefs?.delivery_time_hours ?? 24,
    shipping_flat_rate_cents: merchantPrefs?.shipping_flat_rate_cents ?? null,
    shipping_min_free_cents: merchantPrefs?.shipping_min_free_cents ?? null,
    shipping_handling_days: merchantPrefs?.shipping_handling_days ?? 1,
    pickup_ready_time_minutes: merchantPrefs?.pickup_ready_time_minutes ?? 30,
    pickup_instructions: merchantPrefs?.pickup_instructions ?? null,
  };
}
