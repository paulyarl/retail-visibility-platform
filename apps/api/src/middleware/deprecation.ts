// Deprecation signalling middleware for retiring API endpoints.
//
// Adds RFC 8594 / RFC 9745 style headers so any out-of-repo caller surfaces in
// client tooling and logs before the endpoint is hard-deleted, and logs a single
// warning per (method, path) per process so the retired surface is observable.
//
// See docs/SLUG_API_RETIREMENT.md for the retirement register and sunset plan.
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export interface DeprecationOptions {
  /** ISO date the endpoint was marked retired. */
  retiredOn: string;
  /** ISO date the endpoint will be removed (hard delete). */
  sunsetOn: string;
  /** Path of the replacement endpoint, if any. */
  replacement?: string;
  /** Link to the retirement register. */
  doc?: string;
}

const warned = new Set<string>();

export function deprecate(options: DeprecationOptions) {
  const sunset = new Date(options.sunsetOn).toUTCString();

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', sunset);
    if (options.replacement) {
      res.setHeader('Link', `<${options.replacement}>; rel="successor-version"`);
    }

    const key = `${req.method} ${req.originalUrl.split('?')[0]}`;
    if (!warned.has(key)) {
      warned.add(key);
      logger.warn(
        `[Deprecation] ${key} was retired on ${options.retiredOn} and will be removed on ${options.sunsetOn}.` +
          (options.replacement ? ` Use ${options.replacement} instead.` : '') +
          (options.doc ? ` See ${options.doc}.` : ''),
      );
    }

    next();
  };
}
