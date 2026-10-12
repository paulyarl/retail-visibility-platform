/**
 * Tenant-owned custom domain helpers — single place the domain rules live.
 *
 * Model (sprint plan D9/T-B1/F-B1):
 *   - One row per LOGICAL domain in `custom_domains`. `domain` stores the root:
 *     a leading `www.` is stripped on write and `www.` is never a row.
 *   - Apex-vs-subdomain is DECLARED by the caller (the add flow branches
 *     apex vs subdomain instructions), never parsed from the hostname — the
 *     repo has no public-suffix machinery and label-counting misclassifies
 *     multi-part suffixes (mybrand.co.uk). When the caller can't declare,
 *     attach both hosts (fail toward coverage).
 *   - Platform-owned roots are refused at the service layer, not a DB CHECK —
 *     the list is code-owned (D8).
 *   - Resolution strips a leading `www.` before lookup so `www.<root>` lands
 *     on the apex row.
 */

/** Platform roots a tenant must never claim as a "custom" domain (D8). */
const PLATFORM_DOMAIN_SUFFIXES: readonly string[] = [
  'visibleshelf.com',
  'visibleshelf.store',
];

const DOMAIN_REGEX =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const IPV4_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalize a domain input to its logical root:
 * lowercase, no scheme/port/path/trailing dot, leading `www.` stripped.
 */
export function normalizeDomainInput(input: string | null | undefined): string {
  let value = (input ?? '').trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split('/')[0];
  value = value.split(':')[0];
  value = value.replace(/\.+$/, '');
  if (value.startsWith('www.')) value = value.slice(4);
  return value;
}

/** Normalize a request Host header the same way (www-stripped root). */
export function normalizeHostForResolve(host: string | null | undefined): string {
  return normalizeDomainInput(host);
}

export function isValidDomainFormat(domain: string): boolean {
  return DOMAIN_REGEX.test(domain);
}

/** True when the input is an IP literal or localhost — not a tenant domain. */
export function isNonDnsHost(domain: string): boolean {
  return domain === 'localhost' || IPV4_REGEX.test(domain) || domain.includes(':');
}

/** True when the domain is (or sits under) a platform-owned root (D8). */
export function isPlatformDomain(domain: string): boolean {
  return PLATFORM_DOMAIN_SUFFIXES.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );
}

/**
 * Vercel project-domain hostnames to attach for a stored root.
 * Apex-declared inputs attach BOTH apex + www (one logical domain, D9);
 * subdomain inputs attach only themselves. When `apexDeclared` is unknown,
 * callers should pass true — attaching www for a subdomain host is harmless
 * (it simply won't resolve via DNS) while the inverse silently 404s at the edge.
 */
export function attachedHostsFor(rootDomain: string, apexDeclared: boolean): string[] {
  return apexDeclared ? [rootDomain, `www.${rootDomain}`] : [rootDomain];
}

export type CustomDomainFailureCode =
  | 'invalid_domain'
  | 'platform_domain'
  | 'non_dns_host'
  | 'domain_taken'
  | 'domain_limit'
  | 'not_entitled'
  | 'not_found';
