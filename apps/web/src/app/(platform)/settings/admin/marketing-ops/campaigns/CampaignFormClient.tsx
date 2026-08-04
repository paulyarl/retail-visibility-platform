'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import marketingOpsService, { Campaign, CampaignStage, CampaignScope, CampaignCategory, RepairTrack, RetainerStatus, CampaignCreateInput, CampaignUpdateInput, ServiceCategory } from '@/services/MarketingOpsService';
import { STAGE_LABELS } from '@/components/marketing-ops/StageBadge';
import SuggestiveSelect, { distinctValues } from '@/components/marketing-ops/SuggestiveSelect';
import PlatformUserSelect from '@/components/marketing-ops/PlatformUserSelect';

const STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
const SCOPES: CampaignScope[] = ['business', 'category', 'city'];
const CATEGORIES: CampaignCategory[] = ['review_management', 'recovery_management', 'profile_repair', 'triage_management'];

const REPAIR_ISSUE_TYPES_STANDARD = ['nap_drift', 'unclaimed_profile', 'missing_category', 'missing_hours', 'platform_gap'];
const REPAIR_ISSUE_TYPES_ESCALATED = ['suspension', 'duplicate_listing', 'hijacked_listing', 'ownership_dispute', 'address_verification_block'];
const ALL_REPAIR_ISSUE_TYPES = [...REPAIR_ISSUE_TYPES_STANDARD, ...REPAIR_ISSUE_TYPES_ESCALATED];
const RETAINER_STATUSES: RetainerStatus[] = ['not_pitched', 'pitched', 'won', 'declined'];
const RETAINER_OPTIONS: Array<'Fast' | 'Medium' | 'Slow' | ''> = ['Fast', 'Medium', 'Slow'];
const CAMPAIGN_ATTRIBUTE_OPTIONS = ['High Ticket', 'Upscale', 'Friendly', 'Professional', 'Fast Retainers'];

interface FormState {
  campaign_category: CampaignCategory;
  repair_issue_type: string;
  scope: CampaignScope;
  business_name: string;
  category: string;
  city: string;
  neighborhood: string;
  contact_method: string;
  contact_info: string;
  phone: string;
  email: string;
  website_url: string;
  social_profiles: { platform: string; url: string }[];
  display_id: string;
  gbp_claimed: boolean | '';
  unaddressed_reviews: number | '';
  last_review_date: string;
  has_website: string;
  nap_consistent: boolean | '';
  estimated_tier: string;
  estimated_fee_cents: number | '';
  pain_score: number | '';
  tone: string;
  retainer: 'Fast' | 'Medium' | 'Slow' | '';
  attributes: string[];
  assigned_to: string;
  notes: string;
  stage: CampaignStage;
  retainer_status: RetainerStatus | '';
  retainer_amount_cents: number | '';
  retainer_start_date: string;
  amount_paid_cents: number | '';
  package_delivered: string;
  package_price_cents: number | '';
  subscription_tier_id: string;
  coupon_code: string;
  service_category: string;
  service_category_label: string;
}

const EMPTY_FORM: FormState = {
  campaign_category: 'review_management',
  repair_issue_type: '',
  scope: 'business',
  business_name: '',
  category: '',
  city: '',
  neighborhood: '',
  contact_method: '',
  contact_info: '',
  phone: '',
  email: '',
  website_url: '',
  social_profiles: [],
  display_id: '',
  gbp_claimed: '',
  unaddressed_reviews: '',
  last_review_date: '',
  has_website: '',
  nap_consistent: '',
  estimated_tier: '',
  estimated_fee_cents: '',
  pain_score: '',
  tone: '',
  retainer: '',
  attributes: [],
  assigned_to: '',
  notes: '',
  stage: 'seek',
  retainer_status: '',
  retainer_amount_cents: '',
  retainer_start_date: '',
  amount_paid_cents: '',
  package_delivered: '',
  package_price_cents: '',
  subscription_tier_id: '',
  coupon_code: '',
  service_category: '',
  service_category_label: '',
};

