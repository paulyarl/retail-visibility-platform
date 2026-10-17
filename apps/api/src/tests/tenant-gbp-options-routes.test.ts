/**
 * Tenant orchestrator reachability — GBP options settings
 *
 * Regression: `gbp-options-settings.ts` declares orchestrator-style routes
 * (`/:tenantId/gbp-options`) but was only registered at `/api`, so the
 * documented path `/api/tenants/:tenantId/gbp-options` — the one
 * `PlatformHomeSingletonService.getGbpOptionsSettings` calls — never matched
 * and fell through to the 404 handler. It must be mounted in the tenant
 * orchestrator alongside its sibling `*-options-settings` routers.
 *
 * Requests without an Auth0 session stop at `authenticateToken`, so a 401
 * proves the route matched while a 404 would mean it is still unreachable.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import tenantOrchestrator from '../routes/tenant.routes';
import { notFoundHandler } from '../middleware/errorHandler';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tenants', tenantOrchestrator);
  app.use(notFoundHandler);
  return app;
}

describe('tenant orchestrator — GBP options routes', () => {
  const app = buildApp();
  const tenantId = 'tid-test';

  it.each([
    ['get', `/api/tenants/${tenantId}/gbp-options`],
    ['get', `/api/tenants/${tenantId}/gbp-options/capability`],
    ['put', `/api/tenants/${tenantId}/gbp-options`],
  ])('%s %s reaches the route (401, not 404)', async (method, url) => {
    const res = await (request(app) as any)[method](url);
    expect(
      res.status,
      `expected the route to be mounted; got ${res.status} ${JSON.stringify(res.body)}`,
    ).toBe(401);
    expect(res.body.error).toBe('authentication_required');
  });

  it('still 404s for an unknown sub-path (guard is not vacuous)', async () => {
    const res = await request(app).get(`/api/tenants/${tenantId}/not-a-route`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
