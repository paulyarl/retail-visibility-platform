/**
 * UNIVERSAL TRANSFORM UTILITIES - Frontend Side
 * Makes naming conventions irrelevant on the frontend too
 * 
 * Now frontend developers can use ANY naming convention and it just works!
 */

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
 * Universal API response enhancer
 * Use this to enhance API responses so both naming conventions work
 */
export const enhanceApiResponse = <T>(response: T): T => {
  return makeBothConventionsAvailable(response) as T;
};

/**
 * Universal form data transformer
 * Use this to prepare form data for API requests
 */
export const prepareForApi = (formData: any): any => {
  return makeBothConventionsAvailable(formData);
};

/**
 * Fetch wrapper with automatic transforms
 * Drop-in replacement for fetch that handles naming conventions automatically
 */
export const universalFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  // Transform request body if present
  if (options?.body && typeof options.body === 'string') {
    try {
      const parsed = JSON.parse(options.body);
      const enhanced = makeBothConventionsAvailable(parsed);
      options.body = JSON.stringify(enhanced);
    } catch {
      // If not JSON, leave as is
    }
  }
  
  const response = await fetch(url, options);
  
  // Create enhanced response with transformed json method
  const enhancedResponse = new Proxy(response, {
    get(target, prop) {
      if (prop === 'json') {
        return async () => {
          const data = await target.json();
          return enhanceApiResponse(data);
        };
      }
      return (target as any)[prop];
    }
  });
  
  return enhancedResponse;
};

/**
 * React hook for API calls with automatic transforms
 */
export const useUniversalApi = () => {
  const apiCall = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await universalFetch(url, options);
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    return response.json();
  };
  
  const get = <T>(url: string): Promise<T> => apiCall<T>(url);
  
  const post = <T>(url: string, data: any): Promise<T> => 
    apiCall<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  
  const put = <T>(url: string, data: any): Promise<T> => 
    apiCall<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  
  const del = <T>(url: string): Promise<T> => 
    apiCall<T>(url, { method: 'DELETE' });
  
  return { get, post, put, delete: del, apiCall };
};

/**
 * Quick transforms for common patterns
 */
export const quickTransform = {
  /**
   * Transform business profile data
   */
  businessProfile: (profile: any) => enhanceApiResponse(profile),
  
  /**
   * Transform tenant data
   */
  tenant: (tenant: any) => enhanceApiResponse(tenant),
  
  /**
   * Transform user data
   */
  user: (user: any) => enhanceApiResponse(user),
  
  /**
   * Transform inventory item data
   */
  item: (item: any) => enhanceApiResponse(item),
  
  /**
   * Transform form data for submission
   */
  formData: (data: any) => prepareForApi(data)
};

/**
 * Middleware for Next.js API routes (if needed)
 */
export const universalApiMiddleware = (handler: any) => {
  return async (req: any, res: any) => {
    // Transform request body
    if (req.body) {
      req.body = makeBothConventionsAvailable(req.body);
    }
    
    // Transform query parameters
    if (req.query) {
      req.query = makeBothConventionsAvailable(req.query);
    }
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to transform responses
    res.json = function(data: any) {
      const transformedData = makeBothConventionsAvailable(data);
      return originalJson.call(this, transformedData);
    };
    
    return handler(req, res);
  };
};

/**
 * Legacy compatibility - for gradual migration
 */
export const legacyTransforms = {
  /**
   * Convert camelCase object to snake_case (for old API expectations)
   */
  toSnakeCase: (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(legacyTransforms.toSnakeCase);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[toSnake(key)] = legacyTransforms.toSnakeCase(value);
    }
    return result;
  },
  
  /**
   * Convert snake_case object to camelCase (for frontend preferences)
   */
  toCamelCase: (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(legacyTransforms.toCamelCase);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[toCamel(key)] = legacyTransforms.toCamelCase(value);
    }
    return result;
  }
};
