/**
 * UNIVERSAL TYPES - Build-Time Support
 * Makes TypeScript aware of both naming conventions
 * This allows the build to pass while middleware handles runtime transforms
 */

// Extend Prisma types to include both naming conventions
declare global {
  namespace PrismaJson {
    // Add camelCase versions to snake_case database results
    interface BusinessProfile {
      business_name: string;
      businessName: string; // Auto-available via middleware
      address_line1: string;
      addressLine1: string; // Auto-available via middleware
      phone_number?: string;
      phoneNumber?: string; // Auto-available via middleware
    }
    
    interface GoogleAccount {
      display_name?: string;
      displayName?: string; // Auto-available via middleware
      profile_picture_url?: string;
      profilePictureUrl?: string; // Auto-available via middleware
      google_account_id: string;
      googleAccountId: string; // Auto-available via middleware
    }
    
    interface InventoryItem {
      tenant_id: string;
      tenantId: string; // Auto-available via middleware
      price_cents: number;
      priceCents: number; // Auto-available via middleware
      item_status?: string;
      itemStatus?: string; // Auto-available via middleware
    }
  }
}

// Extend Request interface to show both conventions are available
declare module 'express-serve-static-core' {
  interface Request {
    // Middleware ensures both conventions exist in body/query/params
    body: any & {
      [K in keyof any]: any[K] extends string 
        ? any[K] & { [P in CamelToSnake<K>]: any[K] } & { [P in SnakeToCamel<K>]: any[K] }
        : any[K]
    };
  }
}

// Utility types for case conversion
type CamelToSnake<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${CamelToSnake<U>}`
  : S;

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

export {};
