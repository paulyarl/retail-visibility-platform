/**
 * Tenant Routes Orchestrator
 *
 * Single router that mounts all tenant sub-routers grouped by auth level:
 * 1. Public sub-routers (no auth) — mounted first
 * 2. Tenant-authenticated sub-routers (per-route auth) — mounted second
 * 3. Main tenant CRUD router (tenantsRoutes with /:id patterns) — mounted last
 *
 * This prevents /:id catch-all patterns in tenantsRoutes from intercepting
 * requests meant for sub-resource routers like /:tenantId/payment-gateways.
 *
 * Auth scope isolation (per docs/AUTH_SCOPE_ISOLATION_SPEC.md):
 * - No sub-router uses router.use(authenticateToken) — all auth is per-route.
 * - Public routers are mounted first as defense-in-depth.
 * - Mount order no longer affects auth behavior (NFR-3: order independence).
 */

import { Router } from 'express';

// ── Public sub-routers (no auth required) ────────────────────────────────
import tenantCapabilitiesRoutes from './tenant-capabilities';
import directoryTenantRoutes from './directory-tenant';
import abandonedCartRoutes from './abandoned-carts';
import digitalDownloadPagesRoutes from './tenant/digital-download-pages';
import socialProofRoutes from './social-proof';
import returnsRoutes from './returns';

// ── Tenant-authenticated sub-routers (per-route auth) ────────────────────
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
import storefrontQrSettingsRoutes from './storefront-qr-settings';
import storefrontGallerySettingsRoutes from './storefront-gallery-settings';
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
import wholesaleMatchingRoutes from './wholesale-matching';
import wholesaleMatchingOptionsSettingsRoutes from './wholesale-matching-options-settings';
import paymentGatewaySettingsRoutes from './payment-gateway-settings';
import trialSetupRoutes from './tenant/trial-setup';
import tenantNotificationsRoutes from './tenant-notifications';
import tenantUserRoutes from './tenant-users';

// ── Main tenant CRUD router — has /:id patterns, must be mounted LAST ───
import tenantsRoutes from './tenants';

const router = Router();

// ── 1. Public sub-routers (no auth) — mounted first ─────────────────────
// These routers have routes that must be accessible without authentication
// (e.g., public capability resolution, directory listings, abandoned cart
// recovery). Mounting first ensures no auth-gated router can block them.
router.use('/', tenantCapabilitiesRoutes);
router.use('/', directoryTenantRoutes);
router.use('/', abandonedCartRoutes);
router.use('/', digitalDownloadPagesRoutes);
router.use('/', socialProofRoutes);
router.use('/', returnsRoutes);

// ── 2. Tenant-authenticated sub-routers (per-route auth) ────────────────
// All auth is applied per-route inside each router. No router-level auth
// middleware — this prevents auth scope bleed between siblings.
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
router.use('/', storefrontQrSettingsRoutes);
router.use('/', storefrontGallerySettingsRoutes);
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
router.use('/', wholesaleMatchingRoutes);
router.use('/', wholesaleMatchingOptionsSettingsRoutes);
router.use('/', trialSetupRoutes);
router.use('/', tenantNotificationsRoutes);
router.use('/', tenantUserRoutes);

// ── 3. Main tenant CRUD router — LAST ───────────────────────────────────
// tenantsRoutes has /:id patterns (PATCH /:id, GET /:id/complete, etc.)
// and root-level paths (GET /, GET /check-subdomain/:subdomain).
// Must be mounted after all sub-resource routers to avoid /:id intercepting
// sub-resource paths. Auth is per-route inside tenantsRoutes.
router.use('/', tenantsRoutes);

export default router;
