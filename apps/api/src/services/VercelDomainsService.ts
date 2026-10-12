/**
 * VercelDomainsService — thin client over the Vercel REST API for
 * tenant-owned custom domains (sprint plan Phase 2).
 *
 * Endpoint versions are pinned per H9:
 *   add    POST   /v10/projects/{idOrName}/domains
 *   get    GET    /v9/projects/{idOrName}/domains/{domain}
 *   verify POST   /v9/projects/{idOrName}/domains/{domain}/verify
 *   remove DELETE /v9/projects/{idOrName}/domains/{domain}
 *   config GET    /v6/domains/{domain}/config
 *
 * Verified against the REST reference (H4/H9/H10/M14):
 *   - The project-domain object carries `verified` + `verification` (TXT
 *     challenges) — NO certificate field. Cert state is probe-derived (H4).
 *   - A duplicate add returns 400 (not 409) — treated as "already attached".
 *   - `misconfigured` may arrive as the string "false" — coerce before use.
 *   - `verification`/`recommendedCNAME`/`recommendedIPv4` can be empty
 *     (esp. apex) — callers fall back to known constants.
 *
 * Configuration failures throw a typed `vercel_unconfigured` error so routes
 * can 503 cleanly — a missing token must never crash unrelated settings reads.
 */

import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const VERCEL_API_BASE = 'https://api.vercel.com';

export class VercelUnconfiguredError extends Error {
  readonly code = 'vercel_unconfigured' as const;
  constructor() {
    super('Vercel Domains API is not configured (VERCEL_API_TOKEN / VERCEL_PROJECT_ID)');
    this.name = 'VercelUnconfiguredError';
  }
}

export interface VercelProjectDomain {
  name: string;
  verified: boolean;
  verification?: Array<{ type: string; domain: string; value: string; reason?: string }>;
  [key: string]: unknown;
}

export interface VercelDomainConfig {
  misconfigured: boolean;
  configuredBy?: string | null;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  acceptedChallenges?: string[];
  [key: string]: unknown;
}

export type AddProjectDomainResult =
  | { ok: true; domain: VercelProjectDomain; alreadyAttached: boolean }
  | { ok: false; status: number; message: string };

export type VercelCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export class VercelDomainsService {
  private get config(): { token: string; projectId: string; teamId?: string } {
    const token = unifiedConfig.vercelApiToken;
    const projectId = unifiedConfig.vercelProjectId;
    if (!token || !projectId) {
      throw new VercelUnconfiguredError();
    }
    return { token, projectId, teamId: unifiedConfig.vercelTeamId };
  }

  private teamQuery(): string {
    const { teamId } = this.config;
    return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<VercelCallResult<T>> {
    const { token } = this.config;
    const url = `${VERCEL_API_BASE}${path}${this.teamQuery()}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.warn('[VercelDomainsService] API error', undefined, {
          method, path, status: response.status, body: text.slice(0, 300),
        });
        return { ok: false, status: response.status, message: text.slice(0, 300) || `HTTP ${response.status}` };
      }

      // DELETE and some endpoints return 200/204 with empty bodies
      const text = await response.text();
      const data = (text ? JSON.parse(text) : {}) as T;
      return { ok: true, data };
    } catch (error: any) {
      logger.error('[VercelDomainsService] request failed', undefined, {
        error: { name: error?.name || 'Error', message: error?.message || String(error) },
        method, path,
      });
      return { ok: false, status: 0, message: error?.message || 'network_error' };
    }
  }

  /** Attach a project domain. Duplicate attach (400) = already attached (H9). */
  async addProjectDomain(domain: string): Promise<AddProjectDomainResult> {
    const { projectId } = this.config;
    const result = await this.call<VercelProjectDomain>(
      'POST',
      `/v10/projects/${projectId}/domains`,
      { name: domain },
    );
    if (result.ok) {
      return { ok: true, domain: result.data, alreadyAttached: false };
    }
    // H9: Vercel returns 400 (not 409) when the domain is already on the project.
    if (result.status === 400 && /already|exist|in use|conflict/i.test(result.message)) {
      const existing = await this.getProjectDomain(domain);
      if (existing.ok) {
        return { ok: true, domain: existing.data, alreadyAttached: true };
      }
    }
    return { ok: false, status: result.status, message: result.message };
  }

  /** Project-domain object: `verified` bool + `verification` TXT list. No cert field. */
  async getProjectDomain(domain: string): Promise<VercelCallResult<VercelProjectDomain>> {
    const { projectId } = this.config;
    return this.call<VercelProjectDomain>(
      'GET',
      `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
    );
  }

  /** Trigger the ownership verification check (the "Check status" path, H4). */
  async verifyProjectDomain(domain: string): Promise<VercelCallResult<VercelProjectDomain>> {
    const { projectId } = this.config;
    return this.call<VercelProjectDomain>(
      'POST',
      `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify`,
    );
  }

  /** Detach a project domain. A missing domain (404) is treated as detached. */
  async removeProjectDomain(domain: string): Promise<VercelCallResult<Record<string, never>>> {
    const { projectId } = this.config;
    return this.call<Record<string, never>>(
      'DELETE',
      `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
    );
  }

  /**
   * Live DNS posture: `misconfigured` (coerced — may arrive as the string
   * "false", M14), `recommendedCNAME`/`recommendedIPv4` (may be empty, H10),
   * `acceptedChallenges` (issuance capability, NOT issued status).
   */
  async getDomainConfig(domain: string): Promise<VercelCallResult<VercelDomainConfig>> {
    const result = await this.call<VercelDomainConfig>(
      'GET',
      `/v6/domains/${encodeURIComponent(domain)}/config`,
    );
    if (result.ok) {
      result.data.misconfigured = result.data.misconfigured === true
        || String(result.data.misconfigured) === 'true';
    }
    return result;
  }
}

export const vercelDomainsService = new VercelDomainsService();
export default vercelDomainsService;
