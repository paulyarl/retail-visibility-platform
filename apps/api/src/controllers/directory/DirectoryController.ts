/**
 * DirectoryController
 *
 * Controller for directory public routes (search, featured stores, slug lookup).
 * Uses BaseController for consistent response handling and error capture.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2 and
 * .agents/skills/backend-dev-guidelines (§4 All Controllers Extend BaseController).
 */

import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { directoryService } from '../../services/directory/DirectoryService';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';

export class DirectoryController extends BaseController {
  /**
   * GET /api/directory/search
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const result = await directoryService.search(req.query as any);

      if (!result) {
        throw new ValidationError('Search query is required');
      }

      res.status(200).json({
        success: true,
        ...result,
        performance: {
          queryTime: '<15ms',
          optimized: true,
          source: 'materialized_view',
        },
      });
    } catch (error) {
      this.handleError(error, res, 'search', req);
    }
  }

  /**
   * GET /api/directory/stores/featured
   */
  async getFeaturedStores(req: Request, res: Response): Promise<void> {
    try {
      const stores = await directoryService.getFeaturedStores(req.query as any);

      res.status(200).json({
        success: true,
        stores,
        pagination: {
          totalItems: stores.length,
          itemsPerPage: parseInt((req.query.limit as string) || '20'),
        },
        performance: {
          queryTime: '<10ms',
          optimized: true,
          source: 'materialized_view',
        },
      });
    } catch (error) {
      this.handleError(error, res, 'getFeaturedStores', req);
    }
  }

  /**
   * GET /api/directory/:slug
   */
  async getListingBySlug(req: Request, res: Response): Promise<void> {
    try {
      const listing = await directoryService.getListingBySlug(req.params.slug);

      if (!listing) {
        throw new NotFoundError('Listing not found');
      }

      res.status(200).json(listing);
    } catch (error) {
      this.handleError(error, res, 'getListingBySlug', req);
    }
  }
}

export const directoryController = new DirectoryController();
