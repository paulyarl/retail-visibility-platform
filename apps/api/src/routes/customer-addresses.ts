/**
 * Customer Addresses Routes
 * 
 * API endpoints for customer shipping/billing address management:
 * - List addresses
 * - Create/update/delete addresses
 * - Set default address
 * 
 * Uses cookie-based session authentication
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { generateCustomerAddressId } from '../lib/id-generator';
import { CustomerTokenService } from '../services/CustomerTokenService';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();

// Middleware to extract customer from JWT token or session cookie
const getCustomerId = (req: Request): string | null => {
  // Try JWT token first
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) {
      return payload.customerId;
    }
  }

  // Fallback to session cookie
  return req.cookies?.customer_session_id || null;
};

// Middleware to require authentication
const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);

  if (!customerId) {
    console.log('[Customer Addresses] Authentication failed');
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required',
    });
  }

  (req as any).customerId = customerId;
  next();
};

/**
 * GET /api/customer-addresses
 * 
 * List all addresses for the authenticated customer
 */
router.get('/', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;

    const addresses = await prisma.customer_addresses.findMany({
      where: {
        customer_id: customerId,
        is_active: true,
      },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' },
      ],
    });

    res.json({
      success: true,
      addresses: addresses.map(formatAddress),
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] List error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to list addresses',
    });
  }
});

/**
 * GET /api/customer-addresses/:id
 * 
 * Get a specific address
 */
router.get('/:id', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    const address = await prisma.customer_addresses.findFirst({
      where: {
        id,
        customer_id: customerId,
        is_active: true,
      },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Address not found',
      });
    }

    res.json({
      success: true,
      address: formatAddress(address),
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] Get error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to get address',
    });
  }
});

/**
 * POST /api/customer-addresses
 * 
 * Create a new address
 */
router.post('/', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const {
      label,
      isDefault,
      isBilling,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      recipientName,
      deliveryInstructions,
    } = req.body;

    // Validate required fields
    if (!addressLine1 || !city || !state || !postalCode || !country) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Address line 1, city, state, postal code, and country are required',
      });
    }

    // Generate address ID using id-generator pattern (includes customer key for traceability)
    const addressId = generateCustomerAddressId(customerId);

    // If this is the first address, make it default
    const existingCount = await prisma.customer_addresses.count({
      where: { customer_id: customerId, is_active: true },
    });

    const shouldBeDefault = isDefault || existingCount === 0;

    // If setting as default, unset other defaults
    if (shouldBeDefault) {
      await prisma.customer_addresses.updateMany({
        where: {
          customer_id: customerId,
          is_default: true,
        },
        data: { is_default: false },
      });
    }

    const address = await prisma.customer_addresses.create({
      data: {
        id: addressId,
        customer_id: customerId,
        label,
        is_default: shouldBeDefault,
        is_billing: isBilling || false,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country,
        phone,
        recipient_name: recipientName,
        delivery_instructions: deliveryInstructions,
        is_active: true,
      },
    });

    res.status(201).json({
      success: true,
      address: formatAddress(address),
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to create address',
    });
  }
});

/**
 * PUT /api/customer-addresses/:id
 * 
 * Update an existing address
 */
router.put('/:id', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;
    const {
      label,
      isDefault,
      isBilling,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      phone,
      recipientName,
      deliveryInstructions,
    } = req.body;

    // Check address exists and belongs to customer
    const existing = await prisma.customer_addresses.findFirst({
      where: { id, customer_id: customerId, is_active: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Address not found',
      });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existing.is_default) {
      await prisma.customer_addresses.updateMany({
        where: {
          customer_id: customerId,
          is_default: true,
        },
        data: { is_default: false },
      });
    }

    const address = await prisma.customer_addresses.update({
      where: { id },
      data: {
        label,
        is_default: isDefault,
        is_billing: isBilling,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        country,
        phone,
        recipient_name: recipientName,
        delivery_instructions: deliveryInstructions,
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      address: formatAddress(address),
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update address',
    });
  }
});

/**
 * DELETE /api/customer-addresses/:id
 * 
 * Delete an address (soft delete)
 */
router.delete('/:id', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    // Check address exists and belongs to customer
    const existing = await prisma.customer_addresses.findFirst({
      where: { id, customer_id: customerId, is_active: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Address not found',
      });
    }

    // Soft delete
    await prisma.customer_addresses.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    // If deleted address was default, set another as default
    if (existing.is_default) {
      const nextDefault = await prisma.customer_addresses.findFirst({
        where: {
          customer_id: customerId,
          is_active: true,
          id: { not: id },
        },
        orderBy: { created_at: 'desc' },
      });

      if (nextDefault) {
        await prisma.customer_addresses.update({
          where: { id: nextDefault.id },
          data: { is_default: true },
        });
      }
    }

    res.json({
      success: true,
      message: 'Address deleted',
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to delete address',
    });
  }
});

/**
 * PUT /api/customer-addresses/:id/default
 * 
 * Set an address as the default
 */
router.put('/:id/default', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    // Check address exists and belongs to customer
    const existing = await prisma.customer_addresses.findFirst({
      where: { id, customer_id: customerId, is_active: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Address not found',
      });
    }

    // Unset other defaults
    await prisma.customer_addresses.updateMany({
      where: {
        customer_id: customerId,
        is_default: true,
      },
      data: { is_default: false },
    });

    // Set this as default
    const address = await prisma.customer_addresses.update({
      where: { id },
      data: {
        is_default: true,
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      address: formatAddress(address),
    });
  } catch (error: any) {
    console.error('[CustomerAddresses] Set default error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to set default address',
    });
  }
});

// Helper function to format address for API response
function formatAddress(address: any) {
  return {
    id: address.id,
    label: address.label,
    isDefault: address.is_default,
    isBilling: address.is_billing,
    addressLine1: address.address_line1,
    addressLine2: address.address_line2,
    city: address.city,
    state: address.state,
    postalCode: address.postal_code,
    country: address.country,
    phone: address.phone,
    recipientName: address.recipient_name,
    deliveryInstructions: address.delivery_instructions,
    createdAt: address.created_at,
    updatedAt: address.updated_at,
  };
}

export default router;
