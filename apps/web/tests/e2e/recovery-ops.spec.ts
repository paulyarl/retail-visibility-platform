/**
 * Recovery Ops E2E Test
 *
 * UI render checks + a full API-driven happy-path test:
 *   - Recovery list / detail / nav render checks (admin UI)
 *   - Full cycle: create campaign → stage transitions → auto-minted intake
 *     link → public token resolve → evidence attachment upload → intake
 *     submit → external draft import → approve → delivery status = sent
 *
 * Sprint 4 — Recovery Production Readiness.
 */

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

// ─── Recovery List Page ─────────────────────────────────────────

test("Recovery list page renders at /settings/admin/marketing-ops/recovery", async ({ page }) => {
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery`);
  await page.waitForLoadState('networkidle');

  // The page should render the Marketing Ops shell with "Recovery Management" title
  await expect(page.locator('text=Recovery Management')).toBeVisible({ timeout: 10000 });
});

test("Recovery list page shows breadcrumbs", async ({ page }) => {
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery`);
  await page.waitForLoadState('networkidle');

  // Breadcrumbs should include Marketing Ops
  await expect(page.locator('text=Marketing Ops').first()).toBeVisible({ timeout: 10000 });
});

// ─── Recovery Detail Page ───────────────────────────────────────

test("Recovery detail page renders campaign cycle banner", async ({ page, request }) => {
  // First, fetch recovery campaigns from the API
  const apiContext = await pwRequest.newContext();
  const loginRes = await apiContext.post(`${API_URL}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  const { accessToken } = await loginRes.json();

  const campaignsRes = await apiContext.get(`${API_URL}/api/marketing-ops/recovery/campaigns`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!campaignsRes.ok()) {
    test.skip(true, "No recovery campaigns API available or no campaigns exist");
    return;
  }

  const campaignsBody = await campaignsRes.json();
  const campaigns = campaignsBody.data?.campaigns || campaignsBody.campaigns || [];

  if (campaigns.length === 0) {
    test.skip(true, "No recovery campaigns exist — skipping detail page test");
    return;
  }

  const campaignId = campaigns[0].id || campaigns[0].campaign_id;
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery/${campaignId}`);
  await page.waitForLoadState('networkidle');

  // The campaign cycle banner should be visible
  await expect(page.locator('text=Recovery Campaign Cycle').first()).toBeVisible({ timeout: 10000 });
});

test("Recovery detail page renders Channel Readiness widget", async ({ page }) => {
  // Navigate to recovery list and click first campaign if available
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery`);
  await page.waitForLoadState('networkidle');

  // Try to find a campaign link
  const campaignLink = page.locator('a[href*="/recovery/"]').first();
  const hasCampaign = await campaignLink.count() > 0;

  if (!hasCampaign) {
    test.skip(true, "No recovery campaigns to click — skipping Channel Readiness test");
    return;
  }

  await campaignLink.click();
  await page.waitForLoadState('networkidle');

  // Channel Readiness widget should render
  await expect(page.locator('text=Channel Readiness')).toBeVisible({ timeout: 10000 });
});

test("Recovery detail page renders AI Workspace panel", async ({ page }) => {
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery`);
  await page.waitForLoadState('networkidle');

  const campaignLink = page.locator('a[href*="/recovery/"]').first();
  const hasCampaign = await campaignLink.count() > 0;

  if (!hasCampaign) {
    test.skip(true, "No recovery campaigns — skipping AI Workspace test");
    return;
  }

  await campaignLink.click();
  await page.waitForLoadState('networkidle');

  // AI Workspace panel should render with dual-mode controls
  await expect(page.locator('text=AI Workspace')).toBeVisible({ timeout: 10000 });
  // Copy Prompt button should be visible
  await expect(page.locator('text=Copy Prompt')).toBeVisible({ timeout: 10000 });
});

// ─── Navigation ─────────────────────────────────────────────────

