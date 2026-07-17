/**
 * OpenAPI Specification Generator
 *
 * Extends the route map to produce an OpenAPI 3.0.3 JSON spec.
 * Reads the generated route-map.json and converts each route into
 * an OpenAPI path item with method, parameters, and metadata.
 *
 * Output: apps/api/openapi.json
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 5.2.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../logger';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RouteMethod {
  method: string;
  path: string;
  fullPath: string;
  middleware: string[];
}

interface RouteMapEntry {
  mountPath: string;
  domain: string;
  authLevel: string;
  comment?: string;
  preMiddleware?: boolean;
  isCatchAll?: boolean;
  routes: RouteMethod[];
}

interface RouteMap {
  generatedAt: string;
  totalMounts: number;
  totalRoutes: number;
  mounts: RouteMapEntry[];
}

interface OpenAPIPath {
  [path: string]: {
    [method: string]: {
      tags: string[];
      summary: string;
      description?: string;
      security?: Array<{ [name: string]: string[] }>;
      parameters?: Array<{
        name: string;
        in: string;
        required: boolean;
        schema: { type: string };
        description?: string;
      }>;
      responses: {
        '200': { description: string };
        '400': { description: string };
        '401': { description: string };
        '403': { description: string };
        '404': { description: string };
        '500': { description: string };
      };
    };
  };
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: OpenAPIPath;
  components: {
    securitySchemes: {
      bearerAuth: { type: string; scheme: string; bearerFormat: string };
    };
  };
  security: Array<{ bearerAuth: string[] }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function expressPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

function extractPathParams(path: string): Array<{ name: string; in: string; required: boolean; schema: { type: string } }> {
  const params: Array<{ name: string; in: string; required: boolean; schema: { type: string } }> = [];
  const matches = path.matchAll(/:(\w+)/g);
  for (const match of matches) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }
  return params;
}

function getTag(entry: RouteMapEntry): string {
  return entry.domain;
}

function getSummary(route: RouteMethod): string {
  return `${route.method} ${route.fullPath}`;
}

function getSecurity(authLevel: string): Array<{ [name: string]: string[] }> | undefined {
  if (authLevel === 'public' || authLevel === 'webhook') {
    return [];
  }
  return [{ bearerAuth: [] }];
}

// ─── Tag descriptions ───────────────────────────────────────────────────────

const TAG_DESCRIPTIONS: Record<string, string> = {
  'pre-middleware': 'Routes mounted before global middleware (webhooks, client errors)',
  infrastructure: 'Health checks, cache monitoring, and platform infrastructure',
  public: 'Public API endpoints (no authentication required)',
  tenant: 'Tenant CRUD, profile, status, and coordinates',
  items: 'Items, products, categories, and photos',
  directory: 'Directory listings, categories, store-types, and featured stores',
  storefront: 'Storefront routes using materialized views',
  checkout: 'Checkout, payments, orders, and shopping carts',
  admin: 'Admin routes (users, tools, sentry, errors, catalog, etc.)',
  integration: 'OAuth, POS, GBP, GMC, Meta, TikTok integrations',
  security: 'Auth, MFA, GDPR, CCPA, sessions, and security alerts',
  organization: 'Organizations, capabilities, and users',
  customer: 'Customer auth, addresses, notifications, and payment methods',
  singleton: 'UniversalSingleton system routes',
  settings: 'Fulfillment, commerce, tax, product options, etc.',
  social: 'Social proof, social pixels, and bot routes',
  compliance: 'GDPR, CCPA, and account deletion',
  misc: 'Debug, clone, queue, badges, store reviews, etc.',
};

// ─── Main ───────────────────────────────────────────────────────────────────

function generateOpenAPI(routeMap: RouteMap): OpenAPISpec {
  const paths: OpenAPIPath = {};
  const tagSet = new Set<string>();

  for (const entry of routeMap.mounts) {
    const tag = getTag(entry);
    tagSet.add(tag);

    for (const route of entry.routes) {
      const openApiPath = expressPathToOpenAPI(route.fullPath);
      const method = route.method.toLowerCase();

      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      if (paths[openApiPath][method]) {
        continue;
      }

      const parameters = extractPathParams(route.fullPath);

      paths[openApiPath][method] = {
        tags: [tag],
        summary: getSummary(route),
        description: entry.comment,
        security: getSecurity(entry.authLevel),
        ...(parameters.length > 0 ? { parameters } : {}),
        responses: {
          '200': { description: 'Successful response' },
          '400': { description: 'Bad request — validation error' },
          '401': { description: 'Unauthorized — authentication required' },
          '403': { description: 'Forbidden — insufficient permissions' },
          '404': { description: 'Not found' },
          '500': { description: 'Internal server error' },
        },
      };
    }
  }

  const tags = Array.from(tagSet).map((name) => ({
    name,
    description: TAG_DESCRIPTIONS[name] || name,
  }));

  return {
    openapi: '3.0.3',
    info: {
      title: 'VisibleShelf Retail Visibility Platform API',
      version: '1.0.0',
      description:
        'API for the VisibleShelf retail visibility platform. All authenticated routes require a Bearer JWT token.',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Local development' },
      { url: 'https://api.visibleshelf.store', description: 'Production' },
    ],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

// ─── Entry Point ────────────────────────────────────────────────────────────

const routeMapPath = join(__dirname, '..', 'generated', 'route-map.json');
const outputPath = join(__dirname, '..', '..', 'openapi.json');

if (!existsSync(routeMapPath)) {
  logger.error('❌ route-map.json not found. Run generate-route-map.ts first.', undefined);
  process.exit(1);
}

try {
  const routeMap: RouteMap = JSON.parse(readFileSync(routeMapPath, 'utf-8'));
  const spec = generateOpenAPI(routeMap);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  console.log(`✅ OpenAPI spec generated: ${outputPath}`);
  console.log(`   ${Object.keys(spec.paths).length} paths, ${spec.tags.length} tags`);
} catch (error) {
  logger.error('❌ Failed to generate OpenAPI spec:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  process.exit(1);
}
