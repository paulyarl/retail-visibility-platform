/**
 * Customer Addresses Service
 * 
 * Frontend service for customer shipping/billing address management
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import customerAuthService from './CustomerAuthService';

export interface CustomerAddress {
  id: string;
  label?: string;
  isDefault: boolean;
  isBilling: boolean;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  recipientName?: string;
  deliveryInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  label?: string;
  isDefault?: boolean;
  isBilling?: boolean;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  recipientName?: string;
  deliveryInstructions?: string;
}

export interface UpdateAddressInput extends Partial<CreateAddressInput> {}

class CustomerAddressesService extends PublicApiSingleton {
  private static instance: CustomerAddressesService;

  private constructor() {
    super('customer-addresses-service', { ttl: 60000 }); // 1 minute cache
  }

  static getInstance(): CustomerAddressesService {
    if (!CustomerAddressesService.instance) {
      CustomerAddressesService.instance = new CustomerAddressesService();
    }
    return CustomerAddressesService.instance;
  }

  /**
   * List all addresses for the current customer
   */
  async listAddresses(): Promise<{ success: boolean; addresses?: CustomerAddress[]; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        addresses: CustomerAddress[];
      }>(
        '/api/customer-addresses',
        {
          method: 'GET',
          credentials: 'include', // Send cookies
        },
        'customer-addresses-list'
      );

      if (result.success && result.data?.success) {
        return { success: true, addresses: result.data.addresses };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] List error:', error);
      return { success: false, error: 'Failed to list addresses' };
    }
  }

  /**
   * Get a specific address
   */
  async getAddress(id: string): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        address: CustomerAddress;
      }>(
        `/api/customer-addresses/${id}`,
        {
          method: 'GET',
          credentials: 'include', // Send cookies
        },
        `customer-addresses-get-${id}`
      );

      if (result.success && result.data?.success) {
        return { success: true, address: result.data.address };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] Get error:', error);
      return { success: false, error: 'Failed to get address' };
    }
  }

  /**
   * Create a new address
   */
  async createAddress(input: CreateAddressInput): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        address: CustomerAddress;
      }>(
        '/api/customer-addresses',
        {
          method: 'POST',
          credentials: 'include', // Send cookies
          body: JSON.stringify({
            label: input.label,
            isDefault: input.isDefault,
            isBilling: input.isBilling,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country,
            phone: input.phone,
            recipientName: input.recipientName,
            deliveryInstructions: input.deliveryInstructions,
          }),
        },
        'customer-addresses-create'
      );

      if (result.success && result.data?.success) {
        // Invalidate list cache
        await this.invalidateCache('customer-addresses-list');
        return { success: true, address: result.data.address };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] Create error:', error);
      return { success: false, error: 'Failed to create address' };
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(id: string, input: UpdateAddressInput): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        address: CustomerAddress;
      }>(
        `/api/customer-addresses/${id}`,
        {
          method: 'PUT',
          credentials: 'include', // Send cookies
          body: JSON.stringify({
            label: input.label,
            isDefault: input.isDefault,
            isBilling: input.isBilling,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country,
            phone: input.phone,
            recipientName: input.recipientName,
            deliveryInstructions: input.deliveryInstructions,
          }),
        },
        `customer-addresses-update-${id}`
      );

      if (result.success && result.data?.success) {
        // Invalidate list cache
        await this.invalidateCache('customer-addresses-list');
        return { success: true, address: result.data.address };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] Update error:', error);
      return { success: false, error: 'Failed to update address' };
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/api/customer-addresses/${id}`,
        {
          method: 'DELETE',
          credentials: 'include', // Send cookies
        },
        `customer-addresses-delete-${id}`
      );

      if (result.success && result.data?.success) {
        // Invalidate list cache
        await this.invalidateCache('customer-addresses-list');
        return { success: true };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] Delete error:', error);
      return { success: false, error: 'Failed to delete address' };
    }
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(id: string): Promise<{ success: boolean; address?: CustomerAddress; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        address: CustomerAddress;
      }>(
        `/api/customer-addresses/${id}/default`,
        {
          method: 'PUT',
          credentials: 'include', // Send cookies
        },
        `customer-addresses-default-${id}`
      );

      if (result.success && result.data?.success) {
        // Invalidate list cache
        await this.invalidateCache('customer-addresses-list');
        return { success: true, address: result.data.address };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerAddresses] Set default error:', error);
      return { success: false, error: 'Failed to set default address' };
    }
  }

  /**
   * Get the default address
   */
  async getDefaultAddress(): Promise<CustomerAddress | null> {
    const result = await this.listAddresses();
    if (!result.success || !result.addresses) return null;

    return result.addresses.find(a => a.isDefault) || result.addresses[0] || null;
  }
}

export const customerAddressesService = CustomerAddressesService.getInstance();
export default customerAddressesService;
