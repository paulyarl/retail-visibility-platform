import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  // Get tenant ID from session/auth
  // For now, we'll redirect to login if not authenticated
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  
  if (!session) {
    redirect('/login');
  }

  // TODO: Get actual tenant ID from session
  const tenantId = 'demo-tenant'; // Placeholder

  return <OnboardingWizard tenantId={tenantId} />;
}
