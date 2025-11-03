'use client';

import { useRouter } from 'next/navigation';
import { Rocket, Package, Sparkles, ArrowRight } from 'lucide-react';

interface QuickStartEmptyStateProps {
  tenantId: string;
}

export default function QuickStartEmptyState({ tenantId }: QuickStartEmptyStateProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border-2 border-dashed border-blue-200 dark:border-blue-800">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Package className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            No Products Yet
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Get started fast with our Quick Start wizard or add products manually
          </p>

          {/* Quick Start CTA */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  Quick Start
                  <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Generate 25-100 pre-built products in 1 second! Perfect for getting started quickly. 
                  All products are created as drafts so you can customize them before publishing.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>4 business types</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Auto-categorized</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <span>Realistic data</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/t/${tenantId}/quick-start`)}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <Rocket className="w-4 h-4" />
                  Start Quick Setup
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Manual Option */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Or add products manually
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add products one by one with full control over every detail
            </p>
            <button
              onClick={() => router.push(`/t/${tenantId}/items/new`)}
              className="w-full sm:w-auto bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-2.5 px-5 rounded-lg transition-all duration-200 border border-gray-200 dark:border-gray-600"
            >
              Add Product Manually
            </button>
          </div>
        </div>

        {/* Help Text */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          💡 Tip: Quick Start creates products as drafts. Review and activate them when ready!
        </p>
      </div>
    </div>
  );
}
