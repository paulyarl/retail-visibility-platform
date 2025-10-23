'use client';

import { Modal } from '@/components/ui';
import { QRCodeGenerator } from './QRCodeGenerator';
import type { SubscriptionTier } from '@/lib/qr-tiers';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  productUrl: string;
  productName: string;
  tier?: SubscriptionTier | string | null;
}

export function QRCodeModal({ isOpen, onClose, productUrl, productName, tier }: QRCodeModalProps) {
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
          tier={tier}
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
