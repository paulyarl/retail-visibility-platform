import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TenantsClient from '@/components/tenants/TenantsClient';

export default async function TenantsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) {
    redirect('/login?next=/tenants');
  }
  return <TenantsClient />;
}
