import { Router } from 'express';
//import { prisma } from '../prisma';
import { authenticateToken } from '../../middleware/auth';
import { prisma } from '../../prisma';

const router = Router();

// Create PayPal order
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, paymentId, amount, customerInfo, shippingAddress, cartItems } = req.body;

    // Validate required fields (shippingAddress is optional for pickup orders)
    if (!orderId || !paymentId || !amount || !customerInfo || !cartItems) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'orderId, paymentId, amount, customerInfo, and cartItems are required'
      });
    }

    // Get PayPal credentials from database (you'll need to add these to your payment gateway config)
    // For now, using environment variables as fallback
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!paypalClientId || !paypalClientSecret) {
      return res.status(500).json({
        error: 'PayPal configuration missing',
        message: 'PayPal credentials not configured'
      });
    }

    // Get PayPal access token
    const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const { access_token } = tokenData;

    // Calculate totals from cart items
    const itemTotal = cartItems.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0);
    const totalAmount = itemTotal; // For now, just use item total (add shipping/tax later if needed)

    // Build purchase unit with optional shipping
    const purchaseUnit: any = {
      reference_id: orderId,
      amount: {
        currency_code: 'USD',
        value: (totalAmount / 100).toFixed(2), // Convert from cents to dollars
        breakdown: {
          item_total: {
            currency_code: 'USD',
            value: (itemTotal / 100).toFixed(2),
          },
        },
      },
      description: `Order ${orderId}`,
      items: cartItems.map((item: any) => ({
        name: item.name,
        quantity: item.quantity.toString(),
        unit_amount: {
          currency_code: 'USD',
          value: (item.unitPrice / 100).toFixed(2),
        },
      })),
    };

    // Only add shipping address if provided (not needed for pickup orders)
    if (shippingAddress) {
      purchaseUnit.shipping = {
        address: {
          address_line_1: shippingAddress.addressLine1,
          address_line_2: shippingAddress.addressLine2 || '',
          admin_area_2: shippingAddress.city,
          admin_area_1: shippingAddress.state,
          postal_code: shippingAddress.postalCode,
          country_code: shippingAddress.country,
        },
      };
    }

    // Create PayPal order
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [purchaseUnit],
        // Remove payer info to let user enter any email in PayPal popup
        // This prevents "associated with merchant" errors
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error('PayPal order creation failed:', errorData);
      throw new Error('Failed to create PayPal order');
    }

    const paypalOrder = await orderResponse.json() as { id: string };

    // Update payment record with PayPal order ID
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        gateway_transaction_id: paypalOrder.id,
        payment_method: 'paypal',
        payment_status: 'pending',
      },
    });

    res.json({
      success: true,
      orderId: paypalOrder.id,
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({
      error: 'Failed to create PayPal order',
      message: 'An error occurred while setting up your payment. Please try again.',
    });
  }
});

// Capture PayPal order
router.post('/capture-order', async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'orderId and paymentId are required'
      });
    }

    // Get PayPal configuration
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!paypalClientId || !paypalClientSecret) {
      return res.status(500).json({
        success: false,
        error: 'paypal_credentials_missing',
        message: 'PayPal credentials are not configured',
      });
    }

    // Get PayPal access token
    const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const { access_token } = tokenData;

    // Capture PayPal order
    const captureResponse = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureResponse.ok) {
      const errorData = await captureResponse.text();
      console.error('PayPal capture failed:', errorData);
      throw new Error('Failed to capture PayPal payment');
    }

    const captureData = await captureResponse.json() as { 
      id: string; 
      payer: { payer_id: string } 
    };

    // Update payment and order status
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        payment_status: 'paid',
        updated_at: new Date(),
        gateway_response: captureData,
      },
    });

    // Update order status and reduce inventory
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: { orders: true },
    });

    if (payment?.orders) {
      await prisma.orders.update({
        where: { id: payment.orders.id },
        data: {
          order_status: 'paid',
          paid_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Reduce inventory stock for each order item
      const orderItems = await prisma.order_items.findMany({
        where: { order_id: payment.orders.id },
      });

      for (const item of orderItems) {
        if (item.inventory_item_id) {
          try {
            // Reduce stock using decrement to handle concurrent orders safely
            await prisma.inventory_items.update({
              where: { id: item.inventory_item_id },
              data: {
                stock: { decrement: item.quantity },
                updated_at: new Date(),
              },
            });
            console.log(`[Inventory] Reduced stock for item ${item.inventory_item_id} by ${item.quantity}`);
          } catch (error) {
            console.error(`[Inventory] Failed to reduce stock for item ${item.inventory_item_id}:`, error);
            // Continue processing other items even if one fails
          }
        }
      }
    }

    res.json({
      success: true,
      capture: captureData,
    });
  } catch (error) {
    console.error('PayPal capture order error:', error);
    res.status(500).json({
      error: 'Failed to capture PayPal payment',
      message: 'An error occurred while processing your payment. Please try again.',
    });
  }
});

export default router;
