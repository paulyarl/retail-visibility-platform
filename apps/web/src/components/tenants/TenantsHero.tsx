'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Search,
  Building2,
  Network,
  Store,
  CheckCircle,
} from 'lucide-react';
import type {
  ChainFilterValue,
  StatusFilterValue,
} from './types';

interface StatChipProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
  onClick: () => void;
}

function StatChip({ icon, value, label, accent, onClick }: StatChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
        accent
          ? 'bg-white/20 hover:bg-white/30'
          : 'bg-white/10 hover:bg-white/20'
      }`}
    >
      {icon}
      <span className="font-semibold">{value}</span>
      <span className="text-white/70">{label}</span>
    </button>
  );
}

interface TenantsHeroProps {
  totalCount: number;
  chainCount: number;
  standaloneCount: number;
  activeCount: number;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRefresh: () => void;
  onCreateClick: () => void;
  setChainFilter: (v: ChainFilterValue) => void;
  setStatusFilter: (v: StatusFilterValue) => void;
  resetFilters: () => void;
}

export function TenantsHero({
  totalCount,
  chainCount,
  standaloneCount,
  activeCount,
  loading,
  searchQuery,
  setSearchQuery,
  onRefresh,
  onCreateClick,
  setChainFilter,
  setStatusFilter,
  resetFilters,
}: TenantsHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 text-white">
      {/* Decorative orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-white/80 mt-1">
              Manage your stores and business locations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />{' '}
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              onClick={onCreateClick}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-white text-indigo-700 rounded-lg hover:bg-white/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Location
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
            />
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <StatChip
            icon={<Building2 className="w-4 h-4" />}
            value={totalCount}
            label="total"
            onClick={resetFilters}
          />
          <StatChip
            icon={<Network className="w-4 h-4" />}
            value={chainCount}
            label="chain"
            onClick={() => setChainFilter('chain')}
          />
          <StatChip
            icon={<Store className="w-4 h-4" />}
            value={standaloneCount}
            label="standalone"
            onClick={() => setChainFilter('standalone')}
          />
          <StatChip
            icon={<CheckCircle className="w-4 h-4" />}
            value={activeCount}
            label="active"
            accent
            onClick={() => setStatusFilter('active')}
          />
        </div>
      </div>
    </section>
  );
}
