import { redirect } from 'next/navigation';
import Link from 'next/link';
import { tenantDirectoryService, TenantDirectoryStatus } from '@/services/TenantDirectorySingletonService';
import { clientLogger } from '@/lib/client-logger';

interface DirectoryTenantPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

async function getTenantDirectoryStatus(tenantId: string): Promise<TenantDirectoryStatus | null> {
  try {
    return await tenantDirectoryService.getTenantDirectoryStatus(tenantId);
  } catch (error) {
    clientLogger.error('Error fetching tenant directory status:', { detail: error });
    return null;
  }
}

export default async function DirectoryTenantPage({ params }: DirectoryTenantPageProps) {
  const { tenantId } = await params;

  const status = await getTenantDirectoryStatus(tenantId);

  // Tenant not found or request failed — fall back to directory home
  if (!status) {
    redirect('/directory');
  }

  // Tenant has a published slug — redirect to the friendly URL
  if (status.slug) {
    redirect(`/directory/${status.slug}`);
  }

  // Tenant exists but has no published directory listing — show graceful message
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Store Coming Soon
        </h1>

        <p className="text-gray-600 mb-6 leading-relaxed">
          This store&apos;s directory listing is pending publication.
          Please check back soon to see their full storefront and product catalog.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg mb-8">
          <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-yellow-800">
            Awaiting publication
          </span>
        </div>

        <Link
          href="/directory"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Browse Directory
        </Link>
      </div>
    </div>
  );
}
