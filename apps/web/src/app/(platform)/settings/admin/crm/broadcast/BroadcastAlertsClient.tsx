'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTenantSummary, AlertType } from '@/types/crm';

const ALERT_TYPE_PRESETS = [
  { type: 'info' as AlertType, label: 'Announcement', icon: '📢', color: 'blue', description: 'General platform news or updates' },
  { type: 'warning' as AlertType, label: 'Security Alert', icon: '🔒', color: 'red', description: 'Security incident or vulnerability notice' },
  { type: 'warning' as AlertType, label: 'Emergency', icon: '🚨', color: 'red', description: 'Critical issue requiring immediate attention' },
  { type: 'info' as AlertType, label: 'Promotion', icon: '🎉', color: 'amber', description: 'Feature promotion or special offer' },
  { type: 'milestone' as AlertType, label: 'Milestone', icon: '🏆', color: 'purple', description: 'Platform achievement or anniversary' },
  { type: 'congratulations' as AlertType, label: 'Congratulations', icon: '✨', color: 'green', description: 'Celebratory message for tenants' },
  { type: 'subscription' as AlertType, label: 'Subscription', icon: '💳', color: 'indigo', description: 'Billing or subscription-related notice' },
  { type: 'info' as AlertType, label: 'Maintenance', icon: '🔧', color: 'blue', description: 'Scheduled maintenance or downtime' },
];

const TIER_LABELS: Record<string, string> = {
  chain_starter: 'Chain Starter',
  commitment: 'Commitment',
  organization: 'Organization',
  enterprise: 'Enterprise',
  discovery: 'Discovery',
  chain_professional: 'Chain Professional',
  ecommerce: 'E-commerce',
  omnichannel: 'Omnichannel',
  professional: 'Professional',
  storefront: 'Storefront',
};

