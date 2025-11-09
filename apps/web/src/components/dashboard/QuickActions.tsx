import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";

export interface QuickActionsProps {
  tenantId: string;
  canManageSettings?: boolean;
}

/**
 * Quick Actions Component
 * Displays action cards for common tenant operations
 * Reusable across tenant dashboards
 */
export default function QuickActions({ tenantId, canManageSettings = false }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Manage Inventory */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Manage Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600 mb-4">
            View and edit your product catalog
          </p>
          <Link href={`/t/${tenantId}/items`}>
            <Button className="w-full">View Items</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Scan Products */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Scan Products</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-600 mb-4">
            Add items by scanning barcodes
          </p>
          <Link href={`/t/${tenantId}/scan`}>
            <Button className="w-full">Start Scanning</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Settings (conditional) */}
      {canManageSettings && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-4">
              Configure your store settings
            </p>
            <Link href={`/t/${tenantId}/settings`}>
              <Button className="w-full">Manage Settings</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
