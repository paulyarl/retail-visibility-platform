'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Play, Copy, FileSearch, ChevronDown, ChevronRight, ExternalLink, Flag, ArrowRight, AlertTriangle, Upload, Edit3, Save, X } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { PromptTemplate, PromptExecution, Campaign, ExternalExecutionResult, IntelligenceProfile } from '@/services/MarketingOpsService';
import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';

/**
 * Human-readable suffix appended to the rendered prompt when the template
 * declares an `output_schema`. Mirrors the backend `*_PROMPT_SUFFIX` constants
 * (market_analysis, regional_city_opportunity, business_analysis,
 * city_category_opportunity): the exported/copy/downloaded text tells the
 * external agent what JSON shape to return, so the import flow can validate it.
 *
 * Kept inline (not imported from the API package) because the web app cannot
 * import from apps/api. The backend remains the source of truth for actual
 * validation; this is purely cosmetic guidance appended to exported text.
 */
const OUTPUT_SCHEMA_PROMPT_SUFFIXES: Record<string, string> = {
  market_analysis: `

Return your response as JSON matching this schema:
{
  "market_analysis": {
    "location": "<string>",
    "industry": "<string>",
    "total_approximate_businesses": <number>,
    "average_gbp_metrics": { "average_rating": <number>, "average_review_count": <number> },
    "gbp_claimed_percentage": <number 0-100>,
    "website_presence_percentage": <number 0-100>,
    "top_5_competitors": [{ "name": "<string>", "approximate_rating": <number>, "approximate_review_count": <number>, "location_status": "<string>" }],
    "common_pain_points": ["<string>"],
    "opportunity_gaps": ["<string>"],
    "recommended_outreach_angle": "<string>"
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`,
  regional_city_opportunity: `

Return your response as JSON matching the Regional City Opportunity Discovery schema.
Top-level keys: audit_metadata, summary, regional_metrics, city_rankings,
top_city_opportunities, regional_category_opportunities, data_quality.

Each "city_rankings" element is a bare JSON object { ... } with keys including:
rank, city, state, county_names, place_type, distance_from_reference_miles,
direction_from_reference, inside_requested_radius, representative_zip_codes,
zip_code_count, zip_code_count_complete, population, commercial_context,
review_benchmarks, google_profile_metrics, website_metrics, nap_metrics,
common_opportunity_themes, representative_categories, digital_opportunity_score,
city_priority_score, recommended_next_action, recommended_next_action_rationale,
data_quality, sources.

CRITICAL JSON RULES:
- Every element of a JSON array MUST be a bare JSON object "{ ... }" separated by
  a comma. NEVER prefix array elements with a label or identifier (e.g.
  "city_2: { ... }" or "decline_3: { ... }" are INVALID).
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.

Return ONLY the JSON object, no markdown fences, no commentary.`,
  business_analysis: `

Return your response as JSON matching the Business Analysis schema.
Top-level keys: audit_metadata, summary, platforms, combined_review_metrics,
website, nap_consistency, unanswered_negative_review_examples,
negative_review_themes, digital_opportunity_score, high_attention,
high_attention_reasons, recommended_tier, tier_rationale,
estimated_monthly_service_fee, recommended_services, data_quality, sources.

CRITICAL JSON RULES:
- Every element of a JSON array MUST be a bare JSON object "{ ... }" separated by
  a comma. NEVER prefix array elements with a label or identifier (e.g.
  "source_2: { ... }" is INVALID).
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.

Return ONLY the JSON object, no markdown fences, no commentary.`,
  city_category_opportunity: `

Return your response as JSON matching the City Category Opportunity schema.
Top-level keys: audit_metadata, summary, market_size, category_benchmarks,
competitive_landscape, top_competitors, sampled_businesses,
common_digital_issues, opportunity_gaps, category_digital_opportunity_score,
outreach_recommendation, recommended_tier, tier_rationale,
estimated_monthly_service_fee, data_quality, sources.

Each "top_competitors" and "sampled_businesses" element is a bare JSON object
{ ... } with keys including rank, business_name, ownership_type, google,
yelp, facebook, website_assessment, competitive_visibility_score (competitors)
or nap_status, observed_opportunities, data_confidence (sampled businesses).

CRITICAL JSON RULES:
- Every element of a JSON array MUST be a bare JSON object "{ ... }" separated by
  a comma. NEVER prefix array elements with a label or identifier (e.g.
  "competitor_2: { ... }" is INVALID).
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.
- Exclude national/regional chains and franchise locations. Include only
  independent operators and local chains (2-5 metro-area locations).

Return ONLY the JSON object, no markdown fences, no commentary.`,
};

