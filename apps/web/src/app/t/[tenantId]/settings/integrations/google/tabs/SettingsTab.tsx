'use client';

import { useState, useEffect } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Globe,
  Settings as SettingsIcon,
} from 'lucide-react';

interface SettingsTabProps {
  tenantId: string;
  gmcStatus: any;
  onSaveSettings: (settings: { fulfillmentMode: string; pickupMethod: string; pickupSla: string }) => void;
  saving: boolean;
  saveResult: any;
}

export default function SettingsTab({
  tenantId,
  gmcStatus,
  onSaveSettings,
  saving,
  saveResult,
}: SettingsTabProps) {
  const [fulfillmentMode, setFulfillmentMode] = useState<'standard' | 'shipping_and_pickup' | 'pickup_only'>('standard');
  const [pickupMethod, setPickupMethod] = useState<'buy' | 'reserve' | 'ship to store' | 'not supported'>('buy');
  const [pickupSla, setPickupSla] = useState<'same day' | 'next day' | '2-day' | '3-day' | '4-day' | '5-day' | '6-day' | '7-day' | 'multi-week'>('same day');

  useEffect(() => {
    if (gmcStatus) {
      setFulfillmentMode(gmcStatus.fulfillmentMode || (gmcStatus.pickupOnly ? 'pickup_only' : 'standard'));
      setPickupMethod(gmcStatus.pickupMethod || 'buy');
      setPickupSla(gmcStatus.pickupSla || 'same day');
    }
  }, [gmcStatus]);

  const hasGMC = gmcStatus?.hasGMCConnection;
  const hasMerchant = gmcStatus?.hasMerchantLink;

  return (
    <div className="space-y-4">
      {/* Save Result */}
      {saveResult && (
        <div className={`p-3 rounded-lg text-sm ${
          saveResult.success
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          {saveResult.message || (saveResult.success ? 'Settings saved.' : 'Failed to save settings.')}
        </div>
      )}

      {/* Connection Info */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-orange-600" />
          Merchant Center Connection
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
            <div className="flex items-center gap-3">
              {hasGMC ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">GMC Connection</span>
            </div>
            <span className={`text-sm ${hasGMC ? 'text-green-600' : 'text-red-600'}`}>
              {hasGMC ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
            <div className="flex items-center gap-3">
              {hasMerchant ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Merchant Account</span>
            </div>
            <span className={`text-sm ${hasMerchant ? 'text-green-600' : 'text-amber-600'}`}>
              {hasMerchant ? gmcStatus?.merchantName || 'Linked' : 'Not Linked'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
            <div className="flex items-center gap-3">
              {gmcStatus?.hasSubdomain ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Subdomain</span>
            </div>
            <span className={`text-sm ${gmcStatus?.hasSubdomain ? 'text-green-600' : 'text-amber-600'}`}>
              {gmcStatus?.subdomain || 'Not Set'}
            </span>
          </div>
        </div>
      </div>

      {/* Fulfillment Settings */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          Fulfillment Mode
        </h3>
        <p className="text-sm text-neutral-500 mb-4">
          Choose how you fulfill orders. This controls what attributes we send to Google for each product.
        </p>

        <div className="space-y-3">
          <label className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
            fulfillmentMode === 'standard'
              ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
              : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="fulfillment_mode"
                checked={fulfillmentMode === 'standard'}
                disabled={!hasGMC || !hasMerchant || saving}
                onChange={() => {
                  setFulfillmentMode('standard');
                  onSaveSettings({ fulfillmentMode: 'standard', pickupMethod, pickupSla });
                }}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Standard (default)</p>
                <p className="text-xs text-neutral-500 mt-1">
                  We do not send pickupMethod/pickupSla. Shipping/pickup is handled by your Merchant Center configuration.
                </p>
              </div>
            </div>
          </label>

          <label className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
            fulfillmentMode === 'shipping_and_pickup'
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
              : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="fulfillment_mode"
                checked={fulfillmentMode === 'shipping_and_pickup'}
                disabled={!hasGMC || !hasMerchant || saving}
                onChange={() => {
                  setFulfillmentMode('shipping_and_pickup');
                  onSaveSettings({ fulfillmentMode: 'shipping_and_pickup', pickupMethod, pickupSla });
                }}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Shipping + Pickup</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Sends both shipping and pickup attributes. Choose your pickup method and SLA below.
                </p>
              </div>
            </div>
          </label>

          <label className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
            fulfillmentMode === 'pickup_only'
              ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800'
              : 'border-neutral-200 bg-white dark:bg-neutral-800 dark:border-neutral-700'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="fulfillment_mode"
                checked={fulfillmentMode === 'pickup_only'}
                disabled={!hasGMC || !hasMerchant || saving}
                onChange={() => {
                  setFulfillmentMode('pickup_only');
                  onSaveSettings({ fulfillmentMode: 'pickup_only', pickupMethod, pickupSla });
                }}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Pickup Only</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Marks all products as pickup-only. No shipping attributes are sent.
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* Pickup Settings (visible when not standard) */}
        {fulfillmentMode !== 'standard' && (
          <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Pickup Method
              </label>
              <select
                value={pickupMethod}
                onChange={(e) => setPickupMethod(e.target.value as any)}
                disabled={!hasGMC || !hasMerchant || saving}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
              >
                <option value="buy">Buy (customer pays online, picks up in store)</option>
                <option value="reserve">Reserve (customer reserves online, pays in store)</option>
                <option value="ship to store">Ship to Store (item shipped to store for pickup)</option>
                <option value="not supported">Not Supported</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                Pickup SLA (Service Level Agreement)
              </label>
              <select
                value={pickupSla}
                onChange={(e) => setPickupSla(e.target.value as any)}
                disabled={!hasGMC || !hasMerchant || saving}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
              >
                <option value="same day">Same Day</option>
                <option value="next day">Next Day</option>
                <option value="2-day">2-Day</option>
                <option value="3-day">3-Day</option>
                <option value="4-day">4-Day</option>
                <option value="5-day">5-Day</option>
                <option value="6-day">6-Day</option>
                <option value="7-day">7-Day</option>
                <option value="multi-week">Multi-Week</option>
              </select>
            </div>
            <button
              onClick={() => onSaveSettings({ fulfillmentMode, pickupMethod, pickupSla })}
              disabled={saving || !hasGMC || !hasMerchant}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <SettingsIcon className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        )}
      </div>

      {/* Domain Configuration */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-6">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Domain Configuration
        </h3>
        <p className="text-sm text-neutral-500 mb-4">
          Google Merchant Center requires product links to point to a valid domain. Use a subdomain or custom domain for GMC compliance.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-neutral-400" />
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Current Subdomain</span>
            </div>
            <span className={`text-sm font-medium ${gmcStatus?.hasSubdomain ? 'text-green-600' : 'text-amber-600'}`}>
              {gmcStatus?.subdomain ? `${gmcStatus.subdomain}.visibleshelf.com` : 'Not configured'}
            </span>
          </div>
          {gmcStatus?.domainValidation?.willCauseMismatchedDomains && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Mismatched Domains Warning
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Your website URL is configured but doesn't match your subdomain. This may cause Google to reject product listings.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
