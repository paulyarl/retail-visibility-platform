/**
 * Quick Actions Component
 * 
 * Provides fast access to common inventory tasks:
 * - Add new product
 * - Bulk upload
 * - Barcode scanning
 * - Quick start AI
 * - Enhance products
 * - Manage variants
 * 
 * Following shop management dashboard patterns
 */

'use client';

import { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Camera, 
  Zap, 
  Sparkles, 
  Package,
  ExternalLink,
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';

interface QuickActionsProps {
  tenantId: string;
  onActionComplete?: () => void;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

export default function QuickActions({ tenantId, onActionComplete }: QuickActionsProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleAction = (action: QuickAction) => {
    if (action.comingSoon) {
      setSelectedAction(action.id);
      return;
    }

    if (action.onClick) {
      action.onClick();
    } else if (action.href) {
      window.location.href = action.href;
    }

    if (onActionComplete) {
      onActionComplete();
    }
  };

  const quickActions: QuickAction[] = [
    {
      id: 'add-product',
      title: 'Add Product',
      description: 'Create a new product manually',
      icon: <Plus className="h-5 w-5" />,
      badge: 'Primary',
      badgeVariant: 'default',
      href: `/t/${tenantId}/inventory/new`,
      disabled: false
    },
    {
      id: 'bulk-upload',
      title: 'Bulk Upload',
      description: 'Import multiple products at once',
      icon: <Upload className="h-5 w-5" />,
      badge: 'High Volume',
      badgeVariant: 'secondary',
      href: `/t/${tenantId}/inventory/bulk-upload`,
      disabled: false
    },
    {
      id: 'barcode-scan',
      title: 'Barcode Scan',
      description: 'Scan barcode to add products',
      icon: <Camera className="h-5 w-5" />,
      badge: 'AI-Powered',
      badgeVariant: 'secondary',
      href: `/t/${tenantId}/inventory/scan`,
      disabled: false
    },
    {
      id: 'quick-start',
      title: 'Quick Start',
      description: 'AI-powered catalog generation',
      icon: <Zap className="h-5 w-5" />,
      badge: 'Fastest',
      badgeVariant: 'default',
      href: `/t/${tenantId}/inventory/quick-start`,
      disabled: false
    },
    {
      id: 'enhance-products',
      title: 'Enhance Products',
      description: 'AI-powered content enhancement',
      icon: <Sparkles className="h-5 w-5" />,
      badge: 'Smart',
      badgeVariant: 'secondary',
      href: `/t/${tenantId}/inventory/enhance`,
      disabled: false
    },
    {
      id: 'manage-variants',
      title: 'Manage Variants',
      description: 'Advanced variant management',
      icon: <Package className="h-5 w-5" />,
      badge: 'Advanced',
      badgeVariant: 'secondary',
      href: `/t/${tenantId}/inventory/variants`,
      disabled: false
    },
    {
      id: 'pos-sync',
      title: 'POS Sync',
      description: 'Sync from POS systems',
      icon: <ExternalLink className="h-5 w-5" />,
      badge: 'Real-time',
      badgeVariant: 'secondary',
      href: `/t/${tenantId}/settings/integrations`,
      disabled: false
    }
  ];

  const getActionColor = (action: QuickAction) => {
    if (action.comingSoon) return 'border-gray-200 bg-gray-50';
    if (action.badge === 'Primary') return 'border-blue-200 bg-blue-50 hover:bg-blue-100';
    if (action.badge === 'Fastest') return 'border-green-200 bg-green-50 hover:bg-green-100';
    return 'border-gray-200 bg-white hover:bg-gray-50';
  };

  const getIconColor = (action: QuickAction) => {
    if (action.comingSoon) return 'text-gray-400';
    if (action.badge === 'Primary') return 'text-blue-600';
    if (action.badge === 'Fastest') return 'text-green-600';
    if (action.badge === 'AI-Powered') return 'text-purple-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        <p className="text-sm text-gray-500">Common inventory tasks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <div 
            key={action.id}
            className={`cursor-pointer transition-all duration-200 ${getActionColor(action)}`}
            onClick={() => handleAction(action)}
          >
            <Card className="w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${action.badge === 'Primary' ? 'bg-blue-100' : action.badge === 'Fastest' ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {action.icon}
                </div>
                {action.badge && (
                  <Badge variant="default" className="text-xs">
                    {action.badge}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base">{action.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-3">{action.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {action.comingSoon ? 'Coming Soon' : 'Available'}
                </span>
                <ArrowRight className={`h-4 w-4 ${getIconColor(action)}`} />
              </div>
            </CardContent>
          </Card>
          </div>
        ))}
      </div>

      {/* Coming Soon Dialog */}
      <Dialog open={selectedAction !== null} onOpenChange={(open: boolean) => !open && setSelectedAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feature Coming Soon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAction && (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  {quickActions.find(a => a.id === selectedAction)?.icon}
                </div>
                <h3 className="text-lg font-semibold">
                  {quickActions.find(a => a.id === selectedAction)?.title}
                </h3>
                <p className="text-gray-600">
                  {quickActions.find(a => a.id === selectedAction)?.description}
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  This feature is currently under development and will be available soon.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setSelectedAction(null)}>
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
