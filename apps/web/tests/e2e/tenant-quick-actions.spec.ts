import { test, expect, request as pwRequest } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.TEST_EMAIL || "owner@demo.local";
const PASSWORD = process.env.TEST_PASSWORD || "password123";
const TENANT_ID = process.env.TEST_TENANT_ID || "demo-tenant";

// Prime auth, tenant flags, and cookie
test.beforeEach(async ({ page }) => {
  const api = await pwRequest.newContext();
  const res = await api.post(`${API_URL}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const { accessToken, refreshToken } = await res.json();

  await page.addInitScript((args) => {
    const [token, refresh, tenantId] = args as [string, string, string];
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('tenantId', tenantId);
    localStorage.setItem('current_tenant_id', tenantId);
    localStorage.setItem('ff_tenant_urls', 'on');
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }, [accessToken, refreshToken, TENANT_ID]);

  await page.context().addCookies([{ name: 'access_token', value: accessToken, domain: 'localhost', path: '/', sameSite: 'Lax' }]);
});

// Assert quick actions and hero links use tenant URLs
test('Quick Actions and hero links point to tenant URLs when flags ON', async ({ page }) => {
  await page.goto(`${WEB_URL}/`);

  // Wait for page content to hydrate
  await expect(page.locator('text=Quick Actions')).toBeVisible();

  // Hero metric card link to Inventory
  await expect.poll(async () => {
    return await page.locator('a:has-text("Total Inventory")').first().getAttribute('href');
  }, { timeout: 2000 }).toBe(`/t/${TENANT_ID}/items`);

  // Quick Actions
  await expect.poll(async () => {
    return await page.locator('a:has-text("Manage Tenants")').first().getAttribute('href');
  }, { timeout: 2000 }).toBe(`/tenants`);

  await expect.poll(async () => {
    return await page.locator('a:has-text("Add New Product")').first().getAttribute('href');
  }, { timeout: 2000 }).toBe(`/t/${TENANT_ID}/items?create=true`);

  await expect.poll(async () => {
    return await page.locator('a:has-text("Connect to Google")').first().getAttribute('href');
  }, { timeout: 2000 }).toBe(`/t/${TENANT_ID}/settings/tenant`);
});
