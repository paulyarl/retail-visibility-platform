'use client';

import { useState } from 'react';
import { 
  Building2, 
  Users, 
  Package, 
  Trash2, 
  Rocket, 
  Eraser,
  Clock,
  FileText,
  Plus,
  Loader2
} from 'lucide-react';
import CreateTestChainModal from '@/components/admin/CreateTestChainModal';
import DeleteTestChainModal from '@/components/admin/DeleteTestChainModal';
import CreateTestTenantModal from '@/components/admin/CreateTestTenantModal';
import BulkSeedModal from '@/components/admin/BulkSeedModal';
import BulkClearModal from '@/components/admin/BulkClearModal';

export default function AdminToolsPage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const tools = [
    {
      id: 'create-chain',
      icon: Building2,
      title: 'Create Test Chain',
      description: 'Quickly create multi-location test organizations',
      color: 'from-blue-500 to-blue-600',
      category: 'organization',
    },
    {
      id: 'delete-chain',
      icon: Trash2,
      title: 'Delete Test Chain',
      description: 'Remove test orgs and all associated data',
      color: 'from-red-500 to-red-600',
      category: 'organization',
    },
    {
      id: 'create-tenant',
      icon: Plus,
      title: 'Create Test Tenant',
      description: 'Create standalone test tenants for testing',
      color: 'from-purple-500 to-purple-600',
      category: 'user',
    },
    {
      id: 'bulk-seed',
      icon: Package,
      title: 'Bulk Seed Products',
      description: 'Seed multiple tenants with test data',
      color: 'from-green-500 to-green-600',
      category: 'data',
    },
    {
      id: 'bulk-clear',
      icon: Eraser,
      title: 'Bulk Clear Products',
      description: 'Clear products from multiple tenants',
      color: 'from-orange-500 to-orange-600',
      category: 'data',
    },
  ];

  const categories = [
    { id: 'organization', title: '🏢 Organization Management', icon: Building2 },
    { id: 'user', title: '👤 User Management', icon: Users },
    { id: 'data', title: '📦 Data Management', icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Admin Control Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Powerful tools for platform management
              </p>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        {categories.map((category) => {
          const categoryTools = tools.filter((tool) => tool.category === category.id);
          const gridCols = categoryTools.length === 1 
            ? 'grid-cols-1 md:grid-cols-1 lg:grid-cols-1 max-w-md' 
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
          
          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                {category.title}
              </h2>
              <div className={`grid ${gridCols} gap-6`}>
                {categoryTools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveModal(tool.id)}
                      className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-xl text-left"
                    >
                      {/* Icon */}
                      <div className={`w-14 h-14 bg-gradient-to-br ${tool.color} rounded-lg flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>

                      {/* Content */}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {tool.description}
                      </p>

                      {/* Arrow indicator */}
                      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Info Banner */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                💡 Admin Tools Best Practices
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• All actions are audit logged for security</li>
                <li>• Destructive operations require confirmation</li>
                <li>• Test chains are marked with "test" prefix for easy identification</li>
                <li>• Use draft mode when seeding to prevent accidental publishing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal === 'create-chain' && (
        <CreateTestChainModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'delete-chain' && (
        <DeleteTestChainModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'create-tenant' && (
        <CreateTestTenantModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'bulk-seed' && (
        <BulkSeedModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'bulk-clear' && (
        <BulkClearModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