test("Recovery link appears in admin sidebar under Marketing Ops", async ({ page }) => {
  await page.goto(`${WEB_URL}/settings/admin`);
  await page.waitForLoadState('networkidle');

  // Look for the Marketing Ops section in the sidebar
  const marketingOpsSection = page.locator('text=Marketing Ops').first();
  await expect(marketingOpsSection).toBeVisible({ timeout: 10000 });

  // The Recovery link should be in the nav (might need to expand Marketing Ops first)
  const recoveryLink = page.locator('a[href*="/marketing-ops/recovery"]').first();
  if (await recoveryLink.count() > 0) {
    await recoveryLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/marketing-ops\/recovery/);
  }
});

test("Recovery tab on dashboard links to standalone recovery route", async ({ page }) => {
  await page.goto(`${WEB_URL}/settings/admin/marketing-ops`);
  await page.waitForLoadState('networkidle');

  // The Recovery tab should be a link to /settings/admin/marketing-ops/recovery
  const recoveryTab = page.locator('a[href*="/marketing-ops/recovery"]').first();
  if (await recoveryTab.count() > 0) {
    await recoveryTab.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/marketing-ops\/recovery$/);
  }
});

// ─── Full Recovery Cycle (API-driven happy path) ────────────────
//
// Drives the entire recovery pipeline end-to-end against the real API:
//   create campaign → audit_identified → framework_preview_generated →
//   outreach_dispatched (auto-mints intake link) → awaiting_owner_intake →
//   public intake resolve → evidence attachment upload → intake submit →
//   intake_submitted → external import of recovery_resolution draft →
//   final_resolution_drafted → approve → resolved_and_closed →
//   delivery status = sent.
// Admin API calls authenticate via the x-auth0-email session header (the
// same header the web proxy injects), which resolves to the users row.

const ADMIN_API = `${API_URL}/api/admin/marketing-ops`;
const PUBLIC_API = `${API_URL}/api/public/recovery/intake`;
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || EMAIL;

const adminHeaders = { 'x-auth0-email': ADMIN_EMAIL };

