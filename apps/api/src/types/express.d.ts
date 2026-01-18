// Express type extensions for request augmentation
import { User } from '@prisma/client';
import { Request } from 'express';

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
