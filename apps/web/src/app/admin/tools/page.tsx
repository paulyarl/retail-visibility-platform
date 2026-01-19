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
  Loader2,
  Shield,
  Settings,
  Lock,
  Zap,
  ChevronDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import CreateTestChainModal from '@/components/admin/CreateTestChainModal';
import DeleteTestChainModal from '@/components/admin/DeleteTestChainModal';
import CreateTestTenantModal from '@/components/admin/CreateTestTenantModal';
import DeleteTestTenantModal from '@/components/admin/DeleteTestTenantModal';
import BulkSeedModal from '@/components/admin/BulkSeedModal';
import BulkClearModal from '@/components/admin/BulkClearModal';
import CleanupScanSessionsModal from '@/components/admin/CleanupScanSessionsModal';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminToolsPage() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(['tools', 'dashboards', 'security', 'platform']);

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
      id: 'delete-tenant',
      icon: Trash2,
      title: 'Delete Test Tenant',
      description: 'Remove test tenants and all associated data',
      color: 'from-red-500 to-red-600',
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
    {
      id: 'cleanup-sessions',
      icon: Trash2,
      title: 'Cleanup Scan Sessions',
      description: 'Close active scan sessions for a tenant',
      color: 'from-red-500 to-pink-600',
      category: 'maintenance',
    },
  ];

  const dashboards = [
    {
      id: 'security-dashboard',
      href: '/(platform)/settings/admin/security',
      icon: Shield,
      title: 'Security Dashboard',
      description: 'Platform-wide security monitoring, threat detection, and blocked IP management',
      color: 'from-red-500 to-pink-600',
      stats: 'Threat Monitoring',
      badge: 'CRITICAL'
    },
    {
      id: 'platform-settings',
      href: '/(platform)/settings/admin/platform',
      icon: Settings,
      title: 'Platform Settings',
      description: 'Rate limiting controls, security configurations, and platform-wide settings',
      color: 'from-blue-500 to-indigo-600',
      stats: 'Rate Limiting & Security',
      badge: 'ADMIN'
    },
    {
      id: 'permissions',
      href: '/(platform)/settings/admin/permissions',
      icon: Lock,
      title: 'Platform Permission Matrix',
      description: 'Configure role-based permissions across the platform',
      color: 'from-purple-500 to-purple-600',
      stats: 'Access Control',
    },
    {
      id: 'enrichment',
      href: '/admin/enrichment',
      icon: Rocket,
      title: 'Product Intelligence Dashboard',
      description: 'Universal barcode cache analytics, popular products, data quality metrics',
      color: 'from-cyan-500 to-blue-600',
      stats: 'Real-time analytics',
    },
    {
      id: 'cached-products',
      href: '/admin/tools/cached-products',
      icon: Package,
      title: 'Cached Products Manager',
      description: 'Manage Quick Start product cache - view, edit, and delete cached products',
      color: 'from-purple-500 to-pink-600',
      stats: 'Product Cache',
    },
  ];

  const directories = [
    {
      id: 'directory',
      href: '/admin/directory',
      icon: Shield,
      title: 'Platform Directory Management',
      description: 'Manage directory listings, featured placements, and quality across all tenants',
      color: 'from-red-500 to-pink-600',
      stats: 'Directory Control',
    },
    {
      id: 'listings',
      href: '/admin/directory/listings',
      icon: Rocket,
      title: 'All Directory Listings',
      description: 'View and manage directory listings across all tenants',
      color: 'from-cyan-500 to-blue-600',
      stats: 'View directory listings',
    },
    {
      id: 'featured',
      href: '/admin/directory/featured',
      icon: Package,
      title: 'Featured Listings',
      description: 'Manage featured placements and priorities',
      color: 'from-purple-500 to-pink-600',
      stats: 'Featured Listings',
    },
  ];

  const categories = [
    { id: 'organization', title: '🏢 Organization Management', icon: Building2 },
    { id: 'user', title: '👤 User Management', icon: Users },
    { id: 'data', title: '📦 Data Management', icon: Package },
    { id: 'maintenance', title: '🔧 System Maintenance', icon: Clock },
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const renderCollapsibleSection = (title: string, sectionId: string, icon: React.ReactNode, children: React.ReactNode, badge?: string) => {
    const isExpanded = expandedSections.includes(sectionId);
    const Icon = icon as any;
    
    return (
      <div className="mb-6">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {badge && (
              <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs font-medium rounded-full">
                {badge}
              </span>
            )}
          </div>
          <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-5 h-5 text-gray-500" />
          </div>
        </button>
        
        {isExpanded && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800">
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

        {/* Security & Platform Section */}
        {renderCollapsibleSection(
          "🔒 Security & Platform Control",
          "security-platform",
          <Shield className="w-6 h-6" />,
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboards.filter(d => d.id === 'security-dashboard' || d.id === 'platform-settings').map((dashboard) => {
              const Icon = dashboard.icon;
              return (
                <a
                  key={dashboard.id}
                  href={dashboard.href}
                  className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 transition-all duration-200 hover:shadow-2xl"
                >
                  {/* Badge */}
                  {dashboard.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                        {dashboard.badge}
                      </span>
                    </div>
                  )}
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 bg-gradient-to-br ${dashboard.color} rounded-lg flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {dashboard.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {dashboard.description}
                  </p>

                  {/* Stats Badge */}
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                    <Activity className="w-2 h-2" />
                    {dashboard.stats}
                  </div>

                  {/* Arrow */}
                  <div className="absolute bottom-6 right-6 text-gray-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all duration-200">
                    →
                  </div>
                </a>
              );
            })}
          </div>,
          "CRITICAL"
        )}

        {/* Analytics Dashboards Section */}
        {renderCollapsibleSection(
          "📊 Analytics Dashboards",
          "dashboards",
          <Activity className="w-6 h-6" />,
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.filter(d => d.id !== 'security-dashboard' && d.id !== 'platform-settings').map((dashboard) => {
              const Icon = dashboard.icon;
              return (
                <a
                  key={dashboard.id}
                  href={dashboard.href}
                  className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all duration-200 hover:shadow-2xl"
                >
                  {/* Badge */}
                  {dashboard.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                        {dashboard.badge}
                      </span>
                    </div>
                  )}
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 bg-gradient-to-br ${dashboard.color} rounded-lg flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {dashboard.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {dashboard.description}
                  </p>

                  {/* Stats Badge */}
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                    {dashboard.stats}
                  </div>

                  {/* Arrow */}
                  <div className="absolute top-6 right-6 text-gray-400 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all duration-200">
                    →
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Directory Management Section */}
        {renderCollapsibleSection(
          "📁 Directory Management",
          "directory",
          <Package className="w-6 h-6" />,
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {directories.map((directory) => {
              const Icon = directory.icon;
              return (
                <a
                  key={directory.id}
                  href={directory.href}
                  className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all duration-200 hover:shadow-2xl"
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 bg-gradient-to-br ${directory.color} rounded-lg flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {directory.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {directory.description}
                  </p>

                  {/* Stats Badge */}
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    {directory.stats}
                  </div>

                  {/* Arrow */}
                  <div className="absolute top-6 right-6 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all duration-200">
                    →
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Admin Tools Section */}
        {renderCollapsibleSection(
          "🛠️ Admin Tools",
          "tools",
          <Settings className="w-6 h-6" />,
          <div className="space-y-6">
            {categories.map((category) => {
              const categoryTools = tools.filter((tool) => tool.category === category.id);
              const gridCols = categoryTools.length === 1
                ? 'grid-cols-1 md:grid-cols-1 lg:grid-cols-1 max-w-md'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

              return (
                <div key={category.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    {category.title}
                  </h3>
                  <div className={`grid ${gridCols} gap-4`}>
                    {categoryTools.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => setActiveModal(tool.id)}
                          className="group relative bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200 hover:shadow-lg text-left"
                        >
                          {/* Icon */}
                          <div className={`w-12 h-12 bg-gradient-to-br ${tool.color} rounded-lg flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>

                          {/* Content */}
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                            {tool.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {tool.description}
                          </p>

                          {/* Arrow indicator */}
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          </div>
        )}

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
      {activeModal === 'delete-tenant' && (
        <DeleteTestTenantModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'bulk-seed' && (
        <BulkSeedModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'bulk-clear' && (
        <BulkClearModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'cleanup-sessions' && (
        <CleanupScanSessionsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
