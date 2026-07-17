/**
 * Location Availability Section
 * 
 * Displays product availability across multiple locations with distance,
 * stock status, and pricing. Supports organization-scoped queries.
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Box,
  Card,
  Text,
  Group,
  Badge,
  Stack,
  Button,
  Skeleton,
  Alert,
  Collapse,
  ActionIcon,
  Tooltip,
  ThemeIcon,
  Divider,
  Avatar
} from '@mantine/core';
import {
  IconMapPin,
  IconPackage,
  IconClock,
  IconChevronDown,
  IconChevronUp,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconTruck,
  IconBuildingStore
} from '@tabler/icons-react';
import { locationAvailabilityService, LocationAvailability, MultiLocationAvailability } from '@/services/LocationAvailabilityService';
import { clientLogger } from '@/lib/client-logger';

interface LocationAvailabilitySectionProps {
  productSlug: string;
  slugType?: string;
  productName: string;
  organizationId?: string;
  preferredTenantId?: string;
  onLocationSelect?: (location: LocationAvailability) => void;
  showMap?: boolean;
  maxDistance?: number;
  maxResults?: number;
  useSmartFallback?: boolean; // Enable slug -> SKU fallback
}

export function LocationAvailabilitySection({
  productSlug,
  slugType,
  productName,
  organizationId,
  preferredTenantId,
  onLocationSelect,
  showMap = false,
  maxDistance = 50,
  maxResults = 10,
  useSmartFallback = false
}: LocationAvailabilitySectionProps) {
  const [availability, setAvailability] = useState<MultiLocationAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          // User denied or error - continue without location
          console.log('Location permission denied or unavailable');
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!productSlug) return;

    const fetchAvailability = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use smart fallback if enabled (provides backward compatibility)
        const result = useSmartFallback && !slugType
          ? await locationAvailabilityService.getAvailabilityWithFallback(
              productSlug,
              userLocation || undefined,
              {
                maxDistance,
                maxResults,
                includeOutOfStock: true,
                preferredTenantId,
                organizationId,
                sortBy: 'distance'
              }
            )
          : await locationAvailabilityService.getProductAvailability(
              productSlug,
              userLocation || undefined,
              {
                maxDistance,
                maxResults,
                includeOutOfStock: true,
                preferredTenantId,
                organizationId,
                sortBy: 'distance'
              }
            );

        setAvailability(result);
      } catch (err) {
        clientLogger.error('Error fetching availability:', { detail: err });
        setError('Unable to load availability information');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [productSlug, userLocation, maxDistance, maxResults, preferredTenantId, organizationId]);

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'green';
      case 'limited':
        return 'yellow';
      case 'out_of_stock':
        return 'red';
      case 'backordered':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getAvailabilityLabel = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'In Stock';
      case 'limited':
        return 'Limited Stock';
      case 'out_of_stock':
        return 'Out of Stock';
      case 'backordered':
        return 'Backordered';
      default:
        return 'Unknown';
    }
  };

  const formatDistance = (distance: number) => {
    if (distance >= 999) return 'Distance unknown';
    // if (distance >= 999) return '';
    return `${distance.toFixed(1)} mi away`;
  };

  const formatPrice = (priceCents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(priceCents / 100);
  };

  if (loading) {
    return (
      <Card withBorder p="md">
        <Stack gap="sm">
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={80} />
        </Stack>
      </Card>
    );
  }

  if (error) {
    // Silently fail - don't show error for this component
    return null;
  }

  // Get the current/preferred tenant location for distance display
  const currentLocation = availability?.locations.find(
    loc => loc.tenantId === preferredTenantId
  );

  // Filter out the current/preferred tenant - only show OTHER locations
  const otherLocations = availability?.locations.filter(
    loc => loc.tenantId !== preferredTenantId
  ) || [];

  // Don't render if no availability data at all
  if (!availability || availability.locations.length === 0) {
    return null;
  }

  // If only the current location exists, show a simple distance display
  if (otherLocations.length === 0 && currentLocation) {
    const hasUserLocation = userLocation && currentLocation.distance < 999;
    
    return (
      <Card withBorder p="md" className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <Group justify="space-between">
          <Group>
            <ThemeIcon color="blue" variant="light" size="lg">
              <IconMapPin size={20} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="sm">Product Proximity</Text>
              {hasUserLocation ? (
                <Text size="xs" c="dimmed">
                  {formatDistance(currentLocation.distance)} from you
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  {currentLocation.city}{currentLocation.address ? `, ${currentLocation.address}` : ''}
                </Text>
              )}
            </Box>
          </Group>
          {currentLocation.availability === 'in_stock' && (
            <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
              In Stock
            </Badge>
          )}
        </Group>
      </Card>
    );
  }

  const summary = locationAvailabilityService.getAvailabilitySummary(otherLocations);

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group>
          <ThemeIcon color="blue" variant="light" size="lg">
            <IconMapPin size={20} />
          </ThemeIcon>
          <Box>
            <Text fw={600}>Availability Near You</Text>
            <Text size="sm" c="dimmed">
              {summary.inStock + summary.limited} of {summary.total} locations have stock
            </Text>
          </Box>
        </Group>
        <ActionIcon
          variant="subtle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
        </ActionIcon>
      </Group>

      <Collapse expanded={expanded}>
        <Stack gap="xs">
          {availability?.nearestAvailable && availability?.nearestAvailable.tenantId !== preferredTenantId && (
            <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
              <Group justify="space-between">
                <Box>
                  <Text size="sm" fw={500}>Nearest Available</Text>
                  <Text size="xs" c="dimmed">
                    {availability?.nearestAvailable.tenantName} • {formatDistance(availability?.nearestAvailable.distance)}
                  </Text>
                </Box>
                <Badge color="green">
                  {availability?.nearestAvailable.stock} in stock
                </Badge>
              </Group>
            </Alert>
          )}

          <Divider my="xs" />

          {otherLocations.map((location, index) => (
            <LocationCard
              key={`${location.tenantId}-${location.locationId || index}`}
              location={location}
              onSelect={onLocationSelect}
              isPreferred={location.isPreferred}
              isNearest={location.isNearest}
              formatDistance={formatDistance}
              formatPrice={formatPrice}
              getAvailabilityColor={getAvailabilityColor}
              getAvailabilityLabel={getAvailabilityLabel}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

interface LocationCardProps {
  location: LocationAvailability;
  onSelect?: (location: LocationAvailability) => void;
  isPreferred?: boolean;
  isNearest?: boolean;
  formatDistance: (d: number) => string;
  formatPrice: (p: number, c: string) => string;
  getAvailabilityColor: (s: string) => string;
  getAvailabilityLabel: (s: string) => string;
}

/**
 * Generate storefront URL - uses tenantId as primary, slug as fallback
 */
