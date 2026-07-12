/**
 * TenantController
 *
 * Controller for tenant CRUD routes.
 * Uses BaseController for consistent response handling and error capture.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2 and
 * .agents/skills/backend-dev-guidelines (§4 All Controllers Extend BaseController).
 */

import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { tenantService } from '../../services/tenant/TenantService';
import { NotFoundError } from '../../middleware/errorHandler';

export class TenantController extends BaseController {
  /**
   * GET /api/tenants/:id
   */
  async getTenant(req: Request, res: Response): Promise<void> {
    try {
      const tenant = await tenantService.getTenantById(req.params.id as string);

      if (!tenant) {
        throw this.notFound('Tenant not found');
      }

      this.handleSuccess(res, tenant);
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.handleError(error, res, 'getTenant', req);
      } else {
        this.handleError(error, res, 'getTenant', req);
      }
    }
  }

  /**
   * PATCH /api/tenants/:id
   */
  async updateTenant(req: Request, res: Response): Promise<void> {
    try {
      const tenant = await tenantService.updateTenant(
        req.params.id as string,
        req.body,
      );

      this.handleSuccess(res, tenant);
    } catch (error) {
      this.handleError(error, res, 'updateTenant', req);
    }
  }
}

export const tenantController = new TenantController();
