/**
 * Unified platform scope constant.
 *
 * The platform tenant row (tenants.id = 'platform') is the single sentinel
 * for all platform-scoped commerce and CRM:
 *   - Coupon validation fallback (marketing-ops-public.ts)
 *   - Payment method scope (customer_payment_methods.tenant_id = 'platform')
 *   - Coupon wallet scope (customer_saved_coupons.tenant_id = 'platform')
 *   - CRM support tickets (crm_support_tickets.tenant_id = 'platform')
 *   - CRM alerts (crm_alerts.tenant_id = 'platform')
 *
 * This replaces the prior dual-sentinel design ('_platform_' for commerce +
 * 'platform' for CRM) — see MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md §5.3a and
 * resolved open question #3. New code MUST use this constant instead of
 * hardcoding 'platform' or '_platform_'.
 *
 * Existing files that still define a local `PLATFORM_TENANT_ID = 'platform'`
 * (crm-personal.ts, public-catalog.ts, ccpa.ts) will be migrated to import
 * this constant in a follow-up cleanup — they are semantically identical.
 */
export const PLATFORM_SCOPE = 'platform' as const;

/**
 * CRM ticket tenant_id value — same as PLATFORM_SCOPE.
 * Kept as a separate export for readability at CRM call sites where the
 * semantic intent is "this ticket belongs to the platform operator hub"
 * rather than "this commerce row is platform-scoped".
 */
export const PLATFORM_CRM_TENANT_ID = PLATFORM_SCOPE;