function getStorefrontUrl(tenantId: string, tenantSlug?: string): string {
  // Primary: use tenantId
  // Secondary: use slug if available
  if (tenantSlug) {
    return `/directory/${tenantSlug}`;
  }
  return `/tenant/${tenantId}`;
}

function LocationCard({
  location,
  onSelect,
  isPreferred,
  isNearest,
  formatDistance,
  formatPrice,
  getAvailabilityColor,
  getAvailabilityLabel
}: LocationCardProps) {
  const isAvailable = location.availability === 'in_stock' || location.availability === 'limited';
  const storefrontUrl = getStorefrontUrl(location.tenantId, location.tenantSlug);

  return (
    <Card
      withBorder
      p="sm"
      style={{
        borderColor: isPreferred ? 'var(--mantine-color-blue-5)' : isNearest ? 'var(--mantine-color-green-5)' : undefined,
        borderWidth: isPreferred || isNearest ? 2 : 1
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Box style={{ flex: 1 }}>
          <Group gap="xs">
            <Link href={storefrontUrl}>
              <Avatar
                size="sm"
                radius="md"
                src={location.tenantLogo}
                alt={location.tenantName}
                style={{ cursor: 'pointer' }}
              >
                {!location.tenantLogo && (
                  <IconBuildingStore size={16} color="gray" />
                )}
              </Avatar>
            </Link>
            <Link 
              href={storefrontUrl}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Text 
                size="sm" 
                fw={500} 
                lineClamp={1}
                style={{ cursor: 'pointer' }}
                className="hover:underline"
              >
                {location.tenantName}
              </Text>
            </Link>
            {isPreferred && (
              <Badge size="xs" color="blue" variant="light">Preferred</Badge>
            )}
            {isNearest && !isPreferred && (
              <Badge size="xs" color="green" variant="light">Nearest</Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {location.address}, {location.city}
          </Text>
          <Group gap="md" mt={4}>
            <Text size="xs" c="dimmed">
              <IconMapPin size={12} style={{ marginRight: 4 }} />
              {formatDistance(location.distance)}
            </Text>
            <Text size="xs" fw={500}>
              {formatPrice(location.priceCents, location.currency)}
            </Text>
          </Group>
        </Box>

        <Stack gap={4} align="flex-end">
          <Badge
            color={getAvailabilityColor(location.availability)}
            variant="light"
          >
            {getAvailabilityLabel(location.availability)}
          </Badge>
          {isAvailable && (
            <Text size="xs" c="dimmed">
              {location.stock} available
            </Text>
          )}
          {onSelect && isAvailable && (
            <Button
              size="xs"
              variant="light"
              onClick={() => onSelect(location)}
            >
              Select
            </Button>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

export default LocationAvailabilitySection;
