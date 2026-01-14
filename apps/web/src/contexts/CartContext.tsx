'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number; // in cents (effective price - sale price if on sale)
  listPrice?: number; // in cents (original price if item is on sale)
  imageUrl?: string;
  inventoryItemId?: string;
  tenantId: string; // ← Added tenant context
}

export type CartStatus = 'active' | 'paid' | 'fulfilled';

export interface TenantCart {
  tenantId: string;
  tenantName: string;
  tenantLogo?: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  lastUpdated: Date;
  status: CartStatus;
  orderId?: string;
  paidAt?: Date;
  fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
  fulfillmentFee?: number;
  gatewayTransactionId?: string;
  customerInfo?: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface CartContextType {
  // Multi-cart management
  carts: TenantCart[];
  activeCartTenantId: string | null;
  
  // Current cart (active tenant)
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  
  // Database sync state
  isAuthenticated: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  
  // Actions
  addItem: (item: CartItem, tenantName: string, tenantLogo?: string) => Promise<void>;
  removeItem: (itemId: string, tenantId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number, tenantId: string) => Promise<void>;
  clearCart: (tenantId: string) => Promise<void>;
  markCartAsPaid: (tenantId: string, orderId: string, customerInfo?: any, shippingAddress?: any, fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping', fulfillmentFee?: number, gatewayTransactionId?: string) => Promise<void>;
  switchCart: (tenantId: string) => void;
  getCart: (tenantId: string) => TenantCart | undefined;
  getTotalCartCount: () => number;
  getTotalItemCount: () => number;
  
  // Database sync methods
  syncToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<TenantCart[]>([]);
  const [activeCartTenantId, setActiveCartTenantId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  // For now, carts are localStorage-only (no authentication required)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load carts from localStorage on mount with migration
  useEffect(() => {
    const savedCarts = localStorage.getItem('shopping-carts');
    const savedActiveTenant = localStorage.getItem('active-cart-tenant');
    
    if (savedCarts) {
      try {
        const parsedCarts = JSON.parse(savedCarts);
        let needsMigration = false;
        
        // Migrate old carts to new structure
        const cartsWithDates = parsedCarts.map((cart: any) => {
          // Check if cart needs migration (missing status field)
          if (!cart.status) {
            needsMigration = true;
            console.log('[Cart] Migrating cart to new structure:', cart.tenantId);
          }
          
          // Check if orderId is actually a payment ID (starts with 'pay-')
          let migratedOrderId = cart.orderId;
          if (cart.orderId && cart.orderId.startsWith('pay-')) {
            console.log('[Cart] Detected payment ID stored as order ID, clearing:', cart.orderId);
            migratedOrderId = undefined; // Clear payment IDs from old carts
            needsMigration = true;
          }
          
          return {
            ...cart,
            lastUpdated: new Date(cart.lastUpdated),
            paidAt: cart.paidAt ? new Date(cart.paidAt) : undefined,
            status: cart.status || 'active', // Default to active for old carts
            orderId: migratedOrderId,
            customerInfo: cart.customerInfo || undefined,
            shippingAddress: cart.shippingAddress || undefined,
            fulfillmentMethod: cart.fulfillmentMethod || undefined,
            fulfillmentFee: cart.fulfillmentFee || undefined,
            gatewayTransactionId: cart.gatewayTransactionId || undefined,
          };
        });
        
        setCarts(cartsWithDates);
        
        // Save migrated carts back to localStorage
        if (needsMigration) {
          console.log('[Cart] Saving migrated carts to localStorage');
          localStorage.setItem('shopping-carts', JSON.stringify(cartsWithDates));
        }
      } catch (error) {
        console.error('Failed to load carts from localStorage:', error);
        // Clear corrupted cart data
        localStorage.removeItem('shopping-carts');
        setCarts([]);
      }
    }
    
    if (savedActiveTenant) {
      setActiveCartTenantId(savedActiveTenant);
    }
  }, []);

  // Save carts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('shopping-carts', JSON.stringify(carts));
  }, [carts]);

  // Save active tenant
  useEffect(() => {
    if (activeCartTenantId) {
      localStorage.setItem('active-cart-tenant', activeCartTenantId);
    }
  }, [activeCartTenantId]);

  // Load carts from database for authenticated users
  const loadFromDatabase = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsSyncing(true);
      const response = await fetch('/api/shopping-carts');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.carts)) {
          const dbCarts: TenantCart[] = data.carts.map((cart: any) => ({
            tenantId: cart.tenant_id,
            tenantName: cart.tenant_name,
            tenantLogo: cart.tenant_logo,
            items: [], // Items loaded separately
            subtotal: cart.subtotal_cents || 0,
            itemCount: cart.item_count || 0,
            lastUpdated: new Date(cart.last_activity_at),
            status: cart.status || 'active',
            orderId: cart.order_id,
            paidAt: cart.paid_at ? new Date(cart.paid_at) : undefined,
          }));
          setCarts(dbCarts);
          setLastSyncedAt(new Date());
        }
      }
    } catch (error) {
      console.error('[Cart] Load from database failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync cart to database for authenticated users
  const syncToDatabase = async () => {
    if (!isAuthenticated) return;
    // Database sync happens automatically in add/update/remove methods
  };

  // Load from database on authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadFromDatabase();
    }
  }, [isAuthenticated]);

  const addItem = async (newItem: CartItem, tenantName: string, tenantLogo?: string) => {
    // Update local state first
    setCarts((currentCarts) => {
      const cartIndex = currentCarts.findIndex((c) => c.tenantId === newItem.tenantId);

      if (cartIndex > -1) {
        // Cart exists for this tenant
        const cart = currentCarts[cartIndex];
        
        // If cart is paid, create a new cart instead of adding to paid cart
        if (cart.status === 'paid') {
          console.log('[CartContext] Cart is paid, creating new cart for tenant:', newItem.tenantId);
          const newCart: TenantCart = {
            tenantId: newItem.tenantId,
            tenantName,
            tenantLogo,
            items: [newItem],
            subtotal: newItem.unitPrice * newItem.quantity,
            itemCount: newItem.quantity,
            lastUpdated: new Date(),
            status: 'active',
          };
          
          // Set as active cart
          setActiveCartTenantId(newItem.tenantId);
          
          // Replace the paid cart with the new cart
          const updatedCarts = [...currentCarts];
          updatedCarts[cartIndex] = newCart;
          return updatedCarts;
        }
        
        // Cart is active, add item to existing cart
        const updatedCarts = [...currentCarts];
        const activeCart = updatedCarts[cartIndex];
        
        // Check if item already exists in this cart
        const existingItemIndex = activeCart.items.findIndex(
          (item) => item.id === newItem.id || item.sku === newItem.sku
        );

        if (existingItemIndex > -1) {
          // Update quantity
          activeCart.items[existingItemIndex].quantity += newItem.quantity;
        } else {
          // Add new item
          activeCart.items.push(newItem);
        }

        // Recalculate totals
        activeCart.subtotal = activeCart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        activeCart.itemCount = activeCart.items.reduce((sum, item) => sum + item.quantity, 0);
        activeCart.lastUpdated = new Date();

        return updatedCarts;
      } else {
        // Create new cart for this tenant
        const newCart: TenantCart = {
          tenantId: newItem.tenantId,
          tenantName,
          tenantLogo,
          items: [newItem],
          subtotal: newItem.unitPrice * newItem.quantity,
          itemCount: newItem.quantity,
          lastUpdated: new Date(),
          status: 'active',
        };
        
        // Set as active cart
        setActiveCartTenantId(newItem.tenantId);
        
        return [...currentCarts, newCart];
      }
    });

    // Sync to database if authenticated
    if (isAuthenticated) {
      try {
        setIsSyncing(true);
        
        // Create or get cart
        const cartResponse = await fetch('/api/shopping-carts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: newItem.tenantId,
            tenant_name: tenantName,
            tenant_logo: tenantLogo,
          }),
        });
        
        if (cartResponse.ok) {
          const cartData = await cartResponse.json();
          const cartId = cartData.cart.id;
          
          // Add item to cart
          await fetch(`/api/shopping-carts/${cartId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: newItem.id,
              product_name: newItem.name,
              product_sku: newItem.sku,
              product_image_url: newItem.imageUrl,
              unit_price_cents: newItem.unitPrice,
              quantity: newItem.quantity,
              inventory_item_id: newItem.inventoryItemId,
            }),
          });
          
          setLastSyncedAt(new Date());
        }
      } catch (error) {
        console.error('[Cart] Sync to database failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const removeItem = async (itemId: string, tenantId: string) => {
    // Update local state first
    setCarts((currentCarts) => {
      return currentCarts.map((cart) => {
        if (cart.tenantId !== tenantId) return cart;

        const updatedItems = cart.items.filter((item) => item.id !== itemId);
        
        return {
          ...cart,
          items: updatedItems,
          subtotal: updatedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
          itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
          lastUpdated: new Date(),
        };
      }).filter((cart) => cart.items.length > 0); // Remove empty carts
    });

    // Sync to database if authenticated
    if (isAuthenticated) {
      try {
        setIsSyncing(true);
        const cart = carts.find(c => c.tenantId === tenantId);
        if (cart) {
          // Find cart in database and remove item
          const cartsResponse = await fetch('/api/shopping-carts');
          if (cartsResponse.ok) {
            const data = await cartsResponse.json();
            const dbCart = data.carts?.find((c: any) => c.tenant_id === tenantId);
            if (dbCart) {
              await fetch(`/api/shopping-carts/${dbCart.cart_id}/items/${itemId}`, {
                method: 'DELETE',
              });
              setLastSyncedAt(new Date());
            }
          }
        }
      } catch (error) {
        console.error('[Cart] Remove item sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const updateQuantity = async (itemId: string, quantity: number, tenantId: string) => {
    if (quantity <= 0) {
      await removeItem(itemId, tenantId);
      return;
    }

    setCarts((currentCarts) => {
      return currentCarts.map((cart) => {
        if (cart.tenantId !== tenantId) return cart;

        const updatedItems = cart.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        );

        return {
          ...cart,
          items: updatedItems,
          subtotal: updatedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
          itemCount: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
          lastUpdated: new Date(),
        };
      });
    });

    // Sync to database if authenticated
    if (isAuthenticated) {
      try {
        setIsSyncing(true);
        const cartsResponse = await fetch('/api/shopping-carts');
        if (cartsResponse.ok) {
          const data = await cartsResponse.json();
          const dbCart = data.carts?.find((c: any) => c.tenant_id === tenantId);
          if (dbCart) {
            await fetch(`/api/shopping-carts/${dbCart.cart_id}/items/${itemId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quantity }),
            });
            setLastSyncedAt(new Date());
          }
        }
      } catch (error) {
        console.error('[Cart] Update quantity sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const clearCart = async (tenantId: string) => {
    // Update local state first
    setCarts((currentCarts) => currentCarts.filter((cart) => cart.tenantId !== tenantId));
    if (activeCartTenantId === tenantId) {
      setActiveCartTenantId(null);
    }

    // Sync to database if authenticated
    if (isAuthenticated) {
      try {
        setIsSyncing(true);
        const cartsResponse = await fetch('/api/shopping-carts');
        if (cartsResponse.ok) {
          const data = await cartsResponse.json();
          const dbCart = data.carts?.find((c: any) => c.tenant_id === tenantId);
          if (dbCart) {
            await fetch(`/api/shopping-carts/${dbCart.cart_id}?mark_converted=true`, {
              method: 'DELETE',
            });
            setLastSyncedAt(new Date());
          }
        }
      } catch (error) {
        console.error('[Cart] Clear cart sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const markCartAsPaid = async (
    tenantId: string, 
    orderId: string, 
    customerInfo?: any, 
    shippingAddress?: any,
    fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping',
    fulfillmentFee?: number,
    gatewayTransactionId?: string
  ) => {
    console.log('[CartContext] markCartAsPaid called:', {
      tenantId,
      orderId,
      customerInfo,
      shippingAddress,
      fulfillmentMethod,
      fulfillmentFee,
      gatewayTransactionId
    });
    
    setCarts((currentCarts) => {
      const updatedCarts = currentCarts.map((cart) => {
        if (cart.tenantId !== tenantId) return cart;
        
        const updatedCart = {
          ...cart,
          status: 'paid' as CartStatus,
          orderId,
          paidAt: new Date(),
          lastUpdated: new Date(),
          customerInfo,
          shippingAddress,
          fulfillmentMethod,
          fulfillmentFee,
          gatewayTransactionId,
        };
        
        console.log('[CartContext] Updated cart:', updatedCart);
        return updatedCart;
      });
      
      console.log('[CartContext] All carts after update:', updatedCarts);
      return updatedCarts;
    });

    // Sync to database if authenticated
    if (isAuthenticated) {
      try {
        setIsSyncing(true);
        const cartsResponse = await fetch('/api/shopping-carts');
        if (cartsResponse.ok) {
          const data = await cartsResponse.json();
          const dbCart = data.carts?.find((c: any) => c.tenant_id === tenantId);
          if (dbCart) {
            await fetch(`/api/shopping-carts/${dbCart.cart_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                status: 'paid',
                order_id: orderId,
                paid_at: new Date().toISOString(),
                customer_info: customerInfo,
                shipping_address: shippingAddress,
              }),
            });
            setLastSyncedAt(new Date());
          }
        }
      } catch (error) {
        console.error('[Cart] Mark as paid sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const switchCart = (tenantId: string) => {
    setActiveCartTenantId(tenantId);
  };

  const getCart = (tenantId: string) => {
    return carts.find((cart) => cart.tenantId === tenantId);
  };

  const getTotalCartCount = () => {
    return carts.length;
  };

  const getTotalItemCount = () => {
    return carts.reduce((sum, cart) => sum + cart.itemCount, 0);
  };

  // Get active cart data
  const activeCart = activeCartTenantId ? getCart(activeCartTenantId) : null;
  const items = activeCart?.items || [];
  const itemCount = activeCart?.itemCount || 0;
  const subtotal = activeCart?.subtotal || 0;

  return (
    <CartContext.Provider
      value={{
        carts,
        activeCartTenantId,
        items,
        itemCount,
        subtotal,
        isAuthenticated,
        isSyncing,
        lastSyncedAt,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        markCartAsPaid,
        switchCart,
        getCart,
        getTotalCartCount,
        getTotalItemCount,
        syncToDatabase,
        loadFromDatabase,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
