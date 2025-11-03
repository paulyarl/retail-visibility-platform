import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers['cookie'];
  if (!header) return undefined;
  const parts = header.split(';').map((p) => p.trim());
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return undefined;
}

export function setCsrfCookie(req: Request, res: Response, next: NextFunction) {
  const enforce = String(process.env.FF_ENFORCE_CSRF || 'false').toLowerCase() === 'true';
  const existing = getCookie(req, 'csrf');
  if (!existing) {
    const token = crypto.randomBytes(24).toString('hex');
    const isProd = String(process.env.NODE_ENV) === 'production';
    res.cookie('csrf', token, {
      httpOnly: false,
      sameSite: 'none', // Allow cross-site requests (frontend on Vercel, backend on Railway)
      secure: true, // Required when sameSite=none
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  (req as any).__csrf_enforce = enforce;
  next();
}

export function csrfProtect(req: Request, res: Response, next: NextFunction) {
  const method = (req.method || 'GET').toUpperCase();
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const enforce = (req as any).__csrf_enforce === true;
  if (!isWrite) return next();

  const cookieToken = getCookie(req, 'csrf');
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!enforce) return next();

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'csrf_missing_or_invalid' });
  }

  next();
}
