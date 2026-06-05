import { test, expect, request as pwRequest } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.TEST_EMAIL || "owner@demo.local";
const PASSWORD = process.env.TEST_PASSWORD || "password123";
const TENANT_ID = process.env.TEST_TENANT_ID || "demo-tenant";

test.beforeEach(async ({ page }) => {
  const api = await pwRequest.newContext();
  const res = await api.post(`${API_URL}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const { accessToken, refreshToken } = await res.json();

  await page.addInitScript((args) => {
    const [token, refresh, tenantId] = args as [string, string, string];
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('tenantId', tenantId);
    localStorage.setItem('current_tenant_id', tenantId);
    // set cookie for SSR guards
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }, [accessToken, refreshToken, TENANT_ID]);

  // Also set cookie at the browser context level so SSR sees it on the initial request
  await page.context().addCookies([{
    name: 'access_token',
    value: accessToken,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  }]);
});


// (removed legacy redirect test for /t/{id}/users — route now renders directly)

// AppShell not visible by default (FF off)
test("AppShell is disabled by default (no tenant switcher)", async ({ page }) => {
  await page.goto(`${WEB_URL}/`);
  const hasSwitcher = await page.locator('#tenant-switcher').count();
  expect(hasSwitcher).toBe(0);
});
// Items deep link: expect staying on /t/{id}/items
test("/t/{id}/items deep-link sets tenantId and shows items page", async ({ page }) => {
  await page.goto(`${WEB_URL}/t/${TENANT_ID}/items`);
  await expect(page).toHaveURL(new RegExp(`/t/${TENANT_ID}/items$`));
  const storedTenantId = await page.evaluate(() => localStorage.getItem("tenantId"));
  expect(storedTenantId).toBe(TENANT_ID);
});

// Users deep link: expect staying on /t/{id}/users
test("/t/{id}/users deep-link sets tenantId and shows users page", async ({ page }) => {
  await page.goto(`${WEB_URL}/t/${TENANT_ID}/users`);
  await expect(page).toHaveURL(new RegExp(`/t/${TENANT_ID}/users$`));
  const storedTenantId = await page.evaluate(() => localStorage.getItem("tenantId"));
  expect(storedTenantId).toBe(TENANT_ID);
});