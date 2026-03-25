export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  storeLogo?: string;
  storeName?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
    picture?: string;
  } | null;
}

/**
 * Dashboard Header Component
 * Displays page title and optional subtitle with store branding
 * Reusable across all dashboards
 */
export default function DashboardHeader({ title, subtitle, storeLogo, storeName, user }: DashboardHeaderProps) {
  const displayName = user
    ? user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email
    : null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Store Logo */}
          {storeLogo ? (
            <img
              src={storeLogo}
              alt={storeName || 'Store Logo'}
              className="h-16 w-16 object-contain rounded-lg border border-neutral-200 bg-white"
              loading="lazy"
              decoding="async"
              width="64"
              height="64"
              style={{ aspectRatio: '1/1' }}
              onError={(e) => {
                // Hide broken images and show fallback
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="h-16 w-16 bg-neutral-200 rounded-lg border border-neutral-300 flex items-center justify-center">
              <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          
          {/* Title Section */}
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-neutral-600">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* User Badge */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
            {user.picture ? (
              <img 
                src={user.picture} 
                alt={displayName || 'User'}
                className="w-10 h-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {displayName?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{displayName}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
