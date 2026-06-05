import { test, expect, request as pwRequest } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.TEST_EMAIL || "owner@demo.local";
const PASSWORD = process.env.TEST_PASSWORD || "password123";
const TENANT_ID = process.env.TEST_TENANT_ID || "demo-tenant";

// Prime auth and SSR cookie
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
    document.cookie = `access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }, [accessToken, refreshToken, TENANT_ID]);

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

// Ensure /t/{id}/dashboard renders and tenantId is set
test("/t/{id}/dashboard loads and sets tenantId", async ({ page }) => {
  await page.goto(`${WEB_URL}/t/${TENANT_ID}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/t/${TENANT_ID}/dashboard$`));
  const storedTenantId = await page.evaluate(() => localStorage.getItem("tenantId"));
  expect(storedTenantId).toBe(TENANT_ID);
});
