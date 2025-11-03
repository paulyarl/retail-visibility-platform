/**
 * Currency rate job stub (disabled by default)
 * REQ: REQ-2025-905
 * Feature Flag: FF_CURRENCY_RATE_STUB (default OFF)
 */
import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { Flags } from "../config";

/**
 * POST /jobs/rates/daily
 * Protected by service token
 * Writes mock currency rates to settings.currency_rates table
 */
export async function dailyRatesJob(req: Request, res: Response) {
  // Service token protection (auth first for clearer semantics and tests)
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const serviceToken = process.env.SERVICE_TOKEN || ""; // read at request time
  if (!token || token !== serviceToken) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid service token" });
  }

  // Feature flag guard (only check after auth)
  if (!Flags.CURRENCY_RATE_STUB) {
    return res.status(503).json({ error: "rate_job_disabled", message: "FF_CURRENCY_RATE_STUB is OFF" });
  }

  try {
    // Mock rates (in production, fetch from external API)
    const mockRates = {
      base: "USD",
      date: new Date().toISOString().split("T")[0],
      rates: {
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CAD: 1.36,
        AUD: 1.53,
      },
    };

    // Store in settings.currency_rates table
    await prisma.$executeRaw`
      INSERT INTO currency_rates (base, date, rates, created_at)
      VALUES (${mockRates.base}, ${mockRates.date}, ${JSON.stringify(mockRates.rates)}, now())
      ON CONFLICT (base, date) DO UPDATE SET rates = ${JSON.stringify(mockRates.rates)}, updated_at = now()
    `;

    // Log metrics
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message: "currency_rates_updated",
      base: mockRates.base,
      date: mockRates.date,
      rows_written: 1,
    }));

    return res.json({ success: true, base: mockRates.base, date: mockRates.date, rows: 1 });
  } catch (e: any) {
    console.error("rate_job_error", e);
    return res.status(500).json({ error: "rate_job_failed", message: e.message });
  }
}
