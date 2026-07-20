'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import {
  Users,
  MessageCircle,
  Store,
  Package,
  MapPin,
  UserCheck,
  Upload,
  RefreshCw,
  Flag,
  UserPlus,
  FileText,
  AlertTriangle,
  Mail,
  Type,
  Paperclip,
  MessageSquare,
  Globe,
  BarChart3,
  Save,
  AlertCircle,
  ArrowLeft,
  Lock,
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import { useCrmOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';

interface CrmOptionsSettings {
  crm_enabled: boolean;
  crm_inquiry_product_enabled: boolean;
  crm_inquiry_storefront_enabled: boolean;
  crm_inquiry_directory_enabled: boolean;
  crm_inquiry_anonymous: boolean;
  crm_inquiry_customer: boolean;
  crm_inquiry_assignment: boolean;
  crm_inquiry_auto_response: boolean;
  crm_contact_management: boolean;
  crm_contact_import: boolean;
  crm_contact_sync: boolean;
  crm_ticket_priority: boolean;
  crm_ticket_assignment: boolean;
  crm_ticket_templates: boolean;
  crm_ticket_escalation: boolean;
  crm_message_rich_text: boolean;
  crm_message_attachments: boolean;
  crm_message_templates: boolean;
  crm_customer_tickets: boolean;
  crm_dashboard_analytics: boolean;
  crm_requests_hub: boolean;
}

interface CrmOptionsPageProps {
  tenantId: string;
}

const DEFAULT_SETTINGS: CrmOptionsSettings = {
  crm_enabled: true,
  crm_inquiry_product_enabled: true,
  crm_inquiry_storefront_enabled: true,
  crm_inquiry_directory_enabled: true,
  crm_inquiry_anonymous: true,
  crm_inquiry_customer: true,
  crm_inquiry_assignment: true,
  crm_inquiry_auto_response: false,
  crm_contact_management: true,
  crm_contact_import: false,
  crm_contact_sync: false,
  crm_ticket_priority: true,
  crm_ticket_assignment: true,
  crm_ticket_templates: false,
  crm_ticket_escalation: false,
  crm_message_rich_text: false,
  crm_message_attachments: false,
  crm_message_templates: false,
  crm_customer_tickets: false,
  crm_dashboard_analytics: false,
  crm_requests_hub: false,
};

type FeatureGroup = {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: { key: keyof CrmOptionsSettings; label: string; description: string; icon: React.ReactNode }[];
};

const INQUIRY_SCOPE_GROUP: FeatureGroup = {
  title: 'Inquiry Channels',
  description: 'Control where customers can submit inquiries',
  icon: <MessageCircle className="h-5 w-5 text-indigo-600" />,
  features: [
    { key: 'crm_inquiry_product_enabled', label: 'Product Page Inquiries', description: 'Allow inquiries from product detail pages', icon: <Package className="h-5 w-5 text-indigo-600" /> },
    { key: 'crm_inquiry_storefront_enabled', label: 'Storefront Inquiries', description: 'Allow inquiries from your storefront page', icon: <Store className="h-5 w-5 text-indigo-600" /> },
    { key: 'crm_inquiry_directory_enabled', label: 'Directory Inquiries', description: 'Allow inquiries from directory listings', icon: <MapPin className="h-5 w-5 text-indigo-600" /> },
  ],
};

const INQUIRY_FEATURE_GROUP: FeatureGroup = {
  title: 'Inquiry Features',
  description: 'Advanced inquiry handling options',
  icon: <MessageCircle className="h-5 w-5 text-blue-600" />,
  features: [
    { key: 'crm_inquiry_anonymous', label: 'Anonymous Inquiries', description: 'Allow inquiries without requiring login', icon: <UserCheck className="h-5 w-5 text-blue-600" /> },
    { key: 'crm_inquiry_customer', label: 'Customer Inquiries', description: 'Allow registered customers to submit inquiries', icon: <Users className="h-5 w-5 text-blue-600" /> },
    { key: 'crm_inquiry_assignment', label: 'Inquiry Assignment', description: 'Auto-assign inquiries to team members', icon: <UserPlus className="h-5 w-5 text-blue-600" /> },
    { key: 'crm_inquiry_auto_response', label: 'Auto-Response', description: 'Send automatic acknowledgment emails', icon: <Mail className="h-5 w-5 text-blue-600" /> },
  ],
};

const CONTACT_GROUP: FeatureGroup = {
  title: 'Contact Management',
  description: 'Manage customer and lead contacts',
  icon: <Users className="h-5 w-5 text-green-600" />,
  features: [
    { key: 'crm_contact_management', label: 'Contact Management', description: 'Create, edit, and organize contacts', icon: <Users className="h-5 w-5 text-green-600" /> },
    { key: 'crm_contact_import', label: 'Contact Import', description: 'Bulk import contacts from CSV', icon: <Upload className="h-5 w-5 text-green-600" /> },
    { key: 'crm_contact_sync', label: 'Contact Sync', description: 'Sync contacts with external platforms', icon: <RefreshCw className="h-5 w-5 text-green-600" /> },
  ],
};

const TICKET_GROUP: FeatureGroup = {
  title: 'Ticket Management',
  description: 'Support ticket handling features',
  icon: <Flag className="h-5 w-5 text-amber-600" />,
  features: [
    { key: 'crm_ticket_priority', label: 'Ticket Priority', description: 'Set and filter by ticket priority levels', icon: <AlertTriangle className="h-5 w-5 text-amber-600" /> },
    { key: 'crm_ticket_assignment', label: 'Ticket Assignment', description: 'Assign tickets to specific agents', icon: <UserPlus className="h-5 w-5 text-amber-600" /> },
    { key: 'crm_ticket_templates', label: 'Ticket Templates', description: 'Use templates for common ticket types', icon: <FileText className="h-5 w-5 text-amber-600" /> },
    { key: 'crm_ticket_escalation', label: 'Ticket Escalation', description: 'Escalate tickets to higher tiers', icon: <AlertTriangle className="h-5 w-5 text-amber-600" /> },
  ],
};

const MESSAGE_GROUP: FeatureGroup = {
  title: 'Messaging Features',
  description: 'Enhanced message composition options',
  icon: <MessageSquare className="h-5 w-5 text-purple-600" />,
  features: [
    { key: 'crm_message_rich_text', label: 'Rich Text Messages', description: 'Format messages with rich text editor', icon: <Type className="h-5 w-5 text-purple-600" /> },
    { key: 'crm_message_attachments', label: 'Message Attachments', description: 'Attach files to ticket messages', icon: <Paperclip className="h-5 w-5 text-purple-600" /> },
    { key: 'crm_message_templates', label: 'Message Templates', description: 'Use canned responses and templates', icon: <FileText className="h-5 w-5 text-purple-600" /> },
  ],
};

const PORTAL_GROUP: FeatureGroup = {
  title: 'Customer Portal',
  description: 'Self-service features for customers',
  icon: <Globe className="h-5 w-5 text-teal-600" />,
  features: [
    { key: 'crm_customer_tickets', label: 'Customer Support Tickets', description: 'Allow customers to create and track support tickets', icon: <Globe className="h-5 w-5 text-teal-600" /> },
  ],
};

const DASHBOARD_GROUP: FeatureGroup = {
  title: 'Dashboard & Analytics',
  description: 'Reporting and dashboard features',
  icon: <BarChart3 className="h-5 w-5 text-orange-600" />,
  features: [
    { key: 'crm_dashboard_analytics', label: 'CRM Analytics', description: 'View CRM performance metrics and reports', icon: <BarChart3 className="h-5 w-5 text-orange-600" /> },
    { key: 'crm_requests_hub', label: 'Requests Hub', description: 'Unified hub for all customer requests', icon: <MessageSquare className="h-5 w-5 text-orange-600" /> },
  ],
};

const FEATURE_GROUPS: FeatureGroup[] = [
  INQUIRY_FEATURE_GROUP,
  CONTACT_GROUP,
  TICKET_GROUP,
  MESSAGE_GROUP,
  PORTAL_GROUP,
  DASHBOARD_GROUP,
];

export default function CrmOptionsPage({ tenantId }: CrmOptionsPageProps) {
  const { data: crmCap } = useCrmOptionsCapability(tenantId);
  const tierState = crmCap;
  const allCaps = useAllCapabilities(tenantId);

  const [settings, setSettings] = useState<CrmOptionsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    crmTenantCrmService.getOptions(tenantId)
      .then(({ settings: s }) => setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleToggle = (key: keyof CrmOptionsSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await crmTenantCrmService.updateOptions(tenantId, settings as unknown as Record<string, boolean>);
      setMessage({ type: 'success', text: 'CRM options saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const isTierAllowed = (key: string): boolean => {
    if (!tierState) return true;
    if (!tierState.enabled) return false;
    if (tierState.isFlexible) return true;

    // Inquiry scope gates
    if (key === 'crm_inquiry_product_enabled') return tierState.inquiryProductEnabled;
    if (key === 'crm_inquiry_storefront_enabled') return tierState.inquiryStorefrontEnabled;
    if (key === 'crm_inquiry_directory_enabled') return tierState.inquiryDirectoryEnabled;

    // Feature groups
    if (key.startsWith('crm_inquiry_')) return tierState.allowedInquiryTypes.includes(key as any);
    if (key.startsWith('crm_contact_')) return tierState.allowedContactTypes.includes(key as any);
    if (key.startsWith('crm_ticket_')) return tierState.allowedTicketTypes.includes(key as any);
    if (key.startsWith('crm_message_')) return tierState.allowedMessageTypes.includes(key as any);
    if (key === 'crm_customer_tickets') return tierState.allowedCustomerTicketTypes.includes('crm_customer_tickets');
    if (key.startsWith('crm_dashboard_') || key === 'crm_requests_hub') return tierState.allowedDashboardTypes.includes(key as any);

    return true;
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
      {/* Plan Summary Widget */}
      <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/t/${tenantId}/support`} className="p-2 rounded-md hover:bg-neutral-100 text-neutral-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            CRM Options
          </h1>
          <p className="text-neutral-500 mt-1">
            Manage CRM feature settings for your support hub
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

      {/* Not Available in Plan */}
      {!tierState?.enabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <Lock className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-800 mb-1">CRM Not Available</h3>
            <p className="text-amber-700 text-sm max-w-md mx-auto">
              Your current plan does not include CRM capabilities. Upgrade your subscription to unlock inquiry management, contact tracking, ticket support, and more.
            </p>
            <Link
              href={`/t/${tenantId}/settings/billing`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <Crown className="w-4 h-4" />
              Upgrade Plan
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Global CRM Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            CRM System
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable the CRM system for your tenant. When disabled, all CRM features are hidden.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-neutral-900">CRM Enabled</p>
                <p className="text-sm text-neutral-600">Show CRM management and support features</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!tierState?.enabled && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              <Switch
                id="crm-enabled-toggle"
                checked={settings.crm_enabled}
                onCheckedChange={() => handleToggle('crm_enabled')}
                disabled={!tierState?.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inquiry Scope */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {INQUIRY_SCOPE_GROUP.icon}
            {INQUIRY_SCOPE_GROUP.title}
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">{INQUIRY_SCOPE_GROUP.description}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {INQUIRY_SCOPE_GROUP.features.map(feature => {
              const isAllowed = isTierAllowed(feature.key);
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
                      disabled={!isAllowed || !settings.crm_enabled}
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
                const isAllowed = isTierAllowed(feature.key);
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
                        disabled={!isAllowed || !settings.crm_enabled}
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
          {saving ? 'Saving...' : 'Save CRM Options'}
        </Button>
      </div>
    </div>
  );
}
