'use client';

import { Shield, User, Crown } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function UserRoleBadge() {
  const [user, setUser] = useState<any>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // TODO: Fetch actual user data from API
    // For now, using mock data
    setUser({
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'platform_admin',
      permissions: ['manage_all', 'create_tenants', 'view_analytics'],
    });
  }, []);

  if (!user) return null;

  const roleConfig = {
    platform_admin: {
      label: 'Platform Admin',
      icon: Crown,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      textColor: 'text-purple-700 dark:text-purple-300',
    },
    tenant_admin: {
      label: 'Tenant Admin',
      icon: Shield,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-300',
    },
    user: {
      label: 'User',
      icon: User,
      color: 'from-gray-500 to-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
      textColor: 'text-gray-700 dark:text-gray-300',
    },
  };

  const config = roleConfig[user.role as keyof typeof roleConfig] || roleConfig.user;
  const Icon = config.icon;

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor} hover:opacity-80 transition-opacity`}
      >
        <div className={`w-8 h-8 bg-gradient-to-br ${config.color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="hidden md:block text-left">
          <div className="text-xs font-semibold text-gray-900 dark:text-white">
            {user.name}
          </div>
          <div className={`text-xs ${config.textColor}`}>
            {config.label}
          </div>
        </div>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className={`w-10 h-10 bg-gradient-to-br ${config.color} rounded-lg flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {user.name}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {user.email}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Role
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.bgColor} ${config.textColor} text-xs font-medium`}>
              <Icon className="w-3 h-3" />
              {config.label}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Permissions
            </div>
            <div className="space-y-1">
              {user.permissions.map((perm: string) => (
                <div key={perm} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>{perm.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
