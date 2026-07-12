// Sentry - Must be imported first for error tracking
import * as Sentry from '@sentry/node';

// New Relic APM - Must be imported first
import './newrelic';

// Platform-level structured logger — available before any other code runs
import { logger } from "./logger";

import express from 'express';

// Fix for Supabase SSL certificate issues in production
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  logger.warn('SSL certificate validation disabled for Supabase compatibility');
}
import { prisma } from "./prisma";
import { bootstrapMiddleware } from "./middleware/bootstrap";

// Migration fix applied: ProductCondition enum renamed 'new' to 'brand_new'
// Force rebuild v3: Railway build cache bypass
import fs from "fs";
import path from "path";

const app = express();

// Trust proxy - only enable in production where there's an actual proxy (Railway, Vercel)
// In development, there's no proxy so this should be false to avoid security warnings
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// Initialize Sentry for error tracking (only if DSN is provided)
const sentryEnabled = process.env.SENTRY_DSN && process.env.SENTRY_DSN.trim() !== '';

if (sentryEnabled) {
  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // Use custom environment variable to distinguish staging from production
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,

      // Don't send errors in development
      beforeSend(event, hint) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('Sentry error (not sent in dev)', undefined, { error: hint.originalException || event });
          return null;
        }
        return event;
      },
    });

    logger.info('Sentry error tracking initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry', undefined, { error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } });
  }
} else {
  logger.warn('Sentry DSN not found - error tracking disabled');
}

/* ------------------------- middleware bootstrap ------------------------- */
bootstrapMiddleware(app);

/* -------------------- static uploads (filesystem for MVP) -------------------- */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
// Create upload directory in both dev and production for MVP
if (!fs.existsSync(UPLOAD_DIR)) {
  try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { }
}
// Serve uploads statically in both dev and production for MVP
app.use("/uploads", express.static(UPLOAD_DIR));

/* ------------------------------ route registry ------------------------------ */
import { mountFromRegistry } from './routes/routeRegistry';
mountFromRegistry(app);

// Sentry error handler must be after all routes but before other error handlers
if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler (terminal middleware — logs to all transports, returns consistent JSON)
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
app.use(notFoundHandler);
app.use(globalErrorHandler);

/* ------------------------------ boot ------------------------------ */
const port = Number(process.env.PORT || process.env.API_PORT || 4000);

