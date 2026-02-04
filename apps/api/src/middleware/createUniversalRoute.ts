/**
 * Universal Route Creator
 * 
 * Factory function to create routes that support universal identifier resolution
 * with consistent patterns and middleware integration.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { resolveUniversalIdentifier, createIdentifierResolver } from './universalIdentifierResolver';
import { ResolvedTenant } from '../services/UniversalIdentifierCache';

export interface UniversalRouteOptions {
  /**
   * Base path for the route (e.g., '/shops', '/tenant', '/stores')
   */
  path: string;
  
  /**
   * Handler function that receives the resolved tenant
   */
  handler: (req: Request, res: Response, next?: NextFunction) => Promise<void>;
  
  /**
   * HTTP methods to support (default: ['get'])
   */
  methods?: ('get' | 'post' | 'put' | 'patch' | 'delete')[];
  
  /**
   * Additional middleware to apply BEFORE identifier resolution
   */
  preMiddleware?: any[];
  
  /**
   * Additional middleware to apply AFTER identifier resolution
   */
  postMiddleware?: any[];
  
  /**
   * Authentication requirements
   */
  auth?: {
    required?: boolean;
    checkAccess?: boolean;
  };
  
  /**
   * Custom validation function
   */
  validation?: (identifier: string, req: Request) => string | null;
  
  /**
   * Cache headers
   */
  cache?: {
    maxAge?: number;
    public?: boolean;
  };
  
  /**
   * Response formatting options
   */
  response?: {
    includeMetadata?: boolean;
    includeTiming?: boolean;
    customHeaders?: Record<string, string>;
  };
}

/**
 * Creates a router with universal identifier resolution
 */
export function createUniversalRoute(options: UniversalRouteOptions): Router {
  const router = Router();
  const {
    path,
    handler,
    methods = ['get'],
    preMiddleware = [],
    postMiddleware = [],
    auth = {},
    validation,
    cache = {},
    response = {}
  } = options;

  // Apply pre-middleware
  preMiddleware.forEach(middleware => {
    router.use(middleware);
  });

  // Create the identifier resolver with options
  const resolver = createIdentifierResolver({
    requireAuth: auth.required,
    requireAccess: auth.checkAccess,
    customValidation: validation
  });

  // Apply post-middleware (will run after resolver)
  postMiddleware.forEach(middleware => {
    router.use(middleware);
  });

  // Create routes for each specified method
  methods.forEach(method => {
    const routeHandler = async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // Set cache headers if specified
        if (cache.maxAge) {
          const cacheControl = cache.public 
            ? `public, max-age=${cache.maxAge}`
            : `private, max-age=${cache.maxAge}`;
          res.setHeader('Cache-Control', cacheControl);
        }

        // Set custom headers if specified
        if (response.customHeaders) {
          Object.entries(response.customHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }

        // Call the handler
        await handler(req, res, next);

        // Add timing metadata if requested
        if (response.includeTiming) {
          const totalTime = Date.now() - startTime;
          res.setHeader('X-Total-Time', totalTime.toString());
          
          if (req.identifierResolutionTime) {
            res.setHeader('X-Handler-Time', (totalTime - req.identifierResolutionTime).toString());
          }
        }

        // Add metadata if requested
        if (response.includeMetadata && req.resolvedTenant) {
          const originalData = res.locals.data || {};
          
          if (!res.headersSent) {
            res.json({
              success: true,
              data: originalData,
              metadata: {
                tenant: {
                  id: req.resolvedTenant.id,
                  name: req.resolvedTenant.name,
                  slug: req.resolvedTenant.slug,
                  type: req.identifierType
                },
                timing: {
                  resolution: req.identifierResolutionTime,
                  total: Date.now() - startTime
                },
                cache: {
                  hit: req.identifierResolutionTime !== undefined
                }
              }
            });
          }
        }

      } catch (error) {
        console.error(`[Universal Route] Error in ${method.toUpperCase()} ${path}:`, error);
        
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        
        next(error);
      }
    };

    // Register the route with identifier resolution
    switch (method) {
      case 'get':
        router.get('/:identifier', resolver, routeHandler);
        break;
      case 'post':
        router.post('/:identifier', resolver, routeHandler);
        break;
      case 'put':
        router.put('/:identifier', resolver, routeHandler);
        break;
      case 'patch':
        router.patch('/:identifier', resolver, routeHandler);
        break;
      case 'delete':
        router.delete('/:identifier', resolver, routeHandler);
        break;
    }
  });

  return router;
}

