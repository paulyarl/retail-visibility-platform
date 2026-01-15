'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Package, 
  CreditCard, 
  Truck, 
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Download
} from 'lucide-react';

interface OrderDetails {
  orderId: string;
  orderNumber: string;
  paymentId: string | null;
  gatewayTransactionId: string | null;
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  status: string;
  fulfillmentStatus: string;
  orderDate: string;
  paidAt: string;
  total: number;
  subtotal: number;
  platformFee: number;
  fulfillmentFee: number;
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping' | null;
  trackingNumber?: string;
  shippingProvider?: string;
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
}

const statusIcons: Record<string, any> = {
  draft: AlertCircle,
  pending: Clock,
  confirmed: CheckCircle,
  paid: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<string, string> = {
  draft: 'text-gray-600',
  pending: 'text-yellow-600',
  confirmed: 'text-blue-600',
  paid: 'text-green-600',
  processing: 'text-purple-600',
  shipped: 'text-indigo-600',
  delivered: 'text-green-600',
  cancelled: 'text-red-600',
};

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [digitalDownloads, setDigitalDownloads] = useState<any[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  useEffect(() => {
    if (order?.orderId) {
      fetchDigitalDownloads();
    }
  }, [order?.orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${id}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
      }
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDigitalDownloads = async () => {
    if (!order?.orderId) return;
    
    try {
      setLoadingDownloads(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/download/orders/${order.orderId}/downloads`);
      
      if (response.ok) {
        const data = await response.json();
        setDigitalDownloads(data.downloads || []);
      }
    } catch (error) {
      console.error('Error fetching digital downloads:', error);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Order not found</h3>
          <Button onClick={() => router.push('/orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  const StatusIcon = statusIcons[order.status] || AlertCircle;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => router.push('/orders')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Order {order.orderNumber}
              </h1>
              <p className="text-gray-600">
                Placed on {formatDate(order.orderDate)}
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 ${statusColors[order.status]}`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-semibold capitalize">{order.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                      {/* Product Image */}
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-8 w-8 text-gray-400" />
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.name}</h4>
                        <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(item.unitPrice)} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div className="mt-6 pt-6 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.fulfillmentFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span className="text-gray-900">{formatCurrency(order.fulfillmentFee)}</span>
                    </div>
                  )}
                  {order.platformFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Platform Fee</span>
                      <span className="text-gray-900">{formatCurrency(order.platformFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            {order.paymentId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment ID</span>
                      <span className="font-mono text-sm">{order.paymentId}</span>
                    </div>
                    {order.gatewayTransactionId && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction ID</span>
                        <span className="font-mono text-sm">{order.gatewayTransactionId}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount</span>
                      <span className="font-medium">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date</span>
                      <span className="text-sm">{formatDate(order.paidAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shipping Information */}
            {order.trackingNumber && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.shippingProvider && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Carrier</span>
                        <span className="font-medium capitalize">{order.shippingProvider}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tracking Number</span>
                      <span className="font-mono text-sm">{order.trackingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="font-medium capitalize">{order.fulfillmentStatus}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Digital Downloads */}
            {digitalDownloads.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Digital Downloads
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
                          <Button
                            onClick={() => handleDownload(download.accessToken)}
                            className="w-full mb-3"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Now
                          </Button>
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

            {/* Order Timeline */}
            {false && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Order Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">No status history available</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-gray-600">Name</div>
                  <div className="font-medium">{order.customerInfo.firstName} {order.customerInfo.lastName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Email</div>
                  <div className="font-medium">{order.customerInfo.email}</div>
                </div>
                {order.customerInfo.phone && (
                  <div>
                    <div className="text-sm text-gray-600">Phone</div>
                    <div className="font-medium">{order.customerInfo.phone}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Notes */}
            {order.internalNotes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{order.internalNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => window.print()}>
                  Print Order
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/orders/confirmation?payment=${order.paymentId}`)}
                >
                  View Receipt
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
