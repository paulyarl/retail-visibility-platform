/**
 * UNIVERSAL TRANSFORM MIDDLEWARE
 * Makes naming conventions irrelevant - both sides get what they expect
 * 
 * Frontend expects: snake_case from API responses
 * API code expects: both snake_case AND camelCase properties available
 * Database returns: snake_case
 * 
 * This middleware ensures EVERYONE is happy!
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Convert camelCase to snake_case
 */
const toSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Convert snake_case to camelCase
 */
const toCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Transform object to have BOTH naming conventions
 * This is the magic - every property exists in both formats!
 */
const makeBothConventionsAvailable = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(makeBothConventionsAvailable);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const enhanced: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnake(key);
      const camelKey = toCamel(key);
      
      // Add the original key
      enhanced[key] = makeBothConventionsAvailable(value);
      
      // Add snake_case version if different
      if (snakeKey !== key) {
        enhanced[snakeKey] = makeBothConventionsAvailable(value);
      }
      
      // Add camelCase version if different
      if (camelKey !== key) {
        enhanced[camelKey] = makeBothConventionsAvailable(value);
      }
    }
    
    return enhanced;
  }
  
  return obj;
};

/**
 * Specific field mappings for problematic cases
 * These handle exact errors from your build output
 */
export const UNIVERSAL_FIELD_MAPPINGS = {
  // Auth service
  'passwordHash': 'password_hash',
  'lastLogin': 'last_login',
  
  // Tenant fields
  'trialEndsAt': 'trial_ends_at',
  'createdBy': 'created_by',
  'tenantId': 'tenant_id',
  'userId': 'user_id',
  
  // Item fields
  'inventoryItemId': 'inventory_item_id',
  'priceCents': 'price_cents',
  'itemStatus': 'item_status',
  
  // Business profile
  'businessName': 'business_name',
  'addressLine1': 'address_line1',
  'addressLine2': 'address_line2',
  'phoneNumber': 'phone_number',
  'websiteUrl': 'website_url',
  
  // Google OAuth
  'googleAccountId': 'google_account_id',
  'displayName': 'display_name',
  'profilePictureUrl': 'profile_picture_url',
  
  // JWT payload
  'tenantIds': 'tenant_ids'
};

/**
 * Enhanced transform with specific mappings
 */
const enhancedMakeBothAvailable = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(enhancedMakeBothAvailable);
  }
  
  const enhanced = { ...obj };
  
  // First, apply the universal transform
  const universal = makeBothConventionsAvailable(obj);
  Object.assign(enhanced, universal);
  
  // Then, apply specific mappings for known problematic fields
  for (const [camelKey, snakeKey] of Object.entries(UNIVERSAL_FIELD_MAPPINGS)) {
    if (obj[snakeKey] !== undefined) {
      enhanced[camelKey] = obj[snakeKey];
    }
    if (obj[camelKey] !== undefined) {
      enhanced[snakeKey] = obj[camelKey];
    }
  }
  
  // Recursively enhance nested objects
  for (const [key, value] of Object.entries(enhanced)) {
    if (value && typeof value === 'object') {
      enhanced[key] = enhancedMakeBothAvailable(value);
    }
  }
  
  return enhanced;
};

/**
 * REQUEST TRANSFORM MIDDLEWARE
 * Converts incoming requests to have both naming conventions
 */
export const universalRequestTransform = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Transform request body to have both conventions
    if (req.body && typeof req.body === 'object') {
      req.body = enhancedMakeBothAvailable(req.body);
    }
    
    // Transform query parameters to have both conventions
    if (req.query && typeof req.query === 'object') {
      // Create new object since req.query is readonly
      const enhancedQuery = enhancedMakeBothAvailable(req.query);
      Object.defineProperty(req, 'query', {
        value: enhancedQuery,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    
    // Transform URL parameters to have both conventions
    if (req.params && typeof req.params === 'object') {
      req.params = enhancedMakeBothAvailable(req.params);
    }
    
    if (process.env.NODE_ENV === 'development') {
      const hasData = 
        (req.body && Object.keys(req.body).length > 0) ||
        (req.query && Object.keys(req.query).length > 0);
        
      if (hasData) {
        console.log(`[UNIVERSAL-REQUEST] ${req.method} ${req.path} - Both naming conventions available`);
      }
    }
    
  } catch (error) {
    console.error('[UNIVERSAL-REQUEST] Transform error:', error);
  }
  
  next();
};

/**
 * RESPONSE TRANSFORM MIDDLEWARE
 * Ensures responses have both naming conventions, but prioritizes what frontend expects
 */
export const universalResponseTransform = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override json method to ensure both conventions are available
  res.json = function(data: any) {
    try {
      // Make both conventions available in the data
      const universalData = enhancedMakeBothAvailable(data);
      
      if (process.env.NODE_ENV === 'development') {
        const hasData = data && typeof data === 'object';
        if (hasData) {
          console.log(`[UNIVERSAL-RESPONSE] ${req.method} ${req.path} - Both naming conventions in response`);
        }
      }
      
      return originalJson.call(this, universalData);
    } catch (error) {
      console.error('[UNIVERSAL-RESPONSE] Transform error:', error);
      return originalJson.call(this, data);
    }
  };
  
  next();
};

/**
 * DATABASE RESULT ENHANCER
 * For use in API code to enhance database results
 */
export const enhanceDatabaseResult = (result: any): any => {
  return enhancedMakeBothAvailable(result);
};

/**
 * PRISMA RESULT ENHANCER
 * Wrapper for Prisma queries to automatically enhance results
 */
export const enhancePrismaResult = <T>(result: T): T => {
  return enhancedMakeBothAvailable(result) as T;
};

/**
 * COMBINED UNIVERSAL MIDDLEWARE
 * Single middleware that handles both request and response transforms
 */
export const universalTransformMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Apply request transform
  universalRequestTransform(req, res, () => {
    // Apply response transform
    universalResponseTransform(req, res, next);
  });
};
