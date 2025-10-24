import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}

export { authOptions };
