export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  storeLogo?: string;
  storeName?: string;
}

/**
 * Dashboard Header Component
 * Displays page title and optional subtitle with store branding
 * Reusable across all dashboards
 */
export default function DashboardHeader({ title, subtitle, storeLogo, storeName }: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-4">
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
    </div>
  );
}
