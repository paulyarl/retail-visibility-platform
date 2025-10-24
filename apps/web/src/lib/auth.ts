import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

// TODO: Implement proper admin check when User model includes isAdmin field
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }
  return user;
}

export { authOptions };