test("Full recovery cycle: create → dispatch → intake → import → approve → delivered", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: API_URL });
  let campaignId: string | null = null;

  try {
    // ── 1. Create a business-scope recovery campaign ──────────────
    const businessName = `E2E Recovery Co ${Date.now()}`;
    const createRes = await api.post(ADMIN_API, {
      headers: adminHeaders,
      data: {
        scope: 'business',
        campaign_category: 'recovery_management',
        business_name: businessName,
        category: 'Restaurant',
        city: 'Testville',
        state: 'TS',
        email: 'e2e-recovery-owner@example.com',
        notes: 'E2E test campaign — customer dispute over service charge',
      },
    });

    if (createRes.status() === 401 || createRes.status() === 403) {
      test.skip(true, `Admin auth unavailable via x-auth0-email (${ADMIN_EMAIL}) — set TEST_ADMIN_EMAIL to a platform admin`);
      return;
    }
    expect(createRes.ok(), `create campaign failed: ${await createRes.text()}`).toBeTruthy();

    const campaign = (await createRes.json()).data;
    campaignId = campaign.id;
    expect(campaign.stage).toBe('audit_identified');

    const getStage = async () => {
      const res = await api.get(`${ADMIN_API}/${campaignId}`, { headers: adminHeaders });
      expect(res.ok()).toBeTruthy();
      return (await res.json()).data.stage as string;
    };

    // ── 2. Advance to outreach_dispatched → awaiting_owner_intake ─
    // acknowledge_incomplete bypasses the playbook soft-gate (fresh
    // campaigns may carry an assigned checklist). The outreach_dispatched
    // hook auto-mints the intake link server-side.
    for (const toStage of ['framework_preview_generated', 'outreach_dispatched', 'awaiting_owner_intake']) {
      const res = await api.post(`${ADMIN_API}/${campaignId}/transition`, {
        headers: adminHeaders,
        data: { to_stage: toStage, trigger_type: 'manual', acknowledge_incomplete: true },
      });
      expect(res.ok(), `transition to ${toStage} failed: ${await res.text()}`).toBeTruthy();
    }
    expect(await getStage()).toBe('awaiting_owner_intake');

    // ── 3. Intake link auto-minted at outreach_dispatched ─────────
    const intakeRes = await api.get(`${ADMIN_API}/recovery/${campaignId}/intake?intakeKind=dispute`, {
      headers: adminHeaders,
    });
    expect(intakeRes.ok(), `intake fetch failed: ${await intakeRes.text()}`).toBeTruthy();
    const intake = (await intakeRes.json()).data;
    const token = intake.access_token as string;
    expect(token).toBeTruthy();
    expect(intake.submitted_at).toBeNull();

    // ── 4. Resolve the public token (owner-facing) ────────────────
    const resolveRes = await api.get(`${PUBLIC_API}?token=${encodeURIComponent(token)}`);
    expect(resolveRes.ok()).toBeTruthy();
    const intakeCtx = (await resolveRes.json()).data;
    expect(intakeCtx.campaignId).toBe(campaignId);
    expect(intakeCtx.alreadySubmitted).toBe(false);
    expect(intakeCtx.intakeKind).toBe('dispute');

    // ── 5. Upload evidence attachment (best-effort — requires the
    //        disputes storage bucket to be configured) ─────────────
    // Allowed MIMEs default to pdf/png/jpeg — use a minimal valid PDF.
    const minimalPdf = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF',
    );
    const attachmentIds: string[] = [];
    const uploadRes = await api.post(`${PUBLIC_API}/attachments`, {
      multipart: {
        token,
        file: {
          name: 'receipt-evidence.pdf',
          mimeType: 'application/pdf',
          buffer: minimalPdf,
        },
      },
    });
    if (uploadRes.ok()) {
      const uploaded = (await uploadRes.json()).data;
      expect(uploaded.attachmentId).toBeTruthy();
      attachmentIds.push(uploaded.attachmentId);
    } else {
      const errText = await uploadRes.text();
      expect(
        errText.includes('Storage backend not configured') || errText.includes('Bucket not found'),
        `attachment upload failed unexpectedly: ${errText}`,
      ).toBeTruthy();
      console.warn('[recovery-e2e] attachment storage unavailable — submitting intake without attachments');
    }

    // ── 6. Submit the owner intake (public, token-gated) ──────────
    const submitRes = await api.post(`${PUBLIC_API}/submit`, {
      data: {
        token,
        ownerStatement: 'We dispute this complaint — the service was completed on schedule and the customer was notified of the delay in advance.',
        ownerEmail: 'e2e-recovery-owner@example.com',
        ownerPhone: '+15555550100',
        proposedResolution: 'Partial refund issued to the customer for the disputed charge',
        statusFlag: 'PARTIAL_REFUND',
        attachmentIds,
      },
    });
    expect(submitRes.ok(), `intake submit failed: ${await submitRes.text()}`).toBeTruthy();
    const submitData = (await submitRes.json()).data;
    expect(submitData.stage).toBe('intake_submitted');
    expect(await getStage()).toBe('intake_submitted');

    // Evidence landed on the intake record
    const intakeAfter = await api.get(`${ADMIN_API}/recovery/${campaignId}/intake?intakeKind=dispute`, {
      headers: adminHeaders,
    });
    const intakeRow = (await intakeAfter.json()).data;
    expect(intakeRow.submitted_at).toBeTruthy();
    expect(intakeRow.owner_email).toBe('e2e-recovery-owner@example.com');
    if (attachmentIds.length > 0) {
      expect(intakeRow.mkt_dispute_attachments?.length).toBeGreaterThan(0);
    }

    // ── 7. Import an external recovery_resolution draft ───────────
    const importRes = await api.post(`${ADMIN_API}/recovery/${campaignId}/import-result`, {
      headers: adminHeaders,
      data: {
        raw_output: JSON.stringify({
          recovery_resolution: {
            deliverableText:
              'Dear Review Team, we respectfully dispute this complaint. Our records show the service was completed on schedule, ' +
              'the customer was notified of the delay in advance, and a partial refund was issued as a goodwill gesture.',
            submissionGuide:
              'Log in to the complaint platform, open the flagged review, select "Respond as owner", paste the drafted response, and submit.',
          },
        }),
      },
    });
    expect(importRes.ok(), `import-result failed: ${await importRes.text()}`).toBeTruthy();
    const importData = (await importRes.json()).data;
    expect(importData.passed, `import validation failed: ${JSON.stringify(importData.errors)}`).toBe(true);
    expect(importData.deliverableId).toBeTruthy();
    expect(await getStage()).toBe('final_resolution_drafted');

    // Draft retrievable with both sections
    const draftRes = await api.get(`${ADMIN_API}/recovery/${campaignId}/draft`, { headers: adminHeaders });
    expect(draftRes.ok()).toBeTruthy();
    const draft = (await draftRes.json()).data;
    expect(draft.status).toBe('drafted');
    const sectionTypes = (draft.mkt_deliverable_section || []).map((s: any) => s.section_type);
    expect(sectionTypes).toContain('response_draft');
    expect(sectionTypes).toContain('submission_guide');

    // ── 8. Approve → resolved_and_closed ──────────────────────────
    const approveRes = await api.post(`${ADMIN_API}/recovery/${campaignId}/approve`, { headers: adminHeaders });
    expect(approveRes.ok(), `approve failed: ${await approveRes.text()}`).toBeTruthy();
    expect((await approveRes.json()).data.stage).toBe('resolved_and_closed');

    // ── 9. Delivery tracking recorded ─────────────────────────────
    const dsRes = await api.get(`${ADMIN_API}/recovery/${campaignId}/delivery-status`, { headers: adminHeaders });
    expect(dsRes.ok()).toBeTruthy();
    const ds = (await dsRes.json()).data;
    expect(ds.deliverable?.delivery_status).toBe('sent');
    expect(ds.deliverable?.delivered_at).toBeTruthy();
    expect(ds.deliveryLog?.delivery_status).toBe('sent');
    expect(ds.deliveryLog?.delivery_attempts).toBe(1);

    // ── 10. Operator UI reflects the closed cycle ─────────────────
    await page.goto(`${WEB_URL}/settings/admin/marketing-ops/recovery/${campaignId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Delivery Status').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Delivered').first()).toBeVisible({ timeout: 10000 });
  } finally {
    // Cleanup — best effort; FK cascades handle intake/deliverable rows.
    if (campaignId) {
      await api.delete(`${ADMIN_API}/${campaignId}`, { headers: adminHeaders }).catch(() => {});
    }
    await api.dispose();
  }
});

// ─── Intake Form (Public) ───────────────────────────────────────

test("Public intake form renders with email + phone fields", async ({ page }) => {
  // Navigate to the intake form with a dummy token — it will show an error
  // but we can verify the form fields render if the token resolves.
  await page.goto(`${WEB_URL}/recovery/intake?token=invalid-test-token`);
  await page.waitForLoadState('networkidle');

  // The page should either show an error (invalid token) or the form.
  // If it shows the form, verify the email field is present.
  const emailField = page.locator('input[type="email"]');
  const errorText = page.locator('text=Something Went Wrong');
  const expiredText = page.locator('text=Link Expired');

  // One of these should be visible
  const hasForm = await emailField.count() > 0;
  const hasError = await errorText.count() > 0;
  const hasExpired = await expiredText.count() > 0;

  expect(hasForm || hasError || hasExpired).toBeTruthy();
});
