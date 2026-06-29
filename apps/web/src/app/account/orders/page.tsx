'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import { Package, Search, Filter, ChevronLeft, ChevronRight, Loader2, ShoppingBag, Receipt, CheckCircle, XCircle, AlertTriangle, CreditCard, Calendar } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import DigitalDownloadsCard from '@/components/downloads/DigitalDownloadsCard';
import ProductTypeBadge from '@/components/products/ProductTypeBadge';

export default function OrdersPage() {
  const { customer } = useCustomerAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [customReason, setCustomReason] = useState('');

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
        filteredOrders = filteredOrders.filter(order => {
          const status = order.orderStatus.toLowerCase();
          const fulfillment = (order.fulfillmentStatus || '').toLowerCase();

          if (statusFilter === 'fulfilled') {
            return fulfillment === 'fulfilled';
          }

          // Active statuses hide already-fulfilled orders
          if (['confirmed', 'paid', 'processing', 'shipped'].includes(statusFilter)) {
            if (fulfillment === 'fulfilled') return false;
            return status === statusFilter;
          }

          return status === statusFilter;
        });
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
    switch ((status || 'unknown').toLowerCase()) {
      case 'confirmed':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'paid':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'shipped':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'cancelled':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'refunded':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'fulfilled':
        return 'text-teal-600 bg-teal-50 border-teal-200';
      case 'draft':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch ((status || 'unknown').toLowerCase()) {
      case 'confirmed': return 'Confirmed';
      case 'paid': return 'Paid';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'refunded': return 'Refunded';
      case 'fulfilled': return 'Fulfilled';
      case 'draft': return 'Draft - Needs Payment';
      default: return status;
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

  const handleConfirmPickup = async (orderId: string) => {
    if (!customer?.email) {
      alert('Please provide your email address');
      return;
    }

    try {
      setConfirmingPickup(true);
      
      const result = await customerOrderService.confirmPickup(
        orderId,
        customer.email,
        customer.phone || ''
      );
      
      if (result.success) {
        // Update local state with fulfilledAt timestamp
        if (selectedOrder && selectedOrder.orderId === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            fulfillmentStatus: 'fulfilled',
            fulfilledAt: result.fulfilledAt,
          });
        }

        setOrders(orders.map(order => 
          order.orderId === orderId 
            ? { ...order, fulfillmentStatus: 'fulfilled', fulfilledAt: result.fulfilledAt }
            : order
        ));

        alert('Order marked as fulfilled!');
      } else {
        throw new Error('Failed to confirm fulfillment');
      }
    } catch (error) {
      console.error('Error confirming fulfillment:', error);
      alert('Failed to confirm fulfillment. Please try again.');
    } finally {
      setConfirmingPickup(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingOrder(true);
      
      const finalReason = cancellationReason === 'custom' ? customReason.trim() : cancellationReason;
      
      const success = await customerOrderService.cancelOrder(
        orderId,
        finalReason || 'Customer request',
        customer?.email || '',
        customer?.phone || ''
      );
      
      if (success) {
        // Update local state
        if (selectedOrder) {
          setSelectedOrder({
            ...selectedOrder,
            orderStatus: 'cancelled',
            cancellationReason: finalReason
          });
        }

        setOrders(orders.map(order => 
          order.orderId === orderId 
            ? { ...order, orderStatus: 'cancelled', cancellationReason: finalReason }
            : order
        ));

        setShowCancelConfirm(false);
        setCancellationReason('');
        setCustomReason('');
        alert('Order cancelled successfully');
      } else {
        throw new Error('Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setCancellingOrder(false);
    }
  };

  // Show receipt view for selected order
  if (selectedOrder) {
    return (
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => setSelectedOrder(null)}
          className="mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Orders
        </Button>
        <div>
          {/* Cancel Confirmation Modal */}
          {showCancelConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Order</h3>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to cancel this order? This action cannot be undone.
                </p>
                
                <div className="space-y-3 mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Reason for cancellation
                  </label>
                  <select
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a reason</option>
                    <option value="no_longer_needed">No longer needed</option>
                    <option value="found_elsewhere">Found elsewhere</option>
                    <option value="mistake">Ordered by mistake</option>
                    <option value="financial">Financial reasons</option>
                    <option value="custom">Other (please specify)</option>
                  </select>
                  
                  {cancellationReason === 'custom' && (
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Please explain why you're cancelling..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  )}
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCancelConfirm(false);
                      setCancellationReason('');
                      setCustomReason('');
                    }}
                    className="flex-1"
                  >
                    Keep Order
                  </Button>
                  <Button
                    onClick={() => handleCancelOrder(selectedOrder.orderId)}
                    disabled={cancellingOrder || !cancellationReason || (cancellationReason === 'custom' && !customReason.trim())}
                    className="flex-1"
                  >
                    {cancellingOrder ? 'Cancelling...' : 'Cancel Order'}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Digital Downloads */}
          {selectedOrder.items?.some((item: any) => item.productType === 'digital' || item.productType === 'hybrid') && (
            <DigitalDownloadsCard orderId={selectedOrder.orderId} />
          )}

          <OrderReceipt
            statusHistory={selectedOrder.statusHistory}
            cart={{
              tenantId: selectedOrder.tenantId,
              tenantName: selectedOrder.tenantName,
              tenantLogo: selectedOrder.tenantLogo || undefined,
              items: selectedOrder.items.map(item => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice * 100,
                productType: item.productType,
              })),
              subtotal: selectedOrder.subtotal * 100,
              status: selectedOrder.orderStatus,
              fulfillmentStatus: selectedOrder.fulfillmentStatus,
              fulfilledAt: selectedOrder.fulfilledAt || undefined,
              orderId: selectedOrder.orderId,
              paymentId: selectedOrder.paymentId || undefined,
              gatewayTransactionId: selectedOrder.gatewayTransactionId || undefined,
              paidAt: selectedOrder.paidAt ? new Date(selectedOrder.paidAt) : undefined,
              fulfillmentMethod: selectedOrder.fulfillmentMethod || undefined,
              fulfillmentFee: selectedOrder.shipping ? selectedOrder.shipping * 100 : 0,
              customerInfo: selectedOrder.customerInfo || (selectedOrder.customerEmail ? {
                email: selectedOrder.customerEmail,
                firstName: selectedOrder.customerName?.split(' ')[0] || '',
                lastName: selectedOrder.customerName?.split(' ').slice(1).join(' ') || '',
                phone: selectedOrder.customerPhone || '',
              } : undefined),
              shippingAddress: selectedOrder.shippingAddress || undefined,
              checkoutMode: (selectedOrder as any).checkoutMode || undefined,
              depositCents: (selectedOrder as any).depositCents || undefined,
              remainingBalanceCents: (selectedOrder as any).remainingBalanceCents || undefined,
              pickupDeadline: (selectedOrder as any).pickupDeadline || undefined,
              depositPercentage: (selectedOrder as any).depositPercentage || undefined,
              gatewayType: (selectedOrder as any).gatewayType || undefined,
            }}
            actions={
              <div className="flex gap-2 mt-4">
                {selectedOrder.orderStatus === 'draft' && (
                  <Button
                    onClick={() => {
                      window.location.href = `/checkout?tenantId=${selectedOrder.tenantId}`;
                    }}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    <CreditCard className="w-4 h-4" />
                    Continue Checkout
                  </Button>
                )}

                {['pickup', 'delivery', 'shipping'].includes(selectedOrder.fulfillmentMethod || '') &&
                 selectedOrder.orderStatus === 'paid' &&
                 !selectedOrder.fulfilledAt && (
                  <Button
                    onClick={() => handleConfirmPickup(selectedOrder.orderId)}
                    disabled={confirmingPickup}
                    className="flex items-center gap-2"
                  >
                    {confirmingPickup ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {selectedOrder.fulfillmentMethod === 'pickup' && 'Confirm Pickup'}
                        {selectedOrder.fulfillmentMethod === 'delivery' && 'Confirm Delivery'}
                        {selectedOrder.fulfillmentMethod === 'shipping' && 'Confirm Received'}
                      </>
                    )}
                  </Button>
                )}

                {['paid', 'processing', 'draft'].includes(selectedOrder.orderStatus) && !selectedOrder.fulfilledAt && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={cancellingOrder}
                    className="flex items-center gap-2"
                  >
                    {cancellingOrder ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Cancel Order
                      </>
                    )}
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </div>
    );
  }

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
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="paid">Paid</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
                <option value="fulfilled">Fulfilled</option>
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
                    className={`block border rounded-lg p-4 hover:shadow-md transition-all ${
                      order.orderStatus === 'draft'
                        ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.orderStatus)}`}>
                        {getStatusLabel(order.orderStatus)}
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          </p>
                          {(() => {
                            const types = order.items.map(i => i.productType || 'physical');
                            const unique = [...new Set(types)];
                            if (unique.length === 1 && unique[0] !== 'physical') {
                              return <ProductTypeBadge productType={unique[0] as any} size="sm" />;
                            }
                            if (unique.length > 1) {
                              return <ProductTypeBadge productType="hybrid" size="sm" />;
                            }
                            return null;
                          })()}
                        </div>
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
                      <div className="flex items-center gap-3">
                        {order.trackingNumber && (
                          <div className="text-sm text-blue-600">
                            📦 {order.trackingNumber}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {order.orderStatus === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.location.href = `/checkout?tenantId=${order.tenantId}`;
                                }}
                                className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white"
                              >
                                <CreditCard className="w-3 h-3" />
                                Continue Checkout
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelOrder(order.orderId);
                                }}
                                disabled={cancellingOrder}
                                className="flex items-center gap-1 text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <XCircle className="w-3 h-3" />
                                Cancel Draft
                              </Button>
                            </>
                          )}

                          {['pickup', 'delivery', 'shipping'].includes(order.fulfillmentMethod || '') &&
                           order.orderStatus === 'paid' &&
                           !order.fulfilledAt && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                              className="flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              {order.fulfillmentMethod === 'pickup' && 'Confirm Pickup'}
                              {order.fulfillmentMethod === 'delivery' && 'Confirm Delivery'}
                              {order.fulfillmentMethod === 'shipping' && 'Confirm Received'}
                            </Button>
                          )}

                          {['paid', 'processing'].includes(order.orderStatus) && !order.fulfilledAt && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                              className="flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              Cancel
                            </Button>
                          )}

                          {order.orderStatus !== 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedOrder(order);
                              }}
                            >
                              <Receipt className="w-4 h-4 mr-1" />
                              View Receipt
                            </Button>
                          )}

                          {order.items?.some(i => i.productType === 'service' || i.productType === 'hybrid') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = '/account/appointments';
                              }}
                              className="flex items-center gap-1"
                            >
                              <Calendar className="w-3 h-3" />
                              View Appointment
                            </Button>
                          )}
                        </div>
                      </div>
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
