'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import { Package, Search, Filter, ChevronLeft, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';

export default function OrdersPage() {
  const { customer } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (customer?.email) {
      loadOrders();
    }
  }, [customer?.email, currentPage, statusFilter]);

  const loadOrders = async () => {
    if (!customer?.email) return;

    setIsLoading(true);
    try {
      const result = await customerOrderService.getCustomerOrders(customer!.email, currentPage);
      let filteredOrders = result.orders;

      // Apply status filter
      if (statusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(
          order => order.orderStatus.toLowerCase() === statusFilter
        );
      }

      // Apply search filter
      if (searchQuery) {
        filteredOrders = filteredOrders.filter(
          order =>
            order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.items.some(item =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
      }

      setOrders(filteredOrders);
      setTotalPages(result.pagination.totalPages);
      setTotalCount(result.pagination.total);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'shipped':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
        <p className="text-gray-600 mt-1">View and track your orders</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by order number or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No orders found</p>
              {searchQuery || statusFilter !== 'all' ? (
                <Button variant="outline" onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}>
                  Clear Filters
                </Button>
              ) : (
                <Link href="/">
                  <Button>Start Shopping</Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Results Count */}
              <div className="mb-4 text-sm text-gray-600">
                Showing {orders.length} of {totalCount} orders
              </div>

              {/* Orders */}
              <div className="space-y-4">
                {orders.map((order) => (
                  <Link
                    key={order.orderId}
                    href={`/account/orders/${order.orderId}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    </div>

                    {/* Items Preview */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex -space-x-2">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-white flex items-center justify-center overflow-hidden"
                          >
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-white flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600">+{order.items.length - 3}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {order.items.map(i => i.name).join(', ')}
                        </p>
                      </div>
                    </div>

                    {/* Order Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-sm">
                        <span className="text-gray-600">Total: </span>
                        <span className="font-medium text-gray-900">{formatCurrency(order.total)}</span>
                      </div>
                      {order.trackingNumber && (
                        <div className="text-sm text-blue-600">
                          📦 {order.trackingNumber}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
