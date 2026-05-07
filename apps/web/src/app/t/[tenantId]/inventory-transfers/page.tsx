/**
 * Inventory Transfers Page
 * 
 * Main page for the inventory transfer dashboard
 * Provides access to transfer management, analytics, and inventory overview
 */

import React from 'react';
import { Container, Title, Stack } from '@mantine/core';
import InventoryTransferDashboard from '@/components/dashboard/InventoryTransferDashboard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inventory Transfers | Dashboard',
  description: 'Manage cross-location inventory transfers, view analytics, and monitor inventory levels',
};

export default function InventoryTransfersPage() {
  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <InventoryTransferDashboard />
      </Stack>
    </Container>
  );
}
