'use client';

/**
 * OutreachIntelligenceTab — Manual research worksheet for business-scope campaigns
 *
 * Captures business-published contact context (owner name, business email,
 * team signal, preferred channel) gathered by a human operator after the
 * Business Audit and before outreach begins. The server-computed
 * recommended_salutation is shown as a live preview.
 *
 * Guardrails (visible inline):
 *   - Only business-published information may be recorded.
 *   - Do not guess email formats or infer owner names from unlinked personal profiles.
 *   - Do not record personal phone numbers, home addresses, or unrelated personal info.
 *   - If a field cannot be supported by an acceptable source, leave it blank.
 *
 * Sibling behavior:
 *   - Non-primary siblings inherit the primary sibling's worksheet (read-only).
 *   - Writes are rejected on non-primary siblings — edit the primary's worksheet.
 *
 * Spec: docs/LocalBiz/marketing_ops_outreach_intelligence_prep_sprint_plan.md
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, AlertCircle, Info, User, Mail, Users, MessageSquare, ExternalLink } from 'lucide-react';
import marketingOpsService, {
  type OutreachIntelligenceResult,
  type OutreachIntelligenceInput,
  type SourcedField,
  type TeamSignalField,
  type SourceConfidence,
  type TeamSignalValue,
} from '@/services/MarketingOpsService';

interface Props {
  campaignId: string;
  campaignName?: string | null;
}

const CONFIDENCE_OPTIONS: { value: SourceConfidence; label: string }[] = [
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'inferred_low_risk', label: 'Inferred (low-risk)' },
  { value: 'confirmed', label: 'Confirmed' },
];

const TEAM_SIGNAL_OPTIONS: { value: TeamSignalValue; label: string }[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'sole_owner', label: 'Sole owner' },
  { value: 'family_team', label: 'Family team' },
  { value: 'small_staff', label: 'Small staff' },
];

const emptySourcedField: SourcedField = { value: null, source: null, source_confidence: 'unavailable' };
const emptyTeamSignal: TeamSignalField = { value: 'unknown', quoted_description: null, source: null, source_confidence: 'unavailable' };

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function emptyInput(): OutreachIntelligenceInput {
  return {
    linked_audit_reference: null,
    prepared_by: '',
    research_date: todayStr(),
    owner_name: { ...emptySourcedField },
    business_email: { ...emptySourcedField },
    team_signal: { ...emptyTeamSignal },
    preferred_contact_channel: { ...emptySourcedField },
    researcher_notes: '',
  };
}

export default function OutreachIntelligenceTab({ campaignId, campaignName }: Props) {
  const [data, setData] = useState<OutreachIntelligenceResult | null>(null);
  const [form, setForm] = useState<OutreachIntelligenceInput>(emptyInput());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.getOutreachIntelligence(campaignId);
      setData(result);
      if (result && !result.inherited) {
        // Populate form from stored payload
        const p = result.payload;
        setForm({
          linked_audit_reference: p.linked_audit_reference,
          prepared_by: p.prepared_by,
          research_date: p.research_date,
          owner_name: p.owner_name,
          business_email: p.business_email,
          team_signal: p.team_signal,
          preferred_contact_channel: p.preferred_contact_channel,
          researcher_notes: p.researcher_notes,
        });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load worksheet');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const isReadOnly = data?.inherited === true;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await marketingOpsService.upsertOutreachIntelligence(campaignId, form);
      setData(result);
      setSuccess('Worksheet saved. Salutation: ' + result.recommended_salutation);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save worksheet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this outreach intelligence worksheet? This cannot be undone.')) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await marketingOpsService.deleteOutreachIntelligence(campaignId);
      setData(null);
      setForm(emptyInput());
      setSuccess('Worksheet deleted.');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete worksheet');
    } finally {
      setDeleting(false);
    }
  };

  const updateField = <K extends keyof OutreachIntelligenceInput>(
    key: K,
    value: OutreachIntelligenceInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSourcedField = (
    key: 'owner_name' | 'business_email' | 'preferred_contact_channel',
    patch: Partial<SourcedField>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const updateTeamSignal = (patch: Partial<TeamSignalField>) => {
    setForm((prev) => ({ ...prev, team_signal: { ...prev.team_signal, ...patch } }));
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <p className="text-center text-gray-400 py-8">Loading outreach intelligence worksheet…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Guardrail banner */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Business-published sources only</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Only record information the business has published about itself.</li>
              <li>Do not guess email formats or infer owner names from unlinked personal profiles.</li>
              <li>Do not record personal phone numbers, home addresses, or unrelated personal information.</li>
              <li>If a field cannot be supported by an acceptable source, leave it blank (Unavailable).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Inherited worksheet banner */}
      {isReadOnly && data && (
        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
            <div className="text-xs text-purple-800 dark:text-purple-300">
              <p className="font-semibold">Inherited worksheet (read-only)</p>
              <p>
                This campaign inherits its outreach intelligence from the primary sibling campaign
                {data.sourceCampaignId ? ` (${data.sourceCampaignId})` : ''}. Edit the worksheet on the primary sibling to make changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Salutation preview */}
      {data?.recommended_salutation && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
            <div className="text-sm">
              <span className="text-green-700 dark:text-green-300 font-semibold">Recommended salutation: </span>
              <code className="text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
                {data.recommended_salutation}
              </code>
              <span className="text-green-600 dark:text-green-400 text-xs ml-2">(server-computed)</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Worksheet form */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Prepared by
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={form.prepared_by}
              onChange={(e) => updateField('prepared_by', e.target.value)}
              placeholder="Operator name"
              className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Research date
            </label>
            <input
              type="date"
              disabled={isReadOnly}
              value={form.research_date}
              onChange={(e) => updateField('research_date', e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Linked audit reference */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Linked audit reference (optional — defaults to latest business-analysis audit)
          </label>
          <input
            type="text"
            disabled={isReadOnly}
            value={form.linked_audit_reference ?? ''}
            onChange={(e) => updateField('linked_audit_reference', e.target.value || null)}
            placeholder="maud-…"
            className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        {/* Owner name */}
        <SourcedFieldEditor
          icon={<User className="w-4 h-4" />}
          label="Owner / contact name"
          field={form.owner_name}
          disabled={isReadOnly}
          placeholder="e.g. Maria Garcia (from the business About page)"
          onChange={(patch) => updateSourcedField('owner_name', patch)}
        />

        {/* Business email */}
        <SourcedFieldEditor
          icon={<Mail className="w-4 h-4" />}
          label="Business-published email"
          field={form.business_email}
          disabled={isReadOnly}
          placeholder="e.g. contact@business.com (from the business Contact page)"
          onChange={(patch) => updateSourcedField('business_email', patch)}
        />

        {/* Team signal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Team signal</label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Value</label>
              <select
                disabled={isReadOnly}
                value={form.team_signal.value}
                onChange={(e) => updateTeamSignal({ value: e.target.value as TeamSignalValue })}
                className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
              >
                {TEAM_SIGNAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confidence</label>
              <select
                disabled={isReadOnly}
                value={form.team_signal.source_confidence}
                onChange={(e) => updateTeamSignal({ source_confidence: e.target.value as SourceConfidence })}
                className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
              >
                {CONFIDENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pl-6">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quoted description (optional)</label>
            <input
              type="text"
              disabled={isReadOnly}
              value={form.team_signal.quoted_description ?? ''}
              onChange={(e) => updateTeamSignal({ quoted_description: e.target.value || null })}
              placeholder={`e.g. "Family-owned and operated since 1998"`}
              className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            />
          </div>
          {form.team_signal.source_confidence !== 'unavailable' && (
            <div className="pl-6">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source citation</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={form.team_signal.source ?? ''}
                onChange={(e) => updateTeamSignal({ source: e.target.value || null })}
                placeholder="e.g. About page, GBP description"
                className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
              />
            </div>
          )}
        </div>

        {/* Preferred contact channel */}
        <SourcedFieldEditor
          icon={<MessageSquare className="w-4 h-4" />}
          label="Preferred contact channel"
          field={form.preferred_contact_channel}
          disabled={isReadOnly}
          placeholder="e.g. email, contact form, GBP messaging"
          onChange={(patch) => updateSourcedField('preferred_contact_channel', patch)}
        />

        {/* Researcher notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Researcher notes
          </label>
          <textarea
            disabled={isReadOnly}
            value={form.researcher_notes}
            onChange={(e) => updateField('researcher_notes', e.target.value)}
            placeholder="Notes about where information was found, what was not found, etc."
            rows={3}
            className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.prepared_by}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save worksheet'}
            </button>
            {data && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            {data?.payload?.linked_audit_reference && (
              <a
                href={`/settings/admin/marketing-ops/campaigns/${campaignId}?tab=audits`}
                className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View linked audit
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SourcedFieldEditor sub-component ────────────────────────────────────

interface SourcedFieldEditorProps {
  icon: React.ReactNode;
  label: string;
  field: SourcedField;
  disabled?: boolean;
  placeholder?: string;
  onChange: (patch: Partial<SourcedField>) => void;
}

function SourcedFieldEditor({ icon, label, field, disabled, placeholder, onChange }: SourcedFieldEditorProps) {
  const showValue = field.source_confidence !== 'unavailable';
  const showSource = field.source_confidence !== 'unavailable';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confidence</label>
          <select
            disabled={disabled}
            value={field.source_confidence}
            onChange={(e) => {
              const conf = e.target.value as SourceConfidence;
              if (conf === 'unavailable') {
                onChange({ source_confidence: conf, value: null, source: null });
              } else {
                onChange({ source_confidence: conf });
              }
            }}
            className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {showValue && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Value</label>
            <input
              type="text"
              disabled={disabled}
              value={field.value ?? ''}
              onChange={(e) => onChange({ value: e.target.value || null })}
              placeholder={placeholder}
              className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
            />
          </div>
        )}
      </div>
      {showSource && (
        <div className="pl-6">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source citation</label>
          <input
            type="text"
            disabled={disabled}
            value={field.source ?? ''}
            onChange={(e) => onChange({ source: e.target.value || null })}
            placeholder="e.g. About page, Contact page, GBP description"
            className="w-full rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
          {field.source_confidence === 'confirmed' && (!field.source || field.source.trim().length === 0) && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">A confirmed field must include a source citation.</p>
          )}
        </div>
      )}
    </div>
  );
}
