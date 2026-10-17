'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Wifi, Accessibility, CreditCard, Car, Heart, PawPrint, Truck, ShoppingBag, Store,
  Save, RefreshCw, AlertCircle, CheckCircle, Loader2, BadgeDollarSign,
} from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';
import { clientLogger } from '@/lib/client-logger';

type CommonAttrs = {
  hasWifi: boolean;
  wheelchairAccessible: boolean;
  acceptsCreditCards: boolean;
  hasParking: boolean;
  lgbtqFriendly: boolean;
  petFriendly: boolean;
  offersDelivery: boolean;
  offersCurbsidePickup: boolean;
  offersInStorePickup: boolean;
  offersTakeout: boolean;
  offersInStoreShopping: boolean;
};

const DEFAULT_COMMON: CommonAttrs = {
  hasWifi: false,
  wheelchairAccessible: false,
  acceptsCreditCards: false,
  hasParking: false,
  lgbtqFriendly: false,
  petFriendly: false,
  offersDelivery: false,
  offersCurbsidePickup: false,
  offersInStorePickup: false,
  offersTakeout: false,
  offersInStoreShopping: false,
};

const FULFILLMENT_ATTRS: { key: keyof CommonAttrs; label: string; icon: typeof Truck }[] = [
  { key: 'offersDelivery', label: 'Delivery', icon: Truck },
  { key: 'offersCurbsidePickup', label: 'Curbside pickup', icon: Car },
  { key: 'offersInStorePickup', label: 'In-store pickup', icon: ShoppingBag },
  { key: 'offersTakeout', label: 'Takeout', icon: ShoppingBag },
  { key: 'offersInStoreShopping', label: 'In-store shopping', icon: Store },
];

const OTHER_ATTRS: { key: keyof CommonAttrs; label: string; icon: typeof Wifi }[] = [
  { key: 'acceptsCreditCards', label: 'Accepts credit cards', icon: CreditCard },
  { key: 'hasWifi', label: 'Free WiFi', icon: Wifi },
  { key: 'wheelchairAccessible', label: 'Wheelchair accessible', icon: Accessibility },
  { key: 'hasParking', label: 'Parking available', icon: Car },
  { key: 'lgbtqFriendly', label: 'LGBTQ+ friendly', icon: Heart },
  { key: 'petFriendly', label: 'Pet friendly', icon: PawPrint },
];

interface AvailableAttribute {
  id: string;
  displayName: string;
  group: string;
  valueType: string;
  enumValues: { value: string; displayName: string }[];
}

interface GbpAttributesTabProps {
  tenantId: string;
  canUseAttributes: boolean;
}

/**
 * Attributes tab for the Advanced GBP Features page.
 *
 * Three groups:
 *  1. Retailer fulfillment / payment quick toggles → POST attributes/common
 *  2. Google's full category-driven attribute list → PATCH attributes
 *  3. Your own storefront attributes (SNAP/EBT display, delivery/pickup)
 *     which live on the platform listing, not Google.
 */
