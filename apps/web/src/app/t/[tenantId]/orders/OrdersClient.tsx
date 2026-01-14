'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Package, Search, Filter, Download, Eye, CheckCircle2, Clock, ShoppingBag, XCircle, Settings, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
}

interface Order {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping' | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
  items: OrderItem[];
  createdAt: string;
  paidAt: string;
  trackingNumber?: string;
  shippingAddress?: any;
  payment?: {
    id: string;
    gatewayTransactionId: string;
    method: string;
    amount: number;
    status: string;
  };
  refunds?: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string;
  }>;
}

interface OrdersClientProps {
  tenantId: string;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function OrdersClient({ tenantId, searchParams }: OrdersClientProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'cancelled' | 'archived'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [tenantId, currentPage, pageSize, statusFilter]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy: 'created_at',
        sortOrder: 'desc'
      });
      
      // Add archived filter if selected
      if (statusFilter === 'archived') {
        params.append('archived', 'true');
      } else if (statusFilter !== 'all') {
        params.append('fulfillmentStatus', statusFilter);
      }
      
      const response = await api.get(`/api/tenants/${tenantId}/orders?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      
      console.log('[OrdersClient] API Response:', {
        success: data.success,
        ordersCount: data.data?.orders?.length,
        pagination: data.data?.pagination,
        firstOrder: data.data?.orders?.[0]
      });
      
      if (data.success && data.data) {
        setOrders(data.data.orders || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
        setTotalCount(data.data.pagination?.total || 0);
        console.log('[OrdersClient] State updated:', {
          ordersCount: data.data.orders?.length,
          totalPages: data.data.pagination?.totalPages,
          totalCount: data.data.pagination?.total
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    console.log('[OrdersClient] filterOrders called:', {
      ordersCount: orders.length,
      searchQuery,
      hasSearchQuery: !!searchQuery.trim()
    });

    // Search filter (status filtering now handled by API)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(query) ||
        order.customerEmail?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.items.some(item => 
          item.name.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query)
        )
      );
    }

    console.log('[OrdersClient] After filtering:', {
      filteredCount: filtered.length
    });

    setFilteredOrders(filtered);
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      unfulfilled: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pending' },
      partially_fulfilled: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package, label: 'Partially Fulfilled' },
      fulfilled: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Fulfilled' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Cancelled' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.unfulfilled;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {badge.label}
      </span>
    );
  };

  const archiveOrder = async (orderId: string) => {
    try {
      setArchiving(orderId);
      
      const response = await api.put(`/api/tenants/${tenantId}/orders/${orderId}/archive`, {
        archived: true
      });
      
      if (!response.ok) throw new Error('Failed to archive order');
      
      // Refresh orders list
      await fetchOrders();
    } catch (error) {
      console.error('Error archiving order:', error);
      alert('Failed to archive order. Please try again.');
    } finally {
      setArchiving(null);
    }
  };

  const exportOrders = () => {
    const csv = [
      ['Order Number', 'Date', 'Status', 'Customer', 'Email', 'Items', 'Total'].join(','),
      ...filteredOrders.map(order => [
        order.orderNumber,
        formatDate(new Date(order.paidAt)),
        order.fulfillmentStatus,
        order.customerName || 'N/A',
        order.customerEmail || 'N/A',
        order.itemCount,
        formatCurrency(order.total),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
              <Package className="h-8 w-8 text-primary-600" />
              Order Management
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Manage and fulfill your store orders
            </p>
            <div className="flex gap-2 mt-3">
              <Link href={`/t/${tenantId}/settings/fulfillment`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Fulfillment Settings
                </Button>
              </Link>
              <Link href={`/t/${tenantId}/settings/payment-gateways`}>
                <Button variant="outline" size="sm">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment Gateways
                </Button>
              </Link>
            </div>
          </div>
          {filteredOrders.length > 0 && (
            <Button onClick={exportOrders} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total Orders</p>
                  <p className="text-2xl font-bold text-neutral-900">{totalCount}</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Processing</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {orders.filter(o => o.fulfillmentStatus === 'unfulfilled' || o.fulfillmentStatus === 'partially_fulfilled').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Fulfilled</p>
                  <p className="text-2xl font-bold text-green-600">
                    {orders.filter(o => o.fulfillmentStatus === 'fulfilled').length}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Cancelled</p>
                  <p className="text-2xl font-bold text-red-600">
                    {orders.filter(o => o.fulfillmentStatus === 'cancelled').length}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {formatCurrency(orders.filter(o => o.fulfillmentStatus !== 'cancelled').reduce((sum, o) => sum + o.total, 0))}
                  </p>
                </div>
                <Package className="h-8 w-8 text-primary-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by order ID, customer, email, or product..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-neutral-600" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentPage(1); // Reset to first page when filter changes
                  }}
                  className="px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="partially_fulfilled">Partially Fulfilled</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="archived">📦 Archived</option>
                </select>
              </div>

              {/* Page Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1); // Reset to first page when page size changes
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              {orders.length === 0 ? 'No orders yet' : 'No orders found'}
            </h3>
            <p className="text-neutral-600">
              {orders.length === 0 
                ? 'Orders will appear here once customers make purchases.'
                : 'Try adjusting your search or filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.orderId} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-neutral-900">
                        Order #{order.orderNumber}
                      </h3>
                      
                      {/* Payment Status Badge */}
                      {order.orderStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Paid
                        </span>
                      )}
                      {order.orderStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
                          <Clock className="h-3 w-3" />
                          Payment Pending
                        </span>
                      )}
                      
                      {/* Fulfillment Status Badge */}
                      {getStatusBadge(order.fulfillmentStatus)}
                      
                      {/* Refund Status Badge */}
                      {order.refunds && order.refunds.length > 0 && (
                        <>
                          {order.refunds.some(r => r.status === 'completed') && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-200">
                              Refunded
                            </span>
                          )}
                          {order.refunds.some(r => r.status === 'processing') && !order.refunds.some(r => r.status === 'completed') && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">
                              Refund Processing
                            </span>
                          )}
                          {order.refunds.some(r => r.status === 'pending') && !order.refunds.some(r => r.status === 'processing' || r.status === 'completed') && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
                              Refund Pending
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-neutral-600">
                      <div>
                        <span className="font-medium">Date:</span> {formatDate(new Date(order.paidAt))}
                      </div>
                      <div>
                        <span className="font-medium">Customer:</span>{' '}
                        {order.customerName || 'Guest'}
                      </div>
                      <div>
                        <span className="font-medium">Email:</span>{' '}
                        {order.customerEmail || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Method:</span>{' '}
                        {order.fulfillmentMethod ? order.fulfillmentMethod.charAt(0).toUpperCase() + order.fulfillmentMethod.slice(1) : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Items:</span> {order.itemCount}
                      </div>
                    </div>

                    {/* Shipping Address Preview */}
                    {order.shippingAddress && (
                      <div className="mt-2 text-sm text-neutral-600">
                        <span className="font-medium">Ship to:</span>{' '}
                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                      </div>
                    )}
                  </div>

                  {/* Order Total & Actions */}
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <p className="text-sm text-neutral-600">Total</p>
                      <p className="text-2xl font-bold text-primary-600">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link href={`/t/${tenantId}/orders/${order.orderId}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                      
                      {/* Archive button for fulfilled or cancelled orders */}
                      {(order.fulfillmentStatus === 'fulfilled' || order.fulfillmentStatus === 'cancelled') && statusFilter !== 'archived' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => archiveOrder(order.orderId)}
                          disabled={archiving === order.orderId}
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        >
                          {archiving === order.orderId ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2"></div>
                              Archiving...
                            </>
                          ) : (
                            <>
                              <Package className="h-4 w-4 mr-2" />
                              Archive
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Card className="mt-6">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-neutral-600">
                    Showing page {currentPage} of {totalPages} ({totalCount} total orders)
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="min-w-[40px]"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
