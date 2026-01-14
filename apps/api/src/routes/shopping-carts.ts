/**
 * Shopping Carts API Routes
 * Database-persisted shopping carts for authenticated users
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/shopping-carts
 * Get all active carts for the authenticated user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const pool = getDirectPool();

    const result = await pool.query(
      `SELECT * FROM v_cart_summary 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY last_activity_at DESC`,
      [user.userId]
    );

    res.json({
      success: true,
      carts: result.rows,
    });
  } catch (error: any) {
    console.error('[Shopping Carts] List error:', error);
    res.status(500).json({
      success: false,
      error: 'cart_list_failed',
      message: 'Failed to fetch carts',
      details: error.message,
    });
  }
});

/**
 * GET /api/shopping-carts/:cartId
 * Get specific cart with all items
 */
router.get('/:cartId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { cartId } = req.params;
    const pool = getDirectPool();

    // Get cart
    const cartResult = await pool.query(
      `SELECT * FROM shopping_carts 
       WHERE id = $1 AND user_id = $2`,
      [cartId, user.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'cart_not_found',
        message: 'Cart not found',
      });
    }

    // Get cart items
    const itemsResult = await pool.query(
      `SELECT * FROM shopping_cart_items 
       WHERE cart_id = $1 
       ORDER BY added_at ASC`,
      [cartId]
    );

    const cart = cartResult.rows[0];
    cart.items = itemsResult.rows;

    res.json({
      success: true,
      cart,
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'cart_fetch_failed',
      message: 'Failed to fetch cart',
      details: error.message,
    });
  }
});

/**
 * POST /api/shopping-carts
 * Create a new cart or get existing cart for tenant
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { tenant_id, tenant_name, tenant_logo } = req.body;

    if (!tenant_id || !tenant_name) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'tenant_id and tenant_name are required',
      });
    }

    const pool = getDirectPool();

    // Check if cart already exists
    const existingResult = await pool.query(
      `SELECT * FROM shopping_carts 
       WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [user.userId, tenant_id]
    );

    if (existingResult.rows.length > 0) {
      return res.json({
        success: true,
        cart: existingResult.rows[0],
        existed: true,
      });
    }

    // Create new cart
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await pool.query(
      `INSERT INTO shopping_carts (
        id, user_id, tenant_id, tenant_name, tenant_logo, status
      ) VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *`,
      [cartId, user.userId, tenant_id, tenant_name, tenant_logo || null]
    );

    res.status(201).json({
      success: true,
      cart: result.rows[0],
      existed: false,
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'cart_creation_failed',
      message: 'Failed to create cart',
      details: error.message,
    });
  }
});

/**
 * POST /api/shopping-carts/:cartId/items
 * Add item to cart or update quantity if exists
 */
