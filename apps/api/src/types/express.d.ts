// Express type extensions for request augmentation
import { User } from '@prisma/client';
import { Request } from 'express';
import type { RequestCtx } from '../context';

declare module 'express' {
  interface Request {
    user?: User & {
      tenantIds?: string[];
      role?: string;
    };
    ctx?: RequestCtx;
    // Override Express 5.x parameter types to be string-based
    params: Record<string, string>;
  }
}

export {};
