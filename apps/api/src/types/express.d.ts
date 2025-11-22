// Express type extensions for request augmentation
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User & {
        tenantIds?: string[];
        role?: string;
      };
    }
  }
}

export {};
