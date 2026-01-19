import SetTenantId from '@/components/client/SetTenantId';
import FeaturedProductsManager from '@/components/tenant/FeaturedProductsManager';
import { ArrowLeft, Star } from 'lucide-react';
import Link from 'next/link';

export default async function FeaturedProductsSettings({ 
  params 
}: { 
  params: Promise<{ tenantId: string }> 
}) {
  const { tenantId } = await params;

  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href={`/t/${tenantId}/settings`}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Star className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      Featured Products Management
                    </h1>
                    <p className="text-sm text-gray-500">
                      Manage featured products for directory and storefront
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <FeaturedProductsManager tenantId={tenantId} />
        </div>
      </div>
    </>
  );
}
