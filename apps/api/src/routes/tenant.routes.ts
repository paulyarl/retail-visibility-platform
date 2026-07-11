/**
 * Tenant Routes Orchestrator
 *
 * Single router that mounts all tenant sub-routers in strict order:
 * 1. Sub-resource routers (/:tenantId/specific-path) — mounted first
 * 2. Main tenant CRUD router (tenantsRoutes with /:id patterns) — mounted last
 *
 * This prevents /:id catch-all patterns in tenantsRoutes from intercepting
 * requests meant for sub-resource routers like /:tenantId/payment-gateways.
 *
 * Replaces the previous pattern of 30+ separate app.use('/api/tenants', ...) calls
 * in routeRegistry.ts.
 *
 * ── Auth Middleware Strategy ──────────────────────────────────────────────
 * - Most sub-resource routers handle auth internally (per-route authenticateToken
 *   + checkTenantAccess). No mount-level auth is applied to avoid double-auth.
 * - trialSetupRoutes, tenantNotificationsRoutes, tenantUserRoutes: mount-level
 *   auth was not applied in the original registry; these routers handle auth
 *   internally.
 * - tenantsRoutes (main CRUD): handles auth internally per-route.
 * - The registry mounts this orchestrator at /api/tenants without mount-level
 *   middleware, matching the original behavior.
 */

import { Router } from 'express';

// Sub-resource routers (all use /:tenantId/specific-path patterns)
import paymentGatewaysRoutes from './payment-gateways';
import tenantStripeConnectRoutes from './tenant-stripe-connect';
import paypalConnectRoutes from './paypal-connect';
import fulfillmentSettingsRoutes from './fulfillment-settings';
import commerceSettingsRoutes from './commerce-settings';
import taxRoutes from './tax';
import productOptionsSettingsRoutes from './product-options-settings';
import featuredOptionsSettingsRoutes from './featured-options-settings';
import quickstartOptionsSettingsRoutes from './quickstart-options-settings';
import storefrontOptionsSettingsRoutes from './storefront-options-settings';
import directoryEntryOptionsSettingsRoutes from './directory-entry-options-settings';
import storefrontTypeSettingsRoutes from './storefront-type-settings';
import productTypeSettingsRoutes from './product-type-settings';
import storefrontPolicyRoutes from './storefront-policies';
import faqOptionsSettingsRoutes from './faq-options-settings';
import crmOptionsSettingsRoutes from './crm-options-settings';
import socialCommerceOptionsSettingsRoutes from './social-commerce-options-settings';
import chatbotOptionsSettingsRoutes from './chatbot-options-settings';
import barcodeScanSettingsRoutes from './barcode-scan-settings';
import integrationOptionsSettingsRoutes from './integration-options-settings';
import paymentGatewaySettingsRoutes from './payment-gateway-settings';
import trialSetupRoutes from './tenant/trial-setup';
import tenantNotificationsRoutes from './tenant-notifications';
import digitalDownloadPagesRoutes from './tenant/digital-download-pages';
import socialProofRoutes from './social-proof';
import returnsRoutes from './returns';
import tenantCapabilitiesRoutes from './tenant-capabilities';
import tenantUserRoutes from './tenant-users';
import directoryTenantRoutes from './directory-tenant';
import abandonedCartRoutes from './abandoned-carts';

// Main tenant CRUD router — has /:id patterns, must be mounted LAST
import tenantsRoutes from './tenants';

const router = Router();

// ── 1. Sub-resource routers (/:tenantId/specific-path) ──────────────────
// These all use two-segment paths (/:tenantId/specific) so they don't
// collide with each other. Mount first so they take priority over
// any /:id patterns in tenantsRoutes.

router.use('/', paymentGatewaysRoutes);
router.use('/', tenantStripeConnectRoutes);
router.use('/', paypalConnectRoutes);
router.use('/', fulfillmentSettingsRoutes);
router.use('/', commerceSettingsRoutes);
router.use('/', taxRoutes);
router.use('/', productOptionsSettingsRoutes);
router.use('/', featuredOptionsSettingsRoutes);
router.use('/', quickstartOptionsSettingsRoutes);
router.use('/', storefrontOptionsSettingsRoutes);
router.use('/', directoryEntryOptionsSettingsRoutes);
router.use('/', storefrontTypeSettingsRoutes);
router.use('/', productTypeSettingsRoutes);
router.use('/', storefrontPolicyRoutes);
router.use('/', faqOptionsSettingsRoutes);
router.use('/', crmOptionsSettingsRoutes);
router.use('/', socialCommerceOptionsSettingsRoutes);
router.use('/', chatbotOptionsSettingsRoutes);
router.use('/', barcodeScanSettingsRoutes);
router.use('/', integrationOptionsSettingsRoutes);
router.use('/', paymentGatewaySettingsRoutes);

// Routers with mount-level auth middleware
router.use('/', trialSetupRoutes);
router.use('/', tenantNotificationsRoutes);
router.use('/', tenantUserRoutes);

// Routers without mount-level auth (auth is per-route or not needed)
router.use('/', digitalDownloadPagesRoutes);
router.use('/', socialProofRoutes);
router.use('/', returnsRoutes);
router.use('/', tenantCapabilitiesRoutes);
router.use('/', directoryTenantRoutes);
router.use('/', abandonedCartRoutes);

// ── 2. Main tenant CRUD router — LAST ───────────────────────────────────
// tenantsRoutes has /:id patterns (PATCH /:id, GET /:id/complete, etc.)
// and root-level paths (GET /, GET /check-subdomain/:subdomain).
// Must be mounted after all sub-resource routers to avoid /:id intercepting
// sub-resource paths. Note: tenantsRoutes does NOT have GET /:id (single
// segment), so sub-resource routers are safe, but this ordering future-proofs
// against someone adding one.
router.use('/', tenantsRoutes);

export default router;
