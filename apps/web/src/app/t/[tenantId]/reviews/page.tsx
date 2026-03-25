import { Metadata } from 'next';
import ReviewManagementDashboard from '@/components/reviews/ReviewManagementDashboard';

interface CustomerReviewsPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Review Management',
  description: 'Manage and moderate customer reviews for your store',
};

export default async function CustomerReviewsPage({ params }: CustomerReviewsPageProps) {
  const { tenantId } = await params;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Review Management
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review and moderate customer reviews for your store. Anonymous reviews require approval before they become visible.
        </p>
      </div>

      <ReviewManagementDashboard tenantId={tenantId} />
    </div>
  );
}
