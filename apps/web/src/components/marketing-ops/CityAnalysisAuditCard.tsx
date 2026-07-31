'use client';

import { useState } from 'react';
import { Flame, Globe, Phone, MapPin, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Copy, Save, RefreshCw } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';

// ─── Helpers ────────────────────────────────────────────────────────────

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

function ownershipColor(type: string): string {
  if (type === 'national_chain') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (type === 'independent') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function profileStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'claimed') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (s === 'likely_claimed') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (s === 'unclaimed') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function websiteStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'working') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (s === 'broken') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (s === 'none_found') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
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

function formatFee(fee: { minimum?: number; maximum?: number; currency?: string }): string {
  if (fee.minimum == null && fee.maximum == null) return '—';
  const cur = fee.currency || '$';
  if (fee.minimum != null && fee.maximum != null) return `${cur}${fee.minimum}–${cur}${fee.maximum}`;
  return `${cur}${fee.minimum ?? fee.maximum}`;
}

// ─── Component ──────────────────────────────────────────────────────────

interface CityAnalysisAuditCardProps {
  audit: Audit;
}

export default function CityAnalysisAuditCard({ audit }: CityAnalysisAuditCardProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const b = (audit.audit_data ?? {}) as any;
  const score = b.digital_opportunity_score?.score ?? 0;
  const classification = b.digital_opportunity_score?.classification ?? '';
  const components = b.digital_opportunity_score?.components ?? {};
  const highAttention = b.high_attention === true;
  const tier = b.recommended_tier ?? '';
  const ownership = b.ownership_type ?? 'unknown';
  const dq = b.data_quality ?? {};
  const google = b.platforms?.google ?? {};
  const yelp = b.platforms?.yelp ?? {};
  const facebook = b.platforms?.facebook ?? {};
  const website = b.website ?? {};
  const nap = b.nap_consistency ?? {};
  const reviewMetrics = b.combined_review_metrics ?? {};
  const fee = b.estimated_monthly_service_fee ?? {};
  const themes = b.negative_review_themes ?? [];
  const examples = b.unanswered_negative_review_examples ?? [];
  const opportunities = b.opportunities ?? {};

  const handleCopySummary = () => {
    const text = `Rank #${b.rank ?? '?'} — ${b.business_name} (${b.category})\nScore: ${score}/10 (${classification})\nTier: ${tier}\nHigh Attention: ${highAttention}\nReasons: ${(b.high_attention_reasons ?? []).join('; ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-neutral-700/30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-400">#{b.rank ?? '?'}</span>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{b.business_name}</h3>
          <Badge cls={ownershipColor(ownership)}>{ownership.replace('_', ' ')}</Badge>
          {highAttention && (
            <span title={(b.high_attention_reasons ?? []).join('\n')} className="inline-flex items-center gap-1">
              <Badge cls="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <Flame className="inline h-2.5 w-2.5" /> High Attention
              </Badge>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopySummary} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700">
            <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy summary'}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* 1. Platform ratings table */}
        <Section title="Platform Ratings">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left py-1">Platform</th>
                <th className="text-left">Rating</th>
                <th className="text-left">Reviews</th>
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
                  <td>{p.observable_unanswered_reviews ?? '—'}</td>
                  <td>{p.data_status ? <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{p.data_status}</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 2. GBP status */}
        <Section title="Google Business Profile">
          {google.profile_status ? (
            <Badge cls={profileStatusColor(google.profile_status)}>{google.profile_status.replace(/_/g, ' ')}</Badge>
          ) : (
            <span className="text-xs text-gray-400">N/A</span>
          )}
        </Section>

        {/* 3. Website assessment */}
        <Section title="Website">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {website.status && <Badge cls={websiteStatusColor(website.status)}>{website.status.replace(/_/g, ' ')}</Badge>}
            {website.mobile_friendly && <Badge cls="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Mobile: {website.mobile_friendly}</Badge>}
            {website.https != null && <Badge cls={website.https ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}>HTTPS: {website.https ? 'Yes' : 'No'}</Badge>}
            {website.contact_information_visible != null && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Contact info: {website.contact_information_visible ? 'Visible' : 'Hidden'}</Badge>}
            {website.call_to_action_present != null && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">CTA: {website.call_to_action_present ? 'Yes' : 'No'}</Badge>}
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
        </Section>

        {/* 4. NAP consistency */}
        <Section title="NAP Consistency">
          {nap.status && <Badge cls={nap.status === 'consistent' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}>{nap.status.replace(/_/g, ' ')}</Badge>}
          {nap.material_issues?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {nap.material_issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
            </ul>
          )}
        </Section>

        {/* 5. Combined review metrics */}
        <Section title="Combined Review Metrics">
          <div className="flex flex-wrap gap-3 text-xs text-gray-700 dark:text-gray-300">
            <span>Total: {reviewMetrics.observable_total_reviews ?? '—'}</span>
            <span>Unanswered: {reviewMetrics.observable_unanswered_reviews ?? '—'}</span>
            <span>Rate: {reviewMetrics.unanswered_rate_percent != null ? `${reviewMetrics.unanswered_rate_percent}%` : '—'}</span>
          </div>
        </Section>

        {/* 6. Unanswered negative review examples */}
        {examples.length > 0 && (
          <Section title="Unanswered Negative Review Examples">
            <div className="space-y-1.5">
              {examples.slice(0, 3).map((ex: any, i: number) => (
                <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <span>{ex.platform}</span>
                    <span>·</span>
                    <span>{ex.rating}★</span>
                    <span>·</span>
                    <span>{ex.date}</span>
                  </div>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">{ex.complaint_summary}</p>
                  <div className="mt-1 text-[10px] text-gray-400">
                    Response: {ex.response_status} · Verification: {ex.verification_status}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 7. Negative review themes */}
        {themes.length > 0 && (
          <Section title="Negative Review Themes">
            <div className="space-y-1">
              {themes.map((t: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.theme}</span>
                    {t.observed_frequency && <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{t.observed_frequency}</Badge>}
                  </div>
                  {t.summary && <p className="text-gray-500 dark:text-gray-400">{t.summary}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 8. Opportunities */}
        {opportunities && Object.keys(opportunities).length > 0 && (
          <Section title="Opportunities">
            <div className="space-y-1.5 text-xs">
              {['reputation_management', 'local_search', 'website_conversion'].map((key) => {
                const items = opportunities[key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={key}>
                    <span className="font-medium capitalize text-gray-700 dark:text-gray-300">{key.replace(/_/g, ' ')}:</span>
                    <ul className="ml-3 list-disc list-inside text-gray-500 dark:text-gray-400">
                      {items.map((item: any, i: number) => <li key={i}>{typeof item === 'string' ? item : item.opportunity ?? JSON.stringify(item)}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* 9. Digital opportunity score */}
        <Section title="Digital Opportunity Score">
          <div className="flex items-center gap-3">
            <Badge cls={scoreColor(score)}>{score}/10</Badge>
            <span className="text-xs text-gray-600 dark:text-gray-400">{classification}</span>
          </div>
          {components && Object.keys(components).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(components).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 dark:text-gray-400 capitalize w-40 truncate">{key.replace(/_/g, ' ')}:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (val as number) * 10)}%` }} />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 w-6 text-right">{val as number}</span>
                </div>
              ))}
            </div>
          )}
          {b.digital_opportunity_score?.rationale && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{b.digital_opportunity_score.rationale}</p>
          )}
        </Section>

        {/* 10. Recommended tier */}
        <Section title="Recommended Tier">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {tier && <Badge cls={tierColor(tier)}>{tier.replace(/_/g, ' ')}</Badge>}
            <span className="text-gray-600 dark:text-gray-400">Fee: {formatFee(fee)}</span>
          </div>
          {b.tier_rationale && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{b.tier_rationale}</p>}
          {b.recommended_services?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {b.recommended_services.map((s: string, i: number) => <Badge key={i} cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{s}</Badge>)}
            </div>
          )}
        </Section>

        {/* 11. Data quality */}
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
          {dq.limitations?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {dq.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </Section>

        {/* 12. Sources */}
        {b.sources?.length > 0 && (
          <Section title="Sources">
            <div className="flex flex-wrap gap-1">
              {b.sources.map((s: string, i: number) => <Badge key={i} cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{s}</Badge>)}
            </div>
          </Section>
        )}

        {/* Footer: audit metadata */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-2 text-[10px] text-gray-400">
          Audit created: {new Date(audit.created_at).toLocaleString()} · Platform: {audit.platform}
        </div>
      </div>
    </div>
  );
}
