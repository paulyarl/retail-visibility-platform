/**
 * Shared customer-portal auth middleware.
 *
 * Extracted from the inline copies previously duplicated across
 * gbp-customer.ts, marketing-customer.ts, market-intel-customer.ts,
 * market-intel-surface-customer.ts, customer-coupons.ts,
 * customer-addresses.ts and customer-payment-methods.ts
 * (SOCIAL_POSTING_SUITE_SPEC.md §7 — every future platform surface needs
 * the same gate).
 *
 * - requireCustomerAuth     — 401 unless a valid customer JWT/session cookie
 * - requirePlatformContext  — 403 context_required unless the customer has a
 *                             platform (marketing) relationship
 */

import { Request, Response, NextFunction } from 'express';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { CustomerAuthService } from '../services/CustomerAuthService';

const customerTokenService = CustomerTokenService.getInstance();
const customerAuthService = CustomerAuthService.getInstance();

export const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) return payload.customerId;
  }
  if (req.cookies?.customer_session_id) {
    return req.cookies.customer_session_id;
  }
  return null;
};

export const requireCustomerAuth = (req: Request, res: Response, next: NextFunction) => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    return res.status(401).json({ success: false, error: 'unauthorized', message: 'Not authenticated' });
  }
  (req as any).customerId = customerId;
  next();
};

export const requirePlatformContext = async (req: Request, res: Response, next: NextFunction) => {
  const customerId = (req as any).customerId;
  const contexts = await customerAuthService.computeContexts(customerId);
  if (!contexts.platform) {
    return res.status(403).json({
      success: false,
      error: 'context_required',
      message: 'Marketing portal access requires a linked marketing purchase.',
    });
  }
  next();
};
