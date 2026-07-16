'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import customerAddressesService, { 
  CustomerAddress, 
  CreateAddressInput 
} from '@/services/CustomerAddressesService';
import { AddressCard } from '@/components/customer/AddressCard';
import { AddressForm } from '@/components/customer/AddressForm';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

export default function AddressesPage() {
  const { customer } = useCustomerAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const result = await customerAddressesService.listAddresses();
      if (result.success && result.addresses) {
        setAddresses(result.addresses);
      }
    } catch (error) {
      clientLogger.error('Failed to load addresses:', { detail: error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingAddress(null);
    setShowForm(true);
  };

  const handleEdit = (address: CustomerAddress) => {
    setEditingAddress(address);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const result = await customerAddressesService.deleteAddress(id);
      if (result.success) {
        setAddresses(prev => prev.filter(a => a.id !== id));
      } else {
        alert('Failed to delete address: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      clientLogger.error('Failed to delete address:', { detail: error });
      alert('Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const result = await customerAddressesService.setDefaultAddress(id);
      if (result.success && result.address) {
        // Update addresses list
        setAddresses(prev => 
          prev.map(a => ({
            ...a,
            isDefault: a.id === id
          }))
        );
      } else {
        alert('Failed to set default address: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      clientLogger.error('Failed to set default address:', { detail: error });
      alert('Failed to set default address');
    }
  };

  const handleSave = async (data: CreateAddressInput) => {
    setIsSaving(true);
    try {
      if (editingAddress) {
        // Update existing
        const result = await customerAddressesService.updateAddress(editingAddress.id, data);
        if (result.success && result.address) {
          setAddresses(prev => 
            prev.map(a => a.id === editingAddress.id ? result.address! : a)
          );
          setShowForm(false);
          setEditingAddress(null);
        } else {
          alert('Failed to update address: ' + (result.error || 'Unknown error'));
        }
      } else {
        // Create new
        const result = await customerAddressesService.createAddress(data);
        if (result.success && result.address) {
          setAddresses(prev => [...prev, result.address!]);
          setShowForm(false);
        } else {
          alert('Failed to create address: ' + (result.error || 'Unknown error'));
        }
      }
    } catch (error) {
      clientLogger.error('Failed to save address:', { detail: error });
      alert('Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAddress(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900"> Addresses</h1>
          <p className="text-gray-600 mt-1">Manage your shipping and billing addresses</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" />
          <MapPin className="w-4 h-4 mr-2" />
          Add Address
        </Button>
      </div>

      {/* Address List */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No saved addresses</p>
              <Button onClick={handleAddNew}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Address
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Form Modal */}
      {showForm && (
        <AddressForm
          address={editingAddress}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