// Log startup environment
console.log('\n🚀 Starting API server...');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${port}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   WEB_URL: ${process.env.WEB_URL || 'Not set'}\n`);

// Only start the server when not running tests
if (process.env.NODE_ENV !== "test") {
  try {
    console.log('🔧 About to start server...');
    const server = app.listen(port, '0.0.0.0', async () => {
      logger.info(`API server running → http://localhost:${port}/health`);
      logger.info(`View all routes → http://localhost:${port}/__routes`);

      // Start GMC scheduled sync (every 6 hours)
      try {
        const { startGMCScheduledSync } = await import('./jobs/gmc-scheduled-sync');
        startGMCScheduledSync();
        logger.info('GMC scheduled sync started (every 6 hours)');
      } catch (err) {
        logger.error('Failed to start GMC scheduled sync', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start GMC sync retry (every 2 hours)
      try {
        const { startGMCSyncRetry } = await import('./jobs/gmc-sync-retry');
        startGMCSyncRetry();
        logger.info('GMC sync retry started (every 2 hours)');
      } catch (err) {
        logger.error('Failed to start GMC sync retry', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start OAuth token refresh (every hour)
      try {
        const { startOAuthTokenRefresh } = await import('./jobs/oauth-token-refresh');
        startOAuthTokenRefresh();
        logger.info('OAuth token refresh started (every hour)');
      } catch (err) {
        logger.error('Failed to start OAuth token refresh', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start subscription grace period job (daily at midnight)
      try {
        const { startGracePeriodJob } = await import('./jobs/subscription-grace-period');
        startGracePeriodJob();
        logger.info('Subscription grace period job started (daily at midnight)');
      } catch (err) {
        logger.error('Failed to start grace period job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start BSaaS feature renewal job (daily at midnight)
      try {
        const { startBsaasRenewalJob } = await import('./jobs/bsaas-renewal');
        startBsaasRenewalJob();
        logger.info('BSaaS feature renewal job started (daily at midnight)');
      } catch (err) {
        logger.error('Failed to start BSaaS renewal job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start featured products expiry monitor (daily at midnight)
      try {
        const { startFeaturedExpiryMonitor } = await import('./jobs/featured-products-expiry-monitor');
        startFeaturedExpiryMonitor();
        logger.info('Featured products expiry monitor started (daily at midnight)');
      } catch (err) {
        logger.error('Failed to start featured products expiry monitor', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start featured expiration enforcer (every 5 minutes) — deactivates expired featured_products
      try {
        const { startFeaturedExpirationEnforcer } = await import('./jobs/featured-expiration-enforcer');
        startFeaturedExpirationEnforcer();
        logger.info('Featured expiration enforcer started (every 5 minutes)');
      } catch (err) {
        logger.error('Failed to start featured expiration enforcer', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start featured placement renewal job (daily) — auto-renew, grace period, trial support
      try {
        const { startPlacementRenewalJob } = await import('./jobs/featured-placement-renewal');
        startPlacementRenewalJob();
        logger.info('Featured placement renewal job started (daily)');
      } catch (err) {
        logger.error('Failed to start featured placement renewal job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start directory promotion renewal job (daily) — auto-renew, grace period, expiration
      try {
        const { startPromotionRenewalJob } = await import('./jobs/promotion-renewal');
        startPromotionRenewalJob();
        logger.info('Directory promotion renewal job started (daily)');
      } catch (err) {
        logger.error('Failed to start directory promotion renewal job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start bot product embedding sync (every 12 hours) — gated by platform settings
      try {
        const settings = await prisma.platform_settings_list.findFirst();
        const aiEnabled = (settings?.bot_ai_enabled ?? true) && (settings?.bot_embedding_sync_enabled ?? true);
        if (aiEnabled) {
          const { startBotProductEmbeddingSync } = await import('./jobs/bot-product-embedding-sync');
          await startBotProductEmbeddingSync();
          logger.info('Bot product embedding sync started');
        } else {
          logger.info('Bot product embedding sync skipped (disabled by platform admin)');
        }
      } catch (err) {
        logger.error('Failed to start bot product embedding sync', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start platform badge sync (every 6 hours) — syncs trending/bestseller/recommended to featured_products
      try {
        const { startPlatformBadgeSync } = await import('./jobs/platform-badge-sync');
        await startPlatformBadgeSync();
        logger.info('Platform badge sync started');
      } catch (err) {
        logger.error('Failed to start platform badge sync', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start badge rule auto-assign sync (every 4 hours) — evaluates sale/new_arrival/clearance rules
      try {
        const { startBadgeRuleSync } = await import('./jobs/badge-rule-sync');
        await startBadgeRuleSync();
        logger.info('Badge rule sync started');
      } catch (err) {
        logger.error('Failed to start badge rule sync', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start badge analytics aggregation (every 6 hours) — aggregates badge_events into badge_analytics
      try {
        const { startBadgeAnalyticsSync } = await import('./jobs/badge-analytics-sync');
        await startBadgeAnalyticsSync();
        logger.info('Badge analytics sync started');
      } catch (err) {
        logger.error('Failed to start badge analytics sync', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start log purge job (daily at 2 AM UTC)
      try {
        const { startLogPurgeJob } = await import('./jobs/log-purge');
        startLogPurgeJob();
        logger.info('Log purge job started (daily at 2 AM UTC)');
      } catch (err) {
        logger.error('Failed to start log purge job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start abandoned cart recovery job (every 30 minutes)
      try {
        const { startAbandonedCartRecovery } = await import('./jobs/abandoned-cart-recovery');
        startAbandonedCartRecovery();
        logger.info('Abandoned cart recovery job started (every 30 minutes)');
      } catch (err) {
        logger.error('Failed to start abandoned cart recovery job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start Meta catalog sync job (every 6 hours)
      try {
        const { startMetaCatalogSync } = await import('./jobs/meta-catalog-sync');
        startMetaCatalogSync();
        logger.info('Meta catalog sync job started (every 6 hours)');
      } catch (err) {
        logger.error('Failed to start Meta catalog sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start TikTok catalog sync job (every 6 hours)
      try {
        const { startTikTokCatalogSync } = await import('./jobs/tiktok-catalog-sync');
        startTikTokCatalogSync();
        logger.info('TikTok catalog sync job started (every 6 hours)');
      } catch (err) {
        logger.error('Failed to start TikTok catalog sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start supplier CSV sync job (every 6 hours)
      try {
        const { startSupplierCsvSync } = await import('./jobs/supplier-csv-sync');
        startSupplierCsvSync();
        logger.info('Supplier CSV sync job started (every 6 hours)');
      } catch (err) {
        logger.error('Failed to start supplier CSV sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start supplier open-source sync job (hourly incremental + nightly backfill)
      try {
        const { startSupplierOpenSourceSync } = await import('./jobs/supplier-opensource-sync');
        startSupplierOpenSourceSync();
        logger.info('Supplier open-source sync job started (hourly incremental + nightly backfill)');
      } catch (err) {
        logger.error('Failed to start supplier open-source sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start supplier commercial sync job (nightly backfill + Kroger token refresh)
      try {
        const { startSupplierCommercialSync } = await import('./jobs/supplier-commercial-sync');
        startSupplierCommercialSync();
        logger.info('Supplier commercial sync job started (nightly backfill)');
      } catch (err) {
        logger.error('Failed to start supplier commercial sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start supplier auto-sync job (every 1 hour)
      try {
        const { startSupplierAutoSync } = await import('./jobs/supplier-auto-sync');
        startSupplierAutoSync();
        logger.info('Supplier auto-sync job started (every 1 hour)');
      } catch (err) {
        logger.error('Failed to start supplier auto-sync job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start flag expiry cleanup job (daily) — removes stale tenant flag overrides
      try {
        const { startFlagExpiryCleanup } = await import('./jobs/flag-expiry-cleanup');
        startFlagExpiryCleanup();
        logger.info('Flag expiry cleanup job started (daily)');
      } catch (err) {
        logger.error('Failed to start flag expiry cleanup job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start demo tenant expiry job (hourly) — expires demo tenants past their demo_expires_at
      try {
        const { startDemoExpiryJob } = await import('./jobs/demo-tenant-expiry');
        startDemoExpiryJob();
        logger.info('Demo tenant expiry job started (every 1 hour)');
      } catch (err) {
        logger.error('Failed to start demo tenant expiry job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }

      // Start affiliate click expiry job (daily) — marks pending clicks as expired after 30 days
      try {
        const { startAffiliateClickExpiryJob } = await import('./jobs/affiliate-click-expiry');
        startAffiliateClickExpiryJob();
        logger.info('Affiliate click expiry job started (daily)');
      } catch (err) {
        logger.error('Failed to start affiliate click expiry job', undefined, { error: { name: err instanceof Error ? err.name : 'Error', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined } });
      }
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error('Server error', undefined, { error: { name: error.name, message: error.message, stack: error.stack } });
      }
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    // Capture uncaught exceptions — log to all transports (DB, Sentry, console) then exit
    process.on('uncaughtException', (error: Error) => {
      logger.error('uncaughtException', undefined, {
        error: { name: error.name, message: error.message, stack: error.stack },
      });
      // Give transports a moment to flush, then exit
      setImmediate(() => process.exit(1));
    });

    // Capture unhandled promise rejections — log but don't crash (Node 15+ defaults to exit)
    process.on('unhandledRejection', (reason: unknown) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('unhandledRejection', undefined, {
        error: { name: err.name, message: err.message, stack: err.stack },
      });
    });
  } catch (error) {
    logger.error('Fatal error during server startup', undefined, { error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined } });
    process.exit(1);
  }
}

// Export the Express app for Vercel compatibility
export default app;
