import { Button } from '@/components/ui';

interface ItemsHeaderProps {
  stats: {
    total: number;
    active: number;
    inactive: number;
    syncing: number;
    public: number;
    private: number;
    lowStock: number;
  };
  onCreateClick: () => void;
  onBulkUploadClick: () => void;
  tenantId?: string;
}

/**
 * Header component for items page
 * Displays quick stats and action buttons
 */
export default function ItemsHeader({
  stats,
  onCreateClick,
  onBulkUploadClick,
  tenantId,
}: ItemsHeaderProps) {
  return (
    <div className="mb-6" suppressHydrationWarning>
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-neutral-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Total Items
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-success">
            {stats.active}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Active
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-neutral-500">
            {stats.inactive}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Inactive
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-primary-600">
            {stats.syncing}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Syncing
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-blue-600">
            {stats.public}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Public
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-neutral-600">
            {stats.private}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Private
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-2xl font-bold text-warning">
            {stats.lowStock}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Low Stock
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {tenantId && (
          <Button 
            onClick={() => window.open(`/tenant/${tenantId}`, '_blank')} 
            variant="secondary"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Storefront
          </Button>
        )}
        
        <Button onClick={onCreateClick} variant="primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </Button>

        <Button onClick={onBulkUploadClick} variant="secondary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Bulk Upload
        </Button>
      </div>
    </div>
  );
}