export default function BroadcastAlertsClient() {
  const [tenants, setTenants] = useState<CrmTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendToAll, setSendToAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [alertForm, setAlertForm] = useState({
    type: 'info' as AlertType,
    title: '',
    body: '',
    icon: '📢',
    ctaLabel: '',
    ctaHref: '',
  });
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await crmAdminService.listTenants({ limit: 500 });
        setTenants(result.data);
      } catch (err) {
        console.error('[Broadcast] Load tenants error:', err);
        setError('Failed to load tenants');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const availableTiers = useMemo(() => {
    const tiers = new Set<string>();
    tenants.forEach(t => { if (t.subscription_tier) tiers.add(t.subscription_tier); });
    return Array.from(tiers).sort();
  }, [tenants]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    tenants.forEach(t => { if (t.subscription_status) statuses.add(t.subscription_status); });
    return Array.from(statuses).sort();
  }, [tenants]);

  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    tenants.forEach(t => { if (t.location_status) locations.add(t.location_status); });
    return Array.from(locations).sort();
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      if (tierFilter !== 'all' && t.subscription_tier !== tierFilter) return false;
      if (statusFilter !== 'all' && t.subscription_status !== statusFilter) return false;
      if (locationFilter !== 'all' && t.location_status !== locationFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.email && t.email.toLowerCase().includes(q));
      }
      return true;
    });
  }, [tenants, searchQuery, tierFilter, statusFilter, locationFilter]);

  const toggleTenant = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = filteredTenants.every(t => next.has(t.id));
      if (allSelected) {
        filteredTenants.forEach(t => next.delete(t.id));
      } else {
        filteredTenants.forEach(t => next.add(t.id));
      }
      return next;
    });
  }, [filteredTenants]);

  const selectPreset = useCallback((preset: typeof ALERT_TYPE_PRESETS[0]) => {
    setAlertForm(prev => ({ ...prev, type: preset.type, icon: preset.icon }));
  }, []);

  const canSend = alertForm.title.trim() && (sendToAll || selectedIds.size > 0);

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const metadata: Record<string, any> = {};
      if (showCta && alertForm.ctaLabel.trim()) {
        metadata.cta_label = alertForm.ctaLabel.trim();
        metadata.cta_href = alertForm.ctaHref.trim() || undefined;
      }

      const result = await crmAdminService.broadcastAlert({
        send_to_all: sendToAll,
        tenant_ids: sendToAll ? undefined : Array.from(selectedIds),
        type: alertForm.type,
        title: alertForm.title.trim(),
        body: alertForm.body.trim() || undefined,
        icon: alertForm.icon,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      setSentResult({ count: result.count });
      setShowConfirm(false);
      setAlertForm({ type: 'info', title: '', body: '', icon: '📢', ctaLabel: '', ctaHref: '' });
      setShowCta(false);
      setSelectedIds(new Set());
      setSendToAll(false);
    } catch (err) {
      console.error('[Broadcast] Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send broadcast');
      setShowConfirm(false);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  const targetCount = sendToAll ? tenants.filter(t => t.subscription_status !== 'cancelled' && t.subscription_status !== 'canceled').length : selectedIds.size;

  return (
    <CrmPageShell
      title="Broadcast Alerts"
      subtitle="Send alerts to all or selected tenants"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Broadcast' },
      ]}
    >
      {/* Success banner */}
      {sentResult && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Broadcast sent successfully to {sentResult.count} {sentResult.count === 1 ? 'tenant' : 'tenants'}
            </p>
            <button
              onClick={() => setSentResult(null)}
              className="text-xs text-green-600 hover:underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Alert composition */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Type presets */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Alert Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALERT_TYPE_PRESETS.map(preset => {
                    const isSelected = alertForm.type === preset.type && alertForm.icon === preset.icon;
                    const colorClasses: Record<string, string> = {
                      blue: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                      red: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
                      amber: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                      purple: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
                      green: 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',
                      indigo: 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
                    };
                    return (
                      <button
                        key={preset.label}
                        onClick={() => selectPreset(preset)}
                        className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                          isSelected
                            ? colorClasses[preset.color]
                            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{preset.icon}</span>
                          <span className="text-xs font-medium">{preset.label}</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom type override */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Custom Type (optional)</label>
                <select
                  value={alertForm.type}
                  onChange={e => setAlertForm(prev => ({ ...prev, type: e.target.value as AlertType }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-neutral-900 dark:border-neutral-700"
                >
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="milestone">milestone</option>
                  <option value="subscription">subscription</option>
                  <option value="congratulations">congratulations</option>
                  <option value="welcome">welcome</option>
                  <option value="order">order</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={alertForm.title}
                  onChange={e => setAlertForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                  placeholder="e.g. Scheduled Maintenance — July 15"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Body</label>
                <Textarea
                  value={alertForm.body}
                  onChange={e => setAlertForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Detailed message for tenants..."
                  rows={4}
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={alertForm.icon}
                  onChange={e => setAlertForm(prev => ({ ...prev, icon: e.target.value }))}
                  className="w-20 px-3 py-2 border rounded-lg text-sm text-center dark:bg-neutral-900 dark:border-neutral-700"
                  placeholder="📢"
                />
              </div>

              {/* CTA toggle */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => setShowCta(!showCta)}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    showCta ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300 dark:border-neutral-600'
                  }`}>
                    {showCta && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  Include CTA (Call to Action)
                </button>
                {showCta && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">CTA Label</label>
                      <input
                        type="text"
                        value={alertForm.ctaLabel}
                        onChange={e => setAlertForm(prev => ({ ...prev, ctaLabel: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                        placeholder="e.g. Learn More, Read Details"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">CTA Link (URL)</label>
                      <input
                        type="text"
                        value={alertForm.ctaHref}
                        onChange={e => setAlertForm(prev => ({ ...prev, ctaHref: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                        placeholder="https://docs.example.com/maintenance"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Send button */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
              size="lg"
              className="w-full"
            >
              {sending ? <Spinner size="sm" /> : `Broadcast to ${targetCount} ${targetCount === 1 ? 'tenant' : 'tenants'}`}
            </Button>
            {!canSend && (
              <p className="text-xs text-neutral-500 text-center">
                {!alertForm.title.trim() ? 'Enter a title to continue' : sendToAll ? 'Ready to send to all tenants' : 'Select at least one tenant or toggle Send to All'}
              </p>
            )}
          </div>
        </div>

        {/* Right: Tenant selection */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recipients</CardTitle>
                <Badge variant={sendToAll ? 'success' : 'default'}>
                  {sendToAll ? 'All Tenants' : `${selectedIds.size} selected`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Send to all toggle */}
              <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                <input
                  type="checkbox"
                  checked={sendToAll}
                  onChange={e => {
                    setSendToAll(e.target.checked);
                    if (e.target.checked) setSelectedIds(new Set());
                  }}
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Send to All Tenants</p>
                  <p className="text-xs text-neutral-500">Broadcast to every active tenant (excludes cancelled)</p>
                </div>
                <span className="text-2xl">🌐</span>
              </label>

              {/* Search + filter (disabled when sendToAll) */}
              <div className={`space-y-3 ${sendToAll ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, or email..."
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide self-center mr-1">Tier</span>
                    <button
                      onClick={() => setTierFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        tierFilter === 'all'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      All
                    </button>
                    {availableTiers.map(tier => (
                      <button
                        key={tier}
                        onClick={() => setTierFilter(tier)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          tierFilter === tier
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {TIER_LABELS[tier] || tier}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide self-center mr-1">Sub</span>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        statusFilter === 'all'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      All
                    </button>
                    {availableStatuses.map(status => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                          statusFilter === status
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide self-center mr-1">Loc</span>
                    <button
                      onClick={() => setLocationFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        locationFilter === 'all'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      All
                    </button>
                    {availableLocations.map(loc => (
                      <button
                        key={loc}
                        onClick={() => setLocationFilter(loc)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                          locationFilter === loc
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select all filtered */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleAllFiltered}
                    className="text-xs font-medium text-amber-600 hover:underline"
                  >
                    {filteredTenants.every(t => selectedIds.has(t.id)) && filteredTenants.length > 0
                      ? 'Deselect all visible'
                      : 'Select all visible'}
                  </button>
                  <span className="text-xs text-neutral-500">
                    {filteredTenants.length} {filteredTenants.length === 1 ? 'tenant' : 'tenants'}
                  </span>
                </div>

                {/* Tenant checklist */}
                <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-[420px] overflow-y-auto">
                  {filteredTenants.length === 0 ? (
                    <p className="text-center text-sm text-neutral-500 py-8">No tenants match your filters</p>
                  ) : (
                    filteredTenants.map(tenant => {
                      const isSelected = selectedIds.has(tenant.id);
                      return (
                        <label
                          key={tenant.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-neutral-100 dark:border-neutral-800 last:border-0 transition-colors ${
                            isSelected ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTenant(tenant.id)}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tenant.name}</p>
                            <p className="text-xs text-neutral-500 truncate font-mono">{tenant.id}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tenant.subscription_tier && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                {TIER_LABELS[tenant.subscription_tier] || tenant.subscription_tier}
                              </span>
                            )}
                            {tenant.subscription_status && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                                tenant.subscription_status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : tenant.subscription_status === 'trial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                              }`}>
                                {tenant.subscription_status}
                              </span>
                            )}
                            {tenant.location_status && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                                tenant.location_status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : tenant.location_status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                              }`}>
                                {tenant.location_status}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <Modal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Broadcast"
          description={`You are about to send an alert to ${targetCount} ${targetCount === 1 ? 'tenant' : 'tenants'}`}
          size="md"
        >
          <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{alertForm.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{alertForm.title}</p>
                  {alertForm.body && <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 whitespace-pre-wrap">{alertForm.body}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="default">{alertForm.type}</Badge>
                    {showCta && alertForm.ctaLabel && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        CTA: {alertForm.ctaLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Warning for send-to-all */}
            {sendToAll && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  This will send the alert to <strong>every active tenant</strong> on the platform. Please verify the message content before confirming.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button type="button" onClick={handleSend} disabled={sending}>
              {sending ? <Spinner size="sm" /> : `Send to ${targetCount} ${targetCount === 1 ? 'tenant' : 'tenants'}`}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </CrmPageShell>
  );
}
