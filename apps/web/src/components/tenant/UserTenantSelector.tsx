'use client';

import { useState, useEffect } from 'react';
import { Select, Text, Group, Stack, Box, LoadingOverlay } from '@mantine/core';
import { IconBuilding, IconUsers } from '@tabler/icons-react';
import { itemsSingletonService } from '@/services/ItemsSingletonService';

interface UserTenantSelectorProps {
  selectedTenant?: string | null;
  onTenantSelect: (tenantId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface UserTenant {
  id: string;
  name: string;
  slug?: string;
  role?: string;
}

export function UserTenantSelector({
  selectedTenant,
  onTenantSelect,
  placeholder = "Select a tenant...",
  disabled = false
}: UserTenantSelectorProps) {
  const [tenants, setTenants] = useState<UserTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserTenants();
  }, []);

  const loadUserTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user's accessible tenants
      const userTenants = await itemsSingletonService.getUserTenants();
      console.log('[UserTenantSelector] Raw userTenants:', userTenants);
      
      // Ensure we have an array
      const tenantsArray = Array.isArray(userTenants) ? userTenants : 
                          (userTenants?.data && Array.isArray(userTenants.data)) ? userTenants.data : [];
      
      console.log('[UserTenantSelector] Tenants array:', tenantsArray);
      setTenants(tenantsArray);
    } catch (error) {
      console.error('Failed to load user tenants:', error);
      setError('Failed to load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  // Transform tenants for Select component
  const selectData = Array.isArray(tenants) ? tenants.map(tenant => ({
    value: tenant.id,
    label: tenant.name,
    description: tenant.slug ? `@${tenant.slug}` : undefined,
  })) : [];

  if (loading) {
    return (
      <Box pos="relative">
        <Select
          disabled
          placeholder="Loading tenants..."
          data={[]}
          rightSection={<LoadingOverlay visible />}
        />
      </Box>
    );
  }

  if (error) {
    return (
      <Select
        disabled
        placeholder={error}
        data={[]}
        error
      />
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <Select
        disabled
        placeholder="No tenants available"
        data={[]}
      />
    );
  }

  return (
    <Select
      value={selectedTenant}
      onChange={(value) => onTenantSelect(value || null)}
      placeholder={placeholder}
      data={selectData}
      disabled={disabled}
      searchable
      clearable
      maxDropdownHeight={200}
      leftSection={<IconBuilding size={16} />}
      description={selectedTenant ? `Selected: ${(tenants || []).find(t => t.id === selectedTenant)?.name}` : undefined}
    />
  );
}
