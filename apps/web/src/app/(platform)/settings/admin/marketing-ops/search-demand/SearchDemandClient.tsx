'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import seoDemandAdminService, {
  Paged, SeoDemandGap, SeoDemandMarket, SeoDemandSummary, SeoQuerySignal,
} from '@/services/SeoDemandAdminService';

type Tab = 'signals' | 'gaps' | 'markets';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'signals', label: 'Query signals' },
  { id: 'gaps', label: 'Category × market gaps' },
  { id: 'markets', label: 'Markets' },
];

const ROUTE_LABELS: Record<string, string> = {
  pitch_now: 'Pitch now',
  audit_triage: 'Audit → triage',
  seed_signal: 'Seed signal',
  in_queue: 'In queue',
  claimed_client: 'Claimed client',
  seek_batch: 'Seek batch',
  category: 'Category',
  market: 'Market',
  brand: 'Brand',
};

const ROUTE_COLORS: Record<string, string> = {
  pitch_now: 'bg-red-100 text-red-800',
  audit_triage: 'bg-orange-100 text-orange-800',
  seed_signal: 'bg-green-100 text-green-800',
  in_queue: 'bg-blue-100 text-blue-800',
  claimed_client: 'bg-teal-100 text-teal-800',
  seek_batch: 'bg-indigo-100 text-indigo-800',
};

const INTENTS = ['store', 'category_market', 'category', 'market', 'brand', 'other'];
const REVIEW_STATUSES = ['open', 'confirmed', 'rejected', 'queued'];
const SEED_STATUSES = ['none', 'any', 'draft', 'published', 'invited', 'suppressed'];
const CAMPAIGN_STAGES = ['none', 'seek', 'seed', 'closed'];
const PAGE_SIZES = ['25', '50', '100'];

const DEFAULT_SORT: Record<Tab, string> = { signals: 'priority', gaps: 'gap_score', markets: 'impressions' };

const QUEUEABLE_ROUTES = new Set(['seed_signal', 'audit_triage', 'pitch_now', 'in_queue']);

const fmtPos = (p: number | null | undefined) => (p == null ? '—' : Number(p).toFixed(1));
const pathOf = (url: string | null) => {
  if (!url) return '—';
  try { return new URL(url).pathname; } catch { return url; }
};

