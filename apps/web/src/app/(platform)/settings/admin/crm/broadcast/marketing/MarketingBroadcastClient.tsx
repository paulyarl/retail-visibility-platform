'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Modal, ModalFooter, Textarea } from '@/components/ui';
import { marketingOpsService, type MarketingAlertCustomer, type MarketingAlertHistory } from '@/services/MarketingOpsService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import { clientLogger } from '@/lib/client-logger';

const ALERT_TYPE_PRESETS = [
  { type: 'info', label: 'Announcement', icon: '📢', color: 'blue', description: 'General update or news' },
  { type: 'milestone', label: 'Milestone', icon: '🏆', color: 'purple', description: 'Campaign milestone reached' },
  { type: 'congratulations', label: 'Congratulations', icon: '✨', color: 'green', description: 'Celebratory message' },
  { type: 'warning', label: 'Service Notice', icon: '🔧', color: 'amber', description: 'Maintenance or service update' },
  { type: 'subscription', label: 'Subscription', icon: '💳', color: 'indigo', description: 'Billing or subscription notice' },
  { type: 'info', label: 'Promotion', icon: '🎉', color: 'amber', description: 'Upgrade or cross-sell offer' },
];

export default function MarketingBroadcastClient() {
  const [customers, setCustomers] = useState<MarketingAlertCustomer[]>([]);
  const [history, setHistory] = useState<MarketingAlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendToAll, setSendToAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  const [alertForm, setAlertForm] = useState({
    alertType: 'info',
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
        const [customerList, alertHistory] = await Promise.all([
          marketingOpsService.listMarketingAlertCustomers(),
          marketingOpsService.listMarketingAlerts(),
        ]);
        setCustomers(customerList);
        setHistory(alertHistory.alerts);
      } catch (err) {
        clientLogger.error('[MktBroadcast] Load error:', { detail: err });
        setError('Failed to load marketing customers');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch recipient count when send mode changes
  useEffect(() => {
    if (!showConfirm) return;
    marketingOpsService
      .getAlertRecipientCount({ type: 'mkt_broadcast' })
      .then(setRecipientCount)
      .catch(() => setRecipientCount(null));
  }, [showConfirm]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) => c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.customerNumber.toLowerCase().includes(q),
    );
  }, [customers, searchQuery]);

  const toggleCustomer = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = filteredCustomers.every((c) => next.has(c.id));
      if (allSelected) {
        filteredCustomers.forEach((c) => next.delete(c.id));
      } else {
        filteredCustomers.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }, [filteredCustomers]);

  const selectPreset = useCallback((preset: typeof ALERT_TYPE_PRESETS[0]) => {
    setAlertForm((prev) => ({ ...prev, alertType: preset.type, icon: preset.icon }));
  }, []);

  const canSend = alertForm.title.trim() && (sendToAll || selectedIds.size > 0);

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      // For broadcast: send one alert with no target metadata (all platform-context customers see it)
      // For targeted: send one alert per selected customer with mkt_direct type
      if (sendToAll) {
        await marketingOpsService.createMarketingAlert({
          type: 'mkt_broadcast',
          alertType: alertForm.alertType,
          title: alertForm.title.trim(),
          body: alertForm.body.trim() || undefined,
          icon: alertForm.icon,
          ctaLabel: showCta ? alertForm.ctaLabel.trim() || undefined : undefined,
          ctaHref: showCta ? alertForm.ctaHref.trim() || undefined : undefined,
        });
        setSentResult({ count: recipientCount ?? customers.length });
      } else {
        // Send targeted alerts to each selected customer
        let sent = 0;
        for (const customerId of selectedIds) {
          await marketingOpsService.createMarketingAlert({
            type: 'mkt_direct',
            alertType: alertForm.alertType,
            title: alertForm.title.trim(),
            body: alertForm.body.trim() || undefined,
            icon: alertForm.icon,
            customerId,
            ctaLabel: showCta ? alertForm.ctaLabel.trim() || undefined : undefined,
            ctaHref: showCta ? alertForm.ctaHref.trim() || undefined : undefined,
          });
          sent++;
        }
        setSentResult({ count: sent });
      }

      // Refresh history
      const refreshed = await marketingOpsService.listMarketingAlerts();
      setHistory(refreshed.alerts);

      setShowConfirm(false);
      setAlertForm({ alertType: 'info', title: '', body: '', icon: '📢', ctaLabel: '', ctaHref: '' });
      setShowCta(false);
      setSelectedIds(new Set());
      setSendToAll(false);
    } catch (err) {
      clientLogger.error('[MktBroadcast] Send error:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to send alert');
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

  const targetCount = sendToAll ? recipientCount ?? customers.length : selectedIds.size;

  return (
    <CrmPageShell
      title="Marketing Broadcast"
      subtitle="Send alerts to marketing customers (platform-context only)"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Broadcast', href: '/settings/admin/crm/broadcast' },
        { label: 'Marketing' },
      ]}
    >
      {/* Success banner */}
      {sentResult && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Alert sent successfully to {sentResult.count} {sentResult.count === 1 ? 'customer' : 'customers'}
            </p>
            <button onClick={() => setSentResult(null)} className="text-xs text-green-600 hover:underline mt-1">
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
            <button onClick={() => setError(null)} className="text-xs text-red-600 hover:underline mt-1">
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
                  {ALERT_TYPE_PRESETS.map((preset) => {
                    const isSelected = alertForm.alertType === preset.type && alertForm.icon === preset.icon;
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

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={alertForm.title}
                  onChange={(e) => setAlertForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                  placeholder="e.g. Your campaign has been delivered!"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Body</label>
                <Textarea
                  value={alertForm.body}
                  onChange={(e) => setAlertForm((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Detailed message for customers..."
                  rows={4}
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={alertForm.icon}
                  onChange={(e) => setAlertForm((prev) => ({ ...prev, icon: e.target.value }))}
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
                  <span
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      showCta ? 'bg-amber-500 border-amber-500 text-white' : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {showCta && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
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
                        onChange={(e) => setAlertForm((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                        placeholder="e.g. View Campaign, Upgrade Now"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">CTA Link</label>
                      <input
                        type="text"
                        value={alertForm.ctaHref}
                        onChange={(e) => setAlertForm((prev) => ({ ...prev, ctaHref: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Send button */}
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={!canSend}
            className="w-full"
            size="lg"
          >
            {sendToAll
              ? `Broadcast to all marketing customers`
              : `Send to ${selectedIds.size} ${selectedIds.size === 1 ? 'customer' : 'customers'}`}
          </Button>
        </div>

        {/* Right: Recipient picker + history */}
        <div className="lg:col-span-3 space-y-4">
          {/* Recipient picker */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recipients ({customers.length} marketing customers)</CardTitle>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendToAll}
                    onChange={(e) => {
                      setSendToAll(e.target.checked);
                      if (e.target.checked) setSelectedIds(new Set());
                    }}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-neutral-700 dark:text-neutral-300">Send to all</span>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {sendToAll ? (
                <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                  <span className="text-3xl block mb-2">📡</span>
                  <p className="text-sm">
                    This alert will be visible to <strong>all {customers.length} marketing customers</strong> with claimed campaigns.
                  </p>
                  <p className="text-xs mt-1 text-neutral-400">Each customer sees it in their portal Notifications.</p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or customer #..."
                    className="w-full px-3 py-2 mb-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-neutral-900 dark:border-neutral-700"
                  />
                  {/* Select all */}
                  <button
                    onClick={toggleAllFiltered}
                    className="text-xs text-amber-600 hover:underline mb-2 block"
                  >
                    {filteredCustomers.every((c) => selectedIds.has(c.id))
                      ? 'Deselect all filtered'
                      : 'Select all filtered'}
                  </button>
                  {/* Customer list */}
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">No customers found</p>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <label
                          key={customer.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(customer.id)}
                            onChange={() => toggleCustomer(customer.id)}
                            className="rounded border-neutral-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{customer.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{customer.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {customer.campaignCount} {customer.campaignCount === 1 ? 'campaign' : 'campaigns'}
                            </span>
                            {customer.lastBusinessName && (
                              <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">{customer.lastBusinessName}</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sent alerts history */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sent Alerts ({history.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                      <span className="text-xl">{alert.icon || '📢'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{alert.title}</p>
                        {alert.body && <p className="text-xs text-neutral-500 truncate">{alert.body}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="default">{alert.targetType.replace('mkt_', '')}</Badge>
                          <span className="text-[10px] text-neutral-400">
                            {new Date(alert.createdAt).toLocaleDateString()} · {alert.recipientCount} recipients · {alert.readCount} read
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <Modal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Alert"
          description={`You are about to send an alert to ${targetCount} ${targetCount === 1 ? 'customer' : 'customers'}`}
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
                    <Badge variant="default">{alertForm.alertType}</Badge>
                    {showCta && alertForm.ctaLabel && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">CTA: {alertForm.ctaLabel}</span>
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
                  This will be visible to <strong>every marketing customer</strong> with claimed campaigns. Please verify the message content before confirming.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSend} disabled={sending}>
              {sending ? <Spinner size="sm" /> : `Send to ${targetCount} ${targetCount === 1 ? 'customer' : 'customers'}`}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </CrmPageShell>
  );
}
