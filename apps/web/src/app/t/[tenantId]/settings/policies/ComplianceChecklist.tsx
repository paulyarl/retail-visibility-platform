'use client';

import { useState, useEffect } from 'react';
import { policyTemplateService, CompletenessResult } from '@/services/PolicyTemplateService';
import { CheckCircle2, AlertTriangle, XCircle, Shield, Info } from 'lucide-react';

interface ComplianceChecklistProps {
  tenantId: string;
  onBrowseTemplates?: () => void;
}

const POLICY_LABELS: Record<string, string> = {
  return_policy: 'Return Policy',
  shipping_policy: 'Shipping Policy',
  privacy_policy: 'Privacy Policy',
  terms_of_service: 'Terms of Service',
  refund_policy: 'Refund Policy',
};

const JURISDICTION_LABELS: Record<string, string> = {
  US: 'United States',
  EU: 'European Union',
  UK: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  GLOBAL: 'Global',
};

const JURISDICTION_REGULATIONS: Record<string, string[]> = {
  US: ['CCPA', 'FTC Mail Order Rule'],
  EU: ['GDPR', 'EU Consumer Rights Directive'],
  UK: ['UK GDPR', 'Consumer Rights Act 2015'],
  CA: ['PIPEDA'],
  AU: ['Privacy Act 1988', 'Australian Consumer Law'],
  GLOBAL: [],
};

export default function ComplianceChecklist({ tenantId, onBrowseTemplates }: ComplianceChecklistProps) {
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompleteness();
  }, [tenantId]);

  const fetchCompleteness = async () => {
    setLoading(true);
    const result = await policyTemplateService.getCompleteness(tenantId);
    setCompleteness(result);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-4 animate-pulse">
        <div className="h-5 bg-neutral-200 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-neutral-100 rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!completeness) return null;

  const { jurisdiction, policies, overallScore } = completeness;
  const regulations = JURISDICTION_REGULATIONS[jurisdiction] ?? [];
  const missingRequired = policies.filter(p => p.status === 'missing' && p.required);
  const missingOptional = policies.filter(p => p.status === 'missing' && !p.required);
  const partial = policies.filter(p => p.status === 'partial');

  const scoreColor = overallScore >= 80 ? 'text-green-600' : overallScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = overallScore >= 80 ? 'bg-green-50 border-green-200' : overallScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="space-y-3">
      {/* Overall score + jurisdiction */}
      <div className={`border ${scoreBg} rounded-xl p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-neutral-700" />
            <span className="font-semibold text-neutral-900">Compliance Status</span>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${scoreColor}`}>{overallScore}%</span>
            <span className="text-xs text-neutral-500 ml-2">complete</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
          <span>Jurisdiction: <strong>{JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}</strong></span>
          {regulations.length > 0 && (
            <span className="text-neutral-400">·</span>
          )}
          {regulations.map(reg => (
            <span key={reg} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {reg}
            </span>
          ))}
        </div>
      </div>

      {/* Policy checklist */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">Policy Checklist</h3>
        <div className="space-y-2">
          {policies.map(policy => {
            const label = POLICY_LABELS[policy.policyType] ?? policy.policyType;
            const icon = policy.status === 'complete'
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : policy.status === 'partial'
                ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                : <XCircle className="h-4 w-4 text-red-500" />;

            const statusText = policy.status === 'complete'
              ? 'Configured'
              : policy.status === 'partial'
                ? 'Needs improvement'
                : policy.required
                  ? 'Required — missing'
                  : 'Not configured';

            return (
              <div key={policy.policyType} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="text-sm text-neutral-700">{label}</span>
                  {policy.required && (
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">Required</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${policy.status === 'complete' ? 'text-green-600' : policy.status === 'partial' ? 'text-amber-600' : 'text-red-600'}`}>
                    {statusText}
                  </span>
                  {policy.status !== 'complete' && onBrowseTemplates && (
                    <button
                      onClick={onBrowseTemplates}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Use template →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {(missingRequired.length > 0 || partial.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {missingRequired.length > 0 && (
                <p className="text-sm text-amber-800">
                  <strong>{missingRequired.length}</strong> required {missingRequired.length === 1 ? 'policy is' : 'policies are'} missing: {missingRequired.map(p => POLICY_LABELS[p.policyType]).join(', ')}
                </p>
              )}
              {partial.length > 0 && (
                <p className="text-sm text-amber-700">
                  <strong>{partial.length}</strong> {partial.length === 1 ? 'policy needs' : 'policies need'} more detail: {partial.map(p => POLICY_LABELS[p.policyType]).join(', ')}
                </p>
              )}
              {onBrowseTemplates && (
                <button
                  onClick={onBrowseTemplates}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                >
                  Browse templates to fill gaps →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
