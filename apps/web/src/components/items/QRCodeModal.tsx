'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui';
import { QRCodeGenerator } from './QRCodeGenerator';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import type { SubscriptionTier } from '@/lib/qr-tiers';

interface QRCodeModalProps {
  isOpen: boolean;
  productUrl: string;
  productName: string;
  onClose: () => void;
  tenantId: string;
}

export function QRCodeModal(props: QRCodeModalProps) {
  console.log('[QRCodeModal] Component called with arguments:', arguments);
  console.log('[QRCodeModal] arguments[0]:', arguments[0]);
  console.log('[QRCodeModal] Full props object:', props);
  const { isOpen, onClose, productUrl, productName, tenantId } = props;
  console.log('[QRCodeModal] Destructured:', { isOpen, onClose, productUrl, productName, tenantId });
  
  // TEMPORARY: Hardcode tenantId to test tier system
  const actualTenantId = tenantId || 'tid-ej2um44f';
  console.log('[QRCodeModal] Using tenantId:', actualTenantId);
  
  const { tier, loading: tierLoading } = useTenantTier(actualTenantId);
  const tierId = tier?.effective?.id || null;
  console.log('[QRCodeModal] Tier from hook:', tier, 'tierId:', tierId);
  
  // Get tenant logo for enterprise users
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTenantLogo = async () => {
      if (tierId === 'enterprise' || tierId === 'organization' || tierId === 'professional') {
        try {
          const response = await fetch(`/api/tenants/${actualTenantId}/profile`);
          if (response.ok) {
            const profile = await response.json();
            setTenantLogo(profile.logo_url || null);
          }
        } catch (error) {
          console.warn('Failed to fetch tenant logo:', error);
        }
      }
    };
    
    fetchTenantLogo();
  }, [actualTenantId, tierId]);
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product QR Code"
      size="md"
    >
      <div className="p-6">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">{productName}</h3>
          <p className="text-sm text-neutral-600 break-all">{productUrl}</p>
        </div>
        
        <QRCodeGenerator 
          url={productUrl} 
          productName={productName}
          size={256}
          tenantId={actualTenantId}
          logoUrl={tenantLogo || undefined}
        />
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 How to use QR codes:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Print on flyers and business cards</li>
            <li>• Display in your store window</li>
            <li>• Add to product packaging</li>
            <li>• Share on social media posts</li>
            <li>• Include in email newsletters</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
