'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Store, ArrowRight, Trash2, ShoppingBag, CheckCircle2, Package, Receipt, Edit, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import OrderReceipt from '@/components/checkout/OrderReceipt';
import { PoweredByFooter } from '@/components/PoweredByFooter';

export default function MultiCartPage() {
  const router = useRouter();
  const { carts, clearCart: clearSpecificCart, updateQuantity, removeItem, totalItems } = useMultiCart();
  const [expandedCart, setExpandedCart] = useState<string | null>(null);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const toggleCartExpanded = (cartKey: string) => {
    setExpandedCart(expandedCart === cartKey ? null : cartKey);
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

  const handleCheckout = (tenantId: string, gatewayType: string) => {
    router.push(`/checkout?tenantId=${tenantId}&gatewayType=${gatewayType}`);
  };

  const handleClearCart = (tenantId: string, gatewayType: string) => {
    if (!confirm('Remove all items from this cart?')) {
      return;
    }
    clearSpecificCart(tenantId, gatewayType);
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

  const totalAcrossAllCarts = carts.reduce((sum, cartSummary) => sum + cartSummary.total_cents, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Shopping Carts</h1>
          <p className="text-gray-600">
            {carts.length} {carts.length === 1 ? 'cart' : 'carts'} • {totalItems} items
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
                  {carts.length} {carts.length === 1 ? 'cart' : 'carts'} • {totalItems} items
                </p>
              </div>
              <ShoppingCart className="h-12 w-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Cart List */}
        <div className="space-y-4">
          {carts.map((cartSummary) => {
            const { cart, item_count, total_cents } = cartSummary;
            return (
              <Card key={cartSummary.key} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Store Info */}
                    <div className="flex items-start gap-4 flex-1">
                      {/* Store Logo */}
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {cart.tenant_logo ? (
                          <img
                            src={cart.tenant_logo}
                            alt={cart.tenant_name}
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
                            {cart.tenant_name}
                          </h3>
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                            {cart.gateway_type === 'square' ? 'Square' : cart.gateway_type === 'paypal' ? 'PayPal' : cart.gateway_type}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="h-4 w-4" />
                            {item_count} {item_count === 1 ? 'item' : 'items'}
                          </span>
                        </div>

                        {/* Item Preview */}
                        <div className="space-y-1">
                          {cart.items.slice(0, 3).map((item) => (
                            <p key={item.product_id} className="text-sm text-gray-600 truncate">
                              {item.quantity}x {item.product_name}
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
                        {formatCurrency(total_cents)}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col gap-2 w-full">
                      <Button
                        onClick={() => handleCheckout(cart.tenant_id, cart.gateway_type)}
                        className="w-full"
                      >
                        Checkout with {cart.gateway_type === 'square' ? 'Square' : 'PayPal'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => toggleCartExpanded(cartSummary.key)}
                        className="w-full"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Cart
                        {expandedCart === cartSummary.key ? (
                          <ChevronUp className="ml-2 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleClearCart(cart.tenant_id, cart.gateway_type)}
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Cart
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expandable Cart Items Section */}
                {expandedCart === cartSummary.key && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="font-semibold text-gray-900 mb-4">Cart Items</h4>
                    <div className="space-y-3">
                      {cart.items.map((item) => (
                        <div key={item.product_id} className="flex items-center gap-4 bg-white p-4 rounded-lg">
                          {/* Product Image */}
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ShoppingBag className="h-6 w-6 text-gray-400" />
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-gray-900 truncate">{item.product_name}</h5>
                            <p className="text-sm text-gray-600">
                              {formatCurrency(item.price_cents)} each
                            </p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(cart.tenant_id, cart.gateway_type, item.product_id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(cart.tenant_id, cart.gateway_type, item.product_id, item.quantity + 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Item Total */}
                          <div className="text-right min-w-[80px]">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(item.price_cents * item.quantity)}
                            </p>
                          </div>

                          {/* Remove Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(cart.tenant_id, cart.gateway_type, item.product_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Add More Items Button */}
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/tenant/${cart.tenant_id}`)}
                        className="w-full"
                      >
                        <Store className="mr-2 h-4 w-4" />
                        Add More Items from {cart.tenant_name}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>

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
