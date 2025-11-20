/**
 * API-side case transformation middleware
 * Transforms API responses from snake_case to camelCase
 */

import { Request, Response, NextFunction } from 'express';

// Transform utilities
const toCamel = (str: string): string => 
  str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toSnake = (str: string): string => 
  str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

/**
 * Transform object keys from snake_case to camelCase
 * Handles nested objects and arrays recursively
 */
export const transformToCamel = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(transformToCamel);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamel(key);
      transformed[camelKey] = transformToCamel(value);
    }
    
    return transformed;
  }
  
  return obj;
};

/**
 * Transform object keys from camelCase to snake_case
 * For request body transformation
 */
export const transformToSnake = (obj: any): any => {
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
 * Configuration for endpoint-specific transforms
 */
interface TransformConfig {
  request?: 'camelCase' | 'snake_case' | 'none';
  response?: 'camelCase' | 'snake_case' | 'none';
  enabled?: boolean;
}

const defaultConfig: TransformConfig = {
  request: 'snake_case',  // Transform camelCase requests to snake_case
  response: 'camelCase',  // Transform snake_case responses to camelCase
  enabled: true
};

/**
 * Endpoint-specific transform configuration
 * Add endpoints that should use API-side transforms
 */
const endpointConfig: Record<string, TransformConfig> = {
  // Stable endpoints - good candidates for API transform
  '/api/tenants/:id/profile': { ...defaultConfig },
  '/api/tenants/:id/business-profile': { ...defaultConfig },
  '/api/items': { ...defaultConfig },
  '/api/tenants/:id/items': { ...defaultConfig },
  
  // Legacy endpoints - no transform
  '/api/legacy/*': { enabled: false },
  
  // Experimental endpoints - no transform (use frontend transform)
  '/api/experimental/*': { enabled: false }
};

/**
 * Check if endpoint should be transformed based on configuration
 */
const shouldTransform = (path: string, config: TransformConfig): boolean => {
  if (!config.enabled) return false;
  
  // Simple pattern matching - could be enhanced with proper route matching
  for (const [pattern, patternConfig] of Object.entries(endpointConfig)) {
    if (pattern.includes('*')) {
      const basePattern = pattern.replace('/*', '');
      if (path.startsWith(basePattern)) {
        return patternConfig.enabled !== false;
      }
    } else if (pattern.includes(':')) {
      // Simple parameter matching - replace :id with regex
      const regexPattern = pattern.replace(/:[\w]+/g, '[^/]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(path)) {
        return patternConfig.enabled !== false;
      }
    } else if (path === pattern) {
      return patternConfig.enabled !== false;
    }
  }
  
  return false;
};

/**
 * Request body transform middleware
 * Transforms incoming camelCase to snake_case for database operations
 */
export const transformRequestMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const config = endpointConfig[req.path] || defaultConfig;
  
  if (shouldTransform(req.path, config) && config.request === 'snake_case') {
    if (req.body && typeof req.body === 'object') {
      req.body = transformToSnake(req.body);
    }
  }
  
  next();
};

/**
 * Response transform middleware
 * Transforms outgoing snake_case to camelCase for frontend consumption
 */
export const transformResponseMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  const config = endpointConfig[req.path] || defaultConfig;
  
  if (shouldTransform(req.path, config) && config.response === 'camelCase') {
    // Override res.json to transform the response
    const originalJson = res.json.bind(res);
    
    res.json = function(data: any) {
      const transformedData = transformToCamel(data);
      return originalJson(transformedData);
    };
  }
  
  next();
};

/**
 * Combined middleware for both request and response transforms
 */
export const caseTransformMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  // Transform request first
  transformRequestMiddleware(req, res, () => {
    // Then set up response transform
    transformResponseMiddleware(req, res, next);
  });
};

/**
 * Utility to add new endpoint configurations
 */
export const addEndpointConfig = (
  path: string, 
  config: TransformConfig
) => {
  endpointConfig[path] = { ...defaultConfig, ...config };
};

/**
 * Utility to check current configuration
 */
export const getEndpointConfig = (path: string): TransformConfig => {
  return endpointConfig[path] || defaultConfig;
};

/**
 * Development helper - logs transform activity
 */
export const debugTransformMiddleware = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  if (process.env.NODE_ENV === 'development') {
    const config = endpointConfig[req.path];
    if (config?.enabled) {
      console.log(`[Transform] ${req.method} ${req.path} - Config:`, config);
    }
  }
  next();
};
