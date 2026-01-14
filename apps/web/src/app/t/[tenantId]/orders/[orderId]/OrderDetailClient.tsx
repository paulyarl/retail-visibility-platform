'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { 
  Package, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Truck, 
  MapPin, 
  Mail, 
  Phone,
  User,
  CreditCard,
  ShoppingBag
} from 'lucide-react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
}

interface OrderDetail {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping' | null;
  tenantName: string;
  tenantLogo: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress?: any;
  billingAddress?: any;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  items: OrderItem[];
  payment?: {
    id: string;
    gatewayTransactionId: string;
    method: string;
    amount: number;
    status: string;
  };
  createdAt: string;
  paidAt: string;
  notes?: string;
  internalNotes?: string;
  trackingNumber?: string;
  refunds?: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string;
    gatewayRefundId?: string;
    createdAt: string;
    completedAt?: string;
  }>;
}

interface OrderDetailClientProps {
  tenantId: string;
  orderId: string;
}

export default function OrderDetailClient({ tenantId, orderId }: OrderDetailClientProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showFulfillDialog, setShowFulfillDialog] = useState(false);
  const [shippingProvider, setShippingProvider] = useState('');
  const [fulfillmentSettings, setFulfillmentSettings] = useState<any>(null);

  useEffect(() => {
    fetchOrderDetail();
    fetchFulfillmentSettings();
  }, [tenantId, orderId]);

  const fetchFulfillmentSettings = async () => {
    try {
      const response = await api.get(`/api/tenants/${tenantId}/fulfillment-settings`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setFulfillmentSettings(data.settings);
          // Pre-populate shipping provider from settings
          if (data.settings.shipping_provider) {
            setShippingProvider(data.settings.shipping_provider);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching fulfillment settings:', error);
    }
  };

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      
      const response = await api.get(`/api/tenants/${tenantId}/orders/${orderId}`);
      
      if (!response.ok) throw new Error('Failed to fetch order details');
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setOrder(data.data);
        setTrackingNumber(data.data.trackingNumber || '');
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFulfillmentStatus = async (status: string) => {
    try {
      setUpdating(true);
      
      const payload: any = {
        fulfillmentStatus: status,
      };

      // For shipping orders being fulfilled, include provider and tracking
      if (status === 'fulfilled' && order?.fulfillmentMethod === 'shipping') {
        if (shippingProvider) {
          payload.shippingProvider = shippingProvider;
        }
        if (trackingNumber) {
          payload.trackingNumber = trackingNumber;
        }
      }
      
      const response = await api.put(`/api/tenants/${tenantId}/orders/${orderId}/fulfillment`, payload);
      
      if (!response.ok) throw new Error('Failed to update fulfillment status');
      
      // Refresh order data
      await fetchOrderDetail();
      setShowFulfillDialog(false);
      alert('Order status updated successfully');
    } catch (error) {
      console.error('Error updating fulfillment status:', error);
      alert('Failed to update order status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkFulfilled = () => {
    // For shipping orders, show dialog to collect provider and tracking
    if (order?.fulfillmentMethod === 'shipping') {
      setShowFulfillDialog(true);
    } else {
      // For pickup/delivery, mark as fulfilled directly
      updateFulfillmentStatus('fulfilled');
    }
  };

  const handleCancelOrder = async () => {
    // Use custom reason if "custom" is selected, otherwise use the dropdown value
    const finalReason = cancellationReason === 'custom' ? customReason.trim() : cancellationReason.trim();
    
    if (!finalReason) {
      alert('Please provide a reason for cancelling this order');
      return;
    }

    try {
      setUpdating(true);
      
      const response = await api.put(`/api/tenants/${tenantId}/orders/${orderId}/fulfillment`, {
        fulfillmentStatus: 'cancelled',
        cancellationReason: finalReason,
      });
      
      if (!response.ok) throw new Error('Failed to cancel order');
      
      // Refresh order data
      await fetchOrderDetail();
      setShowCancelDialog(false);
      setCancellationReason('');
      setCustomReason('');
      alert('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const updateTrackingNumber = async () => {
    try {
      setUpdating(true);
      
      const response = await api.put(`/api/tenants/${tenantId}/orders/${orderId}/fulfillment`, {
        trackingNumber: trackingNumber,
      });
      
      if (!response.ok) throw new Error('Failed to update tracking number');
      
      setShowTrackingInput(false);
      await fetchOrderDetail();
    } catch (error) {
      console.error('Error updating tracking number:', error);
      alert('Failed to update tracking number. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pending' },
      processing: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package, label: 'Processing' },
      fulfilled: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2, label: 'Fulfilled' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: Clock, label: 'Cancelled' },
    };
    
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${badge.color}`}>
        <Icon className="h-4 w-4" />
        {badge.label}
      </span>
    );
  };

  const getFulfillmentMethodIcon = (method: string | null) => {
    switch (method) {
      case 'pickup':
        return <ShoppingBag className="h-5 w-5 text-purple-600" />;
      case 'delivery':
        return <Truck className="h-5 w-5 text-blue-600" />;
      case 'shipping':
        return <Package className="h-5 w-5 text-green-600" />;
      default:
        return <Package className="h-5 w-5 text-gray-600" />;
    }
  };

  const getFulfillmentMethodLabel = (method: string | null) => {
    if (!method) return 'Not specified';
    return method.charAt(0).toUpperCase() + method.slice(1);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Order not found</h3>
            <p className="text-neutral-600 mb-4">The order you're looking for doesn't exist or you don't have access to it.</p>
            <Link href={`/t/${tenantId}/orders`}>
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/t/${tenantId}/orders`}>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
              Order #{order.orderNumber}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>
          {getStatusBadge(order.fulfillmentStatus)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-neutral-900">{item.name}</h4>
                      <p className="text-sm text-neutral-600">SKU: {item.sku}</p>
                      <p className="text-sm text-neutral-600">Quantity: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-neutral-900">{formatCurrency(item.total)}</p>
                      <p className="text-sm text-neutral-600">{formatCurrency(item.unitPrice)} each</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Totals - Financial Breakdown */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-semibold text-neutral-900 mb-3">Financial Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-neutral-600">
                    <span>Items Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  {order.shipping > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Shipping Fee</span>
                      <span>{formatCurrency(order.shipping)}</span>
                    </div>
                  )}
                  {order.tax > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Tax</span>
                      <span>{formatCurrency(order.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-neutral-900 pt-2 border-t">
                    <span>Total Paid</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                  {order.payment && (
                    <div className="flex justify-between text-sm text-neutral-500 pt-1">
                      <span>Payment Method</span>
                      <span className="capitalize">{order.payment.method}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment Management */}
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Fulfillment Method */}
              <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg">
                {getFulfillmentMethodIcon(order.fulfillmentMethod)}
                <div>
                  <p className="text-sm text-neutral-600">Fulfillment Method</p>
                  <p className="font-semibold text-neutral-900">{getFulfillmentMethodLabel(order.fulfillmentMethod)}</p>
                </div>
              </div>

              {/* Status Update Buttons */}
              {order.fulfillmentStatus !== 'fulfilled' && order.fulfillmentStatus !== 'cancelled' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-neutral-700">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {order.fulfillmentStatus !== 'processing' && (
                      <Button
                        onClick={() => updateFulfillmentStatus('processing')}
                        disabled={updating}
                        variant="outline"
                        size="sm"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Mark as Processing
                      </Button>
                    )}
                    <Button
                      onClick={handleMarkFulfilled}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Fulfilled
                    </Button>
                    <Button
                      onClick={() => setShowCancelDialog(true)}
                      disabled={updating}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Cancel Order
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Status Message for Final States */}
              {(order.fulfillmentStatus === 'fulfilled' || order.fulfillmentStatus === 'cancelled') && (
                <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200 space-y-2">
                  <p className="text-sm text-neutral-700">
                    {order.fulfillmentStatus === 'fulfilled' 
                      ? '✓ This order has been fulfilled and is complete.'
                      : '✗ This order has been cancelled.'}
                  </p>
                  
                  {/* Show cancellation reason if available */}
                  {order.fulfillmentStatus === 'cancelled' && order.internalNotes && (
                    <div className="pt-2 border-t border-neutral-200">
                      <p className="text-xs font-medium text-neutral-600 mb-1">Cancellation Reason:</p>
                      <p className="text-sm text-neutral-800 bg-white p-2 rounded border border-neutral-200">
                        {order.internalNotes.split('BUYER CANCELLATION: ')[1]?.split('\n')[0] || 'No reason provided'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tracking Number (for shipping orders) */}
              {order.fulfillmentMethod === 'shipping' && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-neutral-700">Tracking Number</p>
                    {!showTrackingInput && (
                      <Button
                        onClick={() => setShowTrackingInput(true)}
                        variant="outline"
                        size="sm"
                      >
                        {order.trackingNumber ? 'Update' : 'Add'} Tracking
                      </Button>
                    )}
                  </div>
                  
                  {showTrackingInput ? (
                    <div className="flex gap-2">
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                        className="flex-1"
                      />
                      <Button
                        onClick={updateTrackingNumber}
                        disabled={updating || !trackingNumber.trim()}
                        size="sm"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setShowTrackingInput(false);
                          setTrackingNumber(order.trackingNumber || '');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : order.trackingNumber ? (
                    <p className="text-neutral-900 font-mono bg-neutral-100 px-3 py-2 rounded">
                      {order.trackingNumber}
                    </p>
                  ) : (
                    <p className="text-neutral-500 text-sm">No tracking number added yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-neutral-600 mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-600">Name</p>
                  <p className="font-medium text-neutral-900">{order.customerName || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-neutral-600 mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-600">Email</p>
                  <p className="font-medium text-neutral-900">{order.customerEmail || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-neutral-600 mt-0.5" />
                <div>
                  <p className="text-sm text-neutral-600">Phone</p>
                  <p className="font-medium text-neutral-900">{order.customerPhone || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {order.fulfillmentMethod === 'shipping' ? 'Shipping Address' : 'Delivery Address'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-neutral-600 mt-0.5" />
                  <div className="text-neutral-900">
                    {order.customerName && <p className="font-semibold mb-1">{order.customerName}</p>}
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country || 'USA'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Billing Address */}
          {order.billingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-neutral-600 mt-0.5" />
                  <div className="text-neutral-900">
                    {order.customerName && <p className="font-semibold mb-1">{order.customerName}</p>}
                    <p>{order.billingAddress.addressLine1}</p>
                    {order.billingAddress.addressLine2 && <p>{order.billingAddress.addressLine2}</p>}
                    <p>
                      {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}
                    </p>
                    <p>{order.billingAddress.country || 'USA'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Information */}
          {order.payment && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-neutral-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-neutral-600">Method</p>
                    <p className="font-medium text-neutral-900">{order.payment.method}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Transaction ID</p>
                  <p className="font-mono text-xs text-neutral-900 break-all">
                    {order.payment.gatewayTransactionId || order.payment.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-600">Paid At</p>
                  <p className="font-medium text-neutral-900">{formatDate(order.paidAt)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refund Information */}
          {order.refunds && order.refunds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Refund Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.refunds.map((refund) => (
                  <div key={refund.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          refund.status === 'completed' ? 'bg-green-100 text-green-800' :
                          refund.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          refund.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {refund.status.charAt(0).toUpperCase() + refund.status.slice(1)}
                        </div>
                        <span className="text-lg font-bold text-neutral-900">
                          {formatCurrency(refund.amount)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {refund.reason && (
                        <div>
                          <p className="text-neutral-600 font-medium">Reason:</p>
                          <p className="text-neutral-900">{refund.reason}</p>
                        </div>
                      )}
                      
                      {refund.gatewayRefundId && (
                        <div>
                          <p className="text-neutral-600 font-medium">Refund ID:</p>
                          <p className="font-mono text-xs text-neutral-900 break-all">
                            {refund.gatewayRefundId}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-neutral-600 font-medium">Initiated:</p>
                        <p className="text-neutral-900">{formatDate(refund.createdAt)}</p>
                      </div>
                      
                      {refund.completedAt && (
                        <div>
                          <p className="text-neutral-600 font-medium">Completed:</p>
                          <p className="text-neutral-900">{formatDate(refund.completedAt)}</p>
                        </div>
                      )}
                      
                      {refund.status === 'processing' && (
                        <p className="text-xs text-blue-600 mt-2">
                          ⏳ Refund is being processed. Funds typically arrive in 5-10 business days.
                        </p>
                      )}
                      
                      {refund.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ Refund has been completed. Customer should see funds in their account.
                        </p>
                      )}
                      
                      {refund.status === 'failed' && (
                        <p className="text-xs text-red-600 mt-2">
                          ✗ Refund failed. Please contact support or process manually.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Order Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-700">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Fulfill Shipping Order Dialog */}
      {showFulfillDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Mark Order as Fulfilled</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Please provide shipping details for this order.
              </p>
              <p className="text-sm text-gray-600">
                Order #{order?.orderNumber}
              </p>
              
              {/* Shipping Provider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Shipping Provider
                </label>
                <select
                  value={shippingProvider}
                  onChange={(e) => setShippingProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={updating}
                >
                  <option value="">Select a provider...</option>
                  <option value="USPS">USPS</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL</option>
                  <option value="Other">Other</option>
                </select>
                {fulfillmentSettings?.shipping_provider && (
                  <p className="text-xs text-gray-500">
                    Default provider from settings: {fulfillmentSettings.shipping_provider}
                  </p>
                )}
              </div>

              {/* Tracking Number */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tracking Number (optional)
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={updating}
                />
                <p className="text-xs text-gray-500">
                  Customer will receive tracking information if provided
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFulfillDialog(false);
                    setTrackingNumber('');
                  }}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => updateFulfillmentStatus('fulfilled')}
                  disabled={updating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {updating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Marking as Fulfilled...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Fulfilled
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel Order Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Cancel Order?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to cancel this order? The buyer will be notified with your reason.
              </p>
              <p className="text-sm text-gray-600">
                Order #{order.orderNumber}
              </p>
              
              {/* Cancellation Reason */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reason for cancellation <span className="text-red-600">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={updating}
                  >
                    <option value="">Select a reason...</option>
                    <option value="Out of stock">Out of stock</option>
                    <option value="Unable to fulfill order">Unable to fulfill order</option>
                    <option value="Pricing error">Pricing error</option>
                    <option value="Customer requested cancellation">Customer requested cancellation</option>
                    <option value="Payment issue">Payment issue</option>
                    <option value="Inventory error">Inventory error</option>
                    <option value="custom">Other (please specify)</option>
                  </select>
                  
                  {cancellationReason === 'custom' && (
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Please explain why you're cancelling this order..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none mt-2"
                      rows={3}
                      disabled={updating}
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  The buyer will be able to see this cancellation reason
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCancelDialog(false);
                    setCancellationReason('');
                    setCustomReason('');
                  }}
                  disabled={updating}
                >
                  Keep Order
                </Button>
                <Button
                  onClick={handleCancelOrder}
                  disabled={updating || !cancellationReason || (cancellationReason === 'custom' && !customReason.trim())}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {updating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
