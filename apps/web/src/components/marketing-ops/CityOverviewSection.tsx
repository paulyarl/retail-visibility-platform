'use client';

import { MapPin, Building } from 'lucide-react';
import type { CampaignDetail } from '@/services/MarketingOpsService';

/**
 * CityOverviewSection — scope-aware Overview content for city-scope campaigns.
 * City campaigns carry only city/state/neighborhood context (no business or
 * category-specific fields), so this view is intentionally sparse. Any
 * city-level analysis imported via the external-import flow would surface
 * under the Audits tab.
 */
export default function CityOverviewSection({ campaign }: { campaign: CampaignDetail }) {
  return (
    <div className="space-y-6">
      {/* City Context */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-blue-500" />
          City Context
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">City</dt>
            <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.city ?? '—'}</dd>
          </div>
          {campaign.neighborhood && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Neighborhood</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.neighborhood}</dd>
            </div>
          )}
          {campaign.tone && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Tone</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.tone}</dd>
            </div>
          )}
          {campaign.attributes && campaign.attributes.length > 0 && (
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Attributes</dt>
              <dd className="text-sm text-gray-900 dark:text-white mt-0.5">{campaign.attributes.join(', ')}</dd>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-neutral-700/50 border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-start gap-2">
          <Building className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            City-scope campaigns carry location context only. Run a city-scope
            prompt template and import the external result to surface analysis
            under the Audits tab, or derive category/business campaigns targeting
            this area.
          </p>
        </div>
      </div>
    </div>
  );
}
