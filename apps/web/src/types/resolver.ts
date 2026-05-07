/**
 * Universal Resolver Types
 * Type-safe identifier resolution for all platform services
 */

export enum ResolverType {
  TENANT = 'tenant',
  SHOP = 'shop', 
  PRODUCT = 'product',
  CATEGORY = 'category',
  DIRECTORY = 'directory'
}

export interface ResolverResponse {
  success: boolean;
  data: {
    resolvedId: string;
    type: ResolverType;
  };
  error?: string;
}
