'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CustomerAddress, CreateAddressInput } from '@/services/CustomerAddressesService';
import { X, Save } from 'lucide-react';

interface AddressFormProps {
  address?: CustomerAddress | null;
  onSave: (data: CreateAddressInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AddressForm({ address, onSave, onCancel, isLoading }: AddressFormProps) {
  const [formData, setFormData] = useState<CreateAddressInput>({
    label: address?.label || '',
    isDefault: address?.isDefault || false,
    isBilling: address?.isBilling || false,
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'US',
    phone: address?.phone || '',
    recipientName: address?.recipientName || '',
    deliveryInstructions: address?.deliveryInstructions || '',
  });

  const handleChange = (field: keyof CreateAddressInput, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {address ? 'Edit Address' : 'Add New Address'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Label */}
          <div>
            <Label htmlFor="label">Label (e.g., Home, Work)</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => handleChange('label', e.target.value)}
              placeholder="Home"
            />
          </div>

          {/* Recipient Name */}
          <div>
            <Label htmlFor="recipientName">Recipient Name</Label>
            <Input
              id="recipientName"
              value={formData.recipientName}
              onChange={(e) => handleChange('recipientName', e.target.value)}
              placeholder="John Doe"
            />
          </div>

          {/* Address Line 1 */}
          <div>
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              value={formData.addressLine1}
              onChange={(e) => handleChange('addressLine1', e.target.value)}
              placeholder="123 Main Street"
              required
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input
              id="addressLine2"
              value={formData.addressLine2}
              onChange={(e) => handleChange('addressLine2', e.target.value)}
              placeholder="Apt 4B"
            />
          </div>

          {/* City, State, Postal Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="New York"
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="NY"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="10001"
                required
              />
            </div>
            <div>
              <Label htmlFor="country">Country *</Label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="555-123-4567"
              type="tel"
            />
          </div>

          {/* Delivery Instructions */}
          <div>
            <Label htmlFor="deliveryInstructions">Delivery Instructions</Label>
            <textarea
              id="deliveryInstructions"
              value={formData.deliveryInstructions}
              onChange={(e) => handleChange('deliveryInstructions', e.target.value)}
              placeholder="Leave at door, ring bell, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => handleChange('isDefault', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Default shipping address</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isBilling}
                onChange={(e) => handleChange('isBilling', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Billing address</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Address
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
