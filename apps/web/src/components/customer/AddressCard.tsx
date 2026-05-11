'use client';

import { MapPin, Edit, Trash2, Star, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CustomerAddress } from '@/services/CustomerAddressesService';

interface AddressCardProps {
  address: CustomerAddress;
  onEdit: (address: CustomerAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function AddressCard({ address, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  return (
    <div className="relative border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
      {/* Default Badge */}
      {address.isDefault && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Star className="w-3 h-3" />
            Default
          </span>
        </div>
      )}

      {/* Billing Badge */}
      {address.isBilling && (
        <div className="absolute top-2 right-20">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="w-3 h-3" />
            Billing
          </span>
        </div>
      )}

      {/* Address Info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          {address.label && (
            <p className="text-sm font-medium text-gray-900 mb-1">{address.label}</p>
          )}
          {address.recipientName && (
            <p className="text-sm font-medium text-gray-900">{address.recipientName}</p>
          )}
          <p className="text-sm text-gray-600">
            {address.addressLine1}
            {address.addressLine2 && <>, {address.addressLine2}</>}
          </p>
          <p className="text-sm text-gray-600">
            {address.city}, {address.state} {address.postalCode}
          </p>
          <p className="text-sm text-gray-600">{address.country}</p>
          {address.phone && (
            <p className="text-sm text-gray-500 mt-1">{address.phone}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(address)}
          className="flex items-center gap-1"
        >
          <Edit className="w-4 h-4" />
          Edit
        </Button>
        {!address.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetDefault(address.id)}
            className="flex items-center gap-1"
          >
            <Star className="w-4 h-4" />
            Set Default
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(address.id)}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}
