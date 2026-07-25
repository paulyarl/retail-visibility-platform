// Express type extensions for request augmentation
import { User } from '@prisma/client';
import type { RequestCtx } from '../context';

declare global {
  namespace Express {
    interface Request {
      ctx?: RequestCtx;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    ctx?: RequestCtx;
  }
}

declare module 'express' {
  interface Request {
    user?: User & {
      tenantIds?: string[];
      role?: string;
    };
    // Override Express 5.x parameter types to be string-based
    params: Record<string, string>;
  }
}

export {};