/**
 * Factory functions for common route patterns
 */

/**
 * Creates a public tenant info route
 */
export function createPublicTenantRoute(path: string): Router {
  return createUniversalRoute({
    path,
    methods: ['get'],
    cache: { maxAge: 900, public: true }, // 15 minutes public cache
    response: { includeMetadata: true, includeTiming: true },
    handler: async (req, res, next) => {
      const { resolvedTenant } = req;
      
      // Store data for response formatting
      res.locals.data = {
        id: resolvedTenant!.id,
        name: resolvedTenant!.name,
        slug: resolvedTenant!.slug,
        subscriptionStatus: resolvedTenant!.subscriptionStatus,
        metadata: resolvedTenant!.metadata
      };
      
      // Response will be formatted by the wrapper
    }
  });
}

/**
 * Creates a shop profile route
 */
export function createShopProfileRoute(path: string): Router {
  return createUniversalRoute({
    path,
    methods: ['get'],
    cache: { maxAge: 900, public: true },
    response: { includeMetadata: true, includeTiming: true },
    handler: async (req, res, next) => {
      const { resolvedTenant } = req;
      
      // Use ShopService to get full shop details
      const ShopService = (await import('../services/ShopService')).default;
      const shopService = ShopService.getInstance();
      
      let shop;
      
      // Try different methods based on identifier type
      switch (req.identifierType) {
        case 'slug':
          shop = await shopService.getShopBySlug(req.params.identifier);
          break;
        case 'tenant_id':
          shop = await shopService.getShopByTenantId(req.params.identifier);
          break;
        case 'auto_id':
          // For auto_id, we need to find the tenant first
          shop = await shopService.getShopByTenantId(resolvedTenant!.id);
          break;
      }
      
      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
          message: 'Shop details not available for this tenant'
        });
        return next?.();
      }

      res.locals.data = shop;
      next?.();
    }
  });
}

/**
 * Creates an authenticated tenant management route
 */
export function createTenantManagementRoute(path: string): Router {
  return createUniversalRoute({
    path,
    methods: ['get', 'put', 'post'],
    auth: { required: true, checkAccess: true },
    cache: { maxAge: 300, public: false }, // 5 minutes private cache
    response: { includeMetadata: true, includeTiming: true },
    handler: async (req, res, next) => {
      const { resolvedTenant } = req;
      
      // Route-specific logic will be handled by the handler
      // This is a base template for tenant management routes
      
      res.locals.data = {
        tenant: resolvedTenant,
        user: req.user,
        method: req.method,
        timestamp: Date.now()
      };
    }
  });
}

/**
 * Creates a storefront route
 */
export function createStorefrontRoute(path: string): Router {
  return createUniversalRoute({
    path,
    methods: ['get'],
    cache: { maxAge: 600, public: true }, // 10 minutes public cache
    response: { includeMetadata: true, includeTiming: true },
    handler: async (req, res, next) => {
      const { resolvedTenant } = req;
      
      // Storefront-specific logic
      res.locals.data = {
        id: resolvedTenant!.id,
        name: resolvedTenant!.name,
        slug: resolvedTenant!.slug,
        storefrontUrl: `/stores/${resolvedTenant!.slug || resolvedTenant!.id}`,
        isActive: resolvedTenant!.subscriptionStatus === 'active'
      };
    }
  });
}

/**
 * Batch testing helper
 */
export function createBatchTestRoute(): Router {
  const router = Router();
  
  router.post('/batch-resolve', async (req, res, next) => {
    try {
      const { identifiers } = req.body;
      
      if (!Array.isArray(identifiers)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          message: 'identifiers must be an array'
        });
      }
      
      const { resolveMultipleIdentifiers } = await import('./universalIdentifierResolver');
      const results = await resolveMultipleIdentifiers(identifiers);
      
      res.json({
        success: true,
        data: results,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[Batch Test] Error:', error);
      next(error);
    }
  });
  
  return router;
}