export function GbpAttributesTab({ tenantId, canUseAttributes }: GbpAttributesTabProps) {
  const [common, setCommon] = useState<CommonAttrs>(DEFAULT_COMMON);
  const [available, setAvailable] = useState<AvailableAttribute[]>([]);
  const [selectedEnums, setSelectedEnums] = useState<Record<string, string[]>>({});
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Storefront (platform) attributes
  const [snapEbtDisplay, setSnapEbtDisplay] = useState(false);
  const [deliveryOffered, setDeliveryOffered] = useState(false);
  const [pickupOffered, setPickupOffered] = useState(false);
  const [savingStorefront, setSavingStorefront] = useState(false);

  const loadAttributes = useCallback(async () => {
    try {
      setLoading(true);
      const [availableAttrs, current] = await Promise.all([
        platformHomeService.getGoogleBusinessAvailableAttributes(tenantId).catch(() => []),
        platformHomeService.getGoogleBusinessAttributes(tenantId).catch(() => []),
      ]);

      const currentById = new Map<string, any>();
      for (const attr of current || []) {
        currentById.set(attr.attributeId, attr);
      }

      const mapped: AvailableAttribute[] = (availableAttrs || []).map((a: any) => {
        const rawId = a.attributeId || a.name || a.parent || '';
        const id = String(rawId).replace(/^attributes\//, '');
        return {
          id,
          displayName: a.displayName || id,
          group: a.groupDisplayName || 'Other',
          valueType: a.valueType || 'BOOL',
          enumValues: (a.valueMetadata || []).map((v: any) => ({ value: String(v.value), displayName: v.displayName || String(v.value) })),
        };
      });
      setAvailable(mapped);

      const bools: Record<string, boolean> = {};
      const enums: Record<string, string[]> = {};
      for (const attr of mapped) {
        const cur = currentById.get(attr.id);
        if (attr.valueType === 'BOOL') {
          bools[attr.id] = Array.isArray(cur?.values) ? !!cur.values[0] : false;
        } else if (attr.valueType === 'REPEATED_ENUM') {
          enums[attr.id] = cur?.repeatedEnumValue?.setValues || [];
        }
      }
      setBoolValues(bools);
      setSelectedEnums(enums);
    } catch (err) {
      clientLogger.error('Failed to load GBP attributes:', { detail: err });
      setError('Failed to load attributes from Google.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadStorefront = useCallback(async () => {
    try {
      const [entry, fulfillment] = await Promise.all([
        tenantDirectoryManagementService.getDirectoryEntryOptions(tenantId).catch(() => null),
        platformHomeService.getTenantFulfillmentSettings(tenantId).catch(() => null),
      ]);
      if (entry) setSnapEbtDisplay(!!(entry as any).snap_ebt_display);
      if (fulfillment) {
        setDeliveryOffered(!!fulfillment.delivery_enabled);
        setPickupOffered(!!fulfillment.pickup_enabled);
      }
    } catch (err) {
      clientLogger.error('Failed to load storefront attributes:', { detail: err });
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadAttributes();
      loadStorefront();
    }
  }, [tenantId, loadAttributes, loadStorefront]);

  async function handleSaveCommon() {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      await platformHomeService.saveGoogleBusinessCommonAttributes(tenantId, common);
      setSaved(true);
    } catch (err) {
      clientLogger.error('Failed to save GBP attributes:', { detail: err });
      setError('Failed to save attributes to Google.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDynamic() {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      const payload: any[] = [];
      for (const attr of available) {
        if (attr.valueType === 'BOOL') {
          payload.push({ attributeId: attr.id, valueType: 'BOOL', values: [boolValues[attr.id] ?? false] });
        } else if (attr.valueType === 'REPEATED_ENUM') {
          const selected = selectedEnums[attr.id] || [];
          const unset = attr.enumValues.map((v) => v.value).filter((v) => !selected.includes(v));
          payload.push({
            attributeId: attr.id,
            valueType: 'REPEATED_ENUM',
            repeatedEnumValue: { setValues: selected, unsetValues: unset },
          });
        }
      }
      if (payload.length > 0) {
        await platformHomeService.updateGoogleBusinessAttributes(tenantId, payload);
      }
      setSaved(true);
    } catch (err) {
      clientLogger.error('Failed to save GBP attribute selections:', { detail: err });
      setError('Failed to save attributes to Google.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStorefront() {
    try {
      setSavingStorefront(true);
      setError(null);
      await Promise.all([
        tenantDirectoryManagementService.updateDirectoryEntryOptions(tenantId, { snap_ebt_display: snapEbtDisplay } as any),
        platformHomeService.updateTenantFulfillmentSettings(tenantId, {
          ...(await platformHomeService.getTenantFulfillmentSettings(tenantId)),
          delivery_enabled: deliveryOffered,
          pickup_enabled: pickupOffered,
        } as any),
      ]);
    } catch (err) {
      clientLogger.error('Failed to save storefront attributes:', { detail: err });
      setError('Failed to save storefront attributes.');
    } finally {
      setSavingStorefront(false);
    }
  }

  const grouped = available.reduce((acc, attr) => {
    if (attr.valueType !== 'BOOL' && attr.valueType !== 'REPEATED_ENUM') return acc;
    (acc[attr.group] = acc[attr.group] || []).push(attr);
    return acc;
  }, {} as Record<string, AvailableAttribute[]>);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Attributes saved to Google.
        </div>
      )}

      {/* Group 1 — Retailer fulfillment + payment quick toggles */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Retailer attributes</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Fulfillment and payment options shoppers see on your Google listing.
        </p>

        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Fulfillment options</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          {FULFILLMENT_ATTRS.map((attr) => (
            <AttributeToggle
              key={attr.key}
              label={attr.label}
              icon={attr.icon}
              checked={common[attr.key]}
              onChange={(v) => { setCommon({ ...common, [attr.key]: v }); setSaved(false); }}
            />
          ))}
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Payments & amenities</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {OTHER_ATTRS.map((attr) => (
            <AttributeToggle
              key={attr.key}
              label={attr.label}
              icon={attr.icon}
              checked={common[attr.key]}
              onChange={(v) => { setCommon({ ...common, [attr.key]: v }); setSaved(false); }}
            />
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleSaveCommon}
            disabled={saving || !canUseAttributes}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save to Google
          </button>
        </div>
      </div>

      {/* Group 2 — Google's full category-driven list */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">More attributes from Google</h3>
          <button type="button" onClick={loadAttributes} className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" title="Reload">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Attributes available for your business category, as reported by Google.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading attributes…
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-neutral-500">
            No additional attributes are available for your category. Connect a GBP location with a primary category first.
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([group, attrs]) => (
              <div key={group}>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">{group}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {attrs.map((attr) =>
                    attr.valueType === 'BOOL' ? (
                      <label key={attr.id} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={boolValues[attr.id] ?? false}
                          onChange={(e) => { setBoolValues({ ...boolValues, [attr.id]: e.target.checked }); setSaved(false); }}
                          className="rounded border-neutral-300 dark:border-neutral-600"
                        />
                        {attr.displayName}
                      </label>
                    ) : (
                      <div key={attr.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                        <p className="mb-1">{attr.displayName}</p>
                        <div className="flex flex-wrap gap-2">
                          {attr.enumValues.map((v) => {
                            const selected = (selectedEnums[attr.id] || []).includes(v.value);
                            return (
                              <label key={v.value} className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(e) => {
                                    const next = new Set(selectedEnums[attr.id] || []);
                                    if (e.target.checked) next.add(v.value);
                                    else next.delete(v.value);
                                    setSelectedEnums({ ...selectedEnums, [attr.id]: Array.from(next) });
                                    setSaved(false);
                                  }}
                                  className="rounded border-neutral-300 dark:border-neutral-600"
                                />
                                {v.displayName}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveDynamic}
                disabled={saving || !canUseAttributes}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save attributes
              </button>
            </div>
          </div>
        )}

        {!canUseAttributes && (
          <p className="mt-3 text-sm text-neutral-500">
            Managing Google attributes is part of GBP Pro.{' '}
            <a href={`/t/${tenantId}/settings/feature-store?feature=gbp_attributes`} className="text-blue-600 hover:text-blue-700">
              Activate the GBP Business Attributes capability
            </a>
            .
          </p>
        )}
      </div>

      {/* Group 3 — Your storefront (platform) attributes */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Your storefront</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          Attributes shown on your own directory and place pages — these stay on the platform and are not sent to Google.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AttributeToggle
            label="SNAP/EBT accepted"
            icon={BadgeDollarSign}
            checked={snapEbtDisplay}
            onChange={setSnapEbtDisplay}
          />
          <AttributeToggle label="Offers delivery" icon={Truck} checked={deliveryOffered} onChange={setDeliveryOffered} />
          <AttributeToggle label="Offers pickup" icon={ShoppingBag} checked={pickupOffered} onChange={setPickupOffered} />
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleSaveStorefront}
            disabled={savingStorefront}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-900 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {savingStorefront ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save storefront
          </button>
        </div>
      </div>
    </div>
  );
}

function AttributeToggle({
  label, icon: Icon, checked, onChange,
}: {
  label: string;
  icon: typeof Wifi;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <Icon className={`w-5 h-5 ${checked ? 'text-blue-600' : 'text-neutral-400'}`} />
      <span className={`text-sm font-medium ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
        {label}
      </span>
      {checked && <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />}
    </label>
  );
}

export default GbpAttributesTab;
