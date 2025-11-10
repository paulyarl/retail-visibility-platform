/**
 * Square Client Service
 * Wrapper around Square SDK for consistent API access
 * Phase 1: Infrastructure Setup
 */

const { SquareClient } = require('square') as any;

export interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export class SquareClientService {
  private client: any;
  private environment: string;

  constructor(config: SquareConfig) {
    this.environment = config.environment === 'production' 
      ? 'production' 
      : 'sandbox';

    this.client = new SquareClient({
      accessToken: config.accessToken,
      environment: this.environment,
    });
  }

  /**
   * Get the Square API client instance
   */
  getClient(): any {
    return this.client;
  }

  /**
   * Get Catalog API for managing products
   */
  getCatalogApi() {
    return this.client.catalogApi;
  }

  /**
   * Get Inventory API for managing stock levels
   */
  getInventoryApi() {
    return this.client.inventoryApi;
  }

  /**
   * Get Locations API for merchant locations
   */
  getLocationsApi() {
    return this.client.locationsApi;
  }

  /**
   * Get OAuth API for authorization flow
   */
  getOAuthApi() {
    return this.client.oAuthApi;
  }

  /**
   * Get Merchants API for business info
   */
  getMerchantsApi() {
    return this.client.merchantsApi;
  }

  /**
   * Test connection to Square API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test if client is properly initialized
      if (!this.client || !this.client.locationsApi) {
        console.error('[SquareClient] Client or locationsApi is undefined');
        return false;
      }
      
      const response = await this.client.locationsApi.listLocations();
      return response?.result?.locations !== undefined;
    } catch (error) {
      console.error('[SquareClient] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get merchant information
   */
  async getMerchantInfo() {
    try {
      const response = await this.client.merchantsApi.listMerchants();
      return response.result.merchant?.[0];
    } catch (error) {
      console.error('[SquareClient] Failed to get merchant info:', error);
      throw error;
    }
  }

  /**
   * List all locations for the merchant
   */
  async listLocations() {
    try {
      const response = await this.client.locationsApi.listLocations();
      return response.result.locations || [];
    } catch (error) {
      console.error('[SquareClient] Failed to list locations:', error);
      throw error;
    }
  }

  /**
   * Get environment (sandbox or production)
   */
  getEnvironment(): string {
    return this.environment;
  }
}

/**
 * Factory function to create Square client from tenant integration
 */
export function createSquareClientFromIntegration(integration: {
  access_token: string;
  mode: 'sandbox' | 'production';
}): SquareClientService {
  return new SquareClientService({
    accessToken: integration.access_token,
    environment: integration.mode,
  });
}

/**
 * Create Square client from environment variables (for admin operations)
 */
export function createSquareClientFromEnv(): SquareClientService {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN environment variable is required');
  }

  return new SquareClientService({
    accessToken,
    environment,
  });
}

/**
 * Alias for createSquareClientFromIntegration (for backwards compatibility)
 */
export const createSquareClient = createSquareClientFromIntegration;
