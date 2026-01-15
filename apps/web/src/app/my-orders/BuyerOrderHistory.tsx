'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Package, Search, ShoppingBag, Mail, Phone, MapPin, Truck, Calendar } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { PoweredByFooter } from '@/components/PoweredByFooter';

interface BuyerOrder {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  status: string;
  fulfillmentStatus?: string;
  orderDate: string;
  paidAt: string;
  total: number;
  subtotal: number;
  platformFee: number;
  fulfillmentFee: number;
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping' | null;
  customerInfo: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  items: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
  }>;
  itemCount: number;
  refunds?: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string;
    gatewayRefundId?: string;
    createdAt: string;
    completedAt?: string;
  }>;
  internalNotes?: string;
  cancellationReason?: string;
  trackingNumber?: string;
  shippingProvider?: string;
}

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  fulfilled: 'bg-blue-100 text-blue-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function BuyerOrderHistory() {
  const router = useRouter();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [digitalDownloads, setDigitalDownloads] = useState<any[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(false);

  // Check localStorage for saved email/phone
  useEffect(() => {
    const savedEmail = localStorage.getItem('buyer_email');
    const savedPhone = localStorage.getItem('buyer_phone');
    
    if (savedEmail) {
      setEmail(savedEmail);
      fetchOrders(savedEmail, savedPhone || '');
    }
  }, []);

  const fetchOrders = async (searchEmail?: string, searchPhone?: string) => {
    const emailToSearch = searchEmail || email;
    const phoneToSearch = searchPhone || phone;

    if (!emailToSearch && !phoneToSearch) {
      setError('Please enter your email or phone number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const params = new URLSearchParams();
      if (emailToSearch) params.append('email', emailToSearch);
      if (phoneToSearch) params.append('phone', phoneToSearch);

      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/orders/buyer?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders || []);

      // Save to localStorage for convenience
      if (emailToSearch) localStorage.setItem('buyer_email', emailToSearch);
      if (phoneToSearch) localStorage.setItem('buyer_phone', phoneToSearch);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchOrders();
  };

  const handleConfirmPickup = async (orderId: string) => {
    if (!email && !phone) {
      alert('Please provide your email or phone number');
      return;
    }

    try {
      setConfirmingPickup(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/orders/${orderId}/pickup`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          phone,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm pickup');
      }

      // Update local state
      if (selectedOrder && selectedOrder.orderId === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          fulfillmentStatus: 'fulfilled',
        });
      }

      setOrders(orders.map(order => 
        order.orderId === orderId 
          ? { ...order, fulfillmentStatus: 'fulfilled' }
          : order
      ));

      alert('Order marked as picked up!');
    } catch (error) {
      console.error('Error confirming pickup:', error);
      alert('Failed to confirm pickup. Please try again.');
    } finally {
      setConfirmingPickup(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingOrder(true);
      
      // Use custom reason if "custom" is selected, otherwise use the dropdown value
      const finalReason = cancellationReason === 'custom' ? customReason.trim() : cancellationReason;
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/orders/${selectedOrder?.orderId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          phone,
          cancellationReason: finalReason || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to cancel order');
      }

      // Update local state
      if (selectedOrder) {
        setSelectedOrder({
          ...selectedOrder,
          fulfillmentStatus: 'cancelled',
          cancellationReason: finalReason,
        });
      }

      setOrders(orders.map(order => 
        order.orderId === selectedOrder?.orderId 
          ? { ...order, fulfillmentStatus: 'cancelled', cancellationReason: finalReason }
          : order
      ));

      setShowCancelConfirm(false);
      setCancellationReason('');
      setCustomReason('');
      alert('Order cancelled successfully. The store has been notified.');
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      alert(error.message || 'Failed to cancel order. Please contact the store directly.');
    } finally {
      setCancellingOrder(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const fetchDigitalDownloads = async (orderId: string) => {
    try {
      setLoadingDownloads(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/download/orders/${orderId}/downloads`);
      
      if (response.ok) {
        const data = await response.json();
        setDigitalDownloads(data.downloads || []);
      } else {
        setDigitalDownloads([]);
      }
    } catch (error) {
      console.error('Error fetching digital downloads:', error);
      setDigitalDownloads([]);
    } finally {
      setLoadingDownloads(false);
    }
  };

  const handleDownload = (accessToken: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    window.open(`${apiUrl}/api/download/${accessToken}`, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDaysRemaining = (expiresAt: Date | null): number | null => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  const getFulfillmentIcon = (method: string | null) => {
    if (method === 'pickup') return <Package className="h-4 w-4" />;
    if (method === 'delivery') return <Truck className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  const getFulfillmentLabel = (method: string | null) => {
    if (method === 'pickup') return 'Pickup';
    if (method === 'delivery') return 'Delivery';
    if (method === 'shipping') return 'Shipping';
    return 'Standard';
  };

  // Fetch digital downloads when order is selected
  useEffect(() => {
    if (selectedOrder) {
      fetchDigitalDownloads(selectedOrder.orderId);
    } else {
      setDigitalDownloads([]);
    }
  }, [selectedOrder?.orderId]);

  // Show order detail modal
  if (selectedOrder) {
    console.log('[Buyer Order Detail] Order data:', {
      fulfillmentMethod: selectedOrder.fulfillmentMethod,
      fulfillmentStatus: selectedOrder.fulfillmentStatus,
      canConfirmPickup: selectedOrder.fulfillmentMethod === 'pickup' && selectedOrder.fulfillmentStatus !== 'fulfilled'
    });

    const canConfirmPickup = 
      selectedOrder.fulfillmentMethod === 'pickup' && 
      selectedOrder.fulfillmentStatus !== 'fulfilled' &&
      selectedOrder.fulfillmentStatus !== 'cancelled';
    
    const canCancelOrder = 
      selectedOrder.fulfillmentStatus !== 'fulfilled' &&
      selectedOrder.fulfillmentStatus !== 'cancelled';

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4 max-w-4xl py-4">
            <div className="flex items-center justify-between">
              <a href="/directory" className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
                <ShoppingBag className="h-5 w-5" />
                <span>Browse Stores</span>
              </a>
              <div className="flex items-center gap-4">
                <a href="/my-orders" className="text-gray-900 font-semibold">
                  My Orders
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-4xl py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
            >
              ← Back to Orders
            </Button>
            
            <div className="flex items-center gap-3">
              {canConfirmPickup && (
                <Button
                  onClick={() => handleConfirmPickup(selectedOrder.orderId)}
                  disabled={confirmingPickup}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {confirmingPickup ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Confirm Pickup
                    </>
                  )}
                </Button>
              )}
              
              {canCancelOrder && (
                <Button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancellingOrder}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Cancel Order
                </Button>
              )}
              
              {selectedOrder.fulfillmentStatus === 'fulfilled' && (
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-semibold">
                  ✓ Picked Up
                </div>
              )}
              
              {selectedOrder.fulfillmentStatus === 'cancelled' && (
                <div className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-semibold">
                  ✗ Cancelled
                </div>
              )}
            </div>
          </div>
          
          {/* Cancel Confirmation Dialog */}
          {showCancelConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-md w-full">
                <CardHeader>
                  <CardTitle>Cancel Order?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700">
                    Are you sure you want to cancel this order? The store will be notified immediately.
                  </p>
                  <p className="text-sm text-gray-600">
                    Order #{selectedOrder.orderNumber}
                  </p>
                  
                  {/* Cancellation Reason */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Reason for cancellation (optional)
                    </label>
                    <div className="space-y-2">
                      <select
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        disabled={cancellingOrder}
                      >
                        <option value="">Select a reason...</option>
                        <option value="Changed my mind">Changed my mind</option>
                        <option value="Found a better price">Found a better price</option>
                        <option value="Ordered by mistake">Ordered by mistake</option>
                        <option value="Taking too long">Taking too long</option>
                        <option value="Need to change order details">Need to change order details</option>
                        <option value="custom">Other (please specify)</option>
                      </select>
                      
                      {cancellationReason === 'custom' && (
                        <textarea
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          placeholder="Please tell us why you're cancelling..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                          rows={3}
                          disabled={cancellingOrder}
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      This helps the store improve their service
                    </p>
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setCancellationReason('');
                        setCustomReason('');
                      }}
                      disabled={cancellingOrder}
                    >
                      Keep Order
                    </Button>
                    <Button
                      onClick={() => handleCancelOrder(selectedOrder.orderId)}
                      disabled={cancellingOrder}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {cancellingOrder ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Cancelling...
                        </>
                      ) : (
                        'Yes, Cancel Order'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Shipping Information */}
          {selectedOrder.fulfillmentStatus === 'fulfilled' && selectedOrder.fulfillmentMethod === 'shipping' && (selectedOrder.trackingNumber || selectedOrder.shippingProvider) && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Shipping Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  {selectedOrder.shippingProvider && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Shipping Provider:</p>
                      <p className="text-gray-900 font-semibold">{selectedOrder.shippingProvider}</p>
                    </div>
                  )}
                  {selectedOrder.trackingNumber && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Tracking Number:</p>
                      <p className="text-gray-900 font-mono text-sm">{selectedOrder.trackingNumber}</p>
                      <p className="text-xs text-blue-600 mt-2">
                        📦 Use this tracking number on the carrier's website to track your shipment
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancellation Reason */}
          {selectedOrder.fulfillmentStatus === 'cancelled' && selectedOrder.internalNotes && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Cancellation Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Reason for cancellation:</p>
                    <p className="text-gray-900">
                      {selectedOrder.internalNotes.includes('BUYER CANCELLATION:')
                        ? selectedOrder.internalNotes.split('BUYER CANCELLATION: ')[1]?.split('\n')[0] || 'No reason provided'
                        : selectedOrder.internalNotes.includes('STORE CANCELLATION:')
                        ? selectedOrder.internalNotes.split('STORE CANCELLATION: ')[1]?.split('\n')[0] || 'No reason provided'
                        : 'No reason provided'}
                    </p>
                  </div>
                  {(() => {
                    const timestampMatch = selectedOrder.internalNotes.match(/\[([^\]]+)\]/);
                    if (timestampMatch) {
                      try {
                        const timestamp = new Date(timestampMatch[1]);
                        return (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Cancelled:</p>
                            <p className="text-gray-900">{timestamp.toLocaleString()}</p>
                          </div>
                        );
                      } catch (e) {
                        return null;
                      }
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Digital Downloads */}
          {digitalDownloads.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💾 Digital Downloads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {digitalDownloads.map((download: any) => {
                  const daysRemaining = getDaysRemaining(download.expiresAt);
                  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
                  const canDownload = !download.isExpired && !download.isRevoked && 
                    (download.downloadsRemaining === null || download.downloadsRemaining > 0);

                  return (
                    <div key={download.accessToken} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{download.productName}</h4>
                          <p className="text-sm text-gray-600">
                            {download.licenseType?.charAt(0).toUpperCase() + download.licenseType?.slice(1)} License
                          </p>
                        </div>
                      </div>

                      {canDownload ? (
                        <button
                          onClick={() => handleDownload(download.accessToken)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors mb-3"
                        >
                          <Package className="w-4 h-4" />
                          Download Now
                        </button>
                      ) : (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                          {download.isExpired && '⏰ Access has expired'}
                          {download.isRevoked && '🔒 Access has been revoked'}
                          {!download.isExpired && !download.isRevoked && download.downloadsRemaining === 0 && 
                            '📊 Download limit reached'}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span>
                            {download.downloadLimit === null ? (
                              'Unlimited downloads'
                            ) : (
                              <>
                                <span className="font-medium">{download.downloadsRemaining}</span> of{' '}
                                <span className="font-medium">{download.downloadLimit}</span> remaining
                              </>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {download.expiresAt === null ? (
                              'Lifetime access'
                            ) : (
                              <>
                                {download.isExpired ? (
                                  <span className="text-red-600 font-medium">Expired</span>
                                ) : (
                                  <>
                                    {isExpiringSoon && (
                                      <span className="text-orange-600 font-medium">
                                        ⚠️ {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                                      </span>
                                    )}
                                    {!isExpiringSoon && (
                                      <span>
                                        Expires {formatDate(download.expiresAt)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </span>
                        </div>

                        {download.asset && (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span>Size: {formatFileSize(download.asset.fileSize)}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span>Downloaded {download.downloadCount} {download.downloadCount === 1 ? 'time' : 'times'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900 mb-2">
                    💡 <strong>Download Instructions:</strong>
                  </p>
                  <ol className="list-decimal list-inside text-sm text-blue-900 space-y-1 ml-2">
                    <li>Click "Download Now" button above</li>
                    <li>Files will download directly to your device</li>
                    <li>Save files to a secure location</li>
                  </ol>
                  <p className="text-xs text-blue-800 mt-3">
                    🔒 Your download links are unique and secure. Do not share them with others.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refund Information */}
          {selectedOrder.refunds && selectedOrder.refunds.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Refund Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedOrder.refunds.map((refund) => (
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
                        <span className="text-lg font-bold text-gray-900">
                          ${(refund.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {refund.reason && (
                        <div>
                          <p className="text-gray-600 font-medium">Reason:</p>
                          <p className="text-gray-900">{refund.reason}</p>
                        </div>
                      )}
                      
                      {refund.gatewayRefundId && (
                        <div>
                          <p className="text-gray-600 font-medium">Refund ID:</p>
                          <p className="font-mono text-xs text-gray-900 break-all">
                            {refund.gatewayRefundId}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-gray-600 font-medium">Initiated:</p>
                        <p className="text-gray-900">{new Date(refund.createdAt).toLocaleString()}</p>
                      </div>
                      
                      {refund.completedAt && (
                        <div>
                          <p className="text-gray-600 font-medium">Completed:</p>
                          <p className="text-gray-900">{new Date(refund.completedAt).toLocaleString()}</p>
                        </div>
                      )}
                      
                      {refund.status === 'processing' && (
                        <p className="text-xs text-blue-600 mt-2">
                          ⏳ Refund is being processed. Funds typically arrive in 5-10 business days.
                        </p>
                      )}
                      
                      {refund.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ Refund has been completed. You should see the funds in your account.
                        </p>
                      )}
                      
                      {refund.status === 'failed' && (
                        <p className="text-xs text-red-600 mt-2">
                          ✗ Refund failed. Please contact the store for assistance.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <OrderReceipt
            cart={{
              tenantId: selectedOrder.tenantId,
              tenantName: selectedOrder.tenantName,
              tenantLogo: selectedOrder.tenantLogo || undefined,
              items: selectedOrder.items,
              subtotal: selectedOrder.subtotal,
              status: selectedOrder.status,
              orderId: selectedOrder.orderNumber,
              paymentId: (selectedOrder as any).paymentId || undefined,
              gatewayTransactionId: (selectedOrder as any).gatewayTransactionId || undefined,
              paidAt: new Date(selectedOrder.paidAt),
              fulfillmentMethod: selectedOrder.fulfillmentMethod || undefined,
              fulfillmentFee: selectedOrder.fulfillmentFee,
              customerInfo: selectedOrder.customerInfo,
              shippingAddress: selectedOrder.shippingAddress || undefined,
            }}
          />
        </div>

        {/* Platform Branding Footer */}
        <PoweredByFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-6xl py-4">
          <div className="flex items-center justify-between">
            <a href="/directory" className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
              <ShoppingBag className="h-5 w-5" />
              <span>Browse Stores</span>
            </a>
            <div className="flex items-center gap-4">
              <a href="/my-orders" className="text-gray-900 font-semibold">
                My Orders
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary-600" />
            My Orders
          </h1>
          <p className="text-gray-600">View your order history and track your purchases</p>
        </div>

        {/* Search Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Find Your Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Phone Number (Optional)
                  </label>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {error}
                </div>
              )}

              <Button
                onClick={handleSearch}
                disabled={loading || (!email && !phone)}
                className="w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Find My Orders
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {hasSearched && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No orders found</h3>
                    <p className="text-gray-600 mb-4">
                      We couldn't find any orders associated with this email or phone number.
                    </p>
                    <p className="text-sm text-gray-500">
                      Make sure you're using the same contact information you provided during checkout.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Found {orders.length} order{orders.length !== 1 ? 's' : ''}
                </div>
                
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.orderId}
                      className="cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          {/* Left: Order Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Order #{order.orderNumber}
                              </h3>
                              
                              {/* Payment Status Badge */}
                              {order.status === 'paid' && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  PAID
                                </span>
                              )}
                              {order.status === 'pending' && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  PENDING
                                </span>
                              )}
                              
                              {/* Fulfillment Status Badge */}
                              {order.fulfillmentStatus && (
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    statusColors[order.fulfillmentStatus] || 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {order.fulfillmentStatus.toUpperCase()}
                                </span>
                              )}
                              
                              {/* Refund Status Badge */}
                              {order.refunds && order.refunds.length > 0 && (
                                <>
                                  {order.refunds.some(r => r.status === 'completed') && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                      REFUNDED
                                    </span>
                                  )}
                                  {order.refunds.some(r => r.status === 'processing') && !order.refunds.some(r => r.status === 'completed') && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                      REFUND PROCESSING
                                    </span>
                                  )}
                                  {order.refunds.some(r => r.status === 'pending') && !order.refunds.some(r => r.status === 'processing' || r.status === 'completed') && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                      REFUND PENDING
                                    </span>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4" />
                                <span className="font-medium">{order.tenantName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(order.orderDate)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getFulfillmentIcon(order.fulfillmentMethod)}
                                <span>{getFulfillmentLabel(order.fulfillmentMethod)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span>{order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Total & Action */}
                          <div className="text-left lg:text-right">
                            <div className="text-2xl font-bold text-gray-900 mb-2">
                              {formatCurrency(order.total)}
                            </div>
                            <Button variant="outline" size="sm">
                              View Receipt
                            </Button>
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Platform Branding Footer */}
      <PoweredByFooter />
    </div>
  );
}
