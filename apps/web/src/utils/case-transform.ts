/**
 * Enhanced case transformation utilities
 * Supports both shallow and deep transforms with auto-detection
 */

export interface TransformOptions {
  deep?: boolean;
  autoDetect?: boolean;
  whitelist?: string[];
}

const toCamel = (str: string): string => 
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toSnake = (str: string): string => 
  str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/**
 * Check if object needs transformation
 */
const needsTransform = (obj: any, direction: 'camel' | 'snake'): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  
  const hasSnakeCase = keys.some(key => key.includes('_'));
  const hasCamelCase = keys.some(key => /[A-Z]/.test(key));
  
  if (direction === 'camel') {
    return hasSnakeCase && !hasCamelCase;
  } else {
    return hasCamelCase && !hasSnakeCase;
  }
};

/**
 * Transform object keys from snake_case to camelCase
 * Enhanced with deep transformation and auto-detection
 */
export const transformToCamel = <T = any>(obj: any, options: TransformOptions = {}): T => {
  const { deep = false, autoDetect = true, whitelist } = options;
  
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return (deep ? obj.map(item => transformToCamel(item, options)) : obj) as T;
  }
  
  // Auto-detect if transform is needed
  if (autoDetect && !needsTransform(obj, 'camel')) {
    return obj;
  }
  
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check whitelist if provided
    if (whitelist && !whitelist.includes(key)) {
      transformed[key] = value;
      continue;
    }
    
    const camelKey = toCamel(key);
    
    if (deep && value && typeof value === 'object') {
      transformed[camelKey] = transformToCamel(value, options);
    } else {
      transformed[camelKey] = value;
    }
  }
  
  return transformed as T;
};

/**
 * Transform object keys from camelCase to snake_case
 * For API requests
 */
export const transformToSnake = <T = any>(obj: any): T => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnake(key);
    transformed[snakeKey] = value;
  }
  
  return transformed as T;
};

/**
 * Safe field whitelist for gradual adoption
 * Only these fields will be transformed initially
 */
const SAFE_TRANSFORM_FIELDS = new Set([
  'business_name',
  'address_line1', 
  'address_line2',
  'phone_number',
  'website_url',
  'created_at',
  'updated_at',
  'map_privacy_mode'
]);

/**
 * Conservative transform - only whitelisted fields
 * Perfect for proof of concept
 */
export const safeTransformToCamel = <T = any>(obj: any): T => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  
  const transformed: any = { ...obj }; // Start with original
  
  for (const [key, value] of Object.entries(obj)) {
    if (SAFE_TRANSFORM_FIELDS.has(key)) {
      const camelKey = toCamel(key);
      transformed[camelKey] = value;
      // Keep both versions during transition
      // delete transformed[key]; // Uncomment later when safe
    }
  }
  
  return transformed as T;
};

// Type definitions for common transformations
export interface BusinessProfile {
  businessName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  websiteUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  mapPrivacyMode?: string;
}