function getOutputSchemaSuffix(template: PromptTemplate | null): string {
  const name = template?.output_schema?.name;
  if (!name) return '';
  return OUTPUT_SCHEMA_PROMPT_SUFFIXES[name] ?? '';
}

/** Detect a scope-mismatch error message from the backend (S0b). */
function isScopeMismatchError(msg: string): boolean {
  return /scope .* is not compatible with campaign scope/i.test(msg)
    || /out-of-scope variables for scope/i.test(msg);
}

export default function PromptWorkspaceClient({ templateId, initialCampaignId, initialCategory }: { templateId: string; initialCampaignId?: string; initialCategory?: string }) {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [executions, setExecutions] = useState<PromptExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  // Tracks whether the deep-linked campaign has been auto-selected so we only
  // auto-render once (avoid clobbering operator edits on re-renders).
  const [autoSelected, setAutoSelected] = useState(false);
  // Intelligence-scope cascade state (Migration 201): category → campaign
  // picker for discovery templates. The flat dropdown is retained for non-
  // intelligence scopes and for the establishment template.
  const [selectedCategory, setSelectedCategory] = useState('');
  // Per-category profile map (batch-resolved for the category list so each
  // row can be badged with active v{version} / no-profile).
  const [categoryProfiles, setCategoryProfiles] = useState<Record<string, IntelligenceProfile | null>>({});

  const selectedCampaign = useMemo(() =>
    campaigns.find((c) => c.id === selectedCampaignId) || null,
  [campaigns, selectedCampaignId]);

  // ─── Intelligence-scope template classification ───────────────────────
  // Discovery templates (Emerging/Competitive) get the category → campaign
  // cascade. The establishment template keeps the flat dropdown (the operator
  // selects the establishment campaign directly).
  const isIntelligenceScope = template?.scope === 'intelligence';
  const isSeekPrompt = (template?.prompt_type || '').toLowerCase() === 'seek';
  const outputSchemaName = template?.output_schema?.name ?? '';
  const templateKind = template?.intelligence_campaign_kind ?? null;
  const isIntelligenceDiscovery = isIntelligenceScope && isSeekPrompt && (templateKind === 'discovery' || (!templateKind && outputSchemaName === 'intelligence_discovery'));
  const isIntelligenceEstablishment = isIntelligenceScope && isSeekPrompt && (templateKind === 'establishment' || (!templateKind && outputSchemaName === 'intelligence_profile'));

  // Template focus is now a stored column (Migration 203). Falls back to a
  // name-based heuristic for legacy templates that haven't been re-seeded,
  // then to 'emerging' (matches the backend default).
  const templateFocus: 'emerging' | 'competitive' = useMemo(() => {
    if (!template) return 'emerging';
    if (template.intelligence_focus) return template.intelligence_focus;
    return /competitive/i.test(template.name) ? 'competitive' : 'emerging';
  }, [template]);

  // Sprint 3 — §1B resolution indicator: when a business-scope seek campaign
  // is selected, resolve the active intelligence profile for its category and
  // show the profile badge in the Rendered Output header. Also fires for
  // intelligence-scope discovery campaigns (the profile is the amplification
  // footprint for the composed prompt).
  useEffect(() => {
    if (!selectedCampaign || !template) {
      setResolvedProfile(null);
      return;
    }
    const isSeek = (template.prompt_type || '').toLowerCase() === 'seek';
    const isBusiness = (selectedCampaign.scope || 'business').toLowerCase() === 'business';
    const isIntelligence = (selectedCampaign.scope || '').toLowerCase() === 'intelligence';
    if (!isSeek || !selectedCampaign.category) {
      setResolvedProfile(null);
      return;
    }
    // Business-scope: §1B amplification gate. Intelligence-scope discovery:
    // the profile is the composed prompt's category footprint.
    if (!isBusiness && !isIntelligence) {
      setResolvedProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await marketingOpsService.resolveIntelligenceProfile(selectedCampaign.category);
        if (!cancelled) setResolvedProfile(profile);
      } catch {
        if (!cancelled) setResolvedProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCampaign, template]);

  const compatibleCampaigns = useMemo(() => {
    if (!template?.scope) return campaigns;
    const scopeMatch = campaigns.filter((c) => c.scope === template.scope);
    // Intelligence-scope refinement (Migration 201):
    //   - Discovery templates: only discovery-kind campaigns whose focus
    //     matches the template (emerging/competitive). Establishment
    //     campaigns are excluded — they were vehicles for profile import,
    //     not discovery scans.
    //   - Establishment template: only establishment-kind campaigns (the
    //     ones used to bootstrap a profile).
    let filtered: Campaign[];
    if (isIntelligenceDiscovery) {
      filtered = scopeMatch.filter((c) =>
        (c.intelligence_campaign_kind ?? 'discovery') === 'discovery' &&
        (c.intelligence_focus ?? 'emerging') === templateFocus,
      );
    } else if (isIntelligenceEstablishment) {
      filtered = scopeMatch.filter((c) =>
        (c.intelligence_campaign_kind ?? 'discovery') === 'establishment',
      );
    } else {
      filtered = scopeMatch;
    }
    // Always include the deep-linked campaign (e.g. opened from a campaign
    // detail page via ?campaignId=) even when it doesn't match the kind/focus
    // filter — otherwise the <select> shows the placeholder while the campaign
    // is auto-selected in state, and the operator can't see or re-select it.
    if (initialCampaignId) {
      const deepLinked = campaigns.find((c) => c.id === initialCampaignId);
      if (deepLinked && !filtered.some((c) => c.id === deepLinked.id)) {
        filtered = [...filtered, deepLinked];
      }
    }
    return filtered;
  }, [campaigns, template, isIntelligenceDiscovery, isIntelligenceEstablishment, templateFocus, initialCampaignId]);

  // Distinct categories among the filtered intelligence-scope campaigns —
  // drives the first dropdown in the category → campaign cascade.
  const intelligenceCategories = useMemo(() => {
    if (!isIntelligenceDiscovery) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of compatibleCampaigns) {
      if (c.category && !seen.has(c.category)) {
        seen.add(c.category);
        list.push(c.category);
      }
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [compatibleCampaigns, isIntelligenceDiscovery]);

  // Campaigns filtered to the selected category — drives the second dropdown.
  const campaignsForCategory = useMemo(() => {
    if (!isIntelligenceDiscovery || !selectedCategory) return compatibleCampaigns;
    return compatibleCampaigns.filter((c) => c.category === selectedCategory);
  }, [compatibleCampaigns, isIntelligenceDiscovery, selectedCategory]);

  // Batch-resolve active profiles for every category in the cascade so each
  // category row can be badged. Runs once when the category list changes.
  useEffect(() => {
    if (!isIntelligenceDiscovery || intelligenceCategories.length === 0) {
      setCategoryProfiles({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries: [string, IntelligenceProfile | null][] = await Promise.all(
        intelligenceCategories.map(async (cat) => {
          try {
            const p = await marketingOpsService.resolveIntelligenceProfile(cat);
            return [cat, p] as [string, IntelligenceProfile | null];
          } catch {
            return [cat, null] as [string, IntelligenceProfile | null];
          }
        }),
      );
      if (!cancelled) setCategoryProfiles(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [intelligenceCategories, isIntelligenceDiscovery]);

  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverRendered, setServerRendered] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(true);
  const [lastExecution, setLastExecution] = useState<PromptExecution | null>(null);
  // Intelligence profile resolution indicator (Sprint 3 — §1B)
  const [resolvedProfile, setResolvedProfile] = useState<IntelligenceProfile | null>(null);

  // External import state (S2b)
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  // Import metadata state — lets the operator record which AI model produced
  // the imported audit so multiple model runs can be told apart on the Audits tab.
  const [importModel, setImportModel] = useState('');
  const [importProvider, setImportProvider] = useState('');
  const [importRunId, setImportRunId] = useState('');
  const [importNotes, setImportNotes] = useState('');

  // Template body inline-edit state
  const [editingBody, setEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('');
  const [savingBody, setSavingBody] = useState(false);
  const [bodySaveError, setBodySaveError] = useState<string | null>(null);
  const [bodySaved, setBodySaved] = useState(false);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const templates = await marketingOpsService.listPromptTemplates();
      const t = templates.find((t) => t.id === templateId);
      if (!t) throw new Error('Template not found');
      setTemplate(t);
      const [campResult, execs] = await Promise.all([
        marketingOpsService.listCampaigns({ limit: 100 }),
        marketingOpsService.listExecutions(),
      ]);
      setCampaigns(campResult.items);
      const templateExecs = execs.filter((e) => e.template_id === templateId);
      setExecutions(templateExecs);
      // Hydrate the Execution Result panel from the most recent execution.
      setLastExecution(templateExecs[0] ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Deep-link: when opened from a campaign detail page (?campaignId=), pre-select
  // the campaign and auto-resolve the prompt server-side so the operator lands on
  // a ready-to-run workspace. Only fires once per template/campaign pair.
  useEffect(() => {
    if (autoSelected || !initialCampaignId || loading || !template) return;
    const match = campaigns.find((c) => c.id === initialCampaignId);
    if (!match) return;
    // Scope guard: only auto-select when the campaign scope is compatible with
    // the template scope. Otherwise the operator must pick manually.
    if (template.scope && match.scope !== template.scope) {
      setAutoSelected(true);
      return;
    }
    setSelectedCampaignId(match.id);
    setAutoSelected(true);
  }, [autoSelected, initialCampaignId, loading, template, campaigns]);

  // Deep-link: when opened from a profile-active badge (?category=), pre-select
  // the category in the intelligence discovery cascade so the operator lands on
  // a filtered campaign list for that category. Only fires once.
  useEffect(() => {
    if (autoSelected || !initialCategory || loading || !isIntelligenceDiscovery) return;
    // Wait for the category list to be populated before attempting selection.
    if (intelligenceCategories.length === 0) return;
    if (intelligenceCategories.includes(initialCategory)) {
      setSelectedCategory(initialCategory);
    }
    setAutoSelected(true);
  }, [autoSelected, initialCategory, loading, isIntelligenceDiscovery, intelligenceCategories]);

  const extractedVariables = useMemo(() => {
    if (!template?.body) return [];
    const matches = template.body.matchAll(/\{\{(\w+)\}\}/g);
    const vars = new Set<string>();
    for (const m of matches) vars.add(m[1]);
    return Array.from(vars);
  }, [template]);

  useEffect(() => {
    if (!selectedCampaign) return;
    setVariables((prev) => ({
      ...prev,
      scope: selectedCampaign.scope,
      business_name: selectedCampaign.business_name ?? '',
      category: selectedCampaign.category,
      city: selectedCampaign.city,
      state: selectedCampaign.state ?? '',
      tone: selectedCampaign.tone || '',
      attributes: (selectedCampaign.attributes || []).join(', '),
    }));
    setServerRendered(null);
  }, [selectedCampaign]);

  const renderedPrompt = useMemo(() => {
    if (serverRendered !== null) return serverRendered;
    if (!template?.body) return '';
    let result = template.body;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    }
    return result;
  }, [template, variables, serverRendered]);

  /** Rendered prompt with the output-schema suffix appended (for copy/download). */
  const exportablePrompt = useMemo(() => {
    return renderedPrompt + getOutputSchemaSuffix(template);
  }, [renderedPrompt, template]);

  // Build the variables payload sent to the backend. Every variable referenced
  // in the template body is included (defaulting to '') so the backend treats
  // them as explicit user overrides regardless of scope. Without this, untouched
  // fields are absent from the payload and the scope validator rejects them as
  // out-of-scope references (e.g. regional-scan vars on a city-scope template).
  const buildVariablesPayload = useCallback((): Record<string, string> => {
    const payload: Record<string, string> = {};
    for (const v of extractedVariables) payload[v] = variables[v] ?? '';
    return { ...payload, ...variables };
  }, [extractedVariables, variables]);

  const handleRenderFromServer = async () => {
    if (!selectedCampaignId) return;
    setRendering(true);
    setRenderError(null);
    try {
      const rendered = await marketingOpsService.renderPrompt(templateId, selectedCampaignId, buildVariablesPayload());
      setServerRendered(rendered);
    } catch (err: any) {
      setRenderError(err.message || 'Failed to render prompt from server');
    } finally {
      setRendering(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedCampaignId) return;
    setExecuting(true);
    setError(null);
    try {
      const execution = await marketingOpsService.createExecution({
        campaign_id: selectedCampaignId,
        template_id: templateId,
        variables_used: buildVariablesPayload(),
      });
      // Capture the returned execution and surface it in the Result panel.
      setLastExecution(execution);
      setResultOpen(true);
      await fetchTemplate();
    } catch (err: any) {
      setError(err.message || 'Failed to execute prompt');
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportablePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportablePrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template?.name?.replace(/\s+/g, '_') ?? 'prompt'}_resolved.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartEditBody = () => {
    setBodyDraft(template?.body ?? '');
    setBodySaveError(null);
    setBodySaved(false);
    setEditingBody(true);
  };

  const handleCancelEditBody = () => {
    setEditingBody(false);
    setBodySaveError(null);
  };

  const handleSaveBody = async () => {
    if (!template) return;
    setSavingBody(true);
    setBodySaveError(null);
    setBodySaved(false);
    try {
      const updated = await marketingOpsService.updatePromptTemplate(template.id, { body: bodyDraft });
      setTemplate(updated);
      setEditingBody(false);
      setBodySaved(true);
      setTimeout(() => setBodySaved(false), 2000);
    } catch (err: any) {
      setBodySaveError(err.message || 'Failed to save template body');
    } finally {
      setSavingBody(false);
    }
  };

  const handleImportExternal = async () => {
    if (!selectedCampaignId || !importJson.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      // Build metadata only from non-empty fields so the audit doesn't store
      // empty strings. The backend also merges `source` as provider fallback.
      const metadata: Record<string, string> = {};
      if (importModel.trim()) metadata.model = importModel.trim();
      if (importProvider.trim()) metadata.provider = importProvider.trim();
      if (importRunId.trim()) metadata.run_id = importRunId.trim();
      if (importNotes.trim()) metadata.notes = importNotes.trim();

      const result: ExternalExecutionResult = await marketingOpsService.createExternalExecution({
        campaign_id: selectedCampaignId,
        template_id: templateId,
        raw_output: importJson.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
      setLastExecution(result.execution);
      setResultOpen(true);
      setImportSuccess(
        `Imported execution ${result.execution.id}` +
        (result.audit ? ` + created ${result.audit.platform} audit` : ''),
      );
      setImportJson('');
      setImportModel('');
      setImportProvider('');
      setImportRunId('');
      setImportNotes('');
      await fetchTemplate();
    } catch (err: any) {
      setImportError(err.message || 'Failed to import external result');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <p className="text-gray-400">Template not found.</p>
      </div>
    );
  }

  const scopeMismatch = !!(error || renderError) && isScopeMismatchError((error || renderError)!);
  const hasOutputSchema = !!template.output_schema?.name;

  return (
    <MarketingOpsPageShell
      title={template.name}
      subtitle={`Type: ${template.prompt_type}${template.tone ? ` · Tone: ${template.tone}` : ''} · v${template.version}${template.scope ? ` · ${template.scope} scope` : ''}`}
      breadcrumbs={[
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Prompts', href: '/settings/admin/marketing-ops/prompts' },
        { label: template.name },
      ]}
      actions={
        <button
          onClick={fetchTemplate}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      }
    >
      {error && (
        <div className={`rounded-lg border p-4 ${scopeMismatch
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <div className="flex items-start gap-2">
            {scopeMismatch && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />}
            <p className={`text-sm ${scopeMismatch
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-red-700 dark:text-red-400'}`}>
              {error}
              {scopeMismatch && (
                <span className="block mt-1 text-xs">
                  This template&apos;s scope ({template.scope}) doesn&apos;t match the selected campaign&apos;s scope.
                  Pick a campaign from the &quot;{template.scope}&quot; scope list, or edit the template scope.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Template + Variables */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Template Body</h2>
              <div className="flex items-center gap-3">
                {bodySaved && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved</span>
                )}
                {editingBody ? (
                  <>
                    <button
                      onClick={handleSaveBody}
                      disabled={savingBody}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingBody ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancelEditBody}
                      disabled={savingBody}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartEditBody}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>
            </div>
            {bodySaveError && (
              <div className="mb-3 text-xs text-red-600 dark:text-red-400">{bodySaveError}</div>
            )}
            {editingBody ? (
              <textarea
                value={bodyDraft}
                onChange={(e) => setBodyDraft(e.target.value)}
                disabled={savingBody}
                className="w-full text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-96 min-h-[12rem] overflow-y-auto border border-gray-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            ) : (
              <pre className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                {template.body}
              </pre>
            )}
            {hasOutputSchema && (
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Output schema: <code className="font-mono">{template.output_schema!.name}</code>
                {template.output_schema!.description ? ` — ${template.output_schema!.description}` : ''}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Variables</h2>
            {extractedVariables.length === 0 ? (
              <p className="text-sm text-gray-400">No variables detected in template.</p>
            ) : (
              <div className="space-y-3">
                {extractedVariables.map((v) => (
                  <div key={v}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{`{{${v}}}`}</label>
                    <input
                      type="text"
                      value={variables[v] ?? ''}
                      onChange={(e) => setVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Execute</h2>
            <div className="space-y-3">
              {isIntelligenceDiscovery ? (
                <>
                  {/* Intelligence Discovery: category → campaign cascade */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedCampaignId('');
                        setServerRendered(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select a category —</option>
                      {intelligenceCategories.map((cat) => {
                        const p = categoryProfiles[cat];
                        const badge = p ? ` · profile v${p.version} active` : ' · no profile';
                        return <option key={cat} value={cat}>{cat}{badge}</option>;
                      })}
                    </select>
                    {intelligenceCategories.length === 0 && campaigns.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        No {templateFocus} discovery campaigns found. Create an intelligence-scope campaign with focus=&quot;{templateFocus}&quot; first.
                      </p>
                    )}
                  </div>
                  {selectedCategory && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Campaign</label>
                      <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Select a campaign —</option>
                        {campaignsForCategory.map((c) => (
                          <option key={c.id} value={c.id}>{c.title || `${c.category} · ${c.city}`} ({c.city})</option>
                        ))}
                      </select>
                      {campaignsForCategory.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No campaigns for {selectedCategory}. Create one in the Campaigns tab.
                        </p>
                      )}
                    </div>
                  )}
                  {/* Profile hint panel — reminds the operator to establish
                      a profile for categories without one. */}
                  {selectedCategory && categoryProfiles[selectedCategory] === null && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                        No active intelligence profile for <strong>{selectedCategory}</strong>. The resolved prompt will use generic fallback mode (no category-specific sources, evidence rules, or prohibited inferences).
                        {' '}
                        <Link href="/settings/admin/marketing-ops/prompts" className="underline font-medium">
                          Run the Profile Establishment template
                        </Link>{' '}
                        to bootstrap one, then activate the draft.
                      </p>
                    </div>
                  )}
                  {selectedCategory && categoryProfiles[selectedCategory] && (
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-3">
                      <p className="text-xs text-indigo-700 dark:text-indigo-400">
                        Category intelligence: <strong>{categoryProfiles[selectedCategory]!.id}</strong> v{categoryProfiles[selectedCategory]!.version} is active. The resolved prompt will be amplified with this profile&apos;s sources, evidence rules, and prohibited inferences.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Default: flat campaign dropdown (business/category/city
                      scopes + intelligence establishment template) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Select Campaign</label>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select a campaign —</option>
                      {compatibleCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title || c.business_name || `${c.category} · ${c.city}`} ({c.scope}, {c.city})</option>
                      ))}
                    </select>
                    {compatibleCampaigns.length === 0 && campaigns.length > 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        No campaigns match this template&apos;s scope ({template.scope}). Create a {template.scope}-scoped campaign first.
                      </p>
                    )}
                  </div>
                </>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExecute}
                  disabled={executing || !selectedCampaignId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {executing ? 'Executing...' : 'Execute Prompt'}
                </button>
                <button
                  onClick={handleRenderFromServer}
                  disabled={rendering || !selectedCampaignId}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700 disabled:opacity-50"
                >
                  <FileSearch className="w-4 h-4" />
                  {rendering ? 'Resolving...' : 'Get Resolved Prompt'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Rendered Output + Execution Result + Next Steps */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rendered Output</h2>
              <div className="flex items-center gap-3">
                {serverRendered !== null && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Server-resolved</span>
                )}
                {resolvedProfile && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium" title="Category intelligence profile is active and will amplify this business audit prompt (§1B)">
                    Category intelligence: {resolvedProfile.id} v{resolvedProfile.version}
                  </span>
                )}
                {selectedCampaign && template?.prompt_type === 'seek' && (selectedCampaign.scope === 'business' || selectedCampaign.scope === 'intelligence') && !resolvedProfile && (
                  <span className="text-xs text-gray-400" title="No active intelligence profile for this category — prompt renders without amplification">
                    No category profile — generic resolution
                  </span>
                )}
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Download
                </button>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            {renderError && (
              <div className="mb-3 text-xs text-red-600 dark:text-red-400">
                {isScopeMismatchError(renderError) && <AlertTriangle className="inline w-3 h-3 mr-1" />}
                {renderError}
              </div>
            )}
            {hasOutputSchema && (
              <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
                Copy/Download includes the output-schema instructions so external agents return JSON in the expected shape.
              </p>
            )}
            <pre className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-64 overflow-y-auto">
              {renderedPrompt}
            </pre>
          </div>

          {/* Execution Result panel — collapsible, hydrates from last execution */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <button
              onClick={() => setResultOpen((v) => !v)}
              className="flex items-center justify-between w-full mb-1"
            >
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                {resultOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Execution Result
              </h2>
              {lastExecution && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  lastExecution.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : lastExecution.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                }`}>
                  {lastExecution.status}
                </span>
              )}
            </button>
            {resultOpen && (
              <div className="mt-2">
                {!lastExecution ? (
                  <p className="text-sm text-gray-400">No execution yet. Run the prompt to see results here.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Execution ID: <code className="font-mono">{lastExecution.id}</code></span>
                      <span>{new Date(lastExecution.executed_at).toLocaleString()}</span>
                    </div>
                    {lastExecution.ai_provider && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Provider: {lastExecution.ai_provider}{lastExecution.ai_model ? ` · ${lastExecution.ai_model}` : ''}
                        {lastExecution.tokens_used != null && ` · ${lastExecution.tokens_used} tokens`}
                        {lastExecution.cost_cents != null && ` · ${lastExecution.cost_cents}¢`}
                      </div>
                    )}
                    {lastExecution.raw_output && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Raw output</p>
                        <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                          {lastExecution.raw_output}
                        </pre>
                      </div>
                    )}
                    {lastExecution.pass_rate != null && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Pass rate: {lastExecution.pass_rate}%{lastExecution.flagged_count != null && ` · Flagged: ${lastExecution.flagged_count}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import External Result card (S2b) */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import External Result
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Paste the JSON returned by an external agent (e.g. ChatGPT, Claude) after running this prompt.
              {hasOutputSchema
                ? ` It will be validated against the "${template.output_schema!.name}" schema and an audit will be created automatically.`
                : ' The template has no output_schema declared — add one to enable validation.'}
            </p>
            {!selectedCampaignId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                Select a campaign first to associate the imported result with.
              </p>
            )}
            {importError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-xs text-red-700 dark:text-red-400">{importError}</p>
              </div>
            )}
            {importSuccess && (
              <div className="mb-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs text-green-700 dark:text-green-400">{importSuccess}</p>
              </div>
            )}
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"market_analysis": { ... }}'
              rows={6}
              disabled={!selectedCampaignId}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-h-48 overflow-y-auto"
            />
            {/* Import metadata — records which AI model produced this audit */}
            <div className="mt-3 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/60 dark:bg-neutral-900/40 p-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Import metadata <span className="text-gray-400">(optional)</span>
              </p>
              <p className="text-[11px] text-gray-400 mb-2">
                Record which model produced this result. Shown on the campaign Audits tab so you can tell apart runs from different models.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={importModel}
                  onChange={(e) => setImportModel(e.target.value)}
                  placeholder="Model (e.g. gpt-4-turbo, claude-3-opus)"
                  disabled={!selectedCampaignId}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={importProvider}
                  onChange={(e) => setImportProvider(e.target.value)}
                  placeholder="Provider (e.g. openai, anthropic)"
                  disabled={!selectedCampaignId}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={importRunId}
                  onChange={(e) => setImportRunId(e.target.value)}
                  placeholder="Run ID (optional external run ref)"
                  disabled={!selectedCampaignId}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={importNotes}
                  onChange={(e) => setImportNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  disabled={!selectedCampaignId}
                  className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
            <button
              onClick={handleImportExternal}
              disabled={importing || !selectedCampaignId || !importJson.trim()}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : 'Import Result'}
            </button>
          </div>

          {/* Next Steps card — campaign launchpad */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Next Steps</h2>
            <div className="space-y-2">
              {selectedCampaignId ? (
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${selectedCampaignId}`}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
                >
                  <span className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Go to campaign</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <p className="text-xs text-gray-400 px-3 py-2">Select a campaign to enable the campaign link.</p>
              )}
              {lastExecution && (
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${lastExecution.campaign_id}?tab=filter-flags`}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
                >
                  <span className="flex items-center gap-2"><Flag className="w-4 h-4" /> Review filter flags</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={handleCopy}
                disabled={!renderedPrompt}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <span className="flex items-center gap-2"><Copy className="w-4 h-4" /> Copy prompt{hasOutputSchema ? ' (+ schema instructions)' : ''}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownload}
                disabled={!renderedPrompt}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:opacity-50"
              >
                <span className="flex items-center gap-2"><FileSearch className="w-4 h-4" /> Download prompt{hasOutputSchema ? ' (+ schema instructions)' : ''}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Recent Executions list (kept for history) */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Executions</h2>
            {executions.length === 0 ? (
              <p className="text-sm text-gray-400">No executions yet.</p>
            ) : (
              <div className="space-y-2">
                {executions.slice(0, 10).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setLastExecution(e); setResultOpen(true); }}
                    className="w-full text-left border border-gray-200 dark:border-neutral-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-neutral-700/50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {campaigns.find((c) => c.id === e.campaign_id)?.title || campaigns.find((c) => c.id === e.campaign_id)?.business_name || campaigns.find((c) => c.id === e.campaign_id)?.category || e.campaign_id}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(e.executed_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>Status: {e.status}</span>
                      {e.pass_rate != null && <span>Pass rate: {e.pass_rate}%</span>}
                      {e.flagged_count != null && <span>Flagged: {e.flagged_count}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MarketingOpsPageShell>
  );
}
