/**
 * Client Error Reporting Endpoint
 *
 * Accepts batched error reports from the frontend and persists them
 * to application_error_log. No authentication required (client errors
 * can occur before login). Rate limited by IP.
 *
 * POST /api/client-errors
 * Body: { errors: ClientErrorReport[] }
 * Response: { accepted: number, dropped: number }
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();

interface ClientErrorReport {
  message: string;
  stack_trace?: string;
  error_name?: string;
  tenant_id?: string;
  user_id?: string;
  correlation_id?: string;
  url: string;
  user_agent: string;
  timestamp: string;
  context?: Record<string, any>;
}

// Simple in-memory rate limiting (max 10 errors/min/IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ERRORS_PER_MINUTE = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ERRORS_PER_MINUTE;
}

// Clean rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60_000).unref();

router.post('/', async (req: Request, res: Response) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited', accepted: 0, dropped: 0 });
  }

  const { errors } = req.body as { errors?: ClientErrorReport[] };

  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return res.status(400).json({ error: 'invalid_body', accepted: 0, dropped: 0 });
  }

  // Cap batch size to prevent abuse
  const batch = errors.slice(0, 20);
  let accepted = 0;
  let dropped = 0;

  for (const report of batch) {
    try {
      await prisma.application_error_log.create({
        data: {
          level: 'error',
          message: report.message?.slice(0, 5000) || 'Unknown client error',
          stack_trace: report.stack_trace?.slice(0, 10000) || null,
          error_name: report.error_name?.slice(0, 255) || 'ClientError',
          tenant_id: report.tenant_id?.slice(0, 255) || null,
          user_id: report.user_id?.slice(0, 255) || null,
          request_method: 'CLIENT',
          request_path: report.url?.slice(0, 2000) || null,
          correlation_id: report.correlation_id?.slice(0, 255) || null,
          service: 'client',
          context: {
            url: report.url,
            user_agent: report.user_agent,
            client_timestamp: report.timestamp,
            ...report.context,
          },
        },
      });
      accepted++;
    } catch (err: any) {
      dropped++;
      // Log but don't fail the entire batch
      logger.error('[ClientErrors] Failed to persist error', undefined, {
        error: { name: err.name, message: err.message, stack: err.stack },
      });
    }
  }

  res.status(201).json({ accepted, dropped });
});

export default router;
