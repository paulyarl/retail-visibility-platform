/**
 * CustomDomainService — tenant-owned custom domains (level-3 storefront
 * presentation). Sprint plan Phase 1.3 + 2.3 lifecycle.
 *
 * Flow: addDomain → pending_verification → checkDomain (tenant click or
 * sweeper) → verified (Vercel `verified && !misconfigured`) → active (our own
 * HTTPS probe — the cert state is probe-derived only, H4).
 *
 * Gates (composed per D10/D12):
 *   - flag `custom_domains` (platform flag + tenant override, effectiveFlags)
 *     = deployed-to-you
 *   - capability `storefront_opt_custom_domain` (MV feature keys, flexible
 *     composed inline to mirror the resolver's `flexible ||` — F-H1 corrected)
 *     = entitled-to-you
 *   addDomain requires BOTH; the resolve path is never gated.
 *
 * One row per LOGICAL domain (D9): `domain` stores the root with `www.`
 * stripped. Apex-declared inputs attach apex + `www` project domains and
 * record the full set in `attached_hosts` — the detach source of truth.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { BaseService } from './BaseService';
import { generateCustomDomainId } from '../lib/id-generator';
import {
  attachedHostsFor,
  isNonDnsHost,
  isPlatformDomain,
  isValidDomainFormat,
  normalizeDomainInput,
  normalizeHostForResolve,
  type CustomDomainFailureCode,
} from '../lib/custom-domain';
import { vercelDomainsService, VercelUnconfiguredError } from './VercelDomainsService';
import { getEffectiveTenant } from '../utils/effectiveFlags';

const CUSTOM_DOMAIN_FEATURE = 'storefront_opt_custom_domain';
const STOREFRONT_FLEXIBLE = 'storefront_opt_flexible';
const PLATFORM_FLAG = 'custom_domains';
const MAX_LIVE_DOMAINS_PER_TENANT = 1;
const HTTPS_PROBE_TIMEOUT_MS = 5000;

export interface CustomDomainRecord {
  id: string;
  tenantId: string;
  domain: string;
  status: string;
  attachedHosts: string[];
  verificationToken: string | null;
  verificationCheckedAt: string | null;
  verificationError: string | null;
  certificateStatus: string | null;
  certificateError: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddDomainResult =
  | { ok: true; domain: CustomDomainRecord; attachedHosts: string[] }
  | { ok: false; code: CustomDomainFailureCode | 'vercel_error' | 'unconfigured'; message?: string };

export type CheckDomainResult =
  | { ok: true; domain: CustomDomainRecord; transitionedTo?: string }
  | { ok: false; code: CustomDomainFailureCode | 'vercel_error' | 'unconfigured'; message?: string };

function toRecord(row: any): CustomDomainRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    domain: row.domain,
    status: row.status,
    attachedHosts: row.attached_hosts ?? [],
    verificationToken: row.verification_token ?? null,
    verificationCheckedAt: row.verification_checked_at?.toISOString?.() ?? null,
    verificationError: row.verification_error ?? null,
    certificateStatus: row.certificate_status ?? null,
    certificateError: row.certificate_error ?? null,
    isPrimary: row.is_primary ?? false,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export class CustomDomainService extends BaseService {
  /**
   * Capability check (D12): resolved `storefront_opt_custom_domain` via the
   * effective-capability MV — tier grant, purchase, or admin override all
   * feed it. `storefront_opt_flexible` composed inline (the resolver's
   * `flexible ||` equivalent — flexible holders inherit without a grant).
   */
  private async isEntitled(tenantId: string): Promise<boolean> {
    // The MV is refreshed by pg_cron (~10 min cadence). Union a live read of
    // its grant sources — same status/expiry semantics — so a just-granted
    // BSaaS purchase or admin override entitles immediately instead of
    // failing the write gate until the next refresh cycle.
    const [mvRows, liveRows] = await Promise.all([
      prisma.$queryRaw<Array<{ feature_key: string }>>`
        SELECT feature_key
        FROM mv_tenant_effective_capabilities
        WHERE tenant_id = ${tenantId}
          AND feature_key IN (${CUSTOM_DOMAIN_FEATURE}, ${STOREFRONT_FLEXIBLE})
      `,
      prisma.$queryRaw<Array<{ feature_key: string }>>`
        SELECT feature_key FROM tenant_feature_purchases
        WHERE tenant_id = ${tenantId}
          AND feature_key IN (${CUSTOM_DOMAIN_FEATURE}, ${STOREFRONT_FLEXIBLE})
          AND status IN ('active', 'past_due', 'trial')
          AND (expires_at IS NULL OR expires_at > NOW())
        UNION
        SELECT feature AS feature_key FROM tenant_feature_overrides_list
        WHERE tenant_id = ${tenantId}
          AND feature IN (${CUSTOM_DOMAIN_FEATURE}, ${STOREFRONT_FLEXIBLE})
          AND granted = true
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
    ]);
    return mvRows.length > 0 || liveRows.length > 0;
  }

  /** Flag check (D10): platform flag + tenant override via effectiveFlags. */
  private async isFlagOn(tenantId: string): Promise<boolean> {
    const flag = await getEffectiveTenant(PLATFORM_FLAG, tenantId);
    return flag.tenantEffectiveOn;
  }

  /**
   * Admin/support visibility (5.2): the composed entitlement + rollout state
   * for a tenant — what the gate evaluated, without mutating anything.
   */
  async entitlementFor(tenantId: string): Promise<{ entitled: boolean; flagOn: boolean }> {
    const [entitled, flagOn] = await Promise.all([this.isEntitled(tenantId), this.isFlagOn(tenantId)]);
    return { entitled, flagOn };
  }

  async addDomain(
    tenantId: string,
    rawDomain: string,
    opts: { apexDeclared?: boolean } = {},
  ): Promise<AddDomainResult> {
    // Flag + capability compose (D10/D12)
    if (!(await this.isFlagOn(tenantId))) {
      return { ok: false, code: 'not_entitled', message: 'Custom domains are not enabled for your account yet.' };
    }
    if (!(await this.isEntitled(tenantId))) {
      return { ok: false, code: 'not_entitled', message: 'Custom domains are not included in your plan.' };
    }

    const domain = normalizeDomainInput(rawDomain);
    if (isNonDnsHost(domain)) return { ok: false, code: 'non_dns_host' };
    if (!isValidDomainFormat(domain)) return { ok: false, code: 'invalid_domain' };
    if (isPlatformDomain(domain)) return { ok: false, code: 'platform_domain' };

    const taken = await prisma.custom_domains.findFirst({
      where: { domain },
      select: { tenant_id: true },
    });
    if (taken && taken.tenant_id !== tenantId) {
      return { ok: false, code: 'domain_taken' };
    }

    const liveCount = await prisma.custom_domains.count({
      where: { tenant_id: tenantId, status: { not: 'disabled' } },
    });
    if (liveCount >= MAX_LIVE_DOMAINS_PER_TENANT) {
      return { ok: false, code: 'domain_limit', message: 'Your plan allows one custom domain.' };
    }

    // F-B1: apex-ness is declared by the caller/UI flow; when unknown, attach
    // both (a stray www project-domain is harmless — an unattached one 404s at
    // the edge before our proxy can 301 it).
    const hosts = attachedHostsFor(domain, opts.apexDeclared ?? true);

    const id = generateCustomDomainId(tenantId);
    let row;
    try {
      row = await prisma.custom_domains.create({
        data: {
          id,
          tenant_id: tenantId,
          domain,
          status: 'pending_verification',
          attached_hosts: hosts,
          is_primary: true,
        },
      });
    } catch (error: any) {
      // Partial unique index race — a concurrent add already claimed the slot.
      if (error?.code === 'P2002') {
        return { ok: false, code: 'domain_limit', message: 'Your plan allows one custom domain.' };
      }
      throw error;
    }

    // Attach the project domains. Failure keeps the row pending with the
    // error recorded — "Check status" / the sweeper can retry the attach.
    try {
      for (const host of hosts) {
        const add = await vercelDomainsService.addProjectDomain(host);
        if (!add.ok) {
          await prisma.custom_domains.update({
            where: { id: row.id },
            data: { verification_error: `attach ${host}: ${add.message}` },
          });
          return { ok: false, code: 'vercel_error', message: `Could not attach ${host}: ${add.message}` };
        }
      }
    } catch (error) {
      if (error instanceof VercelUnconfiguredError) {
        return { ok: false, code: 'unconfigured', message: 'Custom domains are temporarily unavailable.' };
      }
      throw error;
    }

    logger.info(`[CustomDomain] Added domain ${domain} for tenant ${tenantId}`, undefined, {
      tenantId, domain, attachedHosts: hosts,
    });
    return { ok: true, domain: toRecord(row), attachedHosts: hosts };
  }

  async listForTenant(tenantId: string): Promise<CustomDomainRecord[]> {
    const rows = await prisma.custom_domains.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toRecord);
  }

  async getDomain(tenantId: string, domainId: string): Promise<CustomDomainRecord | null> {
    const row = await prisma.custom_domains.findFirst({
      where: { id: domainId, tenant_id: tenantId },
    });
    return row ? toRecord(row) : null;
  }

  /**
   * "Check status" / sweeper path (2.3):
   *   verify → getProjectDomain + getDomainConfig → verified && !misconfigured
   *   → status 'verified' → our HTTPS probe of the canonical host → 'active'.
   * Errors are recorded without state regression.
   */
  async checkDomain(tenantId: string, domainId: string): Promise<CheckDomainResult> {
    const row = await prisma.custom_domains.findFirst({
      where: { id: domainId, tenant_id: tenantId },
    });
    if (!row) return { ok: false, code: 'not_found' };
    if (row.status === 'active' || row.status === 'disabled') {
      return { ok: true, domain: toRecord(row) };
    }

    let verify;
    try {
      verify = await vercelDomainsService.verifyProjectDomain(row.domain);
    } catch (error) {
      if (error instanceof VercelUnconfiguredError) {
        return { ok: false, code: 'unconfigured', message: 'Custom domains are temporarily unavailable.' };
      }
      throw error;
    }
    if (!verify.ok) {
      await prisma.custom_domains.update({
        where: { id: row.id },
        data: {
          status: 'error',
          verification_error: `verify: ${verify.message}`,
          verification_checked_at: new Date(),
        },
      });
      return { ok: false, code: 'vercel_error', message: verify.message };
    }

    const config = await vercelDomainsService.getDomainConfig(row.domain);
    const vercelReady =
      verify.data.verified === true && config.ok && config.data.misconfigured === false;

    if (!vercelReady) {
      const txt = verify.data.verification?.[0];
      await prisma.custom_domains.update({
        where: { id: row.id },
        data: {
          verification_token: txt?.value ?? row.verification_token,
          verification_checked_at: new Date(),
        },
      });
      const refreshed = await prisma.custom_domains.findUnique({ where: { id: row.id } });
      return { ok: true, domain: toRecord(refreshed) };
    }

    // verified && !misconfigured → 'verified'; TLS confirmed by OUR probe (H4)
    const https = await this.probeHttps(row.domain);
    const nextStatus = https.ok ? 'active' : 'verified';
    const updated = await prisma.custom_domains.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        verification_checked_at: new Date(),
        verification_error: null,
        certificate_status: https.ok ? 'issued' : 'pending',
        certificate_error: https.ok ? null : https.message,
      },
    });

    logger.info(`[CustomDomain] ${row.domain} → ${nextStatus} (tenant ${tenantId})`, undefined, {
      tenantId, domain: row.domain, status: nextStatus,
    });
    return { ok: true, domain: toRecord(updated), transitionedTo: nextStatus };
  }

  /**
   * Detach all recorded Vercel hosts (attached_hosts is the source of truth),
   * then delete the row. A Vercel-side failure is logged but does not block
   * removal — an orphan project-domain is recoverable; a stuck row is not.
   */
  async removeDomain(tenantId: string, domainId: string): Promise<{ ok: true } | { ok: false; code: 'not_found' }> {
    const row = await prisma.custom_domains.findFirst({
      where: { id: domainId, tenant_id: tenantId },
    });
    if (!row) return { ok: false, code: 'not_found' };

    const hosts: string[] = row.attached_hosts?.length ? row.attached_hosts : [row.domain];
    for (const host of hosts) {
      try {
        const removed = await vercelDomainsService.removeProjectDomain(host);
        if (!removed.ok && removed.status !== 404) {
          logger.warn('[CustomDomain] Vercel detach failed (continuing)', undefined, {
            tenantId, domain: row.domain, host, status: removed.status, message: removed.message,
          });
        }
      } catch (error) {
        if (!(error instanceof VercelUnconfiguredError)) throw error;
        logger.warn('[CustomDomain] Vercel unconfigured during detach — proceeding', undefined, {
          tenantId, domain: row.domain, host,
        });
      }
    }

    await prisma.custom_domains.delete({ where: { id: row.id } });
    logger.info(`[CustomDomain] Removed domain ${row.domain} for tenant ${tenantId}`, undefined, {
      tenantId, domain: row.domain,
    });
    return { ok: true };
  }

  /**
   * Tier-downgrade path (1.6/H2): losing `storefront_opt_custom_domain`
   * entitlement detaches the Vercel hosts and marks the rows 'disabled' —
   * the domain stops resolving but the record survives for audit/re-enable.
   * Called from TrialManagementService.downgradeToExpired.
   */
  async suspendAllForTenant(tenantId: string): Promise<number> {
    const rows = await prisma.custom_domains.findMany({
      where: { tenant_id: tenantId, status: { not: 'disabled' } },
    });
    for (const row of rows) {
      const hosts: string[] = row.attached_hosts?.length ? row.attached_hosts : [row.domain];
      for (const host of hosts) {
        try {
          await vercelDomainsService.removeProjectDomain(host);
        } catch (error) {
          logger.warn('[CustomDomain] detach on downgrade failed', undefined, {
            tenantId, domain: row.domain, host,
            error: { name: (error as any)?.name, message: (error as any)?.message },
          });
        }
      }
      await prisma.custom_domains.update({
        where: { id: row.id },
        data: { status: 'disabled', certificate_status: null },
      });
    }
    if (rows.length) {
      logger.info(`[CustomDomain] Suspended ${rows.length} domain(s) on tier downgrade`, undefined, {
        tenantId, domains: rows.map((r) => r.domain),
      });
    }
    return rows.length;
  }

  /** Tenant-delete path (1.6): detach every domain's hosts, rows cascade. */
  async detachAllForTenant(tenantId: string): Promise<void> {
    const rows = await prisma.custom_domains.findMany({ where: { tenant_id: tenantId } });
    for (const row of rows) {
      const hosts: string[] = row.attached_hosts?.length ? row.attached_hosts : [row.domain];
      for (const host of hosts) {
        try {
          await vercelDomainsService.removeProjectDomain(host);
        } catch (error) {
          logger.warn('[CustomDomain] detach on tenant-delete failed', undefined, {
            tenantId, domain: row.domain, host,
            error: { name: (error as any)?.name, message: (error as any)?.message },
          });
        }
      }
    }
  }

  /**
   * Resolve a request host → tenant. Strips `www.`; only `active` rows serve.
   * Called by the resolve-custom-domain endpoint (public, rate-limited) and
   * the B4 sweeper.
   */
  async resolveHostToTenant(host: string): Promise<{ tenantId: string; domain: string } | null> {
    const normalized = normalizeHostForResolve(host);
    if (!normalized || isPlatformDomain(normalized) || isNonDnsHost(normalized)) {
      return null;
    }
    const row = await prisma.custom_domains.findFirst({
      where: { domain: normalized, status: 'active' },
      select: { tenant_id: true, domain: true },
    });
    return row ? { tenantId: row.tenant_id, domain: row.domain } : null;
  }

  /** Rows the B4 sweeper re-checks: not active, not disabled, not brand-new. */
  async listSweepable(limit = 50): Promise<Array<{ id: string; tenant_id: string; domain: string }>> {
    return prisma.custom_domains.findMany({
      where: { status: { in: ['pending_verification', 'verified', 'error'] } },
      orderBy: { verification_checked_at: 'asc' },
      take: limit,
      select: { id: true, tenant_id: true, domain: true },
    });
  }

  /**
   * Our own TLS check (H4) — Vercel exposes no cert field, so "certificate
   * ready" means the canonical host answers 2xx/3xx over HTTPS. Canonical
   * host only — never the www companion (it 301s to apex anyway).
   */
  private async probeHttps(host: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTPS_PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`https://${host}/`, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (response.status >= 200 && response.status < 400) {
        return { ok: true };
      }
      return { ok: false, message: `HTTPS ${response.status}` };
    } catch (error: any) {
      return { ok: false, message: error?.name === 'AbortError' ? 'probe timeout' : (error?.message || 'probe failed') };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const customDomainService = new CustomDomainService();
export default customDomainService;
