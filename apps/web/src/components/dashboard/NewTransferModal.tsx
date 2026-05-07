"use client";

import React, { useState, useEffect } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Stack,
  Group,
  Title,
  Text,
  Divider,
  Alert,
  Loader,
  Center
} from '@mantine/core';
import { IconAlertTriangle, IconPackage, IconMapPin } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { inventoryTransferService } from '@/services/InventoryTransferService';
import type { LocationInventory } from '@/services/InventoryTransferService';

interface NewTransferModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

interface TransferFormData {
  sku: string;
  quantity: number;
  targetLocationId: string;
  notes: string;
  trackingNumber?: string;
  estimatedArrival?: string;
}

interface TransferFormErrors {
  sku?: string;
  quantity?: string;
  targetLocationId?: string;
  notes?: string;
}

export default function NewTransferModal({ opened, onClose, onSuccess, tenantId }: NewTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<LocationInventory[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [formData, setFormData] = useState<TransferFormData>({
    sku: '',
    quantity: 1,
    targetLocationId: '',
    notes: ''
  });
  const [errors, setErrors] = useState<TransferFormErrors>({});

  // Load available inventory and locations when modal opens
  useEffect(() => {
    if (opened && tenantId) {
      loadTransferData();
    }
  }, [opened, tenantId]);

  const loadTransferData = async () => {
    try {
      setLoading(true);
      
      console.log('[NewTransferModal] Loading data for tenantId:', tenantId);
      
      // Load current location inventory (tenant's own items)
      const inventoryData = await inventoryTransferService.getLocationInventory(tenantId, tenantId);
      
      // Filter to only show items that actually have available quantity
      const availableInventory = inventoryData.filter(item => item.availableQuantity > 0);
      setInventory(availableInventory);

      // Get tenant's own locations from transfers
      const transfersData = await inventoryTransferService.getTransfers(tenantId);
      const tenantLocations = new Set<string>();
      
      // Add current tenant location
      tenantLocations.add(tenantId);
      
      // Only add locations that belong to this tenant (where tenant is source)
      transfersData.forEach(transfer => {
        if (transfer.sourceLocationId === tenantId && transfer.targetLocationId) {
          tenantLocations.add(transfer.targetLocationId);
        }
        // Also include locations where this tenant is target (for return transfers)
        if (transfer.targetLocationId === tenantId && transfer.sourceLocationId) {
          tenantLocations.add(transfer.sourceLocationId);
        }
      });

      // Remove current tenant from target options (can't transfer to self)
      const availableLocations = Array.from(tenantLocations).filter(loc => loc !== tenantId);
      
      console.log(`[NewTransferModal] Found ${availableInventory.length} available items and ${availableLocations.length} target locations for tenant ${tenantId}`);
      
      setLocations(availableLocations);

    } catch (error) {
      console.error('Failed to load transfer data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load inventory data',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: TransferFormErrors = {};

    if (!formData.sku) {
      newErrors.sku = 'SKU is required';
    }

    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1';
    }

    if (!formData.targetLocationId) {
      newErrors.targetLocationId = 'Target location is required';
    }

    // Check if enough inventory is available
    const selectedInventory = inventory.find(item => item.sku === formData.sku);
    if (selectedInventory && formData.quantity > selectedInventory.availableQuantity) {
      newErrors.quantity = `Only ${selectedInventory.availableQuantity} units available`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const result = await inventoryTransferService.createTransfer(tenantId, {
        sourceLocationId: tenantId,
        targetLocationId: formData.targetLocationId,
        sku: formData.sku,
        quantity: formData.quantity,
        notes: formData.notes
      });

      notifications.show({
        title: 'Success',
        message: 'Transfer created successfully',
        color: 'green'
      });

      // Reset form and close modal
      setFormData({
        sku: '',
        quantity: 1,
        targetLocationId: '',
        notes: ''
      });
      setErrors({});
      
      onClose();
      onSuccess(); // Refresh parent data

    } catch (error: any) {
      console.error('Failed to create transfer:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create transfer',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const availableSKUs = inventory.map(item => ({
    value: item.sku,
    label: `${item.sku} (${item.availableQuantity} available)`,
    availableQuantity: item.availableQuantity
  }));

  const selectedSKU = availableSKUs.find(sku => sku.value === formData.sku);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPackage size={18} />
          <Text>Create New Transfer</Text>
        </Group>
      }
      size="md"
    >
      {loading ? (
        <Center>
          <Loader size="lg" />
        </Center>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* SKU Selection */}
            <Select
              label="Product SKU (Your Inventory)"
              placeholder="Select product to transfer"
              description="Only showing items you currently have in stock"
              data={availableSKUs}
              value={formData.sku}
              onChange={(value) => setFormData({ ...formData, sku: value || '' })}
              error={errors.sku}
              leftSection={<IconPackage size={16} />}
              searchable
              required
              disabled={availableSKUs.length === 0}
            />

            {availableSKUs.length === 0 && (
              <Alert color="yellow" variant="light">
                <Group gap="xs">
                  <IconAlertTriangle size={14} />
                  <Text size="sm">
                    No available inventory found. You can only transfer items you currently have in stock.
                  </Text>
                </Group>
              </Alert>
            )}

            {/* Quantity Input */}
            <NumberInput
              label="Quantity"
              placeholder="Enter quantity"
              description="Cannot exceed available stock"
              value={formData.quantity}
              onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 0 })}
              error={errors.quantity}
              min={1}
              max={selectedSKU?.availableQuantity || 1}
              required
              disabled={!selectedSKU}
            />

            {selectedSKU && (
              <Text size="sm" c="blue" fw={500}>
                Available: {selectedSKU.availableQuantity} units
              </Text>
            )}

            {/* Target Location */}
            <Select
              label="Target Location (Your Organization)"
              placeholder="Select destination location"
              description="Only locations within your organization are shown"
              data={locations.map(loc => ({
                value: loc,
                label: loc === tenantId ? `${loc} (Current Location)` : `${loc} (Organization Location)`
              }))}
              value={formData.targetLocationId}
              onChange={(value) => setFormData({ ...formData, targetLocationId: value || '' })}
              error={errors.targetLocationId}
              leftSection={<IconMapPin size={16} />}
              required
              disabled={locations.length === 0}
            />

            {locations.length === 0 && (
              <Alert color="yellow" variant="light">
                <Group gap="xs">
                  <IconAlertTriangle size={14} />
                  <Text size="sm">
                    No other locations found in your organization. Transfers can only be made between locations within your tenant.
                  </Text>
                </Group>
              </Alert>
            )}

            <Divider />

            {/* Notes */}
            <Textarea
              label="Notes (Optional)"
              placeholder="Add any notes about this transfer"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              minRows={3}
            />

            {/* Form Actions */}
            <Group justify="flex-end" gap="sm">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={!formData.sku || !formData.targetLocationId}
              >
                Create Transfer
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
