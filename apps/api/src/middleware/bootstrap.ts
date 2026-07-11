/**
 * Middleware Bootstrap
 *
 * Applies all global middleware to the Express app in the correct order.
 * Called from index.ts before route mounting.
 *
 * Order matters:
 *   1. Security headers (first for maximum protection)
 *   2. Security logger (log suspicious requests early)
 *   3. Rate limiting (database-driven)
 *   4. IoT/SSRF/input protection
 *   5. CORS
 *   6. Pre-middleware routes (client errors, webhooks — need raw body)
 *   7. Body parsers (cookie, JSON, urlencoded)
 *   8. Rate limit / input validation / performance monitoring
 *   9. HTTP logging / request context / request logger
 *  10. CSRF
 */

import { Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import express from 'express';

import { requestLogger, logger } from '../logger';
import { setRequestContext } from '../context';
import { setCsrfCookie, csrfProtect } from './csrf';
import { applyRateLimit } from './rate-limit';
import { securityHeaders, additionalSecurityHeaders } from './security-headers';
import { inputValidationMiddleware } from './input-validation';
import { validateInput, securityLogger } from './security';
import { ssrfProtection, blockIotRequests } from './ssrf-protection';
import { performanceMonitoring } from '../services/alerting';

// Pre-middleware routes (mounted before JSON parsing)
import clientErrorRoutes from '../routes/client-errors';
import webhooksRoutes from '../routes/webhooks';
import stripeConnectWebhooks from '../routes/stripe-connect-webhooks';

export function bootstrapMiddleware(app: Express): void {
  // ── 1. Security headers ──────────────────────────────────────────────
  app.use(securityHeaders);
  app.use(additionalSecurityHeaders);

  // ── 2. Security logger ───────────────────────────────────────────────
  app.use(securityLogger);

  // ── 3. Rate limiting (database-driven with priority logic) ───────────
  app.use(async (req, res, next) => {
    try {
      const { rateLimitingService } = await import('../services/RateLimitingService');

      const isEnabled = await rateLimitingService.isRateLimitingEnabled();
      if (!isEnabled) {
        return next();
      }

      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
      const path = req.path || req.url || '/';

      const result = await rateLimitingService.checkRateLimit(ip, 'standard', path);

      if (!result.allowed) {
        logger.warn(`[RATE LIMIT] Blocked ${ip} - exceeded limit for standard on ${path}`);

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again after ${result.rule?.windowMinutes || 15} minutes.`,
          retryAfter: (result.rule?.windowMinutes || 15) * 60,
          priority: 'Environment Variable > Database > Default OFF'
        });
      }

      next();
    } catch (error) {
      logger.error('[RateLimitingService] Middleware error', undefined, { error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } });
      next();
    }
  });

  // ── 4. IoT / SSRF / input protection ─────────────────────────────────
  app.use(blockIotRequests);
  app.use(validateInput);
  app.use(ssrfProtection);

  // ── 5. CORS ──────────────────────────────────────────────────────────
  app.use(cors({
    origin: [/localhost:\d+$/, /\.vercel\.app$/, /vercel\.app$/, /www\.visibleshelf\.com$/, /visibleshelf\.com$/, /\.visibleshelf\.com$/, /visibleshelf\.store$/, /\.visibleshelf\.store$/],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token', 'x-tenant-id', 'x-no-retry', 'x-device-info', 'x-admin-request', 'x-tenant-request', 'x-request-group', 'x-request-groups', 'x-require-all', 'x-admin-roles', 'x-audit-id', 'x-request-context', 'x-organization-id', 'x-organization-validation', 'x-audit-operation', 'x-audit-reason', 'x-service', 'x-service-key', 'x-auth0-email', 'x-auth0-id', 'x-session-id', 'x-customer-id', 'x-correlation-id', 'cache-control', 'x-platform-cache', 'x-service-admin'],
  }));

  // ── 6. Pre-middleware routes (before JSON parsing) ───────────────────
  // Client error reporting — mounted BEFORE auth middleware (errors can occur pre-login)
  app.use('/api/client-errors', express.json({ limit: '1mb' }), clientErrorRoutes);
  console.log('✅ Client error reporting mounted at /api/client-errors');

  // Webhook routes MUST be mounted BEFORE JSON parsing (Stripe needs raw body)
  app.use('/api/webhooks', webhooksRoutes);
  console.log('Webhooks routes mounted at /api/webhooks (Phase 3B: Payment Event Processing)');

  // Stripe Connect webhooks - requires raw body for signature verification
  app.use('/api/webhooks/stripe-connect', express.raw({ type: 'application/json' }), stripeConnectWebhooks);
  console.log('Stripe Connect webhooks mounted at /api/webhooks/stripe-connect');

  // ── 7. Body parsers ──────────────────────────────────────────────────
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ── 8. Rate limit / input validation / performance monitoring ────────
  app.use(applyRateLimit);
  app.use(inputValidationMiddleware);
  app.use(performanceMonitoring);

  // ── 9. HTTP logging / request context / request logger ───────────────
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(setRequestContext);
  app.use(requestLogger);

  // ── 10. CSRF ─────────────────────────────────────────────────────────
  app.use(setCsrfCookie);
  app.use(csrfProtect);
}
