/**
 * Request Validation Middleware Factory
 *
 * Takes a Zod schema and validates req.body, req.query, and/or req.params.
 * On success, the parsed values replace the original request properties.
 * On failure, returns a 400 with structured error details.
 *
 * Usage:
 *   import { validateRequest } from '../middleware/validateRequest';
 *   import { z } from 'zod';
 *
 *   const createUserSchema = z.object({
 *     body: z.object({ email: z.string().email(), name: z.string() }),
 *   });
 *
 *   router.post('/users', validateRequest(createUserSchema), userController.create);
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.5 and
 * .agents/skills/backend-dev-guidelines (§7 Validate All External Input with Zod).
 */

import { RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Factory that returns middleware validating the specified request parts.
 *
 * Accepts either a single Zod schema (validated against req.body) or an
 * object with optional body/query/params schemas.
 */
export function validateRequest(
  schemas: ZodSchema | ValidationSchemas,
): RequestHandler {
  const parts: ValidationSchemas =
    schemas && typeof (schemas as ZodSchema).safeParse === 'function'
      ? { body: schemas as ZodSchema }
      : (schemas as ValidationSchemas);

  return ((req: any, _res: any, next: any) => {
    try {
      if (parts.body) {
        const result = parts.body.safeParse(req.body);
        if (!result.success) {
          throw new ValidationError('Invalid request body', formatZodError(result.error));
        }
        req.body = result.data;
      }

      if (parts.query) {
        const result = parts.query.safeParse(req.query);
        if (!result.success) {
          throw new ValidationError('Invalid query parameters', formatZodError(result.error));
        }
        req.query = result.data as any;
      }

      if (parts.params) {
        const result = parts.params.safeParse(req.params);
        if (!result.success) {
          throw new ValidationError('Invalid route parameters', formatZodError(result.error));
        }
        req.params = result.data as any;
      }

      next();
    } catch (err) {
      next(err);
    }
  }) as RequestHandler;
}

/**
 * Format a ZodError into a concise, serializable structure.
 */
function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
