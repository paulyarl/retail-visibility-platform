/**
 * Global Error Handler & Async Wrapper
 *
 * Provides:
 *   - asyncErrorWrapper: Catches async errors in route handlers so they reach
 *     the Express error pipeline instead of becoming unhandled rejections.
 *   - globalErrorHandler: Terminal error middleware that logs to all transports
 *     (console, file, DB, Sentry via logger) and returns a consistent JSON shape.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.4 and
 * .agents/skills/backend-dev-guidelines (§8 Async & Error Handling).
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

// ─── Standardized error response shape ────────────────────────────────────

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  correlationId?: string;
}

// ─── Known HTTP error types ───────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found') {
    super(404, 'not_found', message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, 'unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(403, 'forbidden', message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Validation failed', public details?: unknown) {
    super(400, 'validation_error', message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(409, 'conflict', message);
    this.name = 'ConflictError';
  }
}

// ─── asyncErrorWrapper ────────────────────────────────────────────────────

/**
 * Wraps an async route handler so that rejected promises are forwarded to
 * next() and handled by the global error handler.
 *
 * Usage:
 *   router.get('/users', asyncErrorWrapper((req, res) => controller.list(req, res)));
 */
export function asyncErrorWrapper(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
): RequestHandler {
  return ((req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  }) as RequestHandler;
}

// ─── Global error handler (terminal middleware) ───────────────────────────

/**
 * Express error-handling middleware. Must be registered AFTER all routes
 * and AFTER Sentry's error handler.
 *
 *   app.use(Sentry.setupExpressErrorHandler(app));  // if Sentry enabled
 *   app.use(globalErrorHandler);
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // If headers already sent, defer to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  const ctx = (req as any).ctx as RequestCtx | undefined;

  // Determine status code and code
  const statusCode = err instanceof HttpError
    ? err.statusCode
    : err.status || 500;

  const code = err instanceof HttpError
    ? err.code
    : err.code || 'internal_error';

  const message = err.message || 'An unexpected error occurred';

  // Build response
  const response: ErrorResponse = {
    success: false,
    error: code,
    message: statusCode >= 500 ? 'An unexpected error occurred' : message,
    correlationId: ctx?.correlationId,
  };

  // Include validation details if present
  if (err instanceof ValidationError && err.details) {
    (response as any).details = err.details;
  }

  // Log error (logger routes to console, file, DB, Sentry transports)
  const logMeta = {
    method: req.method,
    path: req.path,
    statusCode,
    error: {
      name: err.name || 'Error',
      message: err.message || String(err),
      stack: err.stack,
    },
  };

  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${req.method} ${req.path} — ${message}`, ctx, logMeta);
  } else if (statusCode >= 400) {
    logger.warn(`[${statusCode}] ${req.method} ${req.path} — ${message}`, ctx, logMeta);
  }

  res.status(statusCode).json(response);
};

// ─── 404 handler (for unmatched routes) ───────────────────────────────────

export const notFoundHandler = (req: Request, res: Response) => {
  const ctx = (req as any).ctx as RequestCtx | undefined;
  logger.warn(`[404] ${req.method} ${req.path} — route not found`, ctx, {
    method: req.method,
    path: req.path,
    statusCode: 404,
  });
  res.status(404).json({
    success: false,
    error: 'not_found',
    message: `Route not found: ${req.method} ${req.path}`,
    correlationId: ctx?.correlationId,
  });
};
