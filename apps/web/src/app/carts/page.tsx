'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, ArrowRight, Trash2, ShoppingBag, CheckCircle2, Package, Receipt } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export default function MultiCartPage() {
  const router = useRouter();
  const { carts, clearCart, switchCart, getTotalItemCount } = useCart();

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Paid
          </div>
        );
      case 'fulfilled':
        return (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            <Package className="h-4 w-4" />
            Fulfilled
          </div>
        );
      default:
        return null;
    }
  };

  const handleViewCart = (tenantId: string) => {
    switchCart(tenantId);
    router.push(`/cart/${tenantId}`);
  };

  const handleCheckout = (tenantId: string) => {
    switchCart(tenantId);
    router.push(`/checkout?tenantId=${tenantId}`);
  };

  const activeCarts = carts.filter(cart => cart.status === 'active');
  const paidCarts = carts.filter(cart => cart.status === 'paid' || cart.status === 'fulfilled');

  const handleClearPaidOrders = async () => {
    if (!confirm(`Clear ${paidCarts.length} paid ${paidCarts.length === 1 ? 'order' : 'orders'} from your cart history?`)) {
      return;
    }

    // Clear all paid carts
    for (const cart of paidCarts) {
      await clearCart(cart.tenantId);
    }
  };

  if (carts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No active carts</h2>
                <p className="text-gray-600 mb-6">
                  Start shopping from your favorite local stores!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => router.push('/directory')}>
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Browse Stores
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/my-orders')}>
                    <Receipt className="mr-2 h-4 w-4" />
                    My Orders
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalAcrossAllCarts = carts.reduce((sum, cart) => sum + cart.subtotal, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Shopping Carts</h1>
          <p className="text-gray-600">
            {activeCarts.length > 0 && (
              <span>{activeCarts.length} active {activeCarts.length === 1 ? 'cart' : 'carts'}</span>
            )}
            {activeCarts.length > 0 && paidCarts.length > 0 && <span> • </span>}
            {paidCarts.length > 0 && (
              <span>{paidCarts.length} paid {paidCarts.length === 1 ? 'order' : 'orders'}</span>
            )}
          </p>
        </div>

        {/* Summary Card */}
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total across all carts</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalAcrossAllCarts)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {carts.length} {carts.length === 1 ? 'store' : 'stores'} • {getTotalItemCount()} items
                </p>
              </div>
              <ShoppingCart className="h-12 w-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Cart List */}
        <div className="space-y-4">
          {carts.map((cart) => (
            <Card key={cart.tenantId} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Store Info */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Store Logo */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {cart.tenantLogo ? (
                        <img
                          src={cart.tenantLogo}
                          alt={cart.tenantName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="h-8 w-8 text-gray-400" />
                      )}
                    </div>

                    {/* Store Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-gray-900">
                          {cart.tenantName}
                        </h3>
                        {getStatusBadge(cart.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-4 w-4" />
                          {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <span>•</span>
                        <span>Updated {formatDate(cart.lastUpdated)}</span>
                        {cart.paidAt && (
                          <>
                            <span>•</span>
                            <span>Paid {formatDate(cart.paidAt)}</span>
                          </>
                        )}
                      </div>

                      {/* Item Preview */}
                      <div className="space-y-1">
                        {cart.items.slice(0, 3).map((item) => (
                          <p key={item.id} className="text-sm text-gray-600 truncate">
                            {item.quantity}x {item.name}
                          </p>
                        ))}
                        {cart.items.length > 3 && (
                          <p className="text-sm text-gray-500">
                            +{cart.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-between items-end gap-4 md:w-64">
                    {/* Total */}
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">Cart Total</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(cart.subtotal)}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col gap-2 w-full">
                      {cart.status === 'active' ? (
                        <>
                          <Button
                            onClick={() => handleCheckout(cart.tenantId)}
                            className="w-full"
                          >
                            Checkout
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleViewCart(cart.tenantId)}
                            className="w-full"
                          >
                            View Cart
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove all items from ${cart.tenantName}?`)) {
                                clearCart(cart.tenantId);
                              }
                            }}
                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear Cart
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => handleViewCart(cart.tenantId)}
                            className="w-full"
                          >
                            View Order
                          </Button>
                          {cart.orderId && (
                            <div className="text-xs text-gray-500 text-center mt-1">
                              Order: {cart.orderId.substring(0, 12)}...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Receipts for Paid Carts */}
        <div className="space-y-6">
          {carts.filter(cart => cart.status === 'paid' || cart.status === 'fulfilled').map((cart) => (
            <OrderReceipt key={`receipt-${cart.tenantId}`} cart={cart} />
          ))}
        </div>

        {/* Clear Paid Orders Button */}
        {paidCarts.length > 0 && (
          <div className="mt-8">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Clear Order History
                    </h3>
                    <p className="text-sm text-gray-600">
                      Remove {paidCarts.length} completed {paidCarts.length === 1 ? 'order' : 'orders'} from this page
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleClearPaidOrders}
                    className="border-amber-300 hover:bg-amber-100 whitespace-nowrap"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Paid Orders
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Continue Shopping */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            size="lg"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            Continue Shopping
          </Button>
        </div>
      </div>
      
      {/* Powered By Footer */}
      <PoweredByFooter />
    </div>
  );
}
