'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Shield, User, Building2, Crown } from 'lucide-react';
import TenantLimitBadge from '@/components/tenant/TenantLimitBadge';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';

export default function AccountPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Account"
          description="Your account information and privileges"
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'PLATFORM_SUPPORT':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'PLATFORM_VIEWER':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'OWNER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return <Shield className="w-5 h-5" />;
      case 'PLATFORM_SUPPORT':
        return <Shield className="w-5 h-5" />;
      case 'PLATFORM_VIEWER':
        return <Shield className="w-5 h-5" />;
      case 'OWNER':
        return <Crown className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return 'Full platform access';
      case 'PLATFORM_SUPPORT':
        return 'Support platform access';
      case 'PLATFORM_VIEWER':
        return 'Basic platform access';
      case 'OWNER':
        return 'Full tenant access';
      case 'USER':
        return 'Basic tenant access';
      default:
        return 'Platform user';
    }
  };

  const getPlatformPrivileges = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return [
          'Full platform access',
          'Manage all tenants and users',
          'Access platform administration',
          'Configure platform settings',
          'View all analytics and reports',
          'Manage feature flags',
          'Access admin tools',
        ];
      case 'PLATFORM_SUPPORT':
        return [
          'Support platform access',
          'View and manage tenants for support',
          'Access support tools',
          'View analytics and reports',
          'Test features across tenants',
          'Limited to 3 test locations globally',
        ];
      case 'PLATFORM_VIEWER':
        return [
          'Basic platform access',
          'Read-only access across all tenants',
          'View analytics and reports',
          'Monitor platform health',
          'Cannot create or modify data',
        ];
      case 'OWNER':
        return [
          'Full tenant access',
          'Manage tenant settings',
          'Invite and manage team members',
          'Configure store branding',
          'Access all tenant features',
          'View tenant analytics',
        ];
      case 'USER':
        return [
          'Basic tenant access',
          'Access assigned tenants',
          'Manage products and inventory',
          'View tenant analytics',
          'Update business hours',
        ];
      default:
        return ['Basic platform access'];
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Account"
        description="Your account information and privileges"
        icon={Icons.Settings}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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

        {/* Platform Role & Privileges */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Role & Privileges</CardTitle>
            <CardDescription>Your access level and permissions on the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Platform Role */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Platform Role</p>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${getRoleBadgeColor(user.role)}`}>
                  {getRoleIcon(user.role)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{user.role}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{getRoleDescription(user.role)}</p>
                </div>
              </div>
            </div>

            {/* Platform Privileges */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Platform Privileges</p>
              <ul className="space-y-2">
                {getPlatformPrivileges(user.role).map((privilege, index) => (
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

        {/* Location Capacity */}
        <Card>
          <CardHeader>
            <CardTitle>Location Capacity</CardTitle>
            <CardDescription>Your location creation limits based on your role and subscription tier</CardDescription>
          </CardHeader>
          <CardContent>
            <TenantLimitBadge variant="full" showUpgrade={true} />
          </CardContent>
        </Card>

        {/* SKU Usage & Current Plan */}
        <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

        {/* Tenant Access */}
        {user.tenants && user.tenants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tenant Access</CardTitle>
              <CardDescription>Stores and locations you have access to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {user.tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{tenant.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">{tenant.id}</p>
                      </div>
                    </div>
                    <Badge className={getRoleBadgeColor(tenant.role)}>
                      {tenant.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your account health and activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Account Active</p>
                  <p className="text-xs text-green-700 dark:text-green-300">All systems operational</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Secure</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Authentication verified</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
