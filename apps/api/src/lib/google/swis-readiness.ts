/**
 * swis_readiness evaluator (spec §6.2)
 *
 * Ordered prerequisite chain for the local surface:
 *   connected → GBP↔MC link confirmed → free-local-listings enrolled →
 *   store_code set → products selected → ready
 *
 * Google-side verification notes:
 * - The GBP↔MC link cannot be detected via our APIs — proxy: GBP token
 *   exists + merchant recorded their GBP account (gbp_account_url) as
 *   checklist confirmation.
 * - Program enrollment has no API either in v1 — free_listings_enabled is
 *   console-confirmed by the merchant via the checklist.
 */

import { prisma } from '../../prisma';
import { findGoogleToken } from './token-store';

export type SwisReadinessState =
  | 'disconnected'
  | 'pending_gbp_link'
  | 'not_enrolled'
  | 'no_store_code'
  | 'pending_selection'
  | 'ready';

export interface SwisReadiness {
  state: SwisReadinessState;
  merchantId?: string;
  storeCode?: string;
  selectedCount: number;
  /** checklist rows for the UI — each step with done flag + cta */
  steps: Array<{ key: string; label: string; done: boolean }>;
}

export async function evaluateSwisReadiness(tenantId: string): Promise<SwisReadiness> {
  const account = await prisma.google_oauth_accounts_list.findFirst({
    where: { tenant_id: tenantId },
    include: {
      google_merchant_links_list: { where: { is_active: true }, take: 1 },
    },
  });
  const link = account?.google_merchant_links_list[0];

  if (!account || !link) {
    return {
      state: 'disconnected',
      selectedCount: 0,
      steps: [
        { key: 'connect', label: 'Connect Google Merchant Center', done: false },
      ],
    };
  }

  // GBP-side evidence: the tenant's linked location row + the 'gbp' token on
  // its owning oauth account — the same resolution resolveGbpToken uses.
  const gbpLocation = await prisma.gbp_locations_list.findFirst({
    where: { tenant_id: tenantId },
    select: { account_id: true },
  });
  const gbpToken = gbpLocation
    ? await findGoogleToken('gbp', { accountId: gbpLocation.account_id })
    : null;

  const gbpLinked = !!link.gbp_account_url && !!gbpToken;
  const enrolled = !!link.free_listings_enabled;
  const storeCode = link.store_code || undefined;
  const optedIn = !!link.swis_enabled;

  const selectedCount = optedIn
    ? await prisma.inventory_items.count({
        where: {
          tenant_id: tenantId,
          swis_listed: true,
          item_status: 'active',
          visibility: 'public',
          product_type: { in: ['physical', 'hybrid'] },
        },
      })
    : 0;

  const steps = [
    { key: 'connect', label: 'Connect Google Merchant Center', done: true },
    { key: 'link_gbp', label: 'Link Business Profile to Merchant Center', done: gbpLinked },
    { key: 'enroll', label: 'Enable free local listings in Merchant Center', done: enrolled },
    { key: 'store_code', label: 'Confirm store code', done: !!storeCode },
    { key: 'select', label: 'Select products for your Google profile', done: optedIn && selectedCount > 0 },
  ];

  let state: SwisReadinessState = 'ready';
  if (!gbpLinked) state = 'pending_gbp_link';
  else if (!enrolled) state = 'not_enrolled';
  else if (!storeCode) state = 'no_store_code';
  else if (!optedIn || selectedCount === 0) state = 'pending_selection';

  return { state, merchantId: link.merchant_id, storeCode, selectedCount, steps };
}
