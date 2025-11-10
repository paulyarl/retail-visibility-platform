/**
 * Square Client Service
 * Wrapper around Square SDK for consistent API access
 * Phase 1: Infrastructure Setup
 */

import { Client, Environment } from 'square';

export interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export class SquareClientService {
  private client: Client;
  private environment: Environment;

  constructor(config: SquareConfig) {
    this.environment = config.environment === 'production' 
      ? Environment.Production 
      : Environment.Sandbox;

    this.client = new Client({
      accessToken: config.accessToken,
      environment: this.environment,
    });
  }

  /**
   * Get the Square API client instance
   */
  getClient(): Client {
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
      const response = await this.client.locationsApi.listLocations();
      return response.result.locations !== undefined;
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
    return this.environment === Environment.Production ? 'production' : 'sandbox';
  }
}

/**
 * Factory function to create Square client from tenant integration
 */
export function createSquareClient(integration: {
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
