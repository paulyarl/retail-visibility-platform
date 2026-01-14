'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag, Store, ArrowLeft, CheckCircle2, Package } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { useEffect, use } from 'react';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export default function TenantCartPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const router = useRouter();
  const { getCart, removeItem, updateQuantity, clearCart, switchCart, getTotalCartCount } = useCart();
  
  const { tenantId } = use(params);
  const cart = getCart(tenantId);

  useEffect(() => {
    if (cart) {
      switchCart(tenantId);
    }
  }, [tenantId, cart, switchCart]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
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

  if (!cart) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Cart not found</h2>
                <p className="text-gray-600 mb-6">
                  This cart doesn't exist or has been cleared.
                </p>
                <Button onClick={() => router.push('/carts')}>
                  View All Carts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const shippingCost = cart.items.length > 0 ? 500 : 0; // $5.00 flat rate
  const total = cart.subtotal + shippingCost;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Back Button */}
        {getTotalCartCount() > 1 && (
          <Button
            variant="ghost"
            onClick={() => router.push('/carts')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to All Carts
          </Button>
        )}

        {/* Store Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
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
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-gray-900">{cart.tenantName}</h1>
                {getStatusBadge(cart.status)}
              </div>
              <p className="text-gray-600">{cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} in cart</p>
            </div>
          </div>
          
          {/* Visit Store Button */}
          <Button
            variant="outline"
            onClick={() => router.push(`/tenant/${cart.tenantId}`)}
            className="flex items-center gap-2"
          >
            <Store className="h-4 w-4" />
            Visit Store
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-gray-400" />
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">SKU: {item.sku}</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>

                    {/* Quantity Controls or Display */}
                    <div className="flex flex-col items-end gap-4">
                      {cart.status === 'active' ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id, cart.tenantId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1, cart.tenantId)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = parseInt(e.target.value, 10);
                                if (!isNaN(qty) && qty > 0) {
                                  updateQuantity(item.id, qty, cart.tenantId);
                                }
                              }}
                              className="w-16 text-center"
                              min="1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1, cart.tenantId)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center px-4 py-2 bg-gray-100 rounded-lg">
                          <p className="text-sm text-gray-600">Quantity</p>
                          <p className="text-lg font-bold text-gray-900">{item.quantity}</p>
                        </div>
                      )}

                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Clear Cart Button - Only for active carts */}
            {cart.status === 'active' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm(`Remove all items from ${cart.tenantName}?`)) {
                    clearCart(cart.tenantId);
                    router.push('/carts');
                  }
                }}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Cart
              </Button>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({cart.itemCount} items)</span>
                  <span className="font-medium">{formatCurrency(cart.subtotal)}</span>
                </div>

                {/* Shipping */}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {shippingCost > 0 ? formatCurrency(shippingCost) : 'FREE'}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Checkout Button - Only for active carts */}
                {cart.status === 'active' ? (
                  <Button
                    onClick={() => router.push(`/checkout?tenantId=${cart.tenantId}`)}
                    className="w-full"
                    size="lg"
                  >
                    Proceed to Checkout
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-green-900">Order Completed</p>
                      {cart.orderId && (
                        <p className="text-xs text-green-700 mt-1">Order ID: {cart.orderId}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => router.push('/my-orders')}
                      className="w-full"
                      size="lg"
                    >
                      <ShoppingBag className="mr-2 h-5 w-5" />
                      View My Orders
                    </Button>
                  </>
                )}

                {/* Continue Shopping */}
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                  className="w-full"
                >
                  Continue Shopping
                </Button>

                {/* View All Carts */}
                {getTotalCartCount() > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/carts')}
                    className="w-full"
                  >
                    View All Carts ({getTotalCartCount()})
                  </Button>
                )}

                {/* Payment Methods */}
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-600 text-center mb-2">We accept</p>
                  <div className="flex justify-center gap-2">
                    <div className="px-3 py-2 bg-gray-100 rounded text-xs font-medium">
                      PayPal
                    </div>
                    <div className="px-3 py-2 bg-gray-100 rounded text-xs font-medium">
                      Credit Card
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Order Receipt for Paid Orders */}
      {(cart.status === 'paid' || cart.status === 'fulfilled') && (
        <div className="mt-8">
          <OrderReceipt cart={cart} />
        </div>
      )}

      {/* Platform Branding Footer */}
      <PoweredByFooter />
    </div>
  );
}
