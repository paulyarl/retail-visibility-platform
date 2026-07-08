'use client';

import { useState, useMemo, useEffect } from 'react';
import { PolicyTemplate, PlaceholderEntry, policyTemplateService } from '@/services/PolicyTemplateService';

interface TemplatePreviewModalProps {
  template: PolicyTemplate;
  tenantId: string;
  onClose: () => void;
  onApplied: (policyType: string) => void;
}

export default function TemplatePreviewModal({
  template,
  tenantId,
  onClose,
  onApplied,
}: TemplatePreviewModalProps) {
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    policyTemplateService.getAutoFillDefaults(tenantId, template.id).then(defaults => {
      if (Object.keys(defaults).length > 0) {
        setPlaceholderValues(defaults);
      }
    }).catch(() => {});
  }, [tenantId, template.id]);

  const previewContent = useMemo(() => {
    let content = template.contentMarkdown;
    for (const entry of template.placeholderSchema) {
      const val = placeholderValues[entry.key] ?? entry.default ?? '';
      content = content.replace(new RegExp(`\\[${entry.key}\\]`, 'g'), val);
    }
    // Clean up any remaining unfilled placeholders
    content = content.replace(/\[[A-Z_]+\]/g, '');
    return content;
  }, [template, placeholderValues]);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const result = await policyTemplateService.applyTemplate(
        tenantId,
        template.id,
        placeholderValues as Record<string, string | number | null>,
      );
      if (result.success) {
        onApplied(result.policyType || template.policyType);
      } else {
        setError(result.error || 'Failed to apply template');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">{template.title}</h2>
            <p className="text-sm text-neutral-500">
              {template.policyType.replace(/_/g, ' ')} · {template.storefrontType} · v{template.version}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl">&times;</button>
        </div>

        {/* Legal disclaimer */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
          <p className="text-xs text-amber-800">
            Templates are starting points, not legal advice. Consult your attorney before publishing.
          </p>
        </div>

        {/* Body: preview + form */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: markdown preview */}
          <div className="p-6 border-r border-neutral-200 overflow-y-auto">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Preview</h3>
            <div className="prose prose-sm max-w-none text-neutral-800 whitespace-pre-wrap">
              {previewContent}
            </div>
          </div>

          {/* Right: placeholder form */}
          <div className="p-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Fill in your details</h3>
            {template.placeholderSchema.length === 0 ? (
              <p className="text-sm text-neutral-500">This template has no placeholders to fill.</p>
            ) : (
              <div className="space-y-4">
                {template.placeholderSchema.map((entry: PlaceholderEntry) => (
                  <div key={entry.key}>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {entry.label}
                      {entry.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {entry.type === 'select' && entry.options ? (
                      <select
                        value={placeholderValues[entry.key] ?? entry.default ?? ''}
                        onChange={(e) => setPlaceholderValues({ ...placeholderValues, [entry.key]: e.target.value })}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {entry.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={entry.type === 'number' ? 'number' : entry.type === 'date' ? 'date' : 'text'}
                        value={placeholderValues[entry.key] ?? entry.default ?? ''}
                        onChange={(e) => setPlaceholderValues({ ...placeholderValues, [entry.key]: e.target.value })}
                        placeholder={entry.helpText || entry.label}
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm"
                      />
                    )}
                    {entry.helpText && (
                      <p className="text-xs text-neutral-400 mt-1">{entry.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Compliance tags */}
            {template.complianceTags.length > 0 && (
              <div className="mt-6 pt-4 border-t border-neutral-200">
                <p className="text-xs font-medium text-neutral-500 mb-2">Compliance Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {template.complianceTags.map(tag => (
                    <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
