'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

export default function AdminCategoriesPage() {
  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Category Management"
        description="Manage product categories and hierarchies"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-neutral-500">Category management interface</p>
              <p className="text-sm text-neutral-400 mt-2">
                API ready - Full UI implementation pending
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
