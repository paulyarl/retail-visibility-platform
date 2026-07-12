/**
 * BaseController
 *
 * Standardized base class for all route controllers.
 * Provides consistent success/error response helpers, Sentry error capture,
 * and structured logging via the platform logger.
 *
 * Usage:
 *   export class UserController extends BaseController {
 *     async getUser(req: Request, res: Response): Promise<void> {
 *       try {
 *         const user = await this.userService.getById(req.params.id);
 *         this.handleSuccess(res, user);
 *       } catch (error) {
 *         this.handleError(error, res, 'getUser', req);
 *       }
 *     }
 *   }
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.1 and
 * .agents/skills/backend-dev-guidelines (§4 All Controllers Extend BaseController).
 */

import { Request, Response } from 'express';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import {
  HttpError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  ErrorResponse,
} from '../middleware/errorHandler';

export abstract class BaseController {
  // ─── Success helpers ──────────────────────────────────────────────────

  /**
   * Send a 200 success response with data.
   */
  protected handleSuccess(res: Response, data: unknown, message?: string): void {
    res.status(200).json({
      success: true,
      data,
      ...(message ? { message } : {}),
    });
  }

  /**
   * Send a 201 Created success response.
   */
  protected handleCreated(res: Response, data: unknown, message?: string): void {
    res.status(201).json({
      success: true,
      data,
      ...(message ? { message } : {}),
    });
  }

  /**
   * Send a 200 success response with no content (or a 204).
   */
  protected handleNoContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Send a 200 success response with paginated data.
   */
  protected handlePaginated(
    res: Response,
    data: unknown[],
    total: number,
    page: number,
    limit: number,
  ): void {
    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  // ─── Error helpers ────────────────────────────────────────────────────

  /**
   * Centralized error handler. Logs the error with request context and sends
   * a consistent JSON response. Re-throws if headers already sent.
   */
  protected handleError(
    error: unknown,
    res: Response,
    operation: string,
    req?: Request,
  ): void {
    if (res.headersSent) {
      // Can't send a response — let the global error handler deal with it
      throw error;
    }

    const ctx = req ? (req as any).ctx as RequestCtx | undefined : undefined;
    const err = error instanceof Error ? error : new Error(String(error));

    // Determine status code
    const statusCode = error instanceof HttpError
      ? error.statusCode
      : (error as any).status || 500;

    const code = error instanceof HttpError
      ? error.code
      : (error as any).code || 'internal_error';

    const message = err.message || 'An unexpected error occurred';

    // Log
    const logMeta = {
      operation,
      method: req?.method,
      path: req?.path,
      statusCode,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    };

    if (statusCode >= 500) {
      logger.error(`[${operation}] ${message}`, ctx, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`[${operation}] ${message}`, ctx, logMeta);
    }

    // Build response
    const response: ErrorResponse = {
      success: false,
      error: code,
      message: statusCode >= 500 ? 'An unexpected error occurred' : message,
      correlationId: ctx?.correlationId,
    };

    // Include validation details if present
    if (error instanceof ValidationError && error.details) {
      (response as any).details = error.details;
    }

    res.status(statusCode).json(response);
  }

  // ─── Convenience error creators ───────────────────────────────────────

  protected notFound(message?: string): NotFoundError {
    return new NotFoundError(message);
  }

  protected unauthorized(message?: string): UnauthorizedError {
    return new UnauthorizedError(message);
  }

  protected forbidden(message?: string): ForbiddenError {
    return new ForbiddenError(message);
  }

  protected validationError(message?: string, details?: unknown): ValidationError {
    return new ValidationError(message, details);
  }

  protected conflict(message?: string): ConflictError {
    return new ConflictError(message);
  }
}
