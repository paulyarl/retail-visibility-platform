'use client';

import { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';

interface CloverDemoModeToggleProps {
  tenantId: string;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function CloverDemoModeToggle({
  tenantId,
  isEnabled,
  onToggle,
  disabled = false,
  className,
}: CloverDemoModeToggleProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      await onToggle(checked);
    } catch (error) {
      console.error('Failed to toggle demo mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isEnabled ? 'primary' : 'secondary'}
      size="sm"
      onClick={() => handleToggle(!isEnabled)}
      disabled={disabled || isLoading}
      className={cn(
        'gap-2',
        isEnabled && 'bg-amber-600 hover:bg-amber-700',
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Package className="h-4 w-4" />
      )}
      <span>
        {isEnabled ? 'Demo Mode Active' : 'Enable Demo Mode'}
      </span>
    </Button>
  );
}
