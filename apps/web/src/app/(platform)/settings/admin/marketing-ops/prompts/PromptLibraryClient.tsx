'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Plus, Pencil, Trash2, Copy, FileText, Sparkles, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { PromptTemplate, PromptType, CampaignScope, IntelligenceProfile, IntelligenceFocus, IntelligenceCampaignKind } from '@/services/MarketingOpsService';
import SuggestiveSelect, { distinctValues } from '@/components/marketing-ops/SuggestiveSelect';
import { useMemo } from 'react';

const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  seek: 'Seek',
  fulfill: 'Fulfill',
  filter: 'Filter',
  retainer: 'Retainer',
  category_analysis: 'Category Analysis',
  city_analysis: 'City Analysis',
  fragment: 'Fragment',
};

const PROMPT_TYPE_COLORS: Record<PromptType, string> = {
  seek: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fulfill: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  filter: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  retainer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  category_analysis: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  city_analysis: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  fragment: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const ALL_TYPES: PromptType[] = ['seek', 'fulfill', 'filter', 'retainer', 'category_analysis', 'city_analysis', 'fragment'];
const SCOPES: CampaignScope[] = ['business', 'category', 'city', 'intelligence'];

export default function PromptLibraryClient() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PromptType | ''>('');
  const [scopeFilter, setScopeFilter] = useState<CampaignScope | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [toneFilter, setToneFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [presetTones, setPresetTones] = useState<string[]>([]);
  const [activeProfiles, setActiveProfiles] = useState<IntelligenceProfile[]>([]);
  // Sprint 3: fragments are hidden by default — they are composition building
  // blocks, not standalone prompts. Toggle to see/manage them.
  const [showFragments, setShowFragments] = useState(false);

  // S3b: deep-link from campaign detail (?campaignId=&angle=)
  const searchParams = useSearchParams();
  const deepLinkCampaignId = searchParams.get('campaignId');
  const deepLinkAngle = searchParams.get('angle');
  const hasDeepLink = !!(deepLinkCampaignId && deepLinkAngle);
  const [deepLinkDismissed, setDeepLinkDismissed] = useState(false);
  // Pre-fill the create modal with the outreach angle when opened from the deep-link banner.
  const [deepLinkPrefill, setDeepLinkPrefill] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.listPromptTemplates({
        prompt_type: typeFilter || undefined,
        scope: scopeFilter || undefined,
        category: categoryFilter || undefined,
        tone: toneFilter || undefined,
      });
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompt templates');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, scopeFilter, categoryFilter, toneFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    marketingOpsService.listTonePresets()
      .then(setPresetTones)
      .catch(() => {});
  }, []);

  useEffect(() => {
    marketingOpsService.listIntelligenceProfiles()
      .then(setActiveProfiles)
      .catch(() => {});
  }, []);

  // Profile-active category names — these are categories with activated
  // intelligence profiles. They are merged into the category dropdown so the
  // dropdown serves as "prompt awareness" (showing which categories have
  // profile-amplified prompts) rather than just a prompt organizer.
  const profileCategoryNames = useMemo(
    () => activeProfiles.map((p) => p.category_name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [activeProfiles],
  );

  // Maps category_name → profile record so the badge can link to the
  // intelligence discovery workspace with the category pre-selected.
  const profileByCategoryName = useMemo(() => {
    const m: Record<string, IntelligenceProfile> = {};
    for (const p of activeProfiles) {
      if (p.category_name) m[p.category_name] = p;
    }
    return m;
  }, [activeProfiles]);

  // Tracks which profile-active badge was clicked so a context banner can
  // tell the operator which category they're scoping into. The badge
  // switches the scope filter to 'intelligence' (not 'category') because
  // the Intelligence Discovery templates are scope: intelligence.
  const [profileBadgeCategory, setProfileBadgeCategory] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [...new Set([...distinctValues(templates, (t) => t.category), ...profileCategoryNames])].sort((a, b) => a.localeCompare(b)),
    [templates, profileCategoryNames],
  );
  const toneOptions = useMemo(
    () => [...new Set([...presetTones, ...distinctValues(templates, (t) => t.tone)])].sort((a, b) => a.localeCompare(b)),
    [presetTones, templates],
  );

  // Intelligence discovery template IDs — used to build deep-links from the
  // profile-active context banner directly to the workspace with the category
  // pre-selected. Resolved from the stored intelligence_focus + kind columns
  // (Migration 203), with a name-based fallback for legacy templates that
  // haven't been re-seeded.
  const intelligenceDiscoveryTemplateIds = useMemo(() => {
    const isDiscovery = (t: PromptTemplate) =>
      t.intelligence_campaign_kind === 'discovery' ||
      (!t.intelligence_campaign_kind && t.output_schema?.name === 'intelligence_discovery');
    const emerging = templates.find((t) =>
      isDiscovery(t) &&
      (t.intelligence_focus === 'emerging' || (!t.intelligence_focus && /emerging/i.test(t.name))),
    );
    const competitive = templates.find((t) =>
      isDiscovery(t) &&
      (t.intelligence_focus === 'competitive' || (!t.intelligence_focus && /competitive/i.test(t.name))),
    );
    return { emerging: emerging?.id, competitive: competitive?.id };
  }, [templates]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prompt template?')) return;
    try {
      await marketingOpsService.deletePromptTemplate(id);
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await marketingOpsService.clonePromptTemplate(id);
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to clone template');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prompt Library</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage seek, fulfill, and filter prompt templates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEditingTemplate(null); setShowCreateModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* S3b: Deep-link banner from campaign detail */}
        {hasDeepLink && !deepLinkDismissed && (
          <div className="mb-6 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-violet-900 dark:text-violet-300">
                    Create a seek prompt from campaign
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">
                    Campaign: <code className="font-mono">{deepLinkCampaignId}</code>
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    <span className="font-medium">Outreach angle:</span> {deepLinkAngle}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => {
                        setEditingTemplate(null);
                        setDeepLinkPrefill(deepLinkAngle);
                        setShowCreateModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New seek prompt with this angle
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <Link
                      href={`/settings/admin/marketing-ops/campaigns/${deepLinkCampaignId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-400 bg-white dark:bg-neutral-800 border border-violet-300 dark:border-violet-800 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20"
                    >
                      Back to campaign
                    </Link>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDeepLinkDismissed(true)}
                className="p-1 text-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Profile-active category badges — quick filter for categories with
            activated intelligence profiles. Clicking switches the scope to
            'intelligence' so the Intelligence Discovery (Emerging/Competitive)
            and Profile Establishment templates become visible. The templates
            themselves are category-agnostic composition markers — the category
            is selected at workspace runtime via the category → campaign
            cascade — so we do NOT set the category filter here. */}
        {profileCategoryNames.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Profile-active:</span>
            {profileCategoryNames.map((cat) => {
              const isActive = profileBadgeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setScopeFilter('intelligence');
                    setCategoryFilter('');
                    setProfileBadgeCategory(isActive ? null : cat);
                  }}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    isActive
                      ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-400 dark:hover:border-violet-700 dark:hover:text-violet-300'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Context banner — when a profile-active badge is clicked, tell the
            operator what they're looking at and link to the discovery
            workspaces. The workspace has a category → campaign cascade that
            will pre-select this category via ?category=. */}
        {profileBadgeCategory && (
          <div className="mb-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-violet-900 dark:text-violet-300">
                    Intelligence templates for <strong>{profileBadgeCategory}</strong>
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">
                    Scope switched to <code>intelligence</code>. The category profile ({profileByCategoryName[profileBadgeCategory]?.id} v{profileByCategoryName[profileBadgeCategory]?.version}) will amplify the resolved prompt.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {intelligenceDiscoveryTemplateIds.emerging && (
                      <Link
                        href={`/settings/admin/marketing-ops/prompts/${intelligenceDiscoveryTemplateIds.emerging}?category=${encodeURIComponent(profileBadgeCategory)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 bg-white dark:bg-neutral-800 border border-violet-300 dark:border-violet-800 rounded-lg px-2.5 py-1 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      >
                        Emerging workspace <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {intelligenceDiscoveryTemplateIds.competitive && (
                      <Link
                        href={`/settings/admin/marketing-ops/prompts/${intelligenceDiscoveryTemplateIds.competitive}?category=${encodeURIComponent(profileBadgeCategory)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 bg-white dark:bg-neutral-800 border border-violet-300 dark:border-violet-800 rounded-lg px-2.5 py-1 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                      >
                        Competitive workspace <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setProfileBadgeCategory(null)}
                className="p-1 text-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PromptType | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {ALL_TYPES.map((t) => <option key={t} value={t}>{PROMPT_TYPE_LABELS[t]}</option>)}
          </select>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as CampaignScope | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Scopes</option>
            {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <SuggestiveSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            emptyLabel="All Categories"
            newLabel="+ Category..."
            newInputPlaceholder="Filter by category"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <SuggestiveSelect
            value={toneFilter}
            onChange={setToneFilter}
            options={toneOptions}
            emptyLabel="All Tones"
            newLabel="+ Tone..."
            newInputPlaceholder="Filter by tone"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showFragments}
              onChange={(e) => setShowFragments(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show fragments
          </label>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-gray-400 dark:text-gray-500">No prompt templates yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.filter((t) => showFragments || t.prompt_type !== 'fragment').map((t) => (
              <div key={t.id} className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PROMPT_TYPE_COLORS[t.prompt_type]}`}>
                        {PROMPT_TYPE_LABELS[t.prompt_type]}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300 uppercase">
                        {t.scope}
                      </span>
                    </div>
                  </div>
                  {t.is_default && (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Default</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-3 font-mono bg-gray-50 dark:bg-neutral-900/50 rounded p-2">
                  {t.body.slice(0, 200)}{t.body.length > 200 ? '...' : ''}
                </p>
                {t.category && <p className="text-xs text-gray-400 mb-3">Category: {t.category}</p>}
                {t.tone && <p className="text-xs text-gray-400 mb-3">Tone: {t.tone}</p>}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/settings/admin/marketing-ops/prompts/${t.id}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open Workspace
                  </Link>
                  <button
                    onClick={() => { setEditingTemplate(t); setShowCreateModal(true); }}
                    className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleClone(t.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Clone"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <PromptTemplateModal
          template={editingTemplate}
          categoryOptions={categoryOptions}
          toneOptions={toneOptions}
          prefillAngle={deepLinkPrefill}
          onClose={() => { setShowCreateModal(false); setDeepLinkPrefill(null); }}
          onSaved={async () => { setShowCreateModal(false); setDeepLinkPrefill(null); await fetchTemplates(); }}
        />
      )}
    </div>
  );
}

function PromptTemplateModal({ template, categoryOptions, toneOptions, prefillAngle, onClose, onSaved }: {
  template: PromptTemplate | null;
  categoryOptions: string[];
  toneOptions: string[];
  prefillAngle?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? (prefillAngle ? 'Seek: Outreach from Category Analysis' : ''));
  const [promptType, setPromptType] = useState<PromptType>(template?.prompt_type ?? 'seek');
  const [scope, setScope] = useState<CampaignScope>(template?.scope ?? 'business');
  const [category, setCategory] = useState(template?.category ?? '');
  const [tone, setTone] = useState(template?.tone ?? '');
  const [intelligenceFocus, setIntelligenceFocus] = useState<IntelligenceFocus | ''>(template?.intelligence_focus ?? '');
  const [intelligenceCampaignKind, setIntelligenceCampaignKind] = useState<IntelligenceCampaignKind | ''>(template?.intelligence_campaign_kind ?? '');
  const [body, setBody] = useState(template?.body ?? (prefillAngle
    ? `You are a local business outreach specialist. Use the following market analysis outreach angle to craft a personalized cold outreach message.

Outreach angle: ${prefillAngle}

Instructions:
1. Write a concise, personalized outreach message (3-4 sentences)
2. Reference the prospect's category and location
3. Lead with the pain point identified in the market analysis
4. End with a clear call-to-action (free audit, demo, or quick call)

Format the output as plain text, ready to paste into an email or DM.`
    : ''));
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (promptType === 'category_analysis') setScope('category');
    else if (promptType === 'city_analysis') setScope('city');
    else if (!template) setScope('business');
  }, [promptType, template]);

  // Clear focus/kind when scope leaves intelligence so non-intelligence
  // templates don't carry stale intelligence metadata.
  useEffect(() => {
    if (scope !== 'intelligence') {
      setIntelligenceFocus('');
      setIntelligenceCampaignKind('');
    }
  }, [scope]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const input = {
        name,
        prompt_type: promptType,
        scope,
        category: category || undefined,
        tone: tone || undefined,
        body,
        is_default: isDefault,
        ...(scope === 'intelligence' ? {
          intelligence_focus: intelligenceFocus || null,
          intelligence_campaign_kind: intelligenceCampaignKind || null,
        } : {
          intelligence_focus: null,
          intelligence_campaign_kind: null,
        }),
      };
      if (template) {
        await marketingOpsService.updatePromptTemplate(template.id, input);
      } else {
        await marketingOpsService.createPromptTemplate(input);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {template ? 'Edit Template' : 'New Template'}
        </h2>

        {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prompt Type</label>
              <select value={promptType} onChange={(e) => setPromptType(e.target.value as PromptType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ALL_TYPES.map((t) => <option key={t} value={t}>{PROMPT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value as CampaignScope)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category (optional)</label>
              <SuggestiveSelect value={category} onChange={setCategory}
                options={categoryOptions} emptyLabel="-- Select category --" newLabel="+ New category..."
                newInputPlaceholder="Enter new category"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tone (optional)</label>
              <SuggestiveSelect value={tone} onChange={setTone}
                options={toneOptions} emptyLabel="-- Select tone --" newLabel="+ New tone..."
                newInputPlaceholder="Enter new tone"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {scope === 'intelligence' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Intelligence Focus</label>
                  <select value={intelligenceFocus} onChange={(e) => setIntelligenceFocus(e.target.value as IntelligenceFocus | '')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— None —</option>
                    <option value="emerging">emerging</option>
                    <option value="competitive">competitive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Intelligence Campaign Kind</label>
                  <select value={intelligenceCampaignKind} onChange={(e) => setIntelligenceCampaignKind(e.target.value as IntelligenceCampaignKind | '')}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— None —</option>
                    <option value="discovery">discovery</option>
                    <option value="establishment">establishment</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prompt Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter prompt body. Use {{variable_name}} for variable injection." />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">Set as default for this type</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-200 dark:border-neutral-700">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name || !body}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
