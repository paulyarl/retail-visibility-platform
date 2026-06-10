'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, MessageSquare, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTicketPage() {
  const router = useRouter();
  const { customer } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string; logo: string | null; orderCount: number }[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer?.email) {
      loadOrders();
    }
  }, [customer?.email]);

  const loadOrders = async () => {
    if (!customer?.email) return;
    try {
      const result = await customerOrderService.getCustomerOrders(customer.email, 1, 50);
      setOrders(result.orders);

      // Derive unique tenants from orders
      const tenantMap = new Map<string, { name: string; logo: string | null; orderCount: number }>();
      for (const order of result.orders) {
        const existing = tenantMap.get(order.tenantId);
        if (existing) {
          existing.orderCount++;
        } else {
          tenantMap.set(order.tenantId, {
            name: order.tenantName,
            logo: order.tenantLogo,
            orderCount: 1,
          });
        }
      }
      setTenants(Array.from(tenantMap.entries()).map(([id, data]) => ({ id, ...data })));
    } catch (err) {
      console.error('[New Ticket] Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId || !title.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      const ticket = await crmCustomerService.createTicket({
        tenant_id: selectedTenantId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority: 'medium',
      });
      router.push(`/account/support/${ticket.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 rounded w-1/3" />
          <div className="h-40 bg-neutral-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Back link */}
      <Link href="/account/support" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 mb-4">
        <ChevronLeft className="w-4 h-4" />
        Back to Support
      </Link>

      <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-amber-500" />
        New Support Ticket
      </h1>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">You need at least one order with a merchant before creating a support ticket.</p>
            <Link href="/directory" className="text-sm text-amber-600 hover:text-amber-700 font-medium mt-2 inline-block">
              Browse stores
            </Link>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Select Merchant */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Which merchant is this about? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tenants.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTenantId(t.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    selectedTenantId === t.id
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {t.logo ? (
                    <img src={t.logo} alt={t.name} className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-500">
                      {t.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.orderCount} order{t.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            >
              <option value="general">General</option>
              <option value="order">Order Issue</option>
              <option value="product">Product Question</option>
              <option value="billing">Billing</option>
              <option value="return">Return / Refund</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief summary of your issue"
              required
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={4}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            type="submit"
            disabled={submitting || !selectedTenantId || !title.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Ticket'}
          </Button>
        </form>
      )}
    </div>
  );
}
