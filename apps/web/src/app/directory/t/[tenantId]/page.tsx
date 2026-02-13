import { redirect } from 'next/navigation';
import { recommendationsService } from '@/services/RecommendationsSingletonService';

interface DirectoryTenantPageProps {
  params: {
    tenantId: string;
  };
}

async function getTenantSlug(tenantId: string): Promise<string | null> {
  try {
    const data = await recommendationsService.getTenantDirectorySlug(tenantId);
    return data?.slug || null;
  } catch (error) {
    console.error('Error fetching tenant directory slug:', error);
    return null;
  }
}

export default async function DirectoryTenantPage({ params }: DirectoryTenantPageProps) {
  const { tenantId } = params;
  
  // Try to get the slug for this tenant
  const slug = await getTenantSlug(tenantId);
  
  if (slug) {
    // Redirect to the slug-based URL
    redirect(`/directory/${slug}`);
  }
  
  // If no slug found, redirect to directory home
  redirect('/directory');
}
