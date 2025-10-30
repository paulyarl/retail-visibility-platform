import { test, expect, request as pwRequest } from "@playwright/test";

const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const API_URL = process.env.API_URL || "http://localhost:4000";
const EMAIL = process.env.TEST_EMAIL || "owner@demo.local";
const PASSWORD = process.env.TEST_PASSWORD || "password123";
const TENANT_ID = process.env.TEST_TENANT_ID || "demo-tenant";

test("Settings > Tenant > Edit Business Profile save", async ({ page }) => {
  const api = await pwRequest.newContext();
  const res = await api.post(`${API_URL}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const { accessToken } = await res.json();

  await page.addInitScript(([token, tenantId]) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("tenantId", tenantId);
  }, [accessToken, TENANT_ID]);

  await page.goto(`${WEB_URL}/settings/tenant`);
  await expect(page.getByRole("heading", { name: "Tenant Settings" })).toBeVisible();

  await page.getByRole("button", { name: /edit business profile/i }).first().click();

  const cityInput = page.getByLabel("City");
  await expect(cityInput).toBeVisible();
  const newCity = `AutoCity${Date.now().toString().slice(-4)}`;
  await cityInput.fill(newCity);

  // Save
await page.getByRole("button", { name: /save changes/i }).click();

// Wait for the PATCH to succeed
await page.waitForResponse((r) =>
  r.url().includes("/api/tenant/profile") &&
  r.request().method() === "PATCH" &&
  r.status() === 200
);

// Assert modal closed (dialog hidden)
await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });

// Reload and assert page is still good
await page.reload();
await expect(page.getByRole("heading", { name: "Tenant Settings" })).toBeVisible();
});
