import { PaymentGatewayInterface, GatewayCredentials } from './PaymentGatewayInterface';
import { StripeGateway } from './gateways/StripeGateway';
// import { PayPalGateway } from './gateways/PayPalGateway'; // TODO: Fix PayPal SDK method names
import { decryptCredential } from '../../utils/credential-encryption';
import { prisma } from '../../prisma';

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'manual';

export class PaymentGatewayFactory {
  /**
   * Create a payment gateway instance from tenant configuration
   */
  static async createFromTenant(
    tenantId: string,
    gatewayType?: GatewayType
  ): Promise<PaymentGatewayInterface> {
    // Get tenant's payment gateway configuration
    const config = await prisma.tenant_payment_gateways.findFirst({
      where: {
        tenant_id: tenantId,
        gateway_type: gatewayType || undefined,
        is_active: true,
      },
      orderBy: {
        is_default: 'desc',
      },
    });

    if (!config) {
      throw new Error(
        `No active payment gateway configured for tenant ${tenantId}${
          gatewayType ? ` (${gatewayType})` : ''
        }`
      );
    }

    return this.createFromConfig(config);
  }

  /**
   * Create a payment gateway instance from configuration
   */
  static createFromConfig(config: any): PaymentGatewayInterface {
    // For Stripe: apiKey = secret key (server-side), apiSecret = publishable key (client-side)
    const credentials: GatewayCredentials = {
      apiKey: config.api_secret_encrypted
        ? decryptCredential(config.api_secret_encrypted)
        : '',
      apiSecret: config.api_key_encrypted
        ? decryptCredential(config.api_key_encrypted)
        : undefined,
      webhookSecret: config.webhook_secret_encrypted
        ? decryptCredential(config.webhook_secret_encrypted)
        : undefined,
    };

    const isTestMode = config.config?.testMode || false;

    switch (config.gateway_type) {
      case 'stripe':
        return new StripeGateway(credentials, isTestMode);
      
      case 'paypal':
        throw new Error('PayPal gateway temporarily disabled - SDK method verification needed');
      
      case 'square':
        throw new Error('Square gateway not yet implemented');
      
      default:
        throw new Error(`Unsupported gateway type: ${config.gateway_type}`);
    }
  }

  /**
   * Create a payment gateway instance from raw credentials (for testing)
   */
  static create(
    gatewayType: GatewayType,
    credentials: GatewayCredentials,
    isTestMode: boolean = false
  ): PaymentGatewayInterface {
    switch (gatewayType) {
      case 'stripe':
        return new StripeGateway(credentials, isTestMode);
      
      case 'paypal':
        throw new Error('PayPal gateway temporarily disabled - SDK method verification needed');
      
      case 'square':
        throw new Error('Square gateway not yet implemented');
      
      default:
        throw new Error(`Unsupported gateway type: ${gatewayType}`);
    }
  }

  /**
   * Get list of supported gateway types
   */
  static getSupportedGateways(): GatewayType[] {
    return ['stripe', 'paypal', 'manual'];
  }

  /**
   * Validate gateway credentials by attempting a test operation
   */
  static async validateCredentials(
    gatewayType: GatewayType,
    credentials: GatewayCredentials,
    isTestMode: boolean = false
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const gateway = this.create(gatewayType, credentials, isTestMode);
      
      // For Stripe, try to retrieve account info
      if (gatewayType === 'stripe') {
        // Test by getting a non-existent payment intent (will fail but validates credentials)
        const result = await gateway.getStatus('pi_test_validation');
        // If we get here without auth error, credentials are valid
        return { valid: true };
      }
      
      // For PayPal, credentials are validated during client creation
      if (gatewayType === 'paypal') {
        return { valid: true };
      }
      
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Credential validation failed',
      };
    }
  }
}
