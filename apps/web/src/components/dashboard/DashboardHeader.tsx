export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Dashboard Header Component
 * Displays page title and optional subtitle
 * Reusable across all dashboards
 */
export default function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-neutral-900">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-neutral-600">
          {subtitle}
        </p>
      )}
    </div>
  );
}
