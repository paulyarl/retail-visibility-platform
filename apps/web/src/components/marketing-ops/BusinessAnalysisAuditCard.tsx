'use client';

import { useState } from 'react';
import { Flame, Globe, AlertTriangle, ShieldCheck, ShieldAlert, Copy, RefreshCw, CheckCircle2, MapPin, ExternalLink } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import marketingOpsService from '@/services/MarketingOpsService';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

// ─── Helpers (shared with CityAnalysisAuditCard — duplicated for isolation) ───

function scoreColor(score: number): string {
  if (score <= 3) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (score <= 6) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (score <= 8) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function confidenceColor(conf: string): string {
  if (conf === 'high') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (conf === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function tierColor(tier: string): string {
  if (tier === 'tier_1') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (tier === 'tier_2') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function profileStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'claimed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (s === 'likely_claimed') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (s === 'unclaimed' || s === 'likely_unclaimed') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function websiteStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'working') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (s === 'broken') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (s === 'none_found') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
}

function identityColor(status: string): string {
  if (status === 'confirmed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (status === 'ambiguous') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 py-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h4>
      {children}
    </div>
  );
}

function YesNo({ v, label }: { v: boolean | null | undefined; label: string }) {
  if (v == null) return null;
  return <Badge cls={v ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}>{label}: {v ? 'Yes' : 'No'}</Badge>;
}

function formatFee(fee: { minimum?: number | null; maximum?: number | null; currency?: string }): string {
  if (fee.minimum == null && fee.maximum == null) return '—';
  const cur = fee.currency || '$';
  if (fee.minimum != null && fee.maximum != null) return `${cur}${fee.minimum}–${cur}${fee.maximum}`;
  return `${cur}${fee.minimum ?? fee.maximum}`;
}

// ─── Component ──────────────────────────────────────────────────────────

interface BusinessAnalysisAuditCardProps {
  audit: Audit;
  campaignId: string;
  onSynced?: () => void;
}

export default function BusinessAnalysisAuditCard({ audit, campaignId, onSynced }: BusinessAnalysisAuditCardProps) {
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [addingToPlace, setAddingToPlace] = useState(false);
  const [placeResult, setPlaceResult] = useState<{ publicUrl: string; seedId: string; created: boolean; seoEnriched: boolean } | null>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const d = (audit.audit_data ?? {}) as any;
  const meta = d.audit_metadata ?? {};
  const requested = meta.requested_business ?? {};
  const matched = meta.matched_business ?? {};
  const identityStatus = meta.identity_status ?? 'unknown';
  const identityConfidence = meta.identity_confidence ?? 'unknown';
  const limitations = meta.limitations ?? [];

  const google = d.platforms?.google ?? {};
  const yelp = d.platforms?.yelp ?? {};
  const facebook = d.platforms?.facebook ?? {};
  const reviewMetrics = d.combined_review_metrics ?? {};
  const website = d.website ?? {};
  const nap = d.nap_consistency ?? {};
  const themes = d.negative_review_themes ?? [];
  const examples = d.unanswered_negative_review_examples ?? [];
  const score = d.digital_opportunity_score?.score ?? 0;
  const classification = d.digital_opportunity_score?.classification ?? '';
  const components = d.digital_opportunity_score?.components ?? {};
  const highAttention = d.high_attention === true;
  const tier = d.recommended_tier ?? '';
  const fee = d.estimated_monthly_service_fee ?? {};
  const dq = d.data_quality ?? {};
  const sources = d.sources ?? [];

  const handleCopySummary = () => {
    const text = d.summary ?? `${requested.business_name ?? 'Business'} seek audit — score ${score}/10, tier ${tier}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const report = await marketingOpsService.syncAuditToCampaign(campaignId, audit.id);
      if (report.skipped) {
        setSyncResult(`Skipped: ${report.skipReason ?? 'identity mismatch'}`);
      } else {
        const parts = [];
        if (report.fieldsSynced.length) parts.push(`${report.fieldsSynced.length} fields`);
        if (report.contactsSynced.length) parts.push(`${report.contactsSynced.length} contacts`);
        if (report.hotProspectMarked) parts.push('hot prospect');
        setSyncResult(`Synced: ${parts.join(', ') || 'no changes'}`);
        onSynced?.();
      }
    } catch (e: any) {
      setSyncResult(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleAddToPlace = async () => {
    setAddingToPlace(true);
    setPlaceResult(null);
    setPlaceError(null);
    try {
      const result = await directoryPresenceAdminService.createSeedFromCampaign(campaignId);
      setPlaceResult(result);
    } catch (e: any) {
      setPlaceError(e.message || 'Failed to add place listing');
    } finally {
      setAddingToPlace(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
      {/* Header: identity verification */}
      <div className="p-4 bg-gray-50 dark:bg-neutral-700/30">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {matched.business_name ?? requested.business_name ?? 'Business'}
            </h3>
            <Badge cls={identityColor(identityStatus)}>
              {identityStatus === 'confirmed' && <ShieldCheck className="inline h-2.5 w-2.5" />}
              {identityStatus === 'mismatched' && <ShieldAlert className="inline h-2.5 w-2.5" />}
              {' '}
              {identityStatus}
            </Badge>
            <span className="text-[10px] text-gray-400">confidence: {identityConfidence}</span>
            <AuditImportMetadataBadge audit={audit} />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleCopySummary} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700">
              <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy summary'}
            </button>
            <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50">
              {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Sync to campaign
            </button>
            <button
              onClick={handleAddToPlace}
              disabled={addingToPlace || identityStatus === 'mismatched' || placeResult != null}
              title={
                placeResult != null
                  ? 'Already added to place listing'
                  : identityStatus === 'mismatched'
                    ? 'Cannot seed: identity mismatch'
                    : 'Create and publish place listing'
              }
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-default"
            >
              {addingToPlace ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : placeResult != null ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {addingToPlace ? 'Adding...' : placeResult != null ? 'Added to place listing' : 'Add to place listing'}
            </button>
          </div>
        </div>
        {syncResult && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{syncResult}</p>
        )}
        {placeResult && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-3 w-3" />
            {placeResult.created ? 'Added' : 'Already linked'}{placeResult.seoEnriched ? ' (SEO enriched)' : ''}:
            <a href={placeResult.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline hover:text-green-700">
              <ExternalLink className="h-3 w-3" /> {placeResult.publicUrl}
            </a>
            <a href={`/settings/admin/directory/presence-seeds/${placeResult.seedId}`} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 underline ml-1">
              seed
            </a>
          </p>
        )}
        {placeError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{placeError}</p>
        )}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="text-gray-400">Requested:</span> {requested.business_name} · {requested.city}, {requested.state} · {requested.category}
        </div>
        {matched.business_name && matched.business_name !== requested.business_name && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="text-gray-400">Matched:</span> {matched.business_name}
            {matched.category && ` · ${matched.category}`}
          </div>
        )}
      </div>

      {/* Identity warning banners */}
      {identityStatus === 'ambiguous' && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>The AI found multiple businesses matching this name. Verify this audit is about the correct business before relying on its data.</span>
        </div>
      )}
      {identityStatus === 'mismatched' && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>This audit appears to be about a different business. Field sync was skipped.</span>
        </div>
      )}

      <div className="px-4 pb-4">
        {/* Detected Signals (Triage Engine Mapping) */}
        {Array.isArray(d.detected_signals) && d.detected_signals.length > 0 && (
          <Section title={`Detected Signals (${d.detected_signals.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {d.detected_signals.map((code: string) => {
                const family = code.split('_')[0];
                const familyColors: Record<string, string> = {
                  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
                  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
                };
                return (
                  <span
                    key={code}
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-mono font-medium ${familyColors[family] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                    title={code}
                  >
                    {code}
                  </span>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              These signals feed the triage engine to auto-assign a playbook, archetype, and FITD offer.
            </p>
          </Section>
        )}

        {/* 2. Summary */}
        {d.summary && (
          <Section title="Summary">
            <p className="text-sm text-gray-700 dark:text-gray-300">{d.summary}</p>
          </Section>
        )}

        {/* 3. Platform ratings */}
        <Section title="Platform Ratings">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left py-1">Platform</th>
                <th className="text-left">Rating</th>
                <th className="text-left">Reviews</th>
                <th className="text-left">Response</th>
                <th className="text-left">Unanswered</th>
                <th className="text-left">Data</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {[
                { name: 'Google', p: google },
                { name: 'Yelp', p: yelp },
                { name: 'Facebook', p: facebook },
              ].map(({ name, p }) => (
                <tr key={name} className="border-t border-gray-50 dark:border-gray-700/50">
                  <td className="py-1 font-medium">{name}</td>
                  <td>{p.rating ?? '—'}</td>
                  <td>{p.total_reviews ?? '—'}</td>
                  <td>{p.observable_response_rate_percent != null ? `${p.observable_response_rate_percent}%` : '—'}</td>
                  <td>{p.observable_unanswered_reviews ?? '—'}</td>
                  <td>{p.data_status ? <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{p.data_status}</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 4. GBP assessment (Google-specific fields) */}
        <Section title="Google Business Profile">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {google.profile_status && <Badge cls={profileStatusColor(google.profile_status)}>{google.profile_status.replace(/_/g, ' ')}</Badge>}
            {google.primary_category && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{google.primary_category}</Badge>}
          </div>
          {google.additional_categories?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {google.additional_categories.map((c: string, i: number) => <Badge key={i} cls="bg-gray-50 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">{c}</Badge>)}
            </div>
          )}
          {(google.displayed_name || google.displayed_address || google.displayed_phone || google.displayed_website) && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              {google.displayed_name && <div><span className="text-gray-400">Displayed:</span> {google.displayed_name}</div>}
              {google.displayed_address && <div><span className="text-gray-400">Address:</span> {google.displayed_address}</div>}
              {google.displayed_phone && <div><span className="text-gray-400">Phone:</span> {google.displayed_phone}</div>}
              {google.displayed_website && <div><span className="text-gray-400">Website:</span> {google.displayed_website}</div>}
            </div>
          )}
          {google.profile_issues?.length > 0 && (
            <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
              {google.profile_issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
            </ul>
          )}
        </Section>

        {/* 5. Website assessment */}
        <Section title="Website">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {website.status && <Badge cls={websiteStatusColor(website.status)}>{website.status.replace(/_/g, ' ')}</Badge>}
            {website.mobile_friendly && <Badge cls="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Mobile: {website.mobile_friendly}</Badge>}
            {website.https != null && <Badge cls={website.https ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}>HTTPS: {website.https ? 'Yes' : 'No'}</Badge>}
            <YesNo v={website.contact_information_visible} label="Contact info" />
            <YesNo v={website.click_to_call_available} label="Click-to-call" />
            <YesNo v={website.call_to_action_present} label="CTA" />
            <YesNo v={website.service_information_present} label="Service info" />
            <YesNo v={website.location_information_present} label="Location info" />
          </div>
          {website.url && (
            <a href={website.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              <Globe className="h-3 w-3" /> {website.url}
            </a>
          )}
          {website.issues?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {website.issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
            </ul>
          )}
          {website.conversion_opportunities?.length > 0 && (
            <div className="mt-1">
              <span className="text-[10px] text-gray-400">Conversion opportunities:</span>
              <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                {website.conversion_opportunities.map((opp: string, i: number) => <li key={i}>{opp}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* 6. NAP consistency */}
        <Section title="NAP Consistency">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {nap.overall_status && <Badge cls={nap.overall_status === 'consistent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}>{nap.overall_status.replace(/_/g, ' ')}</Badge>}
          </div>
          {(nap.canonical_name || nap.canonical_address || nap.canonical_phone) && (
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
              {nap.canonical_name && <div><span className="text-gray-400">Canonical name:</span> {nap.canonical_name}</div>}
              {nap.canonical_address && <div><span className="text-gray-400">Canonical address:</span> {nap.canonical_address}</div>}
              {nap.canonical_phone && <div><span className="text-gray-400">Canonical phone:</span> {nap.canonical_phone}</div>}
            </div>
          )}
          {(nap.name_variations?.length || nap.address_variations?.length || nap.phone_variations?.length) ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">Variations</summary>
              <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                {nap.name_variations?.length > 0 && <div><span className="text-gray-400">Name:</span> {nap.name_variations.join('; ')}</div>}
                {nap.address_variations?.length > 0 && <div><span className="text-gray-400">Address:</span> {nap.address_variations.join('; ')}</div>}
                {nap.phone_variations?.length > 0 && <div><span className="text-gray-400">Phone:</span> {nap.phone_variations.join('; ')}</div>}
              </div>
            </details>
          ) : null}
          {nap.material_issues?.length > 0 && (
            <ul className="mt-1 text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
              {nap.material_issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
            </ul>
          )}
        </Section>

        {/* 7. Combined review metrics */}
        <Section title="Combined Review Metrics">
          <div className="flex flex-wrap gap-3 text-xs text-gray-700 dark:text-gray-300">
            <span>Total: {reviewMetrics.observable_total_reviews ?? '—'}</span>
            <span>With response: {reviewMetrics.observable_reviews_with_response ?? '—'}</span>
            <span>Unanswered: {reviewMetrics.observable_unanswered_reviews ?? '—'}</span>
            <span>Neg unanswered: {reviewMetrics.observable_unanswered_negative_reviews ?? '—'}</span>
            <span>Response rate: {reviewMetrics.observable_response_rate_percent != null ? `${reviewMetrics.observable_response_rate_percent}%` : '—'}</span>
            <span>Unanswered rate: {reviewMetrics.observable_unanswered_rate_percent != null ? `${reviewMetrics.observable_unanswered_rate_percent}%` : '—'}</span>
            {reviewMetrics.counts_complete != null && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Counts: {reviewMetrics.counts_complete ? 'complete' : 'partial'}</Badge>}
          </div>
        </Section>

        {/* 8. Unanswered negative review examples */}
        {examples.length > 0 && (
          <Section title="Unanswered Negative Review Examples">
            <div className="space-y-1.5">
              {examples.slice(0, 3).map((ex: any, i: number) => (
                <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <span>{ex.platform}</span>
                    <span>·</span>
                    <span>{ex.rating}★</span>
                    {ex.date && <><span>·</span><span>{ex.date}</span></>}
                  </div>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">{ex.complaint_summary}</p>
                  <div className="mt-1 text-[10px] text-gray-400">
                    Response: {ex.response_status ?? '—'} · Verification: {ex.verification_status ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 9. Negative review themes */}
        {themes.length > 0 && (
          <Section title="Negative Review Themes">
            <div className="space-y-1">
              {themes.map((t: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.theme}</span>
                    {t.observed_frequency && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{t.observed_frequency}</Badge>}
                    {t.supporting_review_count != null && <span className="text-[10px] text-gray-400">({t.supporting_review_count} reviews)</span>}
                  </div>
                  {t.summary && <p className="text-gray-500 dark:text-gray-400">{t.summary}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 10. Digital opportunity score */}
        <Section title="Digital Opportunity Score">
          <div className="flex items-center gap-3">
            <Badge cls={scoreColor(score)}>{score}/10</Badge>
            <span className="text-xs text-gray-600 dark:text-gray-400">{classification}</span>
          </div>
          {components && Object.keys(components).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(components).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400 capitalize w-44 truncate">{key.replace(/_/g, ' ')}:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (val as number) * 10)}%` }} />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 w-6 text-right">{val as number}</span>
                </div>
              ))}
            </div>
          )}
          {d.digital_opportunity_score?.rationale && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{d.digital_opportunity_score.rationale}</p>
          )}
        </Section>

        {/* 11. High-attention */}
        <Section title="High Attention">
          {highAttention ? (
            <span title={(d.high_attention_reasons ?? []).join('\n')} className="inline-flex items-center gap-1">
              <Badge cls="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <Flame className="inline h-2.5 w-2.5" /> High Attention
              </Badge>
            </span>
          ) : (
            <span className="text-xs text-gray-400">Not flagged</span>
          )}
          {d.high_attention_reasons?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {d.high_attention_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </Section>

        {/* 12. Recommended tier */}
        <Section title="Recommended Tier">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {tier && <Badge cls={tierColor(tier)}>{tier.replace(/_/g, ' ')}</Badge>}
            <span className="text-gray-600 dark:text-gray-400">Fee: {formatFee(fee)}</span>
          </div>
          {d.tier_rationale && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{d.tier_rationale}</p>}
          {d.recommended_services?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.recommended_services.map((s: string, i: number) => <Badge key={i} cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{s}</Badge>)}
            </div>
          )}
        </Section>

        {/* 13. Data quality */}
        <Section title="Data Quality">
          <div className="flex items-center gap-2 mb-2">
            {dq.confidence && <Badge cls={confidenceColor(dq.confidence)}>Confidence: {dq.confidence}</Badge>}
          </div>
          {dq.verified_fields?.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] text-green-600 dark:text-green-400">Verified:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {dq.verified_fields.map((f: string) => <Badge key={f} cls="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">{f}</Badge>)}
              </div>
            </div>
          )}
          {dq.unavailable_fields?.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] text-red-600 dark:text-red-400">Unavailable:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {dq.unavailable_fields.map((f: string) => <Badge key={f} cls="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{f}</Badge>)}
              </div>
            </div>
          )}
          {dq.conflicts?.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Conflicts:</span>
              <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
                {dq.conflicts.map((c: string, i: number) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          {dq.limitations?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {dq.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </Section>

        {/* 14. Sources */}
        {sources.length > 0 && (
          <Section title="Sources">
            <div className="space-y-0.5">
              {sources.map((s: any, i: number) => (
                <div key={i} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{s.platform}</span>
                  {s.source_type && <span className="text-gray-400"> · {s.source_type}</span>}
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 dark:text-blue-400 hover:underline">{s.url}</a>}
                  {s.accessed_date && <span className="text-gray-400"> · {s.accessed_date}</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Audit metadata limitations */}
        {limitations.length > 0 && (
          <Section title="Audit Limitations">
            <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          </Section>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2 text-[10px] text-gray-400">
          Audit created: {new Date(audit.created_at).toLocaleString()} · Platform: {audit.platform}
        </div>
      </div>
    </div>
  );
}
