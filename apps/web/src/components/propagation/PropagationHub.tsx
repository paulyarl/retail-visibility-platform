'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';

interface PropagationHubProps {
  tenantId: string;
}

interface PropagationType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  impact: 'high' | 'medium' | 'low';
  frequency: 'daily' | 'weekly' | 'monthly';
  status: 'available' | 'coming_soon';
  route?: string;
  gradient: string;
}

export default function PropagationHub({ tenantId }: PropagationHubProps) {
  const { canAccess, loading: tierLoading } = useTenantTier(tenantId);
  const hasOrgAccess = canAccess('propagation', 'canManage'); // MANAGER+ only

  const propagationTypes: PropagationType[] = [
    {
      id: 'products',
      name: 'Product Propagation',
      description: 'Push entire products to all your locations instantly. Update once, available everywhere.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      impact: 'high',
      frequency: 'daily',
      status: 'available',
      route: `/t/${tenantId}/items`,
      gradient: 'from-blue-600 to-cyan-600'
    },
    {
      id: 'pricing',
      name: 'Price Propagation',
      description: 'Sync pricing across all locations. Perfect for chain-wide sales and promotions.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      impact: 'high',
      frequency: 'daily',
      status: 'coming_soon',
      gradient: 'from-green-600 to-emerald-600'
    },
    {
      id: 'settings',
      name: 'Settings Propagation',
      description: 'Apply configuration changes across all locations. Store hours, policies, and branding.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      impact: 'high',
      frequency: 'weekly',
      status: 'coming_soon',
      gradient: 'from-purple-600 to-pink-600'
    },
    {
      id: 'categories',
      name: 'Category Propagation',
      description: 'Standardize Google category assignments across your chain for consistent visibility.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      impact: 'medium',
      frequency: 'weekly',
      status: 'coming_soon',
      gradient: 'from-amber-600 to-orange-600'
    },
    {
      id: 'inventory',
      name: 'Inventory Sync',
      description: 'Share stock levels and transfer inventory between locations seamlessly.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      impact: 'medium',
      frequency: 'daily',
      status: 'coming_soon',
      gradient: 'from-indigo-600 to-blue-600'
    },
    {
      id: 'promotions',
      name: 'Promotion Propagation',
      description: 'Launch chain-wide promotions and sales. Coordinate marketing across all locations.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
      impact: 'high',
      frequency: 'monthly',
      status: 'coming_soon',
      gradient: 'from-rose-600 to-red-600'
    },
    {
      id: 'users',
      name: 'User Management',
      description: 'Add staff to multiple locations and manage roles across your organization.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      impact: 'medium',
      frequency: 'monthly',
      status: 'coming_soon',
      gradient: 'from-teal-600 to-cyan-600'
    },
    {
      id: 'templates',
      name: 'Template Sharing',
      description: 'Create and share product templates, descriptions, and SOPs across your chain.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      impact: 'medium',
      frequency: 'weekly',
      status: 'coming_soon',
      gradient: 'from-violet-600 to-purple-600'
    }
  ];

  // Sort by impact and frequency
  const sortedTypes = [...propagationTypes].sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const freqOrder = { daily: 0, weekly: 1, monthly: 2 };
    
    if (impactOrder[a.impact] !== impactOrder[b.impact]) {
      return impactOrder[a.impact] - impactOrder[b.impact];
    }
    return freqOrder[a.frequency] - freqOrder[b.frequency];
  });

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Chain Command Center"
        description="Update once, apply everywhere. Manage your entire organization from one place."
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIP Header */}
        <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-white/20 text-white border-white/30">ORGANIZATION TIER</Badge>
                <Badge className="bg-white/20 text-white border-white/30">VIP ACCESS</Badge>
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to Your Command Center</h2>
              <p className="text-blue-100">
                Manage all your locations from one powerful dashboard. Changes you make here can be instantly applied across your entire chain.
              </p>
            </div>
            <svg className="w-16 h-16 opacity-20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </div>
        </div>

        {/* Propagation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTypes.map((type) => (
            <Card 
              key={type.id}
              className={`hover:shadow-xl transition-all duration-200 ${
                type.status === 'available' ? 'border-2 border-blue-200 dark:border-blue-800' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${type.gradient} text-white`}>
                    {type.icon}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {type.impact === 'high' && (
                      <Badge variant="default" className="bg-red-100 text-red-800 text-[10px]">HIGH IMPACT</Badge>
                    )}
                    {type.status === 'coming_soon' ? (
                      <Badge variant="default" className="bg-amber-100 text-amber-800 text-[10px]">COMING SOON</Badge>
                    ) : (
                      <Badge variant="success" className="text-[10px]">AVAILABLE</Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg">{type.name}</CardTitle>
                <CardDescription className="text-sm">{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {type.frequency.charAt(0).toUpperCase() + type.frequency.slice(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {type.impact.charAt(0).toUpperCase() + type.impact.slice(1)} Impact
                  </span>
                </div>
                {type.status === 'available' ? (
                  <Button 
                    className={`w-full bg-gradient-to-r ${type.gradient} hover:opacity-90 text-white border-0`}
                    onClick={() => type.route && (window.location.href = type.route)}
                    disabled={!hasOrgAccess}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Launch
                  </Button>
                ) : (
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    disabled
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Help Section */}
        <Card className="mt-8 border-2 border-blue-100 dark:border-blue-900">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-2">How Propagation Works</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  Each propagation type lets you make changes once and apply them across all your locations instantly. 
                  You'll always have the option to select which locations receive the updates, giving you full control.
                </p>
                <div className="flex gap-3">
                  <Button size="sm" variant="secondary">
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    View Documentation
                  </Button>
                  <Button size="sm" variant="ghost">
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Watch Tutorial
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
