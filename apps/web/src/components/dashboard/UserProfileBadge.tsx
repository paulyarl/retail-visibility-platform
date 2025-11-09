import { UserProfileData } from "@/hooks/useUserProfile";

export interface UserProfileBadgeProps {
  profile: UserProfileData;
  compact?: boolean;
}

/**
 * User Profile Badge Component
 * Shows user role, locations served, and context
 * Adapts display based on user's role and access level
 */
export default function UserProfileBadge({ profile, compact = false }: UserProfileBadgeProps) {
  const getRoleColor = (color: string) => {
    switch (color) {
      case 'purple':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'blue':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'green':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'amber':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  const getRoleIcon = (roleType: string) => {
    switch (roleType) {
      case 'PLATFORM_ADMIN':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'ORG_ADMIN':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'TENANT_ADMIN':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'TENANT_MANAGER':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Role Badge */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getRoleColor(profile.role.color)}`}>
          {getRoleIcon(profile.role.type)}
          <span>{profile.role.label}</span>
        </div>

        {/* Location Count */}
        {profile.locationsServed > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-full text-xs text-neutral-700">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span>{profile.locationsServed}</span>
          </div>
        )}
      </div>
    );
  }

  // Full display
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-lg">
          {profile.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-neutral-900 truncate">
              {profile.name}
            </h3>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${getRoleColor(profile.role.color)}`}>
              {getRoleIcon(profile.role.type)}
              <span>{profile.role.label}</span>
            </div>
          </div>

          {/* Context Info */}
          <div className="flex flex-wrap gap-2 text-xs">
            {/* Organization */}
            {profile.organizationName && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{profile.organizationName}</span>
              </div>
            )}

            {/* Tenants */}
            {profile.tenantsCount > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>{profile.tenantsCount} {profile.tenantsCount === 1 ? 'location' : 'locations'}</span>
              </div>
            )}

            {/* Locations Served */}
            {profile.locationsServed > profile.tenantsCount && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span>Serves {profile.locationsServed} total</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Access Summary (for admins) */}
      {(profile.isPlatformAdmin || profile.isOrgAdmin || profile.canManageTenants) && (
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <div className="flex flex-wrap gap-2 text-xs">
            {profile.isPlatformAdmin && (
              <span className="inline-flex items-center gap-1 text-purple-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Platform Access
              </span>
            )}
            {profile.canManageOrganization && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Manage Organization
              </span>
            )}
            {profile.canManageTenants && (
              <span className="inline-flex items-center gap-1 text-green-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Manage Locations
              </span>
            )}
            {profile.canManageUsers && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Manage Users
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