export default function CampaignFormClient({ mode, campaignId }: { mode: 'create' | 'edit'; campaignId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vocab, setVocab] = useState({
    categories: [] as string[],
    cities: [] as string[],
    neighborhoods: [] as string[],
    contactMethods: [] as string[],
    estimatedTiers: [] as string[],
    tones: [] as string[],
  });
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    Promise.all([
      marketingOpsService.listCampaigns({ limit: 1000 }).catch(() => ({ items: [] as any[] })),
      marketingOpsService.listTonePresets().catch(() => [] as string[]),
    ])
      .then(([{ items }, presetTones]) => {
        const recordTones = distinctValues(items, (c) => c.tone);
        const mergedTones = [...new Set([...presetTones, ...recordTones])].sort((a, b) => a.localeCompare(b));
        setVocab({
          categories: distinctValues(items, (c) => c.category),
          cities: distinctValues(items, (c) => c.city),
          neighborhoods: distinctValues(items, (c) => c.neighborhood),
          contactMethods: distinctValues(items, (c) => c.contact_method),
          estimatedTiers: distinctValues(items, (c) => c.estimated_tier),
          tones: mergedTones,
        });
      })
      .catch(() => {});
    marketingOpsService.getServiceCategories()
      .then(setServiceCategories)
      .catch(() => {});
  }, []);

  const fetchCampaign = useCallback(async () => {
    if (mode !== 'edit' || !campaignId) return;
    setLoading(true);
    try {
      const c = await marketingOpsService.getCampaign(campaignId);
      setForm({
        campaign_category: (c.campaign_category as CampaignCategory) ?? 'review_management',
        repair_issue_type: (c as any).repair_issue_type ?? '',
        scope: (c.scope as CampaignScope) ?? 'business',
        business_name: c.business_name ?? '',
        category: c.category ?? '',
        city: c.city ?? '',
        neighborhood: c.neighborhood ?? '',
        contact_method: c.contact_method ?? '',
        contact_info: c.contact_info ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        website_url: c.website_url ?? '',
        social_profiles: c.social_profiles ?? [],
        display_id: c.display_id ?? '',
        gbp_claimed: c.gbp_claimed ?? '',
        unaddressed_reviews: c.unaddressed_reviews ?? '',
        last_review_date: c.last_review_date ? c.last_review_date.split('T')[0] : '',
        has_website: c.has_website ?? '',
        nap_consistent: c.nap_consistent ?? '',
        estimated_tier: c.estimated_tier ?? '',
        estimated_fee_cents: c.estimated_fee_cents ?? '',
        pain_score: c.pain_score ?? '',
        tone: c.tone ?? '',
        retainer: c.retainer ?? '',
        attributes: c.attributes ?? [],
        assigned_to: c.assigned_to ?? '',
        notes: c.notes ?? '',
        stage: c.stage,
        retainer_status: c.retainer_status ?? '',
        retainer_amount_cents: c.retainer_amount_cents ?? '',
        retainer_start_date: c.retainer_start_date ? c.retainer_start_date.split('T')[0] : '',
        amount_paid_cents: c.amount_paid_cents ?? '',
        package_delivered: c.package_delivered ?? '',
        package_price_cents: c.package_price_cents ?? '',
        subscription_tier_id: c.subscription_tier_id ?? '',
        coupon_code: c.coupon_code ?? '',
        service_category: c.service_category ?? '',
        service_category_label: c.service_category_label ?? '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [mode, campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleChange = (field: keyof FormState, value: string | number | boolean | '' | string[] | { platform: string; url: string }[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateServiceCategory = async (value: string, label: string) => {
    try {
      const cat = await marketingOpsService.createServiceCategory(value, label);
      setServiceCategories((prev) => [...prev, cat]);
      setForm((prev) => ({ ...prev, service_category: cat.value, service_category_label: cat.label }));
    } catch (err: any) {
      setError(err.message || 'Failed to save service category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const numOrUndef = (v: number | '') => v === '' ? undefined : v;
      const boolOrUndef = (v: boolean | '') => v === '' ? undefined : v;
      const strOrUndef = (v: string) => v === '' ? undefined : v;

      if (mode === 'create') {
        // Backfill legacy contact_method/contact_info from the first non-empty
        // new channel if the operator left the legacy pair blank (preserves
        // existing filters/reports that key off the legacy pair).
        const legacyContactMethod = strOrUndef(form.contact_method);
        const legacyContactInfo = strOrUndef(form.contact_info);
        const backfillMethod = !legacyContactMethod && (form.phone || form.email || form.website_url);
        const backfilledMethod = backfillMethod
          ? (form.phone ? 'phone' : form.email ? 'email' : 'website')
          : legacyContactMethod;
        const backfilledInfo = backfillMethod
          ? (form.phone || form.email || form.website_url || undefined)
          : legacyContactInfo;

        const input: CampaignCreateInput = {
          campaign_category: form.campaign_category,
          repair_issue_type: form.campaign_category === 'profile_repair' ? strOrUndef(form.repair_issue_type) : undefined,
          scope: form.scope,
          business_name: strOrUndef(form.business_name),
          category: form.category,
          city: form.city,
          neighborhood: strOrUndef(form.neighborhood),
          contact_method: backfilledMethod,
          contact_info: backfilledInfo,
          phone: strOrUndef(form.phone),
          email: strOrUndef(form.email),
          website_url: strOrUndef(form.website_url),
          social_profiles: form.social_profiles.length > 0 ? form.social_profiles : undefined,
          display_id: strOrUndef(form.display_id),
          gbp_claimed: boolOrUndef(form.gbp_claimed),
          unaddressed_reviews: numOrUndef(form.unaddressed_reviews),
          last_review_date: form.last_review_date ? new Date(form.last_review_date).toISOString() : undefined,
          has_website: strOrUndef(form.has_website),
          nap_consistent: boolOrUndef(form.nap_consistent),
          estimated_tier: strOrUndef(form.estimated_tier),
          estimated_fee_cents: numOrUndef(form.estimated_fee_cents),
          pain_score: numOrUndef(form.pain_score),
          tone: strOrUndef(form.tone),
          retainer: form.retainer || undefined,
          attributes: form.attributes,
          assigned_to: strOrUndef(form.assigned_to),
          notes: strOrUndef(form.notes),
          service_category: strOrUndef(form.service_category),
        };
        const created = await marketingOpsService.createCampaign(input);
        router.push(`/settings/admin/marketing-ops/campaigns/${created.id}`);
      } else if (mode === 'edit' && campaignId) {
        // Same legacy backfill as create.
        const legacyContactMethod = strOrUndef(form.contact_method);
        const legacyContactInfo = strOrUndef(form.contact_info);
        const backfillMethod = !legacyContactMethod && (form.phone || form.email || form.website_url);
        const backfilledMethod = backfillMethod
          ? (form.phone ? 'phone' : form.email ? 'email' : 'website')
          : legacyContactMethod;
        const backfilledInfo = backfillMethod
          ? (form.phone || form.email || form.website_url || undefined)
          : legacyContactInfo;

        const input: CampaignUpdateInput = {
          campaign_category: form.campaign_category,
          scope: form.scope,
          business_name: strOrUndef(form.business_name),
          category: form.category,
          city: form.city,
          neighborhood: strOrUndef(form.neighborhood),
          contact_method: backfilledMethod,
          contact_info: backfilledInfo,
          phone: strOrUndef(form.phone),
          email: strOrUndef(form.email),
          website_url: strOrUndef(form.website_url),
          social_profiles: form.social_profiles.length > 0 ? form.social_profiles : undefined,
          gbp_claimed: boolOrUndef(form.gbp_claimed),
          unaddressed_reviews: numOrUndef(form.unaddressed_reviews),
          last_review_date: form.last_review_date ? new Date(form.last_review_date).toISOString() : undefined,
          has_website: strOrUndef(form.has_website),
          nap_consistent: boolOrUndef(form.nap_consistent),
          estimated_tier: strOrUndef(form.estimated_tier),
          estimated_fee_cents: numOrUndef(form.estimated_fee_cents),
          pain_score: numOrUndef(form.pain_score),
          tone: strOrUndef(form.tone),
          retainer: form.retainer || undefined,
          attributes: form.attributes,
          assigned_to: strOrUndef(form.assigned_to),
          notes: strOrUndef(form.notes),
          stage: form.stage,
          retainer_status: form.retainer_status || undefined,
          retainer_amount_cents: numOrUndef(form.retainer_amount_cents),
          retainer_start_date: form.retainer_start_date ? new Date(form.retainer_start_date).toISOString() : undefined,
          amount_paid_cents: numOrUndef(form.amount_paid_cents),
          package_delivered: strOrUndef(form.package_delivered),
          package_price_cents: numOrUndef(form.package_price_cents),
          subscription_tier_id: strOrUndef(form.subscription_tier_id),
          coupon_code: strOrUndef(form.coupon_code),
          service_category: strOrUndef(form.service_category),
        };
        await marketingOpsService.updateCampaign(campaignId, input);
        router.push(`/settings/admin/marketing-ops/campaigns/${campaignId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {mode === 'create' ? 'New Campaign' : 'Edit Campaign'}
        </h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core Fields */}
          <FormSection title="Business Information">
            <FormField label="Campaign Category" required>
              <select value={form.campaign_category} onChange={(e) => handleChange('campaign_category', e.target.value as CampaignCategory)}
                className={inputClass}>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat === 'review_management' ? 'Review Management' : cat === 'recovery_management' ? 'Recovery Management' : cat === 'profile_repair' ? 'Profile Repair' : 'Triage Management'}</option>)}
              </select>
              <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-400">
                {form.campaign_category === 'review_management' ? (
                  <>
                    <p className="font-medium">Review Management</p>
                    <p className="mt-1"><strong>Stages:</strong> Seek → Preview Built → Shown → Paid → Delivered → Retainer Pitched → Retainer Won → Tenant Onboarded</p>
                    <p className="mt-1"><strong>Prompts:</strong> Seek, Fulfill, Filter, Retainer (Prompt Library)</p>
                    <p className="mt-1"><strong>AI workflows:</strong> Openers workspace (A1-A4 archetype + close variant) → Follow-Ups workspace (doing/telling branch) → optional Cascade (email → SMS → DM)</p>
                    <p className="mt-1"><strong>Deliverables:</strong> Review responses, service menu, GBP audit, testimonial cards, NAP report, SEO content, lead magnet</p>
                  </>
                ) : form.campaign_category === 'recovery_management' ? (
                  <>
                    <p className="font-medium">Recovery Management</p>
                    <p className="mt-1"><strong>Stages:</strong> Audit Identified → Framework Preview → Outreach Dispatched → Awaiting Owner Intake → Intake Submitted → Final Resolution Drafted → Owner Approved → Resolved & Closed</p>
                    <p className="mt-1"><strong>Prompts:</strong> Recovery Resolution (drafted response + submission guide)</p>
                    <p className="mt-1"><strong>AI workflows:</strong> Recovery detail → AI Workspace (Copy-Paste Bridge + Direct API). Outreach is the Day 1/2/4 cascade (email → SMS → DM), auto-fired by the scheduler.</p>
                    <p className="mt-1"><strong>Deliverables:</strong> Recovery resolution (response draft + submission guide, emailed to owner on approval)</p>
                  </>
                ) : form.campaign_category === 'profile_repair' ? (
                  <>
                    <p className="font-medium">Profile Repair</p>
                    <p className="mt-1"><strong>Triage-first:</strong> Campaigns start in triage (no track). The triage prompt analyzes audit signals and recommends a track — the operator confirms or overrides.</p>
                    <p className="mt-1"><strong>Standard track:</strong> Uses the review pipeline (Seek → Preview → Shown → Paid → Delivered). For NAP drift, unclaimed profiles, missing categories. Pitched as a package.</p>
                    <p className="mt-1"><strong>Escalated track:</strong> Uses the recovery pipeline (Audit Identified → … → Resolved & Closed). For suspensions, hijacked/duplicate listings, ownership disputes. Evidence intake + appeal letter.</p>
                    <p className="mt-1"><strong>Switchable:</strong> Track can be switched mid-flight with guardrails (escalate freely before payment; de-escalate only before intake submission).</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Triage Management</p>
                    <p className="mt-1"><strong>Intelligent triage:</strong> Campaigns start in 'seek'. The Triage Engine evaluates audit signals (NAP, website, reviews, BBB) and recommends one of five standard playbooks (PB-01..PB-05).</p>
                    <p className="mt-1"><strong>Operator gate:</strong> The operator accepts or overrides the recommendation on the campaign detail page. Accepting re-categorizes the campaign to the playbook's category (review/recovery/triage) and applies the FITD fee + archetype.</p>
                    <p className="mt-1"><strong>Pipeline:</strong> Uses the review machine until a triage decision is accepted. BBB recovery (PB-04) requires manual BBB input — no automated BBB source yet.</p>
                  </>
                )}
              </div>
            </FormField>
            {form.campaign_category === 'profile_repair' && (
              <FormField label="Initial Issue Type (diagnosis, revisable)">
                <select
                  value={form.repair_issue_type}
                  onChange={(e) => handleChange('repair_issue_type', e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select issue type —</option>
                  <optgroup label="Standard">
                    {REPAIR_ISSUE_TYPES_STANDARD.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </optgroup>
                  <optgroup label="Escalated">
                    {REPAIR_ISSUE_TYPES_ESCALATED.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </optgroup>
                </select>
                <p className="text-xs text-gray-400 mt-1">Initial diagnosis from audit signals. The track is confirmed later on the campaign detail page after triage analysis.</p>
              </FormField>
            )}
            <FormField label="Scope" required>
              <select value={form.scope} onChange={(e) => handleChange('scope', e.target.value as CampaignScope)}
                className={inputClass}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Business Name" required={form.scope === 'business'}>
              <input type="text" required={form.scope === 'business'} value={form.business_name} onChange={(e) => handleChange('business_name', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Category" required>
              <SuggestiveSelect required value={form.category} onChange={(v) => handleChange('category', v)}
                options={vocab.categories} emptyLabel="-- Select category --" newLabel="+ New category..."
                newInputPlaceholder="Enter new category" className={inputClass} />
            </FormField>
            <FormField label="Tone">
              <SuggestiveSelect value={form.tone} onChange={(v) => handleChange('tone', v)}
                options={vocab.tones} emptyLabel="-- Select tone --" newLabel="+ New tone..."
                newInputPlaceholder="Enter new tone" className={inputClass} />
            </FormField>
            <FormField label="City" required>
              <SuggestiveSelect required value={form.city} onChange={(v) => handleChange('city', v)}
                options={vocab.cities} emptyLabel="-- Select city --" newLabel="+ New city..."
                newInputPlaceholder="Enter new city" className={inputClass} />
            </FormField>
            <FormField label="Neighborhood">
              <SuggestiveSelect value={form.neighborhood} onChange={(v) => handleChange('neighborhood', v)}
                options={vocab.neighborhoods} emptyLabel="-- Select neighborhood --" newLabel="+ New neighborhood..."
                newInputPlaceholder="Enter new neighborhood" className={inputClass} />
            </FormField>
            <FormField label="Display ID">
              <input type="text" value={form.display_id} onChange={(e) => handleChange('display_id', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Assigned To">
              <PlatformUserSelect value={form.assigned_to} onChange={(v) => handleChange('assigned_to', v)}
                emptyLabel="-- Unassigned --" className={inputClass} />
            </FormField>
          </FormSection>

          <FormSection title="Classification">
            <FormField label="Retainer">
              <select value={form.retainer} onChange={(e) => handleChange('retainer', e.target.value as 'Fast' | 'Medium' | 'Slow' | '')}
                className={inputClass}>
                <option value="">—</option>
                {RETAINER_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Attributes" className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-2">
                {CAMPAIGN_ATTRIBUTE_OPTIONS.map((attr) => (
                  <label key={attr} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.attributes.includes(attr)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.attributes, attr]
                          : form.attributes.filter((a) => a !== attr);
                        handleChange('attributes', next);
                      }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{attr}</span>
                  </label>
                ))}
              </div>
            </FormField>
          </FormSection>

          {/* Contact & Audit Info */}
          <FormSection title="Contact & GBP Audit">
            <FormField label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+1 555-0100"
                className={inputClass} />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)}
                placeholder="owner@business.com"
                className={inputClass} />
            </FormField>
            <FormField label="Website URL">
              <input type="url" value={form.website_url} onChange={(e) => handleChange('website_url', e.target.value)}
                placeholder="https://business.com"
                className={inputClass} />
            </FormField>
            <FormField label="Social Profiles" className="sm:col-span-2">
              <div className="space-y-2">
                {form.social_profiles.map((sp, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" value={sp.platform} placeholder="Platform (e.g. Instagram)"
                      onChange={(e) => {
                        const next = [...form.social_profiles];
                        next[idx] = { ...sp, platform: e.target.value };
                        handleChange('social_profiles', next);
                      }}
                      className={`${inputClass} w-1/3`} />
                    <input type="url" value={sp.url} placeholder="https://instagram.com/business"
                      onChange={(e) => {
                        const next = [...form.social_profiles];
                        next[idx] = { ...sp, url: e.target.value };
                        handleChange('social_profiles', next);
                      }}
                      className={`${inputClass} flex-1`} />
                    <button type="button" onClick={() => handleChange('social_profiles', form.social_profiles.filter((_, i) => i !== idx))}
                      className="px-2 text-red-600 hover:text-red-700 dark:text-red-400">Remove</button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => handleChange('social_profiles', [...form.social_profiles, { platform: '', url: '' }])}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">+ Add social profile</button>
              </div>
            </FormField>
            <FormField label="Legacy contact method (optional)" className="sm:col-span-2">
              <div className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                Retained for backwards compatibility with existing filters/reports. Auto-filled from the new channels above when left blank.
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <ContactMethodChecklist value={form.contact_method} options={vocab.contactMethods}
                  onChange={(v) => handleChange('contact_method', v)} className={inputClass} />
                <input type="text" value={form.contact_info} onChange={(e) => handleChange('contact_info', e.target.value)}
                  placeholder="Legacy contact info"
                  className={inputClass} />
              </div>
            </FormField>
            <FormField label="GBP Claimed">
              <select value={form.gbp_claimed === true ? 'true' : form.gbp_claimed === false ? 'false' : ''} onChange={(e) => handleChange('gbp_claimed', e.target.value === '' ? '' : e.target.value === 'true')}
                className={inputClass}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Unaddressed Reviews">
              <input type="number" value={form.unaddressed_reviews} onChange={(e) => handleChange('unaddressed_reviews', e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass} />
            </FormField>
            <FormField label="Last Review Date">
              <input type="date" value={form.last_review_date} onChange={(e) => handleChange('last_review_date', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Has Website">
              <input type="text" value={form.has_website} onChange={(e) => handleChange('has_website', e.target.value)}
                className={inputClass} placeholder="yes, no, wix..." />
            </FormField>
            <FormField label="NAP Consistent">
              <select value={form.nap_consistent === true ? 'true' : form.nap_consistent === false ? 'false' : ''} onChange={(e) => handleChange('nap_consistent', e.target.value === '' ? '' : e.target.value === 'true')}
                className={inputClass}>
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Pain Score (1-10)">
              <input type="number" min={1} max={10} value={form.pain_score} onChange={(e) => handleChange('pain_score', e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass} />
            </FormField>
          </FormSection>

          {/* Pricing & Stage */}
          <FormSection title="Pricing & Stage">
            <FormField label="Estimated Tier">
              <SuggestiveSelect value={form.estimated_tier} onChange={(v) => handleChange('estimated_tier', v)}
                options={vocab.estimatedTiers} emptyLabel="-- Select tier --" newLabel="+ New tier..."
                newInputPlaceholder="Enter new tier" className={inputClass} />
            </FormField>
            <FormField label="Estimated Fee (cents)">
              <input type="number" value={form.estimated_fee_cents} onChange={(e) => handleChange('estimated_fee_cents', e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass} />
            </FormField>
            <FormField label="Package Price (cents)">
              <input type="number" value={form.package_price_cents} onChange={(e) => handleChange('package_price_cents', e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass} placeholder="e.g. 49900 for $499" />
            </FormField>
            <FormField label="Service Category">
              <ServiceCategorySelect
                value={form.service_category}
                label={form.service_category_label}
                options={serviceCategories}
                onChange={(v) => handleChange('service_category', v)}
                onCreate={handleCreateServiceCategory}
                className={inputClass}
              />
            </FormField>
            <FormField label="Coupon Code">
              <input type="text" value={form.coupon_code} onChange={(e) => handleChange('coupon_code', e.target.value)}
                className={inputClass} placeholder="Optional coupon code" />
            </FormField>
            <FormField label="Subscription Tier ID">
              <input type="text" value={form.subscription_tier_id} onChange={(e) => handleChange('subscription_tier_id', e.target.value)}
                className={inputClass} placeholder="Optional tier ID for recurring billing" />
            </FormField>
            {mode === 'edit' && (
              <>
                <FormField label="Stage">
                  <select value={form.stage} onChange={(e) => handleChange('stage', e.target.value as CampaignStage)}
                    className={inputClass}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                </FormField>
                <FormField label="Amount Paid (cents)">
                  <input type="number" value={form.amount_paid_cents} onChange={(e) => handleChange('amount_paid_cents', e.target.value === '' ? '' : parseInt(e.target.value))}
                    className={inputClass} />
                </FormField>
                <FormField label="Package Delivered">
                  <input type="text" value={form.package_delivered} onChange={(e) => handleChange('package_delivered', e.target.value)}
                    className={inputClass} />
                </FormField>
                <FormField label="Retainer Status">
                  <select value={form.retainer_status} onChange={(e) => handleChange('retainer_status', e.target.value as RetainerStatus | '')}
                    className={inputClass}>
                    <option value="">—</option>
                    {RETAINER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </FormField>
                <FormField label="Retainer Amount (cents)">
                  <input type="number" value={form.retainer_amount_cents} onChange={(e) => handleChange('retainer_amount_cents', e.target.value === '' ? '' : parseInt(e.target.value))}
                    className={inputClass} />
                </FormField>
                <FormField label="Retainer Start Date">
                  <input type="date" value={form.retainer_start_date} onChange={(e) => handleChange('retainer_start_date', e.target.value)}
                    className={inputClass} />
                </FormField>
              </>
            )}
          </FormSection>

          {/* Notes */}
          <FormSection title="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Internal notes about this prospect..."
            />
          </FormSection>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/settings/admin/marketing-ops/campaigns"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : mode === 'create' ? 'Create Campaign' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FormField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ServiceCategorySelect({ value, label, options, onChange, onCreate, className }: {
  value: string;
  label?: string;
  options: ServiceCategory[];
  onChange: (value: string) => void;
  onCreate: (value: string, label: string) => void;
  className?: string;
}) {
  const [isNew, setIsNew] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const NEW_ITEM = '__new__';
  const matched = options.find((o) => o.value === value);
  const allOptions = value && !isNew && !matched
    ? [...options, { value, label: label || value }]
    : options;

  const handleAdd = () => {
    const v = newValue.trim();
    const l = newLabel.trim();
    if (v && l && onCreate) {
      onCreate(v, l);
      setNewValue('');
      setNewLabel('');
      setIsNew(false);
    }
  };

  return (
    <>
      <select
        value={isNew ? NEW_ITEM : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NEW_ITEM) {
            setIsNew(true);
            setNewValue('');
            setNewLabel('');
            onChange('');
          } else {
            setIsNew(false);
            onChange(v);
          }
        }}
        className={className}
      >
        <option value="">-- Select category --</option>
        {allOptions.map((sc) => (
          <option key={sc.value} value={sc.value}>{sc.label}</option>
        ))}
        <option value={NEW_ITEM}>+ New service category...</option>
      </select>
      {isNew && (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Category code (e.g. local_seo)"
            className={className}
            autoFocus
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Display label (e.g. Local SEO Package)"
            className={className}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newValue.trim() || !newLabel.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Add service category
          </button>
        </div>
      )}
    </>
  );
}

function ContactMethodChecklist({ value, options, onChange, className }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newMethod, setNewMethod] = useState('');

  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const allOptions = [...new Set([...options, ...selected])].sort((a, b) => a.localeCompare(b));

  const toggle = (method: string, checked: boolean) => {
    const next = checked ? [...selected, method] : selected.filter((m) => m !== method);
    onChange([...new Set(next)].join(', '));
  };

  const addNew = () => {
    const m = newMethod.trim();
    if (m && !selected.includes(m)) {
      onChange([...selected, m].join(', '));
    }
    setNewMethod('');
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {allOptions.length === 0 && !adding && (
        <p className="text-xs text-gray-400 dark:text-gray-500">No contact methods yet. Add one below.</p>
      )}
      {allOptions.map((m) => (
        <label key={m} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.includes(m)}
            onChange={(e) => toggle(m, e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{m}</span>
        </label>
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={newMethod}
            onChange={(e) => setNewMethod(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
            placeholder="Enter new method"
            className={className}
          />
          <button type="button" onClick={addNew}
            className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Add
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewMethod(''); }}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          + Add new method...
        </button>
      )}
    </div>
  );
}
