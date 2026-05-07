'use client';

import PageHeader, { Icons } from '@/components/PageHeader';
import { Card } from '@mantine/core';
import { Button } from '@mantine/core';


export default function LocationLimitsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Location Limits"
        description="Configure tenant location capacity limits"
        icon={Icons.Capacity}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Location Capacity Management
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                  Control how many locations each tenant can create based on their subscription tier.
                </p>
              </div>
            </div>

            <div className="text-center py-8">
              <div className="text-6xl mb-4">🏢</div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                Location Limits Configuration
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                This feature is being implemented. Location limits will be configurable per tenant tier.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
