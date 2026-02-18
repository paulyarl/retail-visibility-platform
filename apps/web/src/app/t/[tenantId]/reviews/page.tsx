import { Metadata } from 'next';
import ReviewManagementDashboard from '@/components/reviews/ReviewManagementDashboard';

interface CustomerReviewsPageProps {
  params: {
    tenantId: string;
  };
}

export const metadata: Metadata = {
  title: 'Customer Reviews',
  description: 'View and manage customer reviews for your store',
};

export default function CustomerReviewsPage({ params }: CustomerReviewsPageProps) {
  const { tenantId } = params;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Customer Reviews
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View all customer reviews for your store. Manage and respond to customer feedback.
        </p>
      </div>

      <ReviewManagementDashboard tenantId={tenantId} />
    </div>
  );
}