router.post('/:cartId/items', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { cartId } = req.params;
    const {
      product_id,
      product_name,
      product_sku,
      product_image_url,
      unit_price_cents,
      quantity = 1,
      inventory_item_id,
    } = req.body;

    // Validation
    if (!product_id || !product_name || !product_sku || unit_price_cents === undefined) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'product_id, product_name, product_sku, and unit_price_cents are required',
      });
    }

    const pool = getDirectPool();

    // Verify cart ownership
    const cartResult = await pool.query(
      `SELECT * FROM shopping_carts WHERE id = $1 AND user_id = $2`,
      [cartId, user.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'cart_not_found',
        message: 'Cart not found',
      });
    }

    // Check if item already exists
    const existingItem = await pool.query(
      `SELECT * FROM shopping_cart_items 
       WHERE cart_id = $1 AND product_id = $2`,
      [cartId, product_id]
    );

    let result;
    if (existingItem.rows.length > 0) {
      // Update quantity
      result = await pool.query(
        `UPDATE shopping_cart_items 
         SET quantity = quantity + $1, updated_at = NOW()
         WHERE cart_id = $2 AND product_id = $3
         RETURNING *`,
        [quantity, cartId, product_id]
      );
    } else {
      // Add new item
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      result = await pool.query(
        `INSERT INTO shopping_cart_items (
          id, cart_id, inventory_item_id, product_id, product_name, 
          product_sku, product_image_url, unit_price_cents, quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          itemId,
          cartId,
          inventory_item_id || null,
          product_id,
          product_name,
          product_sku,
          product_image_url || null,
          unit_price_cents,
          quantity,
        ]
      );
    }

    res.json({
      success: true,
      item: result.rows[0],
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Add item error:', error);
    res.status(500).json({
      success: false,
      error: 'add_item_failed',
      message: 'Failed to add item to cart',
      details: error.message,
    });
  }
});

/**
 * PUT /api/shopping-carts/:cartId/items/:itemId
 * Update item quantity
 */
router.put('/:cartId/items/:itemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { cartId, itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_quantity',
        message: 'Valid quantity is required',
      });
    }

    const pool = getDirectPool();

    // Verify cart ownership
    const cartResult = await pool.query(
      `SELECT * FROM shopping_carts WHERE id = $1 AND user_id = $2`,
      [cartId, user.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'cart_not_found',
        message: 'Cart not found',
      });
    }

    if (quantity === 0) {
      // Delete item
      await pool.query(
        `DELETE FROM shopping_cart_items WHERE id = $1 AND cart_id = $2`,
        [itemId, cartId]
      );

      return res.json({
        success: true,
        deleted: true,
      });
    }

    // Update quantity
    const result = await pool.query(
      `UPDATE shopping_cart_items 
       SET quantity = $1, updated_at = NOW()
       WHERE id = $2 AND cart_id = $3
       RETURNING *`,
      [quantity, itemId, cartId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'item_not_found',
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      item: result.rows[0],
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Update item error:', error);
    res.status(500).json({
      success: false,
      error: 'update_item_failed',
      message: 'Failed to update item',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/shopping-carts/:cartId/items/:itemId
 * Remove item from cart
 */
router.delete('/:cartId/items/:itemId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { cartId, itemId } = req.params;
    const pool = getDirectPool();

    // Verify cart ownership
    const cartResult = await pool.query(
      `SELECT * FROM shopping_carts WHERE id = $1 AND user_id = $2`,
      [cartId, user.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'cart_not_found',
        message: 'Cart not found',
      });
    }

    await pool.query(
      `DELETE FROM shopping_cart_items WHERE id = $1 AND cart_id = $2`,
      [itemId, cartId]
    );

    res.json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Delete item error:', error);
    res.status(500).json({
      success: false,
      error: 'delete_item_failed',
      message: 'Failed to remove item',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/shopping-carts/:cartId
 * Clear entire cart (mark as converted or delete)
 */
router.delete('/:cartId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { cartId } = req.params;
    const { mark_converted } = req.query;
    const pool = getDirectPool();

    // Verify cart ownership
    const cartResult = await pool.query(
      `SELECT * FROM shopping_carts WHERE id = $1 AND user_id = $2`,
      [cartId, user.userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'cart_not_found',
        message: 'Cart not found',
      });
    }

    if (mark_converted === 'true') {
      // Mark as converted (for post-checkout)
      await pool.query(
        `UPDATE shopping_carts SET status = 'converted', updated_at = NOW() WHERE id = $1`,
        [cartId]
      );
    } else {
      // Delete cart and items (CASCADE will handle items)
      await pool.query(`DELETE FROM shopping_carts WHERE id = $1`, [cartId]);
    }

    res.json({
      success: true,
      message: mark_converted === 'true' ? 'Cart marked as converted' : 'Cart deleted',
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Delete cart error:', error);
    res.status(500).json({
      success: false,
      error: 'delete_cart_failed',
      message: 'Failed to delete cart',
      details: error.message,
    });
  }
});

/**
 * POST /api/shopping-carts/migrate
 * Migrate guest cart to authenticated user
 */
router.post('/migrate', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { guest_carts } = req.body;

    if (!Array.isArray(guest_carts)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_input',
        message: 'guest_carts must be an array',
      });
    }

    const pool = getDirectPool();
    const migratedCarts = [];

    for (const guestCart of guest_carts) {
      const { tenant_id, tenant_name, tenant_logo, items } = guestCart;

      if (!tenant_id || !tenant_name || !Array.isArray(items)) {
        continue;
      }

      // Check if user already has cart for this tenant
      const existingResult = await pool.query(
        `SELECT * FROM shopping_carts 
         WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'`,
        [user.userId, tenant_id]
      );

      let cartId;
      if (existingResult.rows.length > 0) {
        // Merge into existing cart
        cartId = existingResult.rows[0].id;
      } else {
        // Create new cart
        cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await pool.query(
          `INSERT INTO shopping_carts (
            id, user_id, tenant_id, tenant_name, tenant_logo, status
          ) VALUES ($1, $2, $3, $4, $5, 'active')`,
          [cartId, user.userId, tenant_id, tenant_name, tenant_logo || null]
        );
      }

      // Add items
      for (const item of items) {
        const {
          id: product_id,
          name: product_name,
          sku: product_sku,
          imageUrl: product_image_url,
          unitPrice: unit_price_cents,
          quantity,
          inventoryItemId: inventory_item_id,
        } = item;

        if (!product_id || !product_name || !product_sku) {
          continue;
        }

        // Check if item exists
        const existingItem = await pool.query(
          `SELECT * FROM shopping_cart_items 
           WHERE cart_id = $1 AND product_id = $2`,
          [cartId, product_id]
        );

        if (existingItem.rows.length > 0) {
          // Update quantity
          await pool.query(
            `UPDATE shopping_cart_items 
             SET quantity = quantity + $1, updated_at = NOW()
             WHERE cart_id = $2 AND product_id = $3`,
            [quantity, cartId, product_id]
          );
        } else {
          // Add new item
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await pool.query(
            `INSERT INTO shopping_cart_items (
              id, cart_id, inventory_item_id, product_id, product_name, 
              product_sku, product_image_url, unit_price_cents, quantity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              itemId,
              cartId,
              inventory_item_id || null,
              product_id,
              product_name,
              product_sku,
              product_image_url || null,
              unit_price_cents,
              quantity,
            ]
          );
        }
      }

      migratedCarts.push({ tenant_id, cart_id: cartId });
    }

    res.json({
      success: true,
      migrated_carts: migratedCarts,
      message: `Successfully migrated ${migratedCarts.length} carts`,
    });
  } catch (error: any) {
    console.error('[Shopping Carts] Migration error:', error);
    res.status(500).json({
      success: false,
      error: 'migration_failed',
      message: 'Failed to migrate carts',
      details: error.message,
    });
  }
});

export default router;
