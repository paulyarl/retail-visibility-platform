'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Shield, User, Building2, Crown } from 'lucide-react';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function TenantAccountPage() {
  const { tenantId } = useParams();
  const { user } = useAuth();

  // Get current tenant info
  const currentTenant = useMemo(() => {
    if (!user?.tenants || !tenantId) return null;
    return user.tenants.find(t => t.id === tenantId as string);
  }, [user, tenantId]);

  if (!user || !currentTenant) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Account"
          description="Your account information and tenant privileges"
          icon={Icons.Settings}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-600 dark:text-neutral-400">Loading account information...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getTenantRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'SUPPORT':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'MEMBER':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getTenantRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-5 h-5" />;
      case 'ADMIN':
        return <Shield className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getTenantRoleDescription = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Full tenant ownership and control';
      case 'ADMIN':
        return 'Administrative access to tenant';
      case 'SUPPORT':
        return 'Support access to tenant';
      case 'MEMBER':
        return 'Standard team member access';
      case 'VIEWER':
        return 'Read-only access to tenant';
      default:
        return 'Tenant team member';
    }
  };

  const getTenantPrivileges = (role: string) => {
    switch (role) {
      case 'OWNER':
        return [
          'Full tenant ownership and control',
          'Manage tenant settings and configuration',
          'Invite and manage team members',
          'Configure store branding and appearance',
          'Access all tenant features and data',
          'View tenant analytics and reports',
          'Manage subscription and billing',
          'Transfer ownership to other users',
        ];
      case 'ADMIN':
        return [
          'Administrative access to tenant',
          'Manage tenant settings and configuration',
          'Invite and manage team members',
          'Configure store branding and appearance',
          'Access all tenant features and data',
          'View tenant analytics and reports',
        ];
      case 'SUPPORT':
        return [
          'Support access to tenant',
          'View tenant data and configuration',
          'Access support and troubleshooting tools',
          'Limited configuration changes',
          'View tenant analytics',
        ];
      case 'MEMBER':
        return [
          'Standard team member access',
          'Manage products and inventory',
          'Update business information',
          'View tenant analytics',
          'Access standard tenant features',
        ];
      case 'VIEWER':
        return [
          'Read-only access to tenant',
          'View products and inventory',
          'View tenant settings and configuration',
          'View tenant analytics and reports',
          'Cannot modify any data',
        ];
      default:
        return ['Basic tenant access'];
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Account"
        description="Your account information and tenant privileges"
        icon={Icons.Settings}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        <SubscriptionStatusGuide />

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your basic account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.email}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">First Name</p>
                <p className="text-base text-gray-900 dark:text-white">{user.firstName || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Name</p>
                <p className="text-base text-gray-900 dark:text-white">{user.lastName || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</p>
                <p className="text-base text-gray-900 dark:text-white">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">User ID</p>
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400">{user.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Tenant */}
        <Card>
          <CardHeader>
            <CardTitle>Current Tenant</CardTitle>
            <CardDescription>The tenant you're currently managing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{currentTenant.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tenant ID: {currentTenant.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tenant Role & Privileges */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Role & Privileges</CardTitle>
            <CardDescription>Your access level and permissions for this tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tenant Role */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Tenant Role</p>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${getTenantRoleBadgeColor(currentTenant.role)}`}>
                  {getTenantRoleIcon(currentTenant.role)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{currentTenant.role}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{getTenantRoleDescription(currentTenant.role)}</p>
                </div>
              </div>
            </div>

            {/* Tenant Privileges */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Tenant Privileges</p>
              <ul className="space-y-2">
                {getTenantPrivileges(currentTenant.role).map((privilege, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{privilege}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* SKU Usage & Current Plan */}
        <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your account health and activity for this tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Account Active</p>
                  <p className="text-xs text-green-700 dark:text-green-300">Active in this tenant</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Authenticated</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Access verified for this tenant</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
