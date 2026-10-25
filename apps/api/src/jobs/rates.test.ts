/**
 * Unit test: Currency rate job stub
 * REQ: REQ-2025-905
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// CI has no database — the flag resolver's platform_feature_flags_list read
// would throw past the route's 503 guard. The flag layer is not what this
// suite tests; pin the platform flag OFF.
vi.mock("../utils/effectiveFlags", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../utils/effectiveFlags")>();
  return {
    ...orig,
    getEffectivePlatform: vi.fn(async (flag: string) => ({
      flag,
      effectiveOn: false,
      effectiveSource: "off",
      sources: { platform_env: false, platform_db: false, allow_override: false },
    })),
  };
});

import request from "supertest";
import app from "../index";

describe("Currency Rate Job Stub (REQ-2025-905)", () => {
  const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "test-token";

  beforeAll(() => {
    // Ensure the handler sees the same token the test uses
    process.env.SERVICE_TOKEN = SERVICE_TOKEN;
    // Leave FF_CURRENCY_RATE_STUB unset/false by default for the 503 test
    if (process.env.FF_CURRENCY_RATE_STUB) delete process.env.FF_CURRENCY_RATE_STUB;
  });

  it("should return 503 when FF_CURRENCY_RATE_STUB is OFF", async () => {
    // Assuming flag is OFF by default
    const res = await request(app)
      .post("/jobs/rates/daily")
      .set("Authorization", `Bearer ${SERVICE_TOKEN}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("rate_job_disabled");
  }, 60_000); // first request pays the full app cold-boot (~17s)

  it("should return 401 when service token is missing", async () => {
    const res = await request(app).post("/jobs/rates/daily");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  }, 60_000); // request path pays prisma retry latency without a DB

  it("should return 401 when service token is invalid", async () => {
    const res = await request(app)
      .post("/jobs/rates/daily")
      .set("Authorization", "Bearer wrong-token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  }, 60_000); // request path pays prisma retry latency without a DB

  // This test would pass if FF_CURRENCY_RATE_STUB=true and currency_rates table exists
  it.skip("should insert mock rates when flag is ON and token is valid", async () => {
    // Enable flag: process.env.FF_CURRENCY_RATE_STUB = "true"
    const res = await request(app)
      .post("/jobs/rates/daily")
      .set("Authorization", `Bearer ${SERVICE_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.base).toBe("USD");
    expect(res.body.rows).toBe(1);
  });
});
