'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui';
import { QRCodeGenerator } from './QRCodeGenerator';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';

interface QRCodeModalProps {
  isOpen: boolean;
  productUrl: string;
  productName: string;
  onClose: () => void;
  tenantId: string;
}

export function QRCodeModal(props: QRCodeModalProps) {
  const { isOpen, onClose, productUrl, productName, tenantId } = props;
  
  const actualTenantId = tenantId || 'tid-ej2um44f';
  
  // Fetch tier and logo using singleton (10-min cache)
  const [tierId, setTierId] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTierAndLogo = async () => {
      try {
        setTierLoading(true);
        
        // Fetch tier and profile via new service (cached)
        const [tier, profile] = await Promise.all([
          publicTenantInfoService.getTenantTier(actualTenantId),
          publicTenantInfoService.getTenantProfile(actualTenantId)
        ]);
        
        if (tier) {
          const effectiveTierId = tier.effective?.id || tier.id;
          setTierId(effectiveTierId);
          
          // Set logo if professional or above
          if (effectiveTierId === 'enterprise' || effectiveTierId === 'organization' || effectiveTierId === 'chain_enterprise' || effectiveTierId === 'professional' || effectiveTierId === 'chain_professional') {
            setTenantLogo(profile?.logo_url || null);
          }
        }
      } catch (error) {
        console.error('[QRCodeModal] Error fetching tier:', error);
      } finally {
        setTierLoading(false);
      }
    };
    
    if (isOpen && actualTenantId) {
      fetchTierAndLogo();
    }
  }, [actualTenantId, isOpen]);
  
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
