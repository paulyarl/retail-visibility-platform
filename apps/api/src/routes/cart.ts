import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { abandonedCartService } from '../services/AbandonedCartService';

const router = Router();

// In-memory cart storage (in production, use Redis or database)
const carts = new Map();

interface CartItem {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  price: number;
  addedAt: Date;
}

interface Cart {
  id: string;
  sessionId?: string;
  userId?: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GET /api/cart
 * Get user's cart
 */
router.get('/', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;
    const cartId = (userId || sessionId) as string;
    
    if (!cartId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Session ID or User ID is required'
      });
    }
    
    const cart = carts.get(cartId) || {
      id: uuidv4(),
      sessionId: sessionId as string,
      userId: userId as string,
      items: [],
      total: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('[Get Cart Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch cart'
    });
  }
});

/**
 * POST /api/cart/items
 * Add item to cart
 */
router.post('/items', async (req, res) => {
  try {
    const { sessionId, userId, tenantId, productId, quantity, price } = req.body;
    const cartId = userId || sessionId;
    
    if (!cartId || !tenantId || !productId || !quantity || !price) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Missing required fields'
      });
    }
    
    let cart = carts.get(cartId);
    
    if (!cart) {
      cart = {
        id: uuidv4(),
        sessionId,
        userId,
        items: [],
        total: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      carts.set(cartId, cart);
    }
    
    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(
      (item: CartItem) => item.tenantId === tenantId && item.productId === productId
    );
    
    if (existingItemIndex !== -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      const newItem: CartItem = {
        id: uuidv4(),
        tenantId,
        productId,
        quantity,
        price,
        addedAt: new Date()
      };
      cart.items.push(newItem);
    }
    
    // Recalculate total
    cart.total = cart.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    
    carts.set(cartId, cart);
    
    res.json({
      success: true,
      data: cart,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    console.error('[Add Cart Item Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to add item to cart'
    });
  }
});

/**
 * DELETE /api/cart/items/:itemId
 * Remove item from cart
 */
router.delete('/items/:itemId', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;
    const { itemId } = req.params;
    const cartId = userId || sessionId;
    
    if (!cartId || !itemId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Cart ID and Item ID are required'
      });
    }
    
    const cart = carts.get(cartId);
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Cart not found'
      });
    }
    
    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item: CartItem) => item.id !== itemId);
    
    if (cart.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Item not found in cart'
      });
    }
    
    // Recalculate total
    cart.total = cart.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
    cart.updatedAt = new Date();
    
    carts.set(cartId, cart);
    
    res.json({
      success: true,
      data: cart,
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    console.error('[Remove Cart Item Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to remove item from cart'
    });
  }
});

/**
 * DELETE /api/cart
 * Clear entire cart
 */
router.delete('/', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;
    const cartId = userId || sessionId;
    
    if (!cartId) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Session ID or User ID is required'
      });
    }
    
    const cart = carts.get(cartId);
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Cart not found'
      });
    }
    
    cart.items = [];
    cart.total = 0;
    cart.updatedAt = new Date();
    
    carts.set(cartId, cart);
    
    res.json({
      success: true,
      data: cart,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('[Clear Cart Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to clear cart'
    });
  }
});

/**
 * POST /api/cart/track
 * Track cart for abandoned cart recovery
 * Called by frontend when cart is updated (items added/removed/quantity changed)
 */
router.post('/track', async (req, res) => {
  try {
    const { tenantId, cartId, customerEmail, customerName, customerId, items } = req.body;

    if (!tenantId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'tenantId and items array are required'
      });
    }

    await abandonedCartService.trackCart({
      cartId,
      tenantId,
      customerEmail,
      customerName,
      customerId,
      items,
    });

    res.json({ success: true, message: 'Cart tracked' });
  } catch (error) {
    console.error('[Track Cart Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to track cart'
    });
  }
});

export default router;
