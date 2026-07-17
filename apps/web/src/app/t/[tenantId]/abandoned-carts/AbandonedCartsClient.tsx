'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Mail, Clock, CheckCircle2, DollarSign, RefreshCw, Send, Search, Filter } from 'lucide-react';
import { abandonedCartService, AbandonedCart, AbandonedCartSummary } from '@/services/AbandonedCartService';
import { clientLogger } from '@/lib/client-logger';

interface AbandonedCartsClientProps {
  tenantId: string;
}

export default function AbandonedCartsClient({ tenantId }: AbandonedCartsClientProps) {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [summary, setSummary] = useState<AbandonedCartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'email_sent' | 'converted'>('all');
  const [resending, setResending] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = { limit: pageSize, offset: (page - 1) * pageSize };
      if (filter === 'pending') {
        filters.converted = false;
        filters.recoveryEmailSent = false;
      } else if (filter === 'email_sent') {
        filters.recoveryEmailSent = true;
        filters.converted = false;
      } else if (filter === 'converted') {
        filters.converted = true;
      }

      const [cartsResult, summaryResult] = await Promise.all([
        abandonedCartService.getAbandonedCarts(tenantId, filters),
        abandonedCartService.getSummary(tenantId),
      ]);

      setCarts(cartsResult.carts);
      setTotal(cartsResult.total);
      setSummary(summaryResult);
    } catch (error) {
      clientLogger.error(error instanceof Error ? error : new Error('AbandonedCartsClient: Failed to fetch data'), { operation: 'fetch_data' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, filter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResend = async (cartId: string) => {
    setResending(cartId);
    try {
      const success = await abandonedCartService.resendRecoveryEmail(tenantId, cartId);
      if (success) {
        await fetchData();
      }
    } catch (error) {
      clientLogger.error(error instanceof Error ? error : new Error('AbandonedCartsClient: Failed to resend email'), { operation: 'resend_email', cartId });
    } finally {
      setResending(null);
    }
  };

  const filteredCarts = carts.filter(cart => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cart.customer_email?.toLowerCase().includes(q) ||
      cart.customer_name?.toLowerCase().includes(q) ||
      cart.cart_id?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(total / pageSize);

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Abandoned Carts</h1>
          <p className="text-sm text-gray-500 mt-1">Track and recover carts that weren&apos;t completed</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Abandoned</p>
                <p className="text-2xl font-bold">{summary?.totalAbandoned ?? 0}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Lost Value</p>
                <p className="text-2xl font-bold">{formatCurrency(summary?.totalValueCents ?? 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Recovered</p>
                <p className="text-2xl font-bold">{summary?.recoveredCount ?? 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Emails Sent</p>
                <p className="text-2xl font-bold">{summary?.emailsSentCount ?? 0}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as any); setPage(1); }}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="all">All Carts</option>
            <option value="pending">Pending Recovery</option>
            <option value="email_sent">Email Sent</option>
            <option value="converted">Converted</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, name, cart ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm w-full"
          />
        </div>
      </div>

      {/* Carts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Abandoned Carts ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : filteredCarts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No abandoned carts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Items</th>
                    <th className="pb-2 pr-4">Value</th>
                    <th className="pb-2 pr-4">Abandoned</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCarts.map((cart) => (
                    <tr key={cart.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{cart.customer_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{cart.customer_email || 'No email'}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-xs">
                          {cart.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="truncate max-w-[200px]">
                              {item.quantity}x {item.product_name}
                            </div>
                          ))}
                          {cart.items.length > 2 && (
                            <div className="text-gray-400">+{cart.items.length - 2} more</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium">{formatCurrency(cart.cart_value_cents)}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(cart.updated_at)}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {cart.converted ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Converted
                          </span>
                        ) : cart.recovery_email_sent ? (
                          <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                            <Mail className="h-3 w-3" /> Email Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-orange-600 text-xs font-medium">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {!cart.converted && cart.customer_email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResend(cart.id)}
                            disabled={resending === cart.id}
                          >
                            {resending === cart.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span className="ml-1">Resend</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
