'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  HelpCircle,
  Store,
  Package,
  FileText,
  MessageSquare,
  BarChart3,
  ArrowLeft,
  Save,
  AlertCircle,
  Upload,
  ListOrdered,
  Search,
  ThumbsUp,
  Bot,
} from 'lucide-react';
import Link from 'next/link';
import { useFaqOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { faqService } from '@/services/FaqService';
import FaqControlPanel from './FaqControlPanel';

interface FaqOptionsSettings {
  faq_enabled: boolean;
  faq_storefront_enabled: boolean;
  faq_product_enabled: boolean;
  faq_templates_enabled: boolean;
  faq_chatbot_knowledge_base: boolean;
  faq_management_hub: boolean;
  faq_management_import: boolean;
  faq_management_bulk_actions: boolean;
  faq_management_reorder: boolean;
  faq_management_search: boolean;
  faq_preview_bot: boolean;
  faq_preview_gap_report: boolean;
  faq_display_storefront_accordion: boolean;
  faq_display_product_accordion: boolean;
  faq_display_feedback: boolean;
  faq_display_bot_handoff: boolean;
  faq_kb_coverage_metrics: boolean;
  faq_kb_auto_sync: boolean;
}

interface FaqOptionsPageProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: FaqOptionsSettings = {
  faq_enabled: true,
  faq_storefront_enabled: true,
  faq_product_enabled: true,
  faq_templates_enabled: true,
  faq_chatbot_knowledge_base: false,
  faq_management_hub: true,
  faq_management_import: true,
  faq_management_bulk_actions: true,
  faq_management_reorder: true,
  faq_management_search: true,
  faq_preview_bot: false,
  faq_preview_gap_report: false,
  faq_display_storefront_accordion: true,
  faq_display_product_accordion: true,
  faq_display_feedback: true,
  faq_display_bot_handoff: false,
  faq_kb_coverage_metrics: false,
  faq_kb_auto_sync: false,
};

type FeatureGroup = {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: { key: keyof FaqOptionsSettings; label: string; description: string; icon: React.ReactNode; tierGate?: string }[];
};

// Scope group gates — control what FAQ types can exist
const SCOPE_GROUP: FeatureGroup = {
  title: 'FAQ Scope',
  description: 'Control which types of FAQs can be created and displayed',
  icon: <Store className="h-5 w-5 text-indigo-600" />,
  features: [
    { key: 'faq_storefront_enabled', label: 'Storefront FAQs', description: 'Create and display FAQs on your storefront page', icon: <Store className="h-5 w-5 text-indigo-600" />, tierGate: 'storefront' },
    { key: 'faq_product_enabled', label: 'Product FAQs', description: 'Create and display FAQs on product detail pages', icon: <Package className="h-5 w-5 text-indigo-600" />, tierGate: 'product' },
    { key: 'faq_templates_enabled', label: 'Templates', description: 'Use templates to create FAQs from predefined patterns', icon: <FileText className="h-5 w-5 text-indigo-600" />, tierGate: 'templates' },
  ],
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'FAQ Management',
    description: 'Control which management features are available in the FAQ Hub',
    icon: <HelpCircle className="h-5 w-5 text-blue-600" />,
    features: [
      { key: 'faq_management_hub', label: 'FAQ Hub', description: 'Full FAQ management hub with all tabs', icon: <HelpCircle className="h-5 w-5 text-blue-600" /> },
      { key: 'faq_management_import', label: 'CSV Import', description: 'CSV upload, column mapping, preview, import', icon: <Upload className="h-5 w-5 text-blue-600" /> },
      { key: 'faq_management_bulk_actions', label: 'Bulk Actions', description: 'Bulk activate, deactivate, delete, change category', icon: <ListOrdered className="h-5 w-5 text-blue-600" /> },
      { key: 'faq_management_reorder', label: 'Reorder', description: 'Drag-and-drop display order control', icon: <ListOrdered className="h-5 w-5 text-blue-600" /> },
      { key: 'faq_management_search', label: 'Search', description: 'Real-time debounced search across question, answer, tags', icon: <Search className="h-5 w-5 text-blue-600" /> },
    ],
  },
  {
    title: 'Public Display',
    description: 'Control how FAQs appear to customers on your storefront and product pages',
    icon: <Store className="h-5 w-5 text-green-600" />,
    features: [
      { key: 'faq_display_storefront_accordion', label: 'Storefront Accordion', description: 'Accordion-style FAQ display on storefront', icon: <Store className="h-5 w-5 text-green-600" />, tierGate: 'storefront' },
      { key: 'faq_display_product_accordion', label: 'Product Accordion', description: 'Accordion-style FAQ display on product pages', icon: <Package className="h-5 w-5 text-green-600" />, tierGate: 'product' },
      { key: 'faq_display_feedback', label: 'Feedback Buttons', description: 'Thumbs up/down + Suggest Edit on each answer', icon: <ThumbsUp className="h-5 w-5 text-green-600" /> },
      { key: 'faq_display_bot_handoff', label: 'Bot Handoff', description: 'Ask our bot CTA in FAQ sections', icon: <Bot className="h-5 w-5 text-green-600" /> },
    ],
  },
  {
    title: 'Bot & Preview',
    description: 'Advanced chatbot integration features (requires higher tier)',
    icon: <MessageSquare className="h-5 w-5 text-purple-600" />,
    features: [
      { key: 'faq_preview_bot', label: 'Bot Preview', description: 'Test questions, see matched FAQ + confidence', icon: <Bot className="h-5 w-5 text-purple-600" /> },
      { key: 'faq_preview_gap_report', label: 'Gap Report', description: 'Unanswered queries ranked by frequency', icon: <BarChart3 className="h-5 w-5 text-purple-600" /> },
    ],
  },
  {
    title: 'Knowledge Base',
    description: 'Chatbot integration and coverage analytics (requires higher tier)',
    icon: <MessageSquare className="h-5 w-5 text-orange-600" />,
    features: [
      { key: 'faq_chatbot_knowledge_base', label: 'Chatbot Knowledge Base', description: 'Feed FAQs into chatbot responses', icon: <MessageSquare className="h-5 w-5 text-orange-600" /> },
      { key: 'faq_kb_coverage_metrics', label: 'Coverage Metrics', description: 'Coverage score, category coverage, product coverage dashboard', icon: <BarChart3 className="h-5 w-5 text-orange-600" /> },
      { key: 'faq_kb_auto_sync', label: 'Inquiry-to-FAQ Curation', description: 'Create draft FAQs directly from customer inquiries', icon: <HelpCircle className="h-5 w-5 text-orange-600" /> },
    ],
  },
];

