'use client';

import { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils'; 
import { Button } from '../ui/Button';
import { clientLogger } from '@/lib/client-logger';

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
      clientLogger.error('Failed to toggle demo mode:', { detail: error });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isEnabled ? 'default' : 'gradient'}
      size="md"
      onClick={() => handleToggle(!isEnabled)}
      disabled={disabled || isLoading}
      className={cn(
        'gap-2',
        isEnabled && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg',
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
