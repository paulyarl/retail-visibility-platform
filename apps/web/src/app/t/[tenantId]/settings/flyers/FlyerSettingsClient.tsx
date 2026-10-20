'use client';

/**
 * FlyerSettingsClient — merchant flyer composer + display options.
 *
 * The capability key unlocks tooling only — the merchant authors every flyer
 * here: title, window, image, dishes/items (spec §1, §6).
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { AlertCircle, Copy, Plus, Sparkles, Calendar, ImageIcon, Share2, Archive, RefreshCw, Upload, Loader2, X } from 'lucide-react';
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';
import Link from 'next/link';
import { useFlyerCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { flyerService, type TenantFlyer, type FlyerVariant, type FlyerRecurrence, type FlyerExtractionDraft } from '@/services/FlyerService';
import FlyerShareKit from './FlyerShareKit';
import FlyerAnalyticsCard from './FlyerAnalyticsCard';
import FlyerCardOrderPanel from './FlyerCardOrderPanel';
import FrozenSpecialsCard from './FrozenSpecialsCard';
import ItemPickerModal from '@/components/inventory/ItemPickerModal';
import { clientLogger } from '@/lib/client-logger';

interface Props { tenantId: string }

type WindowPreset = 'today' | 'weekend' | 'week' | 'custom';

function presetWindow(preset: WindowPreset): { startsAt: string; endsAt: string } {
  const start = new Date();
  const end = new Date();
  if (preset === 'today') {
    end.setHours(23, 59, 59, 0);
  } else if (preset === 'weekend') {
    const day = start.getDay();
    const daysToSunday = (7 - day) % 7 || 7;
    end.setDate(end.getDate() + daysToSunday);
    end.setHours(23, 59, 59, 0);
  } else {
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 0);
  }
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    expired: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500',
    archived: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500',
    suppressed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  return map[status] ?? map.draft;
}

export default function FlyerSettingsClient({ tenantId }: Props) {
  const { data: flyerCap, loading: capLoading } = useFlyerCapability(tenantId);
  const [flyers, setFlyers] = useState<TenantFlyer[]>([]);
  const [repertoire, setRepertoire] = useState<FlyerVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Composer state
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [heroUploading, setHeroUploading] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<WindowPreset>('week');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [ctaMode, setCtaMode] = useState<'auto' | 'order' | 'view'>('auto');
  const [recurrence, setRecurrence] = useState<FlyerRecurrence>('none');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  // Catalog-item links (inventory_item_id) — picked via ItemPickerModal
  const [selectedItems, setSelectedItems] = useState<Map<string, { name: string; priceCents: number | null }>>(new Map());
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [newDishes, setNewDishes] = useState<{ name: string; priceCents: number | null; stock: number; needsPriceConfirmation?: boolean }[]>([]);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishStock, setDishStock] = useState('');

  // AI draft state (spec §7a.1 — draft-then-confirm; nothing saves on load)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // Options state
  const [options, setOptions] = useState({
    flyer_display: true,
    flyer_storefront_display: true,
    flyer_directory_display: true,
    flyer_place_display: true,
    flyer_frozen_display: true,
    default_title: 'Featured Specials',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, rep, opts] = await Promise.all([
        flyerService.listFlyers(tenantId),
        flyerService.getRepertoire(tenantId).catch(() => ({ parentItemId: null, dishes: [] as FlyerVariant[], frozen: [] as FlyerVariant[] })),
        flyerService.getOptions(tenantId).catch(() => null),
      ]);
      setFlyers(list.flyers);
      setRepertoire(rep.dishes);
      if (opts?.settings) setOptions(opts.settings);
    } catch (err: any) {
      setError(err?.message || 'Failed to load flyers');
      clientLogger.error('[FlyerSettings] load failed', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const itemCount = selectedVariants.size + selectedItems.size + newDishes.length;
  const itemsLimit = flyerCap?.itemsLimit ?? 0;
  const overLimit = itemCount > itemsLimit;
  // Price-less dishes are legitimate promo lines — the flag is informational
  // ("no price shown / not orderable"), not a blocker (merchant owns attributes)
  const hasPriceless = newDishes.some(d => d.priceCents == null);

  const resetComposer = () => {
    setComposing(false);
    setEditingId(null);
    setTitle(''); setSummary(''); setHeroImageUrl('');
    setPreset('week'); setStartsAt(''); setEndsAt('');
    setCtaMode('auto');
    setRecurrence('none');
    setKeywords([]); setKwInput('');
    setSelectedVariants(new Set());
    setSelectedItems(new Map());
    setNewDishes([]);
    setDishName(''); setDishPrice(''); setDishStock('');
  };

  const saveFlyer = async (publish: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const window = preset === 'custom'
        ? { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }
        : presetWindow(preset);

      let flyer: TenantFlyer;
      if (editingId) {
        flyer = await flyerService.updateFlyer(tenantId, editingId, {
          title, summary: summary || null, heroImageUrl: heroImageUrl || null,
          startsAt: window.startsAt, endsAt: window.endsAt, ctaMode, recurrence, keywords,
        });
      } else {
        flyer = await flyerService.createFlyer(tenantId, {
          title, summary: summary || null, heroImageUrl: heroImageUrl || null,
          startsAt: window.startsAt, endsAt: window.endsAt, ctaMode, recurrence, keywords,
          status: 'draft',
        });
      }

      const items = [
        ...[...selectedVariants].map(variantId => ({ variantId })),
        ...[...selectedItems.keys()].map(inventoryItemId => ({ inventoryItemId })),
        ...newDishes.map(d => ({ dish: { name: d.name, priceCents: d.priceCents, stock: d.stock } })),
      ];
      if (items.length > 0) {
        await flyerService.setFlyerItems(tenantId, flyer.id, items);
      }
      if (publish) {
        await flyerService.publishFlyer(tenantId, flyer.id);
      }
      setNotice(publish ? 'Flyer published' : 'Flyer saved');
      resetComposer();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save flyer');
    } finally {
      setSaving(false);
    }
  };

  /** Seed-page pattern: client-side validate + compress → dataUrl → API → stored URL into heroImageUrl. */
  const handleHeroFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setHeroUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file, ImageUploadPresets.flyer);
      if (result.error || !result.dataUrl) {
        throw new Error(result.error?.message || 'Could not process that image');
      }
      const url = await flyerService.uploadFlyerHeroImage(tenantId, result.dataUrl);
      setHeroImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setHeroUploading(false);
    }
  };

  /** AI extract → prefill composer. Merchant reviews every field; nothing saves on load. */
  const runExtraction = async () => {
    setAiBusy(true);
    setError(null);
    try {
      const draft = await flyerService.extractFlyerDraft(tenantId, aiBrief);
      applyDraft(draft);
      setAiOpen(false);
      setAiBrief('');
    } catch (err: any) {
      setError(err?.message || 'Extraction failed — try rephrasing the brief');
    } finally {
      setAiBusy(false);
    }
  };

  const applyDraft = (draft: FlyerExtractionDraft) => {
    setComposing(true);
    setEditingId(null);
    setTitle(draft.title);
    setSummary(draft.summary ?? '');
    setKeywords(draft.keywords ?? []);
    const presetMap: Record<string, WindowPreset> = {
      today: 'today', this_weekend: 'weekend', this_week: 'week', custom: 'custom',
    };
    setPreset(presetMap[draft.suggestedWindow ?? 'this_week'] ?? 'week');
    setNewDishes(draft.dishes.map(d => ({
      name: d.name,
      priceCents: d.priceCents,
      stock: d.stock ?? 0,
      needsPriceConfirmation: d.needsPriceConfirmation,
    })));
    setNotice('Draft loaded — review every field before publishing');
  };

  const flyerAction = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true); setError(null);
    try { await fn(); setNotice(ok); await load(); }
    catch (err: any) { setError(err?.message || 'Action failed'); }
    finally { setSaving(false); }
  };

  const [shareFlyer, setShareFlyer] = useState<TenantFlyer | null>(null);

  const saveOptions = async () => {
    setSaving(true); setError(null);
    try {
      await flyerService.updateOptions(tenantId, options);
      setNotice('Display settings saved');
    } catch (err: any) { setError(err?.message || 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const startEdit = (f: TenantFlyer) => {
    setEditingId(f.id);
    setComposing(true);
    setTitle(f.title);
    setSummary(f.summary ?? '');
    setHeroImageUrl(f.hero_image_url ?? '');
    setCtaMode(f.cta_mode);
    setRecurrence(f.recurrence ?? 'none');
    setKeywords(f.keywords ?? []);
    setPreset('custom');
    setStartsAt(f.starts_at.slice(0, 16));
    setEndsAt(f.ends_at.slice(0, 16));
    setSelectedVariants(new Set((f.tenant_flyer_items ?? []).map(i => i.variant_id).filter(Boolean) as string[]));
    setSelectedItems(new Map((f.tenant_flyer_items ?? [])
      .filter(i => i.inventory_item_id)
      .map(i => [i.inventory_item_id!, {
        name: i.inventory_items?.name ?? i.inventory_item_id!,
        priceCents: i.inventory_items?.sale_price_cents ?? i.inventory_items?.price_cents ?? null,
      }])));
  };

  if (capLoading || loading) {
    return <div className="p-8 text-sm text-neutral-500">Loading flyer settings…</div>;
  }

  if (!flyerCap?.enabled) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-neutral-900 dark:text-white">Specials Flyer isn't included in your plan</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Flyers let you publish time-boxed specials to your storefront, directory listing, and share links.
              </p>
              <Link href={`/t/${tenantId}/settings/subscription`} className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                View plans →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" /> Specials Flyer
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Publish a time-boxed flyer of specials — it appears on your surfaces for the window you choose, then retires itself.
          </p>
        </div>
        {!composing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAiOpen(!aiOpen)} className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Draft with AI
            </Button>
            <Button onClick={() => setComposing(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New flyer
            </Button>
          </div>
        )}
      </div>

      {/* AI extraction brief — returns a draft for review, never publishes */}
      {aiOpen && !composing && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Describe this run's specials in plain text — e.g. <em>"jollof plate $14 vegan, catfish $16, friday only"</em>.
              AI drafts the flyer; you review and publish.
            </p>
            <textarea
              value={aiBrief} onChange={e => setAiBrief(e.target.value)} rows={3}
              placeholder="item name + price, one per line or comma-separated…"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={runExtraction} disabled={aiBusy || aiBrief.trim().length < 3}>
                {aiBusy ? 'Extracting…' : 'Extract draft'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)} disabled={aiBusy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {notice && <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">{notice}</div>}

      {/* Composer */}
      {composing && (
        <Card>
          <CardHeader><CardTitle>{editingId ? 'Edit flyer' : 'New flyer'}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Title</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)} maxLength={160}
                placeholder="Weekend specials: fresh fish & sides"
                className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Becomes the page title on your public flyer link, share previews, and Google post — say what's on offer and when.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Summary <span className="text-neutral-400 font-normal">(optional)</span></label>
              <textarea
                value={summary} onChange={e => setSummary(e.target.value)} maxLength={2000} rows={2}
                placeholder="Fresh dishes prepared daily — order ahead for pickup or call the store."
                className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Shown on the flyer page and link previews — include items, timing, and how to buy (pickup, call, order online).
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Search keywords <span className="text-neutral-400 font-normal">(optional)</span></label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs text-neutral-800 dark:text-neutral-200">
                    {kw}
                    <button type="button" aria-label={`Remove ${kw}`} onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100">×</button>
                  </span>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const kw = kwInput.trim().toLowerCase();
                      if (kw && keywords.length < 10 && !keywords.includes(kw)) setKeywords([...keywords, kw]);
                      setKwInput('');
                    }
                  }}
                  maxLength={60}
                  placeholder="fish fry, weekend specials, fresh okra…"
                  className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                />
                <Button size="sm" variant="outline" onClick={() => {
                  const kw = kwInput.trim().toLowerCase();
                  if (kw && keywords.length < 10 && !keywords.includes(kw)) setKeywords([...keywords, kw]);
                  setKwInput('');
                }} disabled={!kwInput.trim() || keywords.length >= 10}>Add</Button>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Terms shoppers search for — they feed the flyer page's meta keywords and structured data. {keywords.length}/10
              </p>
            </div>
            {flyerCap.image && (
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Flyer image <span className="text-neutral-400 font-normal">(optional)</span></label>
                <div className="mt-1 flex items-start gap-3">
                  {heroImageUrl && (
                    <div className="relative shrink-0">
                      <img src={heroImageUrl} alt="Flyer artwork preview" className="h-20 max-w-[12rem] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 object-contain" />
                      <button
                        type="button" onClick={() => setHeroImageUrl('')} aria-label="Remove image"
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={heroFileRef} type="file" className="hidden"
                      accept={getAcceptString([...ImageUploadPresets.flyer.allowedTypes])}
                      onChange={handleHeroFile}
                    />
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={() => heroFileRef.current?.click()}
                      disabled={heroUploading}
                    >
                      {heroUploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                      {heroUploading ? 'Uploading…' : heroImageUrl ? 'Replace image' : 'Upload image'}
                    </Button>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Wide artwork works best — PNG, JPG, or WebP up to 8 MB.
                    </p>
                  </div>
                </div>
                <input
                  value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)}
                  placeholder="or paste an image URL — https://…"
                  className="mt-2 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1"><Calendar className="w-4 h-4" /> Window</label>
              <div className="mt-2 flex gap-2 flex-wrap">
                {(['today', 'weekend', 'week', 'custom'] as WindowPreset[]).map(p => (
                  <button key={p} type="button" onClick={() => setPreset(p)}
                    className={`text-sm rounded-lg px-3 py-1.5 border ${preset === p ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                    {p === 'today' ? 'Today' : p === 'weekend' ? 'This weekend' : p === 'week' ? 'This week' : 'Custom'}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm" />
                  <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm" />
                </div>
              )}
            </div>

            {flyerCap.recurring && (
              <div>
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Repeat</label>
                <div className="mt-2 flex gap-2">
                  {(['none', 'daily', 'weekly'] as FlyerRecurrence[]).map(r => (
                    <button key={r} type="button" onClick={() => setRecurrence(r)}
                      className={`text-sm rounded-lg px-3 py-1.5 border ${recurrence === r ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                      {r === 'none' ? 'One-time' : r === 'daily' ? 'Daily' : 'Weekly'}
                    </button>
                  ))}
                </div>
                {recurrence !== 'none' && (
                  <p className="text-xs text-neutral-500 mt-1.5">
                    When this flyer ends, the next window rolls out automatically with the same items.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Order button</label>
              <div className="mt-2 flex gap-2">
                {(['auto', 'order', 'view'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setCtaMode(m)}
                    className={`text-sm rounded-lg px-3 py-1.5 border ${ctaMode === m ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'}`}>
                    {m === 'auto' ? 'Auto (if checkout is on)' : m === 'order' ? 'Show ordering' : 'Display only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Items <span className={overLimit ? 'text-red-600' : 'text-neutral-400'}>({itemCount}/{itemsLimit})</span>
                </label>
              </div>

              {repertoire.length > 0 && (
                <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800 max-h-56 overflow-y-auto">
                  {repertoire.map(v => (
                    <label key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <input type="checkbox" checked={selectedVariants.has(v.id)}
                        onChange={e => {
                          const next = new Set(selectedVariants);
                          e.target.checked ? next.add(v.id) : next.delete(v.id);
                          setSelectedVariants(next);
                        }} />
                      <span className="flex-1 text-neutral-900 dark:text-white">{v.variant_name}</span>
                      {v.price_cents != null && <span className="text-neutral-500">${(v.price_cents / 100).toFixed(2)}</span>}
                      {v.is_active === false && <span className="text-xs text-neutral-400">(inactive)</span>}
                    </label>
                  ))}
                </div>
              )}

              {/* Catalog items — link inventory created via the item wizard */}
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" className="flex items-center gap-1.5"
                  onClick={() => setShowItemPicker(true)}>
                  <Plus className="w-3.5 h-3.5" /> Link catalog item
                </Button>
                {selectedItems.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...selectedItems.entries()].map(([itemId, info]) => (
                      <span key={itemId} className="inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                        {info.name}{info.priceCents != null ? ` · $${(info.priceCents / 100).toFixed(2)}` : ''}
                        <button type="button" onClick={() => {
                          const next = new Map(selectedItems); next.delete(itemId); setSelectedItems(next);
                        }} className="hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* New dish quick-add */}
              <div className="mt-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-3">
                <p className="text-xs text-neutral-500 mb-2">New special — saved to your repertoire, reusable on future flyers</p>
                <div className="flex gap-2">
                  <input value={dishName} onChange={e => setDishName(e.target.value)} placeholder="Name (e.g., Jollof Rice Plate)"
                    className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
                  <input value={dishPrice} onChange={e => setDishPrice(e.target.value)} placeholder="Price" type="number" step="0.01" min="0"
                    className="w-24 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
                  <input value={dishStock} onChange={e => setDishStock(e.target.value)} placeholder="Qty" type="number" min="0"
                    className="w-20 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
                  <Button type="button" variant="outline" size="sm" disabled={!dishName}
                    onClick={() => {
                      const p = parseFloat(dishPrice);
                      setNewDishes([...newDishes, { name: dishName, priceCents: dishPrice && !Number.isNaN(p) ? Math.round(p * 100) : null, stock: parseInt(dishStock || '0', 10) }]);
                      setDishName(''); setDishPrice(''); setDishStock('');
                    }}>
                    Add
                  </Button>
                </div>
                {newDishes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {newDishes.map((d, i) => (
                      <span key={i} className={`inline-flex items-center gap-1.5 rounded-full text-xs px-2.5 py-1 ${
                        d.priceCents == null
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600'
                          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                      }`}>
                        {d.name} · {d.priceCents != null ? `$${(d.priceCents / 100).toFixed(2)}` : 'no price'} {d.priceCents == null && (
                          <input
                            type="number" min="0" step="0.01" placeholder="add price"
                            className="w-24 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-1.5 py-0.5 text-xs"
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!Number.isNaN(v) && v >= 0) {
                                setNewDishes(newDishes.map((x, j) => j === i ? { ...x, priceCents: Math.round(v * 100), needsPriceConfirmation: false } : x));
                              }
                            }}
                          />
                        )}
                        <button type="button" onClick={() => setNewDishes(newDishes.filter((_, j) => j !== i))} className="hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
                {hasPriceless && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                    Items without a price are shown without one and aren't orderable — set a price only if you want them sellable.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => saveFlyer(true)} disabled={saving || !title || overLimit}>
                {saving ? 'Saving…' : 'Publish'}
              </Button>
              <Button variant="outline" onClick={() => saveFlyer(false)} disabled={saving || !title || overLimit}>
                Save draft
              </Button>
              <Button variant="ghost" onClick={resetComposer} disabled={saving}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flyer list */}
      <Card>
        <CardHeader><CardTitle>Your flyers</CardTitle></CardHeader>
        <CardContent>
          {flyers.length === 0 ? (
            <p className="text-sm text-neutral-500 py-4">No flyers yet. Create one — it takes about a minute.</p>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {flyers.map(f => (
                <div key={f.id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900 dark:text-white">{f.title}</p>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${statusBadge(f.status)}`}>{f.status}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(f.starts_at).toLocaleDateString()} → {new Date(f.ends_at).toLocaleDateString()}
                      {' · '}{(f.tenant_flyer_items ?? []).length} items
                      {f.impressions > 0 && ` · ${f.impressions} views`}
                      {f.recurrence && f.recurrence !== 'none' && ` · repeats ${f.recurrence}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {flyerCap.canUseGbpPublish && (f.status === 'published' || f.status === 'scheduled') && (
                      <Button variant="outline" size="sm" disabled={saving} title="Also publish to Google Business Profile"
                        onClick={() => flyerAction(
                          () => flyerService.publishFlyerToGbp(tenantId, f.id),
                          'GBP post scheduled — goes out when the flyer window opens',
                        )}>
                        GBP
                      </Button>
                    )}
                    {(f.status === 'draft' || f.status === 'scheduled' || f.status === 'expired') && (
                      <Button variant="outline" size="sm" disabled={saving}
                        onClick={() => flyerAction(() => flyerService.publishFlyer(tenantId, f.id), 'Flyer published')}>
                        <Upload className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {f.status !== 'suppressed' && f.status !== 'archived' && (
                      <>
                        <Button variant="outline" size="sm" disabled={saving} onClick={() => startEdit(f)}>Edit</Button>
                        <Button variant="outline" size="sm" disabled={saving}
                          onClick={() => flyerAction(() => flyerService.duplicateFlyer(tenantId, f.id), 'Flyer duplicated to next window')}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShareFlyer(f)} title="Share kit">
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled={saving}
                          onClick={() => flyerAction(() => flyerService.archiveFlyer(tenantId, f.id), 'Flyer archived')}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FlyerAnalyticsCard tenantId={tenantId} />

      <FlyerCardOrderPanel tenantId={tenantId} />

      {flyerCap.frozen && <FrozenSpecialsCard tenantId={tenantId} />}

      {/* Display options */}
      <Card>
        <CardHeader><CardTitle>Where your flyer appears</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {([
            ['flyer_display', 'Show flyers', 'Master switch — hides the flyer everywhere', flyerCap.enabled],
            ['flyer_storefront_display', 'Storefront', 'Your online store page', flyerCap.storefrontOn],
            ['flyer_directory_display', 'Directory listing', 'Your public directory page', flyerCap.directoryOn],
            ['flyer_place_display', 'Place page', 'Your /place business page', flyerCap.placeOn],
            ['flyer_frozen_display', 'Frozen panel', '"From the freezer" section on live flyers', flyerCap.frozen],
          ] as [keyof typeof options, string, string, boolean][]).map(([key, label, hint, allowed]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{label}</p>
                <p className="text-xs text-neutral-500">{hint}{!allowed && ' — not included in your plan'}</p>
              </div>
              <Switch
                checked={!!options[key] && allowed}
                disabled={!allowed}
                onCheckedChange={(v) => setOptions({ ...options, [key]: v })}
              />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Default flyer title</label>
            <input
              value={options.default_title} onChange={e => setOptions({ ...options, default_title: e.target.value })} maxLength={160}
              className="mt-1 w-full max-w-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>
          <Button onClick={saveOptions} disabled={saving} size="sm">{saving ? 'Saving…' : 'Save display settings'}</Button>
        </CardContent>
      </Card>

      <FlyerShareKit tenantId={tenantId} flyer={shareFlyer} onClose={() => setShareFlyer(null)} />
      <ItemPickerModal
        isOpen={showItemPicker}
        onClose={() => setShowItemPicker(false)}
        title="Link catalog item to flyer"
        tenantId={tenantId}
        onSelect={(itemId, itemName) => {
          if (!selectedItems.has(itemId)) {
            const next = new Map(selectedItems);
            next.set(itemId, { name: itemName, priceCents: null });
            setSelectedItems(next);
          }
          setShowItemPicker(false);
        }}
      />
    </div>
  );
}
