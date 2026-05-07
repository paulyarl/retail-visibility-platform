import { Metadata } from 'next';
import AdminReviewManagement from '@/components/admin/AdminReviewManagement';

export const metadata: Metadata = {
  title: 'Admin - Review Management',
  description: 'Platform-wide review moderation for stores and products',
};

export default function AdminReviewsPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Review Management
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Moderate and manage customer reviews for stores and products across all locations on the platform.
        </p>
      </div>

      <AdminReviewManagement />
    </div>
  );
}
