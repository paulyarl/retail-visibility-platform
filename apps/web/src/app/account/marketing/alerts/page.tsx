'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Check, X, CheckCheck } from 'lucide-react';
import marketingCustomerService, { CustomerAlert } from '@/services/MarketingCustomerService';

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MarketingAlertsPage() {
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getAlerts();
        setAlerts(data.filter((a) => !a.isDismissed));
      } catch (err: any) {
        setError(err.message || 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleMarkRead = async (alertId: string) => {
    try {
      await marketingCustomerService.markAlertRead(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)));
    } catch (err: any) {
      setError(err.message || 'Failed to mark alert');
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await marketingCustomerService.dismissAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err: any) {
      setError(err.message || 'Failed to dismiss alert');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await marketingCustomerService.markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch (err: any) {
      setError(err.message || 'Failed to mark all read');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/account/marketing" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back to My Services
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">Updates about your marketing services</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
      )}

      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>You're all caught up. No new notifications.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 ${!alert.isRead ? 'bg-blue-50/30' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !alert.isRead ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <Bell className={`w-4 h-4 ${!alert.isRead ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
                    {!alert.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  {alert.body && <p className="text-sm text-gray-600 mt-1">{alert.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(alert.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
