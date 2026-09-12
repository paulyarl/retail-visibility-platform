'use client';

import { Globe, MapPin } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * EnrichmentAuditCard — mapped render for directory_enrichment audits.
 *
 * Enrichment audits are created when a validated `category_enrichment` or
 * `location_enrichment` output is produced (internal run or external import)
 * by a directory_enrichment campaign. The validated packet is stored in
 * `audit.audit_data` and auto-applied to `directory_category_enrichment`
 * (trigger_source='campaign_run'). This card renders the applied packet so
 * the operator can see exactly what went live on the public pages.
 */

interface EnrichmentPacket {
  category_key?: string;
  category_name?: string;
  city?: string;
  state?: string;
  location_name?: string;
  meta_title: string;
  description: string;
  keywords: string[];
  secondary_categories?: string[];
  top_categories?: string[];
  schema_type_hint?: string;
  body_copy?: string;
}

export default function EnrichmentAuditCard({
  audit,
  campaignCategory,
  campaignCity,
  campaignState,
}: {
  audit: Audit;
  /** Campaign fields — the applied-to target is derived from the campaign,
   *  not the payload (payload echoes are ignored by the applier). */
  campaignCategory?: string | null;
  campaignCity?: string | null;
  campaignState?: string | null;
}) {
  const data = audit.audit_data as EnrichmentPacket | null;
  if (!data || typeof data !== 'object' || !data.meta_title) return null;

  const isLocation = audit.platform === 'location_enrichment';
  const isNational = (campaignCity ?? '').trim().toLowerCase() === '__all__';

  const appliedTo = isLocation
    ? `location page · ${campaignCity ?? '—'}${campaignState ? `, ${campaignState}` : ''}`
    : isNational
      ? `category page · ${campaignCategory ?? data.category_name ?? '—'} · national`
      : `category page · ${campaignCategory ?? data.category_name ?? '—'} · ${campaignCity ?? '—'}${campaignState ? `, ${campaignState}` : ''}`;

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/30 dark:bg-emerald-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLocation
            ? <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          <span className="font-medium text-gray-900 dark:text-white">
            {isLocation ? 'Location Enrichment' : 'Category Enrichment'}
          </span>
          <span className="text-xs text-gray-400">applied to {appliedTo}</span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Applied packet — mirrors the fields written to the enrichment row */}
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Meta title</p>
          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{data.meta_title}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Description</p>
          <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{data.description}</p>
        </div>
        {data.body_copy && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Body copy (on-page)</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{data.body_copy}</p>
          </div>
        )}
        {data.keywords?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Keywords</p>
            <div className="flex flex-wrap gap-1">
              {data.keywords.map((k, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-700">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        {data.secondary_categories?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Secondary categories</p>
            <div className="flex flex-wrap gap-1">
              {data.secondary_categories.map((c, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {data.top_categories?.length ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Top categories (AI)</p>
            <div className="flex flex-wrap gap-1">
              {data.top_categories.map((c, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {data.schema_type_hint && (
          <p className="text-[10px] text-gray-400">
            Schema type hint: <span className="font-mono">{data.schema_type_hint}</span>
          </p>
        )}
      </div>
    </div>
  );
}
