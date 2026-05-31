'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@mantine/core';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn-select';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import customerAddressesService, { CustomerAddress } from '@/services/CustomerAddressesService';
import { MapPin, Plus, Check, Edit, Trash2 } from 'lucide-react';

type ShippingAddressFormData = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  recipientName?: string;
  phone?: string;
  saveAddress?: boolean;
  label?: string;
};

interface ShippingAddressFormWithSavedProps {
  initialData?: ShippingAddressFormData | null;
  onSubmit: (data: ShippingAddressFormData, isNew?: boolean) => void;
  selectedAddressId?: string | null;
  onAddressSelect?: (addressId: string | null) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const ADDRESS_LABELS = ['Home', 'Work', 'Other'];

export function ShippingAddressFormWithSaved({
  initialData,
  onSubmit,
  selectedAddressId,
  onAddressSelect
}: ShippingAddressFormWithSavedProps) {
  const { customer, isAuthenticated } = useCustomerAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  const form = useForm<ShippingAddressFormData>({
    defaultValues: initialData || {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      recipientName: '',
      phone: '',
      saveAddress: isAuthenticated ? true : false,
      label: 'Home',
    },
  });

  // Load saved addresses when authenticated
  useEffect(() => {
    if (isAuthenticated && customer) {
      loadAddresses();
    }
  }, [isAuthenticated, customer]);

  // Set form values when editing an address
  useEffect(() => {
    if (editingAddress) {
      form.reset({
        addressLine1: editingAddress.addressLine1,
        addressLine2: editingAddress.addressLine2 || '',
        city: editingAddress.city,
        state: editingAddress.state,
        postalCode: editingAddress.postalCode,
        country: editingAddress.country,
        recipientName: editingAddress.recipientName || '',
        phone: editingAddress.phone || '',
        label: editingAddress.label || 'Home',
        saveAddress: true,
      });
      setShowNewAddressForm(true);
    }
  }, [editingAddress, form]);

  const loadAddresses = async () => {
    setIsLoadingAddresses(true);
    try {
      const result = await customerAddressesService.listAddresses();
      if (result.success && result.addresses) {
        setAddresses(result.addresses);
      }
    } catch (error) {
      console.error('[ShippingAddressForm] Failed to load addresses:', error);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleAddressSelect = (addressId: string) => {
    const address = addresses.find(a => a.id === addressId);
    if (address) {
      // Populate form with selected address data
      form.reset({
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || '',
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        recipientName: address.recipientName || '',
        phone: address.phone || '',
        saveAddress: false, // Don't overwrite saved address
        label: address.label || 'Home',
      });
      setShowNewAddressForm(false);
      onAddressSelect?.(addressId);
    }
  };

  const handleNewAddress = () => {
    setEditingAddress(null);
    form.reset({
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      recipientName: customer?.firstName && customer?.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : '',
      phone: customer?.phone || '',
      saveAddress: isAuthenticated ? true : false,
      label: 'Home',
    });
    setShowNewAddressForm(true);
    onAddressSelect?.(null);
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingAddress(address);
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const result = await customerAddressesService.deleteAddress(addressId);
      if (result.success) {
        setAddresses(addresses.filter(a => a.id !== addressId));
        if (selectedAddressId === addressId) {
          onAddressSelect?.(null);
        }
      }
    } catch (error) {
      console.error('[ShippingAddressForm] Failed to delete address:', error);
    }
  };

  const handleSubmit = async (data: ShippingAddressFormData) => {
    setIsSubmitting(true);
    try {
      // If authenticated and saveAddress is true, create/update the address
      if (isAuthenticated && data.saveAddress && !editingAddress) {
        const createResult = await customerAddressesService.createAddress({
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          recipientName: data.recipientName,
          phone: data.phone,
          label: data.label,
        });

        if (createResult.success && createResult.address) {
          setAddresses([...addresses, createResult.address]);
          onAddressSelect?.(createResult.address.id);
        }
      } else if (isAuthenticated && data.saveAddress && editingAddress) {
        const updateResult = await customerAddressesService.updateAddress(editingAddress.id, {
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
          recipientName: data.recipientName,
          phone: data.phone,
          label: data.label,
        });

        if (updateResult.success && updateResult.address) {
          setAddresses(addresses.map(a => a.id === editingAddress.id ? updateResult.address! : a));
          setEditingAddress(null);
          setShowNewAddressForm(false);
        }
      }

      onSubmit(data, !editingAddress);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (isLoadingAddresses) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saved Addresses Section */}
      {isAuthenticated && addresses.length > 0 && !showNewAddressForm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Saved Addresses
            </h3>
            <Button
              style={{ color: 'white' }}
              variant="gradient"
              size="sm"
              onClick={handleNewAddress}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Address
            </Button>
          </div>

          <div className="space-y-2">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedAddressId === address.id
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => handleAddressSelect(address.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {selectedAddressId === address.id && (
                      <Check className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {address.label && (
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                            {address.label}
                          </span>
                        )}
                        {address.isDefault && (
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">
                        {address.recipientName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {address.addressLine1}
                        {address.addressLine2 && `, ${address.addressLine2}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {address.city}, {address.state} {address.postalCode}
                      </p>
                      {address.phone && (
                        <p className="text-sm text-gray-500">{address.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAddress(address);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAddress(address.id);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Address Form */}
      {(!isAuthenticated || addresses.length === 0 || showNewAddressForm) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">
              {editingAddress ? 'Edit Address' : isAuthenticated ? 'Add New Address' : 'Shipping Address'}
            </h3>
            {isAuthenticated && !editingAddress && addresses.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewAddressForm(false);
                  setEditingAddress(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Save Address Option */}
              {isAuthenticated && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveAddress"
                      {...form.register('saveAddress')}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="saveAddress" className="text-sm text-blue-700">
                      Save this address to my profile
                    </label>
                  </div>
                </div>
              )}

              {/* Address Label (only when saving) */}
              {isAuthenticated && form.watch('saveAddress') && (
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Label</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a label" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ADDRESS_LABELS.map((label) => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Recipient Name */}
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Fields */}
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2 (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="US">United States</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                style={{ color: 'white' }}
                variant="gradient"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Processing...'
                  : editingAddress
                    ? 'Update Address'
                    : 'Continue to Payment'
                }
              </Button>
            </form>
          </Form>
        </div>
      )}

      {/* Add New Address Button (when authenticated with no addresses) */}
      {isAuthenticated && addresses.length === 0 && !showNewAddressForm && (
        <Button
          style={{ color: 'white' }}
          variant="gradient"
          onClick={handleNewAddress}
          className="w-full flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Shipping Address
        </Button>
      )}
    </div>
  );
}
