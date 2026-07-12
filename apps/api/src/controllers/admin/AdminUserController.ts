/**
 * AdminUserController
 *
 * Controller for admin user management routes.
 * Uses BaseController for consistent response handling and error capture.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2 and
 * .agents/skills/backend-dev-guidelines (§4 All Controllers Extend BaseController).
 */

import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
import { adminUserService } from '../../services/admin/AdminUserService';
import { ForbiddenError } from '../../middleware/errorHandler';

export class AdminUserController extends BaseController {
  /**
   * GET /api/admin/users
   * List users based on requesting user's permissions.
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const requestingUser = (req as any).user;
      const users = await adminUserService.listUsers(requestingUser);

      if (users === null) {
        throw new ForbiddenError('Insufficient permissions to view users');
      }

      res.status(200).json({
        success: true,
        users,
        user_tenants: users,
        userTenants: users,
        data: users,
        items: users,
        results: users,
        total: users.length,
      });
    } catch (error) {
      this.handleError(error, res, 'listUsers', req);
    }
  }
}

export const adminUserController = new AdminUserController();
