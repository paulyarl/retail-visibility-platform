/**
 * Payment Gateways API Routes
 * Manage tenant payment gateway configurations
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { requireAuth, checkTenantAccess } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// Encryption helpers (simple example - use proper encryption in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * GET /api/tenants/:tenantId/payment-gateways
 * List all payment gateways for a tenant
 */
router.get('/:tenantId/payment-gateways', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  console.log('[PaymentGateways] Request received:', {
    tenantId: req.params.tenantId,
    user: req.user ? { id: req.user.userId, email: req.user.email, role: req.user.role } : null,
    headers: {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'content-type': req.headers['content-type']
    }
  });

  try {
    const { tenantId } = req.params;

    const gateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
        config: true,
        last_verified_at: true,
        verification_status: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [
        { is_default: 'desc' },
        { is_active: 'desc' },
        { created_at: 'desc' },
      ],
    });

    res.json({
      success: true,
      gateways,
    });
  } catch (error: any) {
    console.error('[Payment Gateways] List error:', error);
    res.status(500).json({
      success: false,
      error: 'list_failed',
      message: 'Failed to list payment gateways',
    });
  }
});

/**
 * POST /api/tenants/:tenantId/payment-gateways
 * Create a new payment gateway configuration
 */
router.post('/:tenantId/payment-gateways', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { gateway_type, is_active, is_default, display_name } = req.body;

    // Validation
    if (!gateway_type) {
      return res.status(400).json({
        success: false,
        error: 'missing_gateway_type',
        message: 'Gateway type is required',
      });
    }

    // Gateway-specific validation and config
    let config: any = {};
    let apiKey: string = '';
    let apiSecret: string = '';

    if (gateway_type === 'paypal') {
      const { mode, client_id, client_secret } = req.body;
      
      if (!client_id || !client_secret) {
        return res.status(400).json({
          success: false,
          error: 'missing_credentials',
          message: 'PayPal Client ID and Client Secret are required',
        });
      }

      apiKey = client_id;
      apiSecret = client_secret;
      config = {
        mode: mode || 'sandbox',
        client_id,
        display_name: display_name || `PayPal (${mode || 'sandbox'})`,
      };
    } else if (gateway_type === 'square') {
      const { environment, application_id, access_token, location_id } = req.body;
      
      if (!application_id || !access_token || !location_id) {
        return res.status(400).json({
          success: false,
          error: 'missing_credentials',
          message: 'Square Application ID, Access Token, and Location ID are required',
        });
      }

      apiKey = application_id;
      apiSecret = access_token;
      config = {
        environment: environment || 'sandbox',
        application_id,
        location_id,
        display_name: display_name || `Square (${environment || 'sandbox'})`,
      };
    } else {
      return res.status(400).json({
        success: false,
        error: 'unsupported_gateway',
        message: `Gateway type '${gateway_type}' is not supported`,
      });
    }

    // If this is set as default, unset other defaults for this gateway type
    if (is_default) {
      await prisma.tenant_payment_gateways.updateMany({
        where: {
          tenant_id: tenantId,
          gateway_type,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      });
    }

    // Encrypt sensitive data
    const encryptedApiKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    // Create gateway
    const gatewayId = `gateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gateway = await prisma.tenant_payment_gateways.create({
      data: {
        id: gatewayId,
        tenant_id: tenantId,
        gateway_type,
        is_active: is_active !== false,
        is_default: is_default === true,
        api_key_encrypted: encryptedApiKey,
        api_secret_encrypted: encryptedSecret,
        config,
      },
    });

    res.status(201).json({
      success: true,
      gateway: {
        id: gateway.id,
        gateway_type: gateway.gateway_type,
        is_active: gateway.is_active,
        is_default: gateway.is_default,
        config: gateway.config,
        created_at: gateway.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Payment Gateways] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'create_failed',
      message: 'Failed to create payment gateway',
    });
  }
});

/**
 * PATCH /api/tenants/:tenantId/payment-gateways/:gatewayId
 * Update payment gateway (e.g., toggle active status)
 */
router.patch('/:tenantId/payment-gateways/:gatewayId', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, gatewayId } = req.params;
    const { is_active } = req.body;

    // Verify gateway belongs to tenant
    const gateway = await prisma.tenant_payment_gateways.findFirst({
      where: {
        id: gatewayId,
        tenant_id: tenantId,
      },
    });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        error: 'gateway_not_found',
        message: 'Payment gateway not found',
      });
    }

    // Update gateway
    const updated = await prisma.tenant_payment_gateways.update({
      where: { id: gatewayId },
      data: {
        is_active: is_active !== undefined ? is_active : gateway.is_active,
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      gateway: {
        id: updated.id,
        gateway_type: updated.gateway_type,
        is_active: updated.is_active,
        is_default: updated.is_default,
      },
    });
  } catch (error: any) {
    console.error('[Payment Gateways] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'update_failed',
      message: 'Failed to update payment gateway',
    });
  }
});

/**
 * POST /api/tenants/:tenantId/payment-gateways/:gatewayId/set-default
 * Set a gateway as the default
 */
router.post('/:tenantId/payment-gateways/:gatewayId/set-default', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, gatewayId } = req.params;

    // Verify gateway belongs to tenant and is active
    const gateway = await prisma.tenant_payment_gateways.findFirst({
      where: {
        id: gatewayId,
        tenant_id: tenantId,
      },
    });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        error: 'gateway_not_found',
        message: 'Payment gateway not found',
      });
    }

    if (!gateway.is_active) {
      return res.status(400).json({
        success: false,
        error: 'gateway_inactive',
        message: 'Cannot set inactive gateway as default',
      });
    }

    // Unset all other defaults
    await prisma.tenant_payment_gateways.updateMany({
      where: {
        tenant_id: tenantId,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });

    // Set this as default
    await prisma.tenant_payment_gateways.update({
      where: { id: gatewayId },
      data: {
        is_default: true,
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Default gateway updated',
    });
  } catch (error: any) {
    console.error('[Payment Gateways] Set default error:', error);
    res.status(500).json({
      success: false,
      error: 'set_default_failed',
      message: 'Failed to set default gateway',
    });
  }
});

/**
 * DELETE /api/tenants/:tenantId/payment-gateways/:gatewayId
 * Delete a payment gateway
 */
router.delete('/:tenantId/payment-gateways/:gatewayId', requireAuth, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { tenantId, gatewayId } = req.params;

    // Verify gateway belongs to tenant
    const gateway = await prisma.tenant_payment_gateways.findFirst({
      where: {
        id: gatewayId,
        tenant_id: tenantId,
      },
    });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        error: 'gateway_not_found',
        message: 'Payment gateway not found',
      });
    }

    // Delete gateway
    await prisma.tenant_payment_gateways.delete({
      where: { id: gatewayId },
    });

    res.json({
      success: true,
      message: 'Payment gateway deleted',
    });
  } catch (error: any) {
    console.error('[Payment Gateways] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'delete_failed',
      message: 'Failed to delete payment gateway',
    });
  }
});

export default router;
