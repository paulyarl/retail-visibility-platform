/**
 * Checkout Location Picker Component
 * 
 * Displays available pickup locations for multi-location checkout.
 * Shows nearest location by default with option to select different location.
 * Supports both deposit and full checkout flows.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Button,
  Radio,
  Badge,
  Skeleton,
  Alert,
  Box,
  ThemeIcon,
  Collapse,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconMapPin,
  IconBuildingStore,
  IconCheck,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconClock,
  IconPackage,
} from '@tabler/icons-react';
import { checkoutLocationService, CartItem, CheckoutLocation } from '@/services/CheckoutLocationService';

export interface CheckoutLocationPickerProps {
  items: CartItem[];
  organizationId?: string;
  preferredTenantId?: string;
  userLocation?: { latitude: number; longitude: number };
  onLocationSelect: (location: CheckoutLocation) => void;
  onAvailabilityChange?: (available: boolean) => void;
  checkoutMode?: 'deposit' | 'full';
  maxDistance?: number;
}

export function CheckoutLocationPicker({
  items,
  organizationId,
  preferredTenantId,
  userLocation,
  onLocationSelect,
  onAvailabilityChange,
  checkoutMode = 'full',
  maxDistance = 100,
}: CheckoutLocationPickerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkoutLocationService.findLocationsForCart>> | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [validating, setValidating] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const locationResult = await checkoutLocationService.findLocationsForCart(
        items,
        userLocation,
        {
          organizationId,
          preferredTenantId,
          maxDistance,
        }
      );

      setResult(locationResult);
      onAvailabilityChange?.(locationResult.allLocationsAvailable);

      // Auto-select nearest pickup location
      if (locationResult.nearestPickupLocation) {
        setSelectedTenantId(locationResult.nearestPickupLocation.tenantId);
        onLocationSelect(locationResult.nearestPickupLocation);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
      onAvailabilityChange?.(false);
    } finally {
      setLoading(false);
    }
  }, [items, userLocation, organizationId, preferredTenantId, maxDistance, onAvailabilityChange, onLocationSelect]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleLocationChange = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setValidating(true);

    // Find the selected location
    const selectedLocation = result?.items
      .flatMap(item => item.allLocations)
      .find(loc => loc.tenantId === tenantId);

    if (selectedLocation) {
      // Validate location has all items
      const validation = await checkoutLocationService.validateLocationForCart(tenantId, items);
      
      if (validation.valid) {
        onLocationSelect(selectedLocation);
      } else {
        setError(`This location is missing: ${validation.missingItems.join(', ')}`);
      }
    }

    setValidating(false);
  };

  const formatAddress = (location: CheckoutLocation) => {
    return checkoutLocationService.formatAddress(location);
  };

  const formatDistance = (distance: number) => {
    return checkoutLocationService.formatDistance(distance);
  };

  // Get unique locations from all items
  const uniqueLocations = React.useMemo(() => {
    if (!result) return [];
    
    const locationMap = new Map<string, CheckoutLocation>();
    result.items.forEach(item => {
      item.allLocations.forEach(loc => {
        if (!locationMap.has(loc.tenantId)) {
          locationMap.set(loc.tenantId, loc);
        }
      });
    });
    
    return Array.from(locationMap.values()).sort((a, b) => a.distance - b.distance);
  }, [result]);

  if (loading) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Skeleton height={20} width="60%" />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </Stack>
      </Paper>
    );
  }

  if (error && !result) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Text size="sm">{error}</Text>
        <Button size="xs" variant="light" mt="sm" onClick={loadLocations}>
          Try Again
        </Button>
      </Alert>
    );
  }

  if (!result || uniqueLocations.length === 0) {
    return (
      <Alert color="orange" icon={<IconAlertCircle size={16} />}>
        <Text size="sm" fw={500}>No pickup locations available</Text>
        <Text size="xs" c="dimmed">
          None of your cart items are available nearby. Try adjusting your location or removing items.
        </Text>
      </Alert>
    );
  }

  const nearestLocation = result.nearestPickupLocation;
  const hasMultipleLocations = uniqueLocations.length > 1;

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconMapPin size={14} />
            </ThemeIcon>
            <Text fw={500}>Pickup Location</Text>
            {hasMultipleLocations && (
              <Badge size="xs" variant="light" color="gray">
                {uniqueLocations.length} locations
              </Badge>
            )}
          </Group>
          <Tooltip label="Refresh locations">
            <ActionIcon variant="subtle" onClick={loadLocations} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Checkout mode info */}
        {checkoutMode === 'deposit' && (
          <Alert color="yellow" icon={<IconClock size={16} />} p="xs">
            <Text size="xs">
              Pay a deposit now, pick up within 48 hours and pay the remaining balance.
            </Text>
          </Alert>
        )}

        {/* Nearest location card */}
        {nearestLocation && (
          <Paper
            p="sm"
            withBorder
            style={{
              borderColor: selectedTenantId === nearestLocation.tenantId ? 'var(--mantine-color-blue-6)' : undefined,
              borderWidth: selectedTenantId === nearestLocation.tenantId ? 2 : 1,
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" style={{ flex: 1 }}>
                <ThemeIcon variant="light" color="green" size="lg">
                  <IconBuildingStore size={20} />
                </ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>{nearestLocation.tenantName}</Text>
                    {nearestLocation.isNearest && (
                      <Badge size="xs" variant="filled" color="green">Nearest</Badge>
                    )}
                    {nearestLocation.isPreferred && (
                      <Badge size="xs" variant="light" color="violet">Preferred</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">{formatAddress(nearestLocation)}</Text>
                  <Group gap="md">
                    <Text size="xs" c="dimmed">
                      <IconMapPin size={12} style={{ marginRight: 4 }} />
                      {formatDistance(nearestLocation.distance)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      <IconPackage size={12} style={{ marginRight: 4 }} />
                      {nearestLocation.stock} in stock
                    </Text>
                  </Group>
                </Stack>
              </Group>
              {selectedTenantId === nearestLocation.tenantId && (
                <ThemeIcon color="blue" variant="light">
                  <IconCheck size={16} />
                </ThemeIcon>
              )}
            </Group>
          </Paper>
        )}

        {/* Show more locations toggle */}
        {hasMultipleLocations && (
          <>
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => setShowAllLocations(!showAllLocations)}
              rightSection={showAllLocations ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            >
              {showAllLocations ? 'Hide other locations' : `Show ${uniqueLocations.length - 1} other locations`}
            </Button>

            <Collapse in={showAllLocations}>
              <Stack gap="xs">
                {uniqueLocations
                  .filter(loc => loc.tenantId !== nearestLocation?.tenantId)
                  .map(location => (
                    <Paper
                      key={location.tenantId}
                      p="sm"
                      withBorder
                      style={{
                        borderColor: selectedTenantId === location.tenantId ? 'var(--mantine-color-blue-6)' : undefined,
                        borderWidth: selectedTenantId === location.tenantId ? 2 : 1,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleLocationChange(location.tenantId)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" style={{ flex: 1 }}>
                          <ThemeIcon variant="light" color="gray" size="lg">
                            <IconBuildingStore size={20} />
                          </ThemeIcon>
                          <Stack gap={2} style={{ flex: 1 }}>
                            <Text size="sm" fw={500}>{location.tenantName}</Text>
                            <Text size="xs" c="dimmed">{formatAddress(location)}</Text>
                            <Group gap="md">
                              <Text size="xs" c="dimmed">
                                {formatDistance(location.distance)}
                              </Text>
                              <Text size="xs" c={location.hasLowStock ? 'orange' : 'dimmed'}>
                                {location.stock} in stock
                              </Text>
                            </Group>
                          </Stack>
                        </Group>
                        {selectedTenantId === location.tenantId && (
                          <ThemeIcon color="blue" variant="light">
                            <IconCheck size={16} />
                          </ThemeIcon>
                        )}
                      </Group>
                    </Paper>
                  ))}
              </Stack>
            </Collapse>
          </>
        )}

        {/* Availability warning */}
        {!result.allLocationsAvailable && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />} p="xs">
            <Text size="xs">
              Some items in your cart may not be available at all locations.
              The nearest location with most items is selected.
            </Text>
          </Alert>
        )}

        {/* Validation error */}
        {error && result && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} p="xs">
            <Text size="xs">{error}</Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export default CheckoutLocationPicker;
