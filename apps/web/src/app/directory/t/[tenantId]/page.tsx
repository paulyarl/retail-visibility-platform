import { redirect } from 'next/navigation';

interface DirectoryTenantPageProps {
  params: {
    tenantId: string;
  };
}

async function getTenantSlug(tenantId: string): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/directory/${tenantId}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.listing?.slug || null;
  } catch (error) {
    console.error('Error fetching tenant directory listing:', error);
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
