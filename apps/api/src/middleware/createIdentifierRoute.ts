/**
 * Create Identifier Route Helper
 * 
 * Utility function to create routes that support universal identifier resolution
 */

import { Router } from 'express';
import { resolveIdentifier } from './identifierResolver';

export interface CreateIdentifierRouteOptions {
  /**
   * Route path (e.g., '/shops', '/tenant', '/stores', '/storefront')
   */
  path: string;
  
  /**
   * Handler function that receives the resolved identifier
   */
  handler: (req: any, res: any, next?: any) => Promise<void>;
  
  /**
   * Additional middleware to apply before the identifier resolver
   */
  preMiddleware?: any[];
  
  /**
   * Additional middleware to apply after the identifier resolver
   */
  postMiddleware?: any[];
  
  /**
   * HTTP methods to support (default: ['get'])
   */
  methods?: ('get' | 'post' | 'put' | 'patch' | 'delete')[];
}

/**
 * Creates a router with identifier resolution middleware
 */
export function createIdentifierRoute(options: CreateIdentifierRouteOptions): Router {
  const router = Router();
  const {
    path,
    handler,
    preMiddleware = [],
    postMiddleware = [],
    methods = ['get']
  } = options;
  
  // Apply pre-middleware
  preMiddleware.forEach(middleware => router.use(middleware));
  
  // Apply identifier resolution middleware
  router.use(resolveIdentifier);
  
  // Apply post-middleware
  postMiddleware.forEach(middleware => router.use(middleware));
  
  // Create routes for each specified method
  methods.forEach(method => {
    const routeHandler = async (req: any, res: any, next: any) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
    
    switch (method) {
      case 'get':
        router.get('/:identifier', routeHandler);
        break;
      case 'post':
        router.post('/:identifier', routeHandler);
        break;
      case 'put':
        router.put('/:identifier', routeHandler);
        break;
      case 'patch':
        router.patch('/:identifier', routeHandler);
        break;
      case 'delete':
        router.delete('/:identifier', routeHandler);
        break;
    }
  });
  
  return router;
}

/**
 * Example usage factory functions for common patterns
 */

/**
 * Creates a public tenant info route
 */
export function createPublicTenantRoute(path: string): Router {
  return createIdentifierRoute({
    path,
    methods: ['get'],
    handler: async (req, res) => {
      const { resolvedIdentifier } = req;
      const { tenant } = resolvedIdentifier!;
      
      // Set cache headers for public routes
      res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
      res.setHeader('X-Service-Source', 'Identifier-Resolver');
      
      res.json({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subscriptionStatus: tenant.subscription_status,
          metadata: tenant.metadata,
          identifierType: resolvedIdentifier!.type
        }
      });
    }
  });
}

/**
 * Creates a shop profile route (like the current shops API)
 */
export function createShopProfileRoute(path: string): Router {
  return createIdentifierRoute({
    path,
    methods: ['get'],
    handler: async (req, res) => {
      const { resolvedIdentifier } = req;
      const { tenant } = resolvedIdentifier!;
      
      // Use ShopService to get full shop details
      const ShopService = (await import('../services/ShopService')).default;
      const shopService = ShopService.getInstance();
      
      let shop;
      
      // Try different methods based on identifier type
      switch (resolvedIdentifier!.type) {
        case 'slug':
          shop = await shopService.getShopBySlug(resolvedIdentifier!.identifier);
          break;
        case 'tenant_id':
          shop = await shopService.getShopByTenantId(resolvedIdentifier!.identifier);
          break;
        case 'auto_id':
          // For auto_id, we need to find the tenant first
          shop = await shopService.getShopByTenantId(tenant.id);
          break;
      }
      
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }
      
      res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
      res.setHeader('X-Service-Source', 'Identifier-Resolver');
      
      res.json({
        success: true,
        shop,
        identifierType: resolvedIdentifier!.type
      });
    }
  });
}
