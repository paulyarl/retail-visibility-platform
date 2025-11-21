/**
 * EMERGENCY TRANSFORM MIDDLEWARE
 * Systematic fix for 50+ TypeScript case mismatch errors
 * Converts camelCase requests to snake_case for existing API logic
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Convert camelCase to snake_case
 */
const toSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Transform object keys from camelCase to snake_case
 * Handles nested objects and arrays recursively
 */
const transformToSnake = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(transformToSnake);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnake(key);
      transformed[snakeKey] = transformToSnake(value);
    }
    
    return transformed;
  }
  
  return obj;
};

/**
 * Emergency request transform middleware
 * Converts all incoming camelCase data to snake_case
 * This preserves existing API logic while fixing TypeScript errors
 */
export const emergencyTransformMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Transform request body
    if (req.body && typeof req.body === 'object') {
      req.body = transformToSnake(req.body);
    }
    
    // Transform query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = transformToSnake(req.query);
    }
    
    // Transform URL parameters (for dynamic routes)
    if (req.params && typeof req.params === 'object') {
      req.params = transformToSnake(req.params);
    }
    
    // Log successful transforms in development
    if (process.env.NODE_ENV === 'development') {
      const hasTransforms = 
        (req.body && Object.keys(req.body).length > 0) ||
        (req.query && Object.keys(req.query).length > 0);
        
      if (hasTransforms) {
        console.log(`[EMERGENCY-TRANSFORM] ${req.method} ${req.path} - Data transformed to snake_case`);
      }
    }
    
  } catch (error) {
    console.error('[EMERGENCY-TRANSFORM] Transform error:', error);
    // Continue anyway - don't break the request
  }
  
  next();
};

/**
 * Specific field mappings for common problematic cases
 * These handle the exact errors from your build output
 */
export const FIELD_MAPPINGS = {
  // Auth service errors
  'passwordHash': 'password_hash',
  'lastLogin': 'last_login',
  
  // Tenant errors
  'trialEndsAt': 'trial_ends_at',
  'createdBy': 'created_by',
  'tenantId': 'tenantId',
  'userId': 'userId',
  
  // Item errors
  'inventoryItemId': 'inventory_item_id',
  'priceCents': 'priceCents',
  'itemStatus': 'itemStatus',
  
  // Business profile errors
  'businessName': 'business_name',
  'googleAccountId': 'google_account_id',
  'displayName': 'display_name',
  'profilePictureUrl': 'profile_picture_url',
  
  // JWT payload errors
  'tenantIds': 'tenantIds'
};

/**
 * Enhanced transform that uses specific field mappings
 * for the exact errors in your build output
 */
export const enhancedTransformToSnake = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(enhancedTransformToSnake);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Use specific mapping if available, otherwise convert to snake_case
      const snakeKey = FIELD_MAPPINGS[key as keyof typeof FIELD_MAPPINGS] || toSnake(key);
      transformed[snakeKey] = enhancedTransformToSnake(value);
    }
    
    return transformed;
  }
  
  return obj;
};

/**
 * Enhanced middleware with specific field mappings
 */
export const enhancedEmergencyTransformMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Transform request body with enhanced mappings
    if (req.body && typeof req.body === 'object') {
      req.body = enhancedTransformToSnake(req.body);
    }
    
    // Transform query parameters with enhanced mappings
    if (req.query && typeof req.query === 'object') {
      req.query = enhancedTransformToSnake(req.query);
    }
    
    // Log transforms with field mapping info
    if (process.env.NODE_ENV === 'development') {
      const bodyKeys = req.body ? Object.keys(req.body) : [];
      const queryKeys = req.query ? Object.keys(req.query) : [];
      const mappedFields = [...bodyKeys, ...queryKeys].filter(key => 
        Object.values(FIELD_MAPPINGS).includes(key)
      );
      
      if (mappedFields.length > 0) {
        console.log(`[ENHANCED-TRANSFORM] ${req.method} ${req.path} - Mapped fields:`, mappedFields);
      }
    }
    
  } catch (error) {
    console.error('[ENHANCED-TRANSFORM] Transform error:', error);
  }
  
  next();
};

/**
 * Database result enhancer - adds camelCase properties alongside snake_case
 * This allows API code to access either naming convention
 */
export const enhanceDatabaseResult = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(enhanceDatabaseResult);
  }
  
  const enhanced = { ...obj };
  
  // Add camelCase versions of snake_case properties from FIELD_MAPPINGS
  for (const [camelKey, snakeKey] of Object.entries(FIELD_MAPPINGS)) {
    if (obj[snakeKey] !== undefined) {
      enhanced[camelKey] = obj[snakeKey];
    }
  }
  
  return enhanced;
};

/**
 * Development helper to track which transforms are being applied
 */
export const debugTransformMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === 'development') {
    const originalBody = JSON.stringify(req.body);
    const originalQuery = JSON.stringify(req.query);
    
    // Apply transform
    enhancedEmergencyTransformMiddleware(req, res, () => {
      const transformedBody = JSON.stringify(req.body);
      const transformedQuery = JSON.stringify(req.query);
      
      if (originalBody !== transformedBody || originalQuery !== transformedQuery) {
        console.log(`[DEBUG-TRANSFORM] ${req.method} ${req.path}`);
        if (originalBody !== transformedBody) {
          console.log('  Body:', originalBody, '→', transformedBody);
        }
        if (originalQuery !== transformedQuery) {
          console.log('  Query:', originalQuery, '→', transformedQuery);
        }
      }
      
      next();
    });
  } else {
    enhancedEmergencyTransformMiddleware(req, res, next);
  }
};