export default function FaqOptionsPage({ tenantId }: FaqOptionsPageProps) {
  const { data: faqCap } = useFaqOptionsCapability(tenantId, { forTenant: true });
  const tierState = faqCap;

  const [settings, setSettings] = useState<FaqOptionsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    faqService.getOptions(tenantId)
      .then(({ settings: s }) => setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleToggle = (key: keyof FaqOptionsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await faqService.updateOptions(tenantId, settings as unknown as Record<string, boolean>);
      setMessage({ type: 'success', text: 'FAQ options saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const isTierAllowed = (key: string, tierGate?: string): boolean => {
    if (!tierState) return true; // fail-open if tier not loaded
    if (!tierState.enabled) return false;
    if (tierState.isFlexible) return true;
    // Scope group gates
    if (tierGate === 'storefront') return tierState.storefrontEnabled;
    if (tierGate === 'product') return tierState.productEnabled;
    if (tierGate === 'templates') return tierState.templatesEnabled;
    // Feature-level gates
    const allAllowed = [
      ...tierState.allowedManagementTypes,
      ...tierState.allowedPreviewTypes,
      ...tierState.allowedDisplayTypes,
      ...tierState.allowedKbTypes,
    ];
    return allAllowed.includes(key as any);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-neutral-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/t/${tenantId}/faq`} className="p-2 rounded-md hover:bg-neutral-100 text-neutral-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            FAQ Options
          </h1>
          <p className="text-neutral-500 mt-1">
            Manage FAQ feature settings for your storefront and products
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Global FAQ Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            FAQ System
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable the FAQ system for your storefront. When disabled, no FAQ sections will appear and management is hidden.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-neutral-900">FAQ Enabled</p>
                <p className="text-sm text-neutral-600">Show FAQ management and display sections</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!tierState?.enabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="faq-enabled-toggle"
                checked={settings.faq_enabled}
                onCheckedChange={() => handleToggle('faq_enabled')}
                disabled={!tierState?.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scope Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {SCOPE_GROUP.icon}
            {SCOPE_GROUP.title}
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">{SCOPE_GROUP.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SCOPE_GROUP.features.map(feature => {
              const isAllowed = isTierAllowed(feature.key, feature.tierGate);
              const isChecked = isAllowed && settings[feature.key];
              const IconComp = feature.icon;
              return (
                <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {IconComp}
                    <div>
                      <p className="font-medium text-neutral-900">{feature.label}</p>
                      <p className="text-sm text-neutral-600">{feature.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isAllowed && (
                      <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                    )}
                    <Switch
                      id={`${feature.key}-toggle`}
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(feature.key)}
                      disabled={!isAllowed || !settings.faq_enabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feature Groups */}
      {FEATURE_GROUPS.map(group => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {group.icon}
              {group.title}
            </CardTitle>
            <p className="text-sm text-neutral-600 mt-1">{group.description}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {group.features.map(feature => {
                const isAllowed = isTierAllowed(feature.key, feature.tierGate);
                const isChecked = isAllowed && settings[feature.key];
                const IconComp = feature.icon;
                return (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {IconComp}
                      <div>
                        <p className="font-medium text-neutral-900">{feature.label}</p>
                        <p className="text-sm text-neutral-600">{feature.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                      )}
                      <Switch
                        id={`${feature.key}-toggle`}
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(feature.key)}
                        disabled={!isAllowed || !settings.faq_enabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save FAQ Options'}
        </Button>
      </div>

      {/* Coverage Dashboard */}
      {settings.faq_enabled && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">Coverage Dashboard</h2>
          <FaqControlPanel tenantId={tenantId} />
        </div>
      )}
    </div>
  );
}
