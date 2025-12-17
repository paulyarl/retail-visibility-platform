import { Badge } from '@/components/ui';
import { Tenant, DbTier } from '../types';

interface TenantCardProps {
  tenant: Tenant;
  tiers: DbTier[];
}

export default function TenantCard({ tenant, tiers }: TenantCardProps) {
  const tier = tiers.find((t) => t.tierKey === tenant.subscriptionTier);

  return (
    <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-1">
            <div className="font-bold text-primary-900 dark:text-primary-100">{tenant.name}</div>
          </div>
          {tenant.metadata?.city && tenant.metadata?.state && (
            <div className="text-sm text-neutral-600">
              {tenant.metadata.city}, {tenant.metadata.state}
            </div>
          )}
          {tenant.organization && (
            <div className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium mt-1">
              {tenant.organization.name}
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          {tier ? (
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {tier.displayName}
            </Badge>
          ) : (
            <Badge variant="default" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
              No Tier
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
