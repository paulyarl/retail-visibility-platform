'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Save, FileText, AlertCircle, LayoutTemplate, RefreshCw } from 'lucide-react';
import { tenantStorefrontPolicyService } from '@/services/TenantStorefrontPolicyService';
import { policyTemplateService, OutdatedUsageRecord } from '@/services/PolicyTemplateService';
import TemplateGallery from './TemplateGallery';
import ComplianceChecklist from './ComplianceChecklist';

interface StorefrontPolicies {
  return_policy: string | null;
  shipping_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  refund_policy: string | null;
}

interface StorefrontPoliciesClientProps {
  tenantId: string;
  effectiveStorefrontType?: string;
}

const POLICY_FIELDS: Array<{
  key: keyof StorefrontPolicies;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: 'return_policy',
    label: 'Return Policy',
    description: 'Tell customers how and when they can return items',
    placeholder: '## Return Policy\n\nWe accept returns within 30 days of purchase...\n\n- Items must be in original condition\n- Refunds processed within 5-7 business days\n- Return shipping is the responsibility of the customer',
  },
  {
    key: 'shipping_policy',
    label: 'Shipping Policy',
    description: 'Explain shipping methods, timeframes, and costs',
    placeholder: '## Shipping Policy\n\nOrders are processed within 1-2 business days...\n\n- Standard shipping: 3-5 business days\n- Express shipping: 1-2 business days\n- Free shipping on orders over $50',
  },
  {
    key: 'refund_policy',
    label: 'Refund Policy',
    description: 'Describe your refund process and timelines',
    placeholder: '## Refund Policy\n\nRefunds are issued to the original payment method...\n\n- Full refunds within 30 days\n- Store credit after 30 days\n- Refunds processed within 5-7 business days',
  },
  {
    key: 'privacy_policy',
    label: 'Privacy Policy',
    description: 'Explain how you collect and use customer data',
    placeholder: '## Privacy Policy\n\nWe respect your privacy and protect your data...\n\n- We collect: name, email, shipping address\n- We use your data to fulfill orders\n- We never sell your personal information',
  },
  {
    key: 'terms_of_service',
    label: 'Terms of Service',
    description: 'Terms governing use of your storefront',
    placeholder: '## Terms of Service\n\nBy placing an order with us, you agree to these terms...\n\n- All sales subject to applicable taxes\n- Prices are subject to change without notice\n- We reserve the right to refuse service',
  },
];

export default function StorefrontPoliciesClient({ tenantId, effectiveStorefrontType }: StorefrontPoliciesClientProps) {
  const router = useRouter();
  const [policies, setPolicies] = useState<StorefrontPolicies>({
    return_policy: null,
    shipping_policy: null,
    privacy_policy: null,
    terms_of_service: null,
    refund_policy: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<keyof StorefrontPolicies>('return_policy');
  const [showTemplates, setShowTemplates] = useState(false);
  const [outdatedTemplates, setOutdatedTemplates] = useState<OutdatedUsageRecord[]>([]);

  useEffect(() => {
    fetchPolicies();
    policyTemplateService.getOutdatedUsage(tenantId).then(setOutdatedTemplates).catch(() => {});
  }, [tenantId]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const result = await tenantStorefrontPolicyService.getPolicies(tenantId);
      if (result) {
        setPolicies(result);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      setMessage({ type: 'error', text: 'Failed to load policies' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const result = await tenantStorefrontPolicyService.updatePolicies(tenantId, policies);
      if (result) {
        setPolicies(result);
        setMessage({ type: 'success', text: 'Policies saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to save policies' });
      }
    } catch (error) {
      console.error('Error saving policies:', error);
      setMessage({ type: 'error', text: 'Failed to save policies' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded mb-6"></div>
          <div className="h-64 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  const activeField = POLICY_FIELDS.find(f => f.key === activeTab)!;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Storefront Policies</h1>
          <p className="text-neutral-600 mt-1">
            Configure legal and compliance policies for your storefront
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Markdown supported</p>
            <p className="mt-1">Use markdown formatting (headings, lists, bold, etc.) for rich policy pages. These policies will be displayed on your public storefront.</p>
          </div>
        </div>
      </div>

      {outdatedTemplates.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <RefreshCw className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Policy template updates available</p>
              <p className="mt-1">
                {outdatedTemplates.length} policy template{outdatedTemplates.length > 1 ? 's have' : ' has'} been updated since you last applied {outdatedTemplates.length > 1 ? 'them' : 'it'}. Review and update to stay compliant.
              </p>
              <ul className="mt-2 space-y-1">
                {outdatedTemplates.map(r => (
                  <li key={r.id} className="text-xs">
                    <strong>{r.templateTitle || r.policyType.replace(/_/g, ' ')}</strong> — v{r.appliedVersion} → v{r.currentVersion}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowTemplates(true)}
                className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900"
              >
                Browse updated templates →
              </button>
            </div>
          </div>
        </div>
      )}

      <ComplianceChecklist
        tenantId={tenantId}
        onBrowseTemplates={() => setShowTemplates(true)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Policy Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Policy type tabs */}
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
            {POLICY_FIELDS.map((field) => (
              <button
                key={field.key}
                onClick={() => setActiveTab(field.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === field.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {field.label}
              </button>
            ))}
          </div>

          {/* Browse Templates toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                showTemplates
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-blue-600 hover:bg-blue-50'
              }`}
            >
              <LayoutTemplate className="h-4 w-4" />
              {showTemplates ? 'Hide Templates' : 'Browse Templates'}
            </button>
          </div>

          {/* Template Gallery */}
          {showTemplates && (
            <TemplateGallery
              tenantId={tenantId}
              effectiveStorefrontType={effectiveStorefrontType}
              policyTypeFilter={activeTab}
              onApplied={(policyType) => {
                fetchPolicies();
                setMessage({ type: 'success', text: `Template applied to ${policyType.replace(/_/g, ' ')}! Review and save.` });
                setTimeout(() => setMessage(null), 5000);
              }}
            />
          )}

          {/* Active policy editor */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900">{activeField.label}</h3>
              <p className="text-sm text-neutral-600">{activeField.description}</p>
            </div>
            <textarea
              value={policies[activeTab] || ''}
              onChange={(e) => setPolicies({ ...policies, [activeTab]: e.target.value || null })}
              placeholder={activeField.placeholder}
              rows={16}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg font-mono text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">
                {(policies[activeTab] || '').length} characters
              </span>
              {policies[activeTab] ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Configured
                </span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Not configured
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/t/${tenantId}/settings`)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Policies'}
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
