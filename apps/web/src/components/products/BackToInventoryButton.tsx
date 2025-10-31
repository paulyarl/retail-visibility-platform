"use client";

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Button } from '@/components/ui';

interface BackToInventoryButtonProps {
  tenantId: string;
  className?: string;
}

export function BackToInventoryButton({ tenantId, className = '' }: BackToInventoryButtonProps) {
  const { isAuthenticated } = useAuth();
  
  // Only show for authenticated users
  if (!isAuthenticated) return null;
  
  return (
    <div className={`mb-4 ${className}`}>
      <Link href={`/items?tenantId=${tenantId}`}>
        <Button variant="ghost" size="sm">
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Inventory
        </Button>
      </Link>
    </div>
  );
}

export default BackToInventoryButton;
