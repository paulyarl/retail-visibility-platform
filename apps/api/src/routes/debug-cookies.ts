/**
 * Debug Cookies Route
 * 
 * Temporary endpoint to debug cookie issues
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/debug-cookies', (req: Request, res: Response) => {
  console.log('[Debug] Cookie check:', {
    cookies: req.cookies,
    headers: req.headers,
  });

  res.json({
    success: true,
    debug: {
      cookies: req.cookies,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer,
        host: req.headers.host,
      },
      rawCookies: req.headers.cookie,
      parsedCookies: req.cookies,
    },
  });
});

export default router;
