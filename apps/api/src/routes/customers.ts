import { Router, Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService';
import { logger } from '../logger';

const router = Router();
const customerService = CustomerService.getInstance();

// Middleware to extract tenant info from headers
const getTenantInfo = (req: Request) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const customerId = req.headers['x-customer-id'] as string;
  const organizationId = req.headers['x-organization-id'] as string;
  return { tenantId, organizationId };
};

// Create or find customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, firstName, lastName, phone, ...customerData } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'missing_email',
        message: 'Email is required'
      });
    }

    const customer = await customerService.createOrFindCustomer(email, {
      firstName,
      lastName,
      phone,
      ...customerData
    });

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    logger.error('[Customer] Create customer error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_create_customer',
      message: error.message
    });
  }
});

// Get customer by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await customerService.getCustomer(id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'customer_not_found',
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    logger.error('[Customer] Get customer error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_customer',
      message: error.message
    });
  }
});

// Get customer by email
router.get('/email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const customer = await customerService.getCustomerByEmail(email);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'customer_not_found',
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    logger.error('[Customer] Get customer by email error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_customer',
      message: error.message
    });
  }
});

// Get tenant customers
router.get('/tenant/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = 10, offset = 0, search } = req.query;
    
    const result = await customerService.getTenantCustomers(
      tenantId,
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        search: search as string
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('[Customer] Get tenant customers error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_get_tenant_customers',
      message: error.message
    });
  }
});

// Update customer
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const customer = await customerService.updateCustomer(id, updateData);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'customer_not_found',
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    logger.error('[Customer] Update customer error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_update_customer',
      message: error.message
    });
  }
});

// Update customer from order data
router.post('/from-order', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'missing_order_id',
        message: 'Order ID is required'
      });
    }

    await customerService.updateCustomerFromOrder(orderId);

    res.json({
      success: true,
      message: 'Customer updated from order data'
    });
  } catch (error: any) {
    logger.error('[Customer] Update customer from order error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_update_customer_from_order',
      message: error.message
    });
  }
});

// Create or update customer-tenant relationship
router.post('/relationship', async (req: Request, res: Response) => {
  try {
    const { customerId, tenantId, customerSegment, loyaltyPoints, ...relationshipData } = req.body;
    
    if (!customerId || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'Customer ID and Tenant ID are required'
      });
    }

    const relationship = await customerService.updateCustomerTenantRelationship(
      customerId,
      tenantId,
      {
        customerSegment,
        loyaltyPoints,
        ...relationshipData
      }
    );

    res.json({
      success: true,
      data: relationship
    });
  } catch (error: any) {
    logger.error('[Customer] Create relationship error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_create_relationship',
      message: error.message
    });
  }
});

export default router;