export default function SearchDemandClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = (searchParams.get('tab') as Tab) || 'signals';
  const param = useCallback((k: string, d = '') => searchParams.get(k) ?? d, [searchParams]);

  const setParams = useCallback((updates: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !('page' in updates)) next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const [summary, setSummary] = useState<SeoDemandSummary | null>(null);
  const [data, setData] = useState<Paged<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Text inputs are debounced into the URL.
  const [qInput, setQInput] = useState(param('q'));
  useEffect(() => { setQInput(param('q')); }, [param]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== param('q')) setParams({ q: qInput }); }, 350);
    return () => clearTimeout(t);
  }, [qInput, param, setParams]);

  const apiParams = useMemo(() => {
    const p: Record<string, string> = {};
    searchParams.forEach((v, k) => { if (k !== 'tab' && v) p[k] = v; });
    if (!p.sort) p.sort = DEFAULT_SORT[tab];
    return p;
  }, [searchParams, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = tab === 'gaps'
        ? seoDemandAdminService.listGaps(apiParams)
        : tab === 'markets'
          ? seoDemandAdminService.listMarkets(apiParams)
          : seoDemandAdminService.listSignals(apiParams);
      const [res, sum] = await Promise.all([fetcher, seoDemandAdminService.getSummary()]);
      setData(res);
      setSummary(sum);
    } catch (e: any) {
      setError(e?.message || 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, [tab, apiParams]);

  useEffect(() => { load(); }, [load]);

  const sort = param('sort', DEFAULT_SORT[tab]);
  const dir = param('dir', sort === 'priority' ? 'asc' : 'desc');
  const page = Number(param('page', '1'));
  const pageSize = param('pageSize', '25');
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / Number(pageSize)));

  const toggleSort = (key: string) => {
    if (sort === key) setParams({ sort: key, dir: dir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sort: key, dir: ['query', 'match', 'category', 'city', 'route', 'intent', 'priority', 'position'].includes(key) ? 'asc' : 'desc' });
  };

  const Th = ({ k, children, className = '' }: { k?: string; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap ${k ? 'cursor-pointer select-none hover:text-gray-900' : ''} ${className}`}
      onClick={k ? () => toggleSort(k) : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {k && sort === k && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
    } catch (e: any) {
      setNotice(`Error: ${e?.message || 'request_failed'}`);
    } finally {
      setBusy(null);
    }
  };

  const queue = (s: SeoQuerySignal) => run(`q:${s.query_norm}`, async () => {
    const r = await seoDemandAdminService.queueSignal(s.query_norm);
    if (r.kind === 'campaign_exists') return `"${s.sample_query}" already has a campaign (${r.campaignId}).`;
    return r.kind === 'created'
      ? `Queued "${s.sample_query}" as a search_batch prospect.`
      : `"${s.sample_query}" was already in the queue.`;
  });

  const review = (s: SeoQuerySignal, status: 'confirmed' | 'rejected' | 'open') =>
    run(`r:${s.query_norm}`, async () => { await seoDemandAdminService.reviewSignal(s.query_norm, status); });

  const seekHref = (category: string, city: string | null) => {
    const qs = new URLSearchParams({ category });
    if (city) qs.set('city', city);
    return `/settings/admin/directory/batches?${qs.toString()}`;
  };

  const select = (key: string, label: string, options: string[], labels?: Record<string, string>) => (
    <label className="flex flex-col text-xs text-gray-600">
      {label}
      <select
        className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
        value={param(key)}
        onChange={(e) => setParams({ [key]: e.target.value })}
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </label>
  );

  const text = (key: string, label: string, placeholder = '', width = 'w-32') => (
    <label className="flex flex-col text-xs text-gray-600">
      {label}
      <input
        className={`mt-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 ${width}`}
        defaultValue={param(key)}
        placeholder={placeholder}
        key={`${key}:${param(key)}`}
        onBlur={(e) => { if (e.target.value !== param(key)) setParams({ [key]: e.target.value }); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      {summary && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded border border-gray-200 bg-white px-3 py-2">
            <div className="text-xs text-gray-500">Site impressions (28d)</div>
            <div className="font-semibold">{summary.ingest?.page_impressions_28d ?? 0}</div>
          </div>
          <div className="rounded border border-gray-200 bg-white px-3 py-2">
            <div className="text-xs text-gray-500">Clicks (28d)</div>
            <div className="font-semibold">{summary.ingest?.page_clicks_28d ?? 0}</div>
          </div>
          {summary.routes.filter((r) => ROUTE_LABELS[r.route]).map((r) => (
            <button
              key={r.route}
              type="button"
              onClick={() => setParams({ tab: 'signals', route: r.route })}
              className="rounded border border-gray-200 bg-white px-3 py-2 text-left hover:border-blue-400"
            >
              <div className="text-xs text-gray-500">{ROUTE_LABELS[r.route]}</div>
              <div className="font-semibold">{r.open} open <span className="font-normal text-gray-500">/ {r.queries}</span></div>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            Data through {summary.ingest?.last_date ? String(summary.ingest.last_date).slice(0, 10) : '—'}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
              disabled={busy === 'ingest'}
              onClick={() => run('ingest', async () => {
                const r = await seoDemandAdminService.ingest();
                return r?.result?.skipped ? 'Search Console key not configured on the API.' : 'Search Console pulled.';
              })}
            >
              {busy === 'ingest' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Pull now
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              next.set('tab', t.id);
              const w = param('window');
              if (w) next.set('window', w);
              router.replace(`${pathname}?${next.toString()}`, { scroll: false });
            }}
            className={`px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-gray-600">
          Search
          <input
            className="mt-1 w-56 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            value={qInput}
            placeholder={tab === 'signals' ? 'Query or business name' : tab === 'gaps' ? 'Category or city' : 'City'}
            onChange={(e) => setQInput(e.target.value)}
          />
        </label>
        {select('window', 'Window', ['7', '28', '90'], { '7': '7 days', '28': '28 days', '90': '90 days' })}
        {text('minImpressions', 'Min impressions', '0', 'w-24')}
        {tab !== 'markets' && text('category', 'Category', 'e.g. Halal Grocery Store', 'w-48')}
        {tab !== 'markets' && text('city', 'City')}
        {text('state', 'State', 'MO', 'w-16')}
        {tab === 'signals' && (
          <>
            {select('route', 'Route', Object.keys(ROUTE_LABELS), ROUTE_LABELS)}
            {select('intent', 'Intent', INTENTS)}
            {select('reviewStatus', 'Review', REVIEW_STATUSES)}
            {text('minConfidence', 'Min confidence', '0.6', 'w-20')}
            {select('seedStatus', 'Seed', SEED_STATUSES)}
            {select('campaignStage', 'Campaign', CAMPAIGN_STAGES)}
          </>
        )}
        {tab === 'gaps' && (
          <label className="flex items-center gap-1 pb-1 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={param('gapOnly') === 'true'}
              onChange={(e) => setParams({ gapOnly: e.target.checked ? 'true' : null })}
            />
            Gaps only (≤ 2 live seeds)
          </label>
        )}
        <button type="button" className="pb-1 text-xs text-blue-600 hover:underline" onClick={() => router.replace(`${pathname}?tab=${tab}`)}>
          Clear filters
        </button>
      </div>

      {notice && <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          {tab === 'signals' && (
            <>
              <thead className="bg-gray-50">
                <tr>
                  <Th k="query">Query</Th>
                  <Th k="route">Route</Th>
                  <Th k="match">Match</Th>
                  <Th k="confidence">Conf.</Th>
                  <Th k="category">Category</Th>
                  <Th k="city">Market</Th>
                  <Th k="impressions">Impr.</Th>
                  <Th k="clicks">Clicks</Th>
                  <Th k="position">Pos.</Th>
                  <Th>Top page</Th>
                  <Th>Seed / campaign</Th>
                  <Th k="last_seen">Last seen</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.rows as SeoQuerySignal[] | undefined)?.map((s) => {
                  const imp = param('window') === '7' ? s.impressions_7d : param('window') === '90' ? s.impressions_90d : s.impressions_28d;
                  return (
                    <tr key={s.query_norm} className={s.review_status === 'rejected' ? 'opacity-50' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-900">{s.sample_query}</td>
                      <td className="px-3 py-2">
                        {s.route && (
                          <span className={`rounded px-2 py-0.5 text-xs ${ROUTE_COLORS[s.route] || 'bg-gray-100 text-gray-700'}`}>
                            {ROUTE_LABELS[s.route] || s.route}
                          </span>
                        )}
                        {s.review_status !== 'open' && <div className="mt-1 text-xs text-gray-500">{s.review_status}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {s.match_name && s.match_kind !== 'unmatched' ? (
                          <>
                            {s.match_name}
                            <div className="text-xs text-gray-400">{s.match_kind}</div>
                          </>
                        ) : <span className="text-gray-400">{s.match_kind === 'unmatched' ? 'no seed' : '—'}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{s.match_confidence != null ? s.match_confidence.toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{s.category || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{s.city ? `${s.city}, ${s.state}` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{imp}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.clicks_28d}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPos(s.position_28d)}</td>
                      <td className="max-w-[14rem] truncate px-3 py-2 text-xs text-gray-500" title={s.top_page || ''}>
                        {s.top_page ? <a href={s.top_page} target="_blank" rel="noreferrer" className="hover:underline">{pathOf(s.top_page)}</a> : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {s.seed_id && (
                          <Link href={`/settings/admin/directory/presence-seeds/${s.seed_id}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                            Seed{s.seed_status ? ` (${s.seed_status})` : ''} <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {s.campaign_id && (
                          <Link href={`/settings/admin/marketing-ops/campaigns/${s.campaign_id}`} className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline">
                            Campaign{s.campaign_stage ? ` (${s.campaign_stage})` : ''} <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {s.queued_prospect_id && (
                          <Link href="/settings/admin/marketing-ops/queue" className="ml-2 text-blue-600 hover:underline">Queued</Link>
                        )}
                        {!s.seed_id && !s.campaign_id && !s.queued_prospect_id && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{s.last_seen ? String(s.last_seen).slice(0, 10) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {s.intent === 'store' && s.route && QUEUEABLE_ROUTES.has(s.route) && s.review_status !== 'queued' && s.review_status !== 'rejected' && (
                            <button
                              type="button"
                              disabled={busy === `q:${s.query_norm}`}
                              onClick={() => queue(s)}
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              title={s.route === 'seed_signal' ? 'Queue a seed signal (search_batch)' : 'Queue for audit → triage (search_batch)'}
                            >
                              {busy === `q:${s.query_norm}` ? '…' : s.route === 'seed_signal' ? 'Queue seed' : 'Queue audit'}
                            </button>
                          )}
                          {(s.route === 'seek_batch' || s.route === 'category') && s.category && (
                            <Link href={seekHref(s.category, s.city)} className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                              Start seek batch
                            </Link>
                          )}
                          {s.review_status === 'open' && s.match_kind && s.match_kind !== 'unmatched' && (
                            <button type="button" title="Confirm match" onClick={() => review(s, 'confirmed')} className="rounded border border-gray-300 p-1 text-green-700 hover:bg-green-50">
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                          {s.review_status === 'open' && (
                            <button type="button" title="Reject" onClick={() => review(s, 'rejected')} className="rounded border border-gray-300 p-1 text-red-700 hover:bg-red-50">
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          {(s.review_status === 'confirmed' || s.review_status === 'rejected') && (
                            <button type="button" onClick={() => review(s, 'open')} className="text-xs text-gray-500 hover:underline">Reopen</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          )}

          {tab === 'gaps' && (
            <>
              <thead className="bg-gray-50">
                <tr>
                  <Th k="category">Category</Th>
                  <Th k="city">Market</Th>
                  <Th k="impressions">Impr.</Th>
                  <Th k="queries">Queries</Th>
                  <Th k="store_signals">Store queries</Th>
                  <Th k="position">Pos.</Th>
                  <Th k="seeds">Seeds</Th>
                  <Th k="published">Live seeds</Th>
                  <Th k="gap_score">Gap score</Th>
                  <Th>Top queries</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.rows as SeoDemandGap[] | undefined)?.map((g) => (
                  <tr key={`${g.category}|${g.city}|${g.state}`}>
                    <td className="px-3 py-2 font-medium text-gray-900">{g.category}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{g.city ? `${g.city}, ${g.state}` : <span className="text-gray-400">No market in query</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.impressions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.queries}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.store_signals}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPos(g.position)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.seeds}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${g.published <= 2 ? 'font-semibold text-orange-700' : ''}`}>{g.published}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.gap_score.toFixed(1)}</td>
                    <td className="max-w-[18rem] truncate px-3 py-2 text-xs text-gray-500" title={(g.top_queries || []).join(', ')}>
                      {(g.top_queries || []).join(', ')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={seekHref(g.category, g.city)} className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                        Start seek batch
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {tab === 'markets' && (
            <>
              <thead className="bg-gray-50">
                <tr>
                  <Th k="city">Market</Th>
                  <Th k="impressions">Impr.</Th>
                  <Th k="clicks">Clicks</Th>
                  <Th k="position">Pos.</Th>
                  <Th k="queries">Queries</Th>
                  <Th k="store_signals">Store queries</Th>
                  <Th k="seed_signals">Unseeded stores</Th>
                  <Th k="categories">Categories</Th>
                  <Th k="seeds">Seeds</Th>
                  <Th k="published">Live seeds</Th>
                  <Th>Drill in</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.rows as SeoDemandMarket[] | undefined)?.map((m) => (
                  <tr key={`${m.city}|${m.state}`}>
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{m.city}, {m.state}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.impressions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.clicks}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPos(m.position)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.queries}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.store_signals}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.seed_signals}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.categories}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.seeds}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.published}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => router.replace(`${pathname}?tab=signals&city=${encodeURIComponent(m.city)}&state=${encodeURIComponent(m.state)}`)}>
                        Queries
                      </button>
                      <button type="button" className="ml-3 text-blue-600 hover:underline" onClick={() => router.replace(`${pathname}?tab=gaps&city=${encodeURIComponent(m.city)}&state=${encodeURIComponent(m.state)}`)}>
                        Gaps
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
        {loading && <div className="flex items-center justify-center py-8 text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</div>}
        {!loading && !error && total === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No rows. {summary?.ingest?.last_date ? 'Try loosening the filters.' : 'No Search Console data yet — set the GSC key on the API and click Pull now.'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <div>{total} {total === 1 ? 'row' : 'rows'}</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            Rows
            <select className="rounded border border-gray-300 px-1 py-0.5" value={pageSize} onChange={(e) => setParams({ pageSize: e.target.value })}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, false)} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Prev</button>
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) }, false)} className="rounded border border-gray-300 px-2 py-0.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
