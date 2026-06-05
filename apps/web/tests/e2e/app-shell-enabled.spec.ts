import { test, expect, request as pwRequest } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.TEST_EMAIL || "owner@demo.local";
const PASSWORD = process.env.TEST_PASSWORD || "password123";
const TENANT_ID = process.env.TEST_TENANT_ID || "demo-tenant";

// Login and prime flags/tokens before each test
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
    localStorage.setItem('ff_app_shell_nav', 'on');
    localStorage.setItem('ff_tenant_urls', 'on');
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }, [accessToken, refreshToken, TENANT_ID]);
});

// Header renders and Inventory link works while tokens persist
test('AppShell header renders and Inventory nav keeps tokens', async ({ page }) => {
  await page.goto(`${WEB_URL}/`);

  // Switcher should be visible when shell is enabled
  await expect(page.locator('#tenant-switcher')).toBeVisible();

  // Header Dashboard link should point to tenant-scoped dashboard
  const dashboardHref = await page.locator('header a', { hasText: 'Dashboard' }).first().getAttribute('href');
  expect(dashboardHref).toBe(`/t/${TENANT_ID}/dashboard`);

  // Click Inventory in header
  // With this (scoped to header)
  await page.locator('header').getByRole('link', { name: 'Inventory', exact: true }).first().click();

  await expect(page).toHaveURL(new RegExp(`/items$`));

  // Tokens should persist
  const access = await page.evaluate(() => localStorage.getItem('access_token'));
  const refresh = await page.evaluate(() => localStorage.getItem('refresh_token'));
  expect(access).toBeTruthy();
  expect(refresh).toBeTruthy();
});
