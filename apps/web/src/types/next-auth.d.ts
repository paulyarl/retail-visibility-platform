import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      tenants?: Array<{
        id: string;
        name: string;
      }>;
    } & DefaultSession['user'];
  }

  interface User {
    role: string;
    tenants?: Array<{
      id: string;
      name: string;
    }>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    tenants?: Array<{
      id: string;
      name: string;
    }>;
  }
}
