/**
 * Auth Scope Isolation Verification Script (FR-7)
 *
 * Enforces two rules from docs/AUTH_SCOPE_ISOLATION_SPEC.md:
 *
 * Check A — URL/authLevel consistency in routeRegistry.ts:
 *   - authLevel: 'public' entries must NOT be at /api/tenants, /api/admin,
 *     or /api/organizations paths.
 *   - authLevel: 'tenant' or 'admin' entries must NOT be at /api/public paths.
 *
 * Check B — No router-level auth in orchestrator sub-routers:
 *   - Files mounted inside domain orchestrators (admin.routes.ts,
 *     tenant.routes.ts, directory.routes.ts) must NOT contain
 *     router.use(authenticateToken), router.use(requireAuth),
 *     router.use(requireAdmin), or router.use(requirePlatformAdmin).
 *   - Standalone routers mounted directly in routeRegistry.ts are exempt
 *     (they have no siblings to bleed into).
 *   - Mount-level auth (router.use('/path', authenticateToken, subRouter))
 *     is NOT a violation — only bare router.use(authMiddleware) is.
 *
 * Exit code 0 = pass, 1 = violations found.
 * Usage: npx tsx scripts/verify-auth-scope.ts
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'apps', 'api', 'src', 'routes', 'routeRegistry.ts');
const ROUTES_DIR = path.join(ROOT, 'apps', 'api', 'src', 'routes');

// ─── Orchestrator files ───────────────────────────────────────────────────
const ORCHESTRATORS = [
  path.join(ROUTES_DIR, 'admin.routes.ts'),
  path.join(ROUTES_DIR, 'tenant.routes.ts'),
  path.join(ROUTES_DIR, 'directory.routes.ts'),
];

// Auth middleware names that are forbidden as router-level (bare router.use(...))
const FORBIDDEN_AUTH_MIDDLEWARE = [
  'authenticateToken',
  'requireAuth',
  'requireAdmin',
  'requirePlatformAdmin',
];

interface RegistryEntry {
  path: string;
  authLevel: string;
}

// ─── Check A: Parse routeRegistry.ts ──────────────────────────────────────

function parseRouteRegistry(content: string): RegistryEntry[] {
  const entries: RegistryEntry[] = [];
  // Matches { path: '...' ... authLevel: '...' ... } entries.
  // Handles single, double, and backtick quoted strings.
  const objectRegex =
    /\{\s*path:\s*['"`]([^'"`]+)['"`][\s\S]*?authLevel:\s*['"`]([^'"`]+)['"`]/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(content)) !== null) {
    entries.push({ path: match[1], authLevel: match[2] });
  }
  return entries;
}

function checkUrlAuthLevelConsistency(entries: RegistryEntry[]): string[] {
  const errors: string[] = [];

  for (const entry of entries) {
    if (
      entry.authLevel === 'public' &&
      (entry.path.startsWith('/api/tenants') ||
        entry.path.startsWith('/api/admin') ||
        entry.path.startsWith('/api/organizations'))
    ) {
      errors.push(
        `authLevel 'public' is incompatible with private path ${entry.path}`
      );
    }

    if (
      (entry.authLevel === 'tenant' || entry.authLevel === 'admin') &&
      entry.path.startsWith('/api/public')
    ) {
      errors.push(
        `authLevel '${entry.authLevel}' is incompatible with public path ${entry.path}`
      );
    }
  }

  return errors;
}

// ─── Check B: No router-level auth in orchestrator sub-routers ─────────────

/**
 * Parse an orchestrator file to extract the relative import paths of all
 * sub-routers it mounts. Returns absolute file paths.
 */
function getOrchestratorSubRouters(orchestratorPath: string): string[] {
  const content = fs.readFileSync(orchestratorPath, 'utf-8');
  const subRouters: string[] = [];

  // Match import statements: import foo from './path';
  // Only relative imports (./ or ../) are sub-routers.
  const importRegex = /import\s+\w+\s+from\s+['"](\.[^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const resolved = path.resolve(path.dirname(orchestratorPath), importPath);
    // Try .ts extension
    const tsFile = resolved.endsWith('.ts') ? resolved : resolved + '.ts';
    if (fs.existsSync(tsFile)) {
      subRouters.push(tsFile);
    }
  }

  return subRouters;
}

/**
 * Check a single file for forbidden router-level auth middleware.
 * Only flags bare router.use(authMiddleware) — NOT mount-level
 * router.use('/path', authMiddleware, subRouter).
 */
function checkFileForRouterLevelAuth(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(ROOT, filePath);
  const violations: string[] = [];

  // Match router.use( followed directly by an auth middleware name
  // (not a path string). This catches:
  //   router.use(authenticateToken)
  //   router.use(authenticateToken, requireAdmin)
  //   router.use(requireAuth)
  //   router.use(requireAdmin)
  //   router.use(requirePlatformAdmin)
  // But NOT:
  //   router.use('/path', authenticateToken, subRouter)
  for (const mw of FORBIDDEN_AUTH_MIDDLEWARE) {
    const pattern = new RegExp(`router\\.use\\(${mw}\\b`);
    if (pattern.test(content)) {
      violations.push(
        `Router-level auth middleware in ${relativePath}: router.use(${mw})`
      );
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  const violations: string[] = [];

  // ── Check A: URL / authLevel consistency ────────────────────────────────
  const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  const entries = parseRouteRegistry(registryContent);

  if (entries.length === 0) {
    violations.push(`Could not parse any entries from ${REGISTRY_PATH}`);
  } else {
    violations.push(...checkUrlAuthLevelConsistency(entries));
  }

  // ── Check B: No router-level auth in orchestrator sub-routers ───────────
  const checkedFiles = new Set<string>();

  for (const orchestratorPath of ORCHESTRATORS) {
    if (!fs.existsSync(orchestratorPath)) continue;

    const subRouters = getOrchestratorSubRouters(orchestratorPath);
    for (const subRouterPath of subRouters) {
      if (checkedFiles.has(subRouterPath)) continue;
      checkedFiles.add(subRouterPath);
      violations.push(...checkFileForRouterLevelAuth(subRouterPath));
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────
  if (violations.length > 0) {
    console.error('Auth scope verification failed:');
    for (const violation of violations) {
      console.error(`  ❌ ${violation}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Auth scope verification passed (${entries.length} route entries checked, ` +
    `${checkedFiles.size} orchestrator sub-routers scanned).`
  );
}

main();
