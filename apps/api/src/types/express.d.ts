// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        role: string;
        email: string;
      };
    }
  }
}

export {};
