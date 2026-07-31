'use client';

import { useState } from 'react';
import marketingOpsService, {
  OwnerVoiceProfile, OwnerVoiceInput, VoiceInferenceResult,
} from '@/services/MarketingOpsService';

const PERSON_OPTIONS = [
  { value: 'first_person', label: 'First person (I)' },
  { value: 'third_person', label: 'Third person (The team at...)' },
  { value: 'we', label: 'We (Our team...)' },
];

const FORMALITY_OPTIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal' },
];

const HUMOR_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'light', label: 'Light' },
  { value: 'witty', label: 'Witty' },
];

const APOLOGY_OPTIONS = [
  { value: 'direct_apology', label: 'Direct apology ("I\'m sorry...")' },
  { value: 'fix_first', label: 'Fix first ("Here\'s what we fixed...")' },
  { value: 'acknowledge_and_pivot', label: 'Acknowledge & pivot ("Thanks for letting us know — and here\'s the fix")' },
];

const SIGNOFF_OPTIONS = [
  { value: 'first_name', label: 'First name' },
  { value: 'full_name', label: 'Full name' },
  { value: 'title', label: 'Title (Owner, Manager)' },
  { value: 'team', label: 'Team' },
  { value: 'none', label: 'None' },
];

export default function OwnerVoiceCard({
  profile, onSaved, onInfer,
}: {
  profile: OwnerVoiceProfile | null;
  onSaved: (input: OwnerVoiceInput) => Promise<void>;
  onInfer: () => Promise<VoiceInferenceResult>;
}) {
  const [person, setPerson] = useState(profile?.person ?? 'first_person');
  const [formality, setFormality] = useState(profile?.formality ?? 'casual');
  const [humor, setHumor] = useState(profile?.humor ?? 'none');
  const [apologyStyle, setApologyStyle] = useState(profile?.apologyStyle ?? 'fix_first');
  const [signoffStyle, setSignoffStyle] = useState(profile?.signoffStyle ?? 'first_name');
  const [signature, setSignature] = useState(profile?.signature ?? '');
  const [saving, setSaving] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [inferInfo, setInferInfo] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaved({ person, formality, humor, apologyStyle, signoffStyle, signature });
    } finally {
      setSaving(false);
    }
  };

  const handleInfer = async () => {
    setInferring(true);
    setInferError(null);
    setInferInfo(null);
    try {
      const result = await onInfer();
      setInferInfo(`Inferred from ${result.inferredFromCount} existing owner responses.`);
    } catch (e) {
      setInferError((e as Error).message);
    } finally {
      setInferring(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Owner Voice</h2>
        <button
          onClick={handleInfer}
          disabled={inferring}
          className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-300"
        >
          {inferring ? 'Inferring...' : 'Infer from existing responses'}
        </button>
      </div>

      {inferError && (
        <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {inferError}
        </div>
      )}
      {inferInfo && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-300">
          {inferInfo}
        </div>
      )}
      {profile && profile.inferredFromCount > 0 && !inferInfo && (
        <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Inferred from {profile.inferredFromCount} existing responses
          {profile.operatorOverrides && Object.keys(profile.operatorOverrides).length > 0 &&
            ` · ${Object.keys(profile.operatorOverrides).length} operator override(s)`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SelectField label="Person" value={person} options={PERSON_OPTIONS} onChange={setPerson} />
        <SelectField label="Formality" value={formality} options={FORMALITY_OPTIONS} onChange={setFormality} />
        <SelectField label="Humor" value={humor} options={HUMOR_OPTIONS} onChange={setHumor} />
        <SelectField label="Apology style" value={apologyStyle} options={APOLOGY_OPTIONS} onChange={setApologyStyle} />
        <SelectField label="Signoff style" value={signoffStyle} options={SIGNOFF_OPTIONS} onChange={setSignoffStyle} />
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Signature</label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="— Sarah, Owner"
            className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save voice profile'}
        </button>
      </div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-100"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
