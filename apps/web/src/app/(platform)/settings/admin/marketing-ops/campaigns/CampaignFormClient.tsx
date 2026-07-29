'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import marketingOpsService, { Campaign, CampaignStage, RetainerStatus, CampaignCreateInput, CampaignUpdateInput } from '@/services/MarketingOpsService';
import { STAGE_LABELS } from '@/components/marketing-ops/StageBadge';

const STAGES: CampaignStage[] = ['seek', 'preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded'];
const RETAINER_STATUSES: RetainerStatus[] = ['not_pitched', 'pitched', 'won', 'declined'];

interface FormState {
  business_name: string;
  category: string;
  city: string;
  neighborhood: string;
  contact_method: string;
  contact_info: string;
  display_id: string;
  gbp_claimed: boolean | '';
  unaddressed_reviews: number | '';
  last_review_date: string;
  has_website: string;
  nap_consistent: boolean | '';
  estimated_tier: string;
  estimated_fee_cents: number | '';
  pain_score: number | '';
  assigned_to: string;
  notes: string;
  stage: CampaignStage;
  retainer_status: RetainerStatus | '';
  retainer_amount_cents: number | '';
  retainer_start_date: string;
  amount_paid_cents: number | '';
  package_delivered: string;
}

const EMPTY_FORM: FormState = {
  business_name: '',
  category: '',
  city: '',
  neighborhood: '',
  contact_method: '',
  contact_info: '',
  display_id: '',
  gbp_claimed: '',
  unaddressed_reviews: '',
  last_review_date: '',
  has_website: '',
  nap_consistent: '',
  estimated_tier: '',
  estimated_fee_cents: '',
  pain_score: '',
  assigned_to: '',
  notes: '',
  stage: 'seek',
  retainer_status: '',
  retainer_amount_cents: '',
  retainer_start_date: '',
  amount_paid_cents: '',
  package_delivered: '',
};

export default function CampaignFormClient({ mode, campaignId }: { mode: 'create' | 'edit'; campaignId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    if (mode !== 'edit' || !campaignId) return;
    setLoading(true);
    try {
      const c = await marketingOpsService.getCampaign(campaignId);
      setForm({
        business_name: c.business_name ?? '',
        category: c.category ?? '',
        city: c.city ?? '',
        neighborhood: c.neighborhood ?? '',
        contact_method: c.contact_method ?? '',
        contact_info: c.contact_info ?? '',
        display_id: c.display_id ?? '',
        gbp_claimed: c.gbp_claimed ?? '',
        unaddressed_reviews: c.unaddressed_reviews ?? '',
        last_review_date: c.last_review_date ? c.last_review_date.split('T')[0] : '',
        has_website: c.has_website ?? '',
        nap_consistent: c.nap_consistent ?? '',
        estimated_tier: c.estimated_tier ?? '',
        estimated_fee_cents: c.estimated_fee_cents ?? '',
        pain_score: c.pain_score ?? '',
        assigned_to: c.assigned_to ?? '',
        notes: c.notes ?? '',
        stage: c.stage,
        retainer_status: c.retainer_status ?? '',
        retainer_amount_cents: c.retainer_amount_cents ?? '',
        retainer_start_date: c.retainer_start_date ? c.retainer_start_date.split('T')[0] : '',
        amount_paid_cents: c.amount_paid_cents ?? '',
        package_delivered: c.package_delivered ?? '',
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

  const handleChange = (field: keyof FormState, value: string | number | boolean | '') => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        const input: CampaignCreateInput = {
          business_name: form.business_name,
          category: form.category,
          city: form.city,
          neighborhood: strOrUndef(form.neighborhood),
          contact_method: strOrUndef(form.contact_method),
          contact_info: strOrUndef(form.contact_info),
          display_id: strOrUndef(form.display_id),
          gbp_claimed: boolOrUndef(form.gbp_claimed),
          unaddressed_reviews: numOrUndef(form.unaddressed_reviews),
          last_review_date: form.last_review_date ? new Date(form.last_review_date).toISOString() : undefined,
          has_website: strOrUndef(form.has_website),
          nap_consistent: boolOrUndef(form.nap_consistent),
          estimated_tier: strOrUndef(form.estimated_tier),
          estimated_fee_cents: numOrUndef(form.estimated_fee_cents),
          pain_score: numOrUndef(form.pain_score),
          assigned_to: strOrUndef(form.assigned_to),
          notes: strOrUndef(form.notes),
        };
        const created = await marketingOpsService.createCampaign(input);
        router.push(`/settings/admin/marketing-ops/campaigns/${created.id}`);
      } else if (mode === 'edit' && campaignId) {
        const input: CampaignUpdateInput = {
          business_name: form.business_name,
          category: form.category,
          city: form.city,
          neighborhood: strOrUndef(form.neighborhood),
          contact_method: strOrUndef(form.contact_method),
          contact_info: strOrUndef(form.contact_info),
          gbp_claimed: boolOrUndef(form.gbp_claimed),
          unaddressed_reviews: numOrUndef(form.unaddressed_reviews),
          last_review_date: form.last_review_date ? new Date(form.last_review_date).toISOString() : undefined,
          has_website: strOrUndef(form.has_website),
          nap_consistent: boolOrUndef(form.nap_consistent),
          estimated_tier: strOrUndef(form.estimated_tier),
          estimated_fee_cents: numOrUndef(form.estimated_fee_cents),
          pain_score: numOrUndef(form.pain_score),
          assigned_to: strOrUndef(form.assigned_to),
          notes: strOrUndef(form.notes),
          stage: form.stage,
          retainer_status: form.retainer_status || undefined,
          retainer_amount_cents: numOrUndef(form.retainer_amount_cents),
          retainer_start_date: form.retainer_start_date ? new Date(form.retainer_start_date).toISOString() : undefined,
          amount_paid_cents: numOrUndef(form.amount_paid_cents),
          package_delivered: strOrUndef(form.package_delivered),
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
        <Link
          href="/settings/admin/marketing-ops/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaigns
        </Link>

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
            <FormField label="Business Name" required>
              <input type="text" required value={form.business_name} onChange={(e) => handleChange('business_name', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Category" required>
              <input type="text" required value={form.category} onChange={(e) => handleChange('category', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="City" required>
              <input type="text" required value={form.city} onChange={(e) => handleChange('city', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Neighborhood">
              <input type="text" value={form.neighborhood} onChange={(e) => handleChange('neighborhood', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Display ID">
              <input type="text" value={form.display_id} onChange={(e) => handleChange('display_id', e.target.value)}
                className={inputClass} />
            </FormField>
            <FormField label="Assigned To">
              <input type="text" value={form.assigned_to} onChange={(e) => handleChange('assigned_to', e.target.value)}
                className={inputClass} />
            </FormField>
          </FormSection>

          {/* Contact & Audit Info */}
          <FormSection title="Contact & GBP Audit">
            <FormField label="Contact Method">
              <input type="text" value={form.contact_method} onChange={(e) => handleChange('contact_method', e.target.value)}
                className={inputClass} placeholder="phone, email, walk-in..." />
            </FormField>
            <FormField label="Contact Info">
              <input type="text" value={form.contact_info} onChange={(e) => handleChange('contact_info', e.target.value)}
                className={inputClass} />
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
              <input type="text" value={form.estimated_tier} onChange={(e) => handleChange('estimated_tier', e.target.value)}
                className={inputClass} placeholder="basic, standard, premium..." />
            </FormField>
            <FormField label="Estimated Fee (cents)">
              <input type="number" value={form.estimated_fee_cents} onChange={(e) => handleChange('estimated_fee_cents', e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass} />
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

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
