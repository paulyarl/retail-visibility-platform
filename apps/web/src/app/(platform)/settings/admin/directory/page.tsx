'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { List, Star, Palette, Building2, CheckCircle, FileEdit, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface DirectorySummary {
  total: number;
  published: number;
  draft: number;
  featured: number;
}

export default function DirectoryPanelPage() {
  const [summary, setSummary] = useState<DirectorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await platformHomeService.getAdminDirectoryListings({});
        if (data) {
          const listings = data.listings || [];
          setSummary({
            total: listings.length,
            published: listings.filter((l: any) => l.is_published).length,
            draft: listings.filter((l: any) => !l.is_published).length,
            featured: listings.filter((l: any) => l.is_featured).length,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load directory summary');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const statCards = [
    { label: 'Total Listings', value: summary?.total ?? '—', icon: Building2, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Published', value: summary?.published ?? '—', icon: CheckCircle, color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    { label: 'Drafts', value: summary?.draft ?? '—', icon: FileEdit, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    { label: 'Featured', value: summary?.featured ?? '—', icon: Star, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
  ];

  const navCards = [
    {
      href: '/settings/admin/directory/listings',
      title: 'All Directory Listings',
      description: 'View, filter, and manage directory listings across all tenants. Feature or unfeature listings.',
      icon: List,
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      href: '/settings/admin/directory/featured',
      title: 'Premium Featured Products',
      description: 'Platform-controlled featured product algorithms and performance analytics.',
      icon: TrendingUp,
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      href: '/settings/admin/directory/appearance',
      title: 'Directory Home Appearance',
      description: 'Choose the layout variant for the public directory home page. Platform-wide setting.',
      icon: Palette,
      gradient: 'from-teal-500 to-cyan-500',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Directory Panel"
        description="Manage directory listings, featured products, and appearance settings"
      />

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? (
                  <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {navCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${card.gradient} mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{card.description}</p>
              <div className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                Open →
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
