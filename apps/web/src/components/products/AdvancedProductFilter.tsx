/**
 * Advanced Product Filter with Mantine UI
 * 
 * Comprehensive filtering system for products with multiple criteria
 * Uses Mantine components for professional filter interface
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  RangeSlider,
  Select,
  MultiSelect,
  Checkbox,
  Button,
  Badge,
  Divider,
  Collapse,
  ActionIcon,
  NumberInput,
  TextInput,
  Tooltip,
  ScrollArea
} from '@mantine/core';
import {
  IconFilter,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconRefresh
} from '@tabler/icons-react';

interface FilterOption {
  id: string;
  label: string;
  value: any; // Allow different types based on filter type
  type: 'select' | 'multiselect' | 'range' | 'checkbox' | 'number' | 'text';
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

interface FilterCategory {
  id: string;
  title: string;
  options: FilterOption[];
  defaultExpanded?: boolean;
}

interface AdvancedProductFilterProps {
  categories: FilterCategory[];
  onFiltersChange: (filters: Record<string, any>) => void;
  initialFilters?: Record<string, any>;
  className?: string;
}

const AdvancedProductFilter: React.FC<AdvancedProductFilterProps> = ({
  categories,
  onFiltersChange,
  initialFilters = {},
  className = ''
}) => {
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    categories.reduce((acc, cat) => ({
      ...acc,
      [cat.id]: cat.defaultExpanded ?? true
    }), {})
  );
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Calculate active filters count
  useEffect(() => {
    const count = Object.entries(filters).filter(([key, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        const range = value as [number, number];
        return range[0] !== undefined && range[1] !== undefined && 
               (range[0] !== 0 || range[1] !== 1000000);
      }
      return value !== '' && value !== null && value !== undefined;
    }).length;
    
    setActiveFiltersCount(count);
  }, [filters]);

  const handleFilterChange = (filterId: string, value: any) => {
    const newFilters = { ...filters, [filterId]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilter = (filterId: string) => {
    const newFilters = { ...filters };
    delete newFilters[filterId];
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onFiltersChange({});
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const renderFilterOption = (option: FilterOption) => {
    const value = filters[option.id];

    switch (option.type) {
      case 'select':
        return (
          <Select
            placeholder={`Select ${option.label}`}
            data={option.options || []}
            value={value || ''}
            onChange={(newValue) => handleFilterChange(option.id, newValue)}
            clearable
          />
        );

      case 'multiselect':
        return (
          <MultiSelect
            placeholder={`Select ${option.label}`}
            data={option.options || []}
            value={value || []}
            onChange={(newValue) => handleFilterChange(option.id, newValue)}
            clearable
            searchable
          />
        );

      case 'range':
        const rangeValue = (value as [number, number]) || [option.min || 0, option.max || 1000000];
        return (
          <div className="space-y-2">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                ${rangeValue[0].toLocaleString()} - ${rangeValue[1].toLocaleString()}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => handleFilterChange(option.id, [option.min || 0, option.max || 1000000])}
              >
                Reset
              </Button>
            </Group>
            <RangeSlider
              min={option.min || 0}
              max={option.max || 1000000}
              step={option.step || 1000}
              value={rangeValue}
              onChange={(newValue) => handleFilterChange(option.id, newValue)}
              label={(value) => `$${value.toLocaleString()}`}
            />
          </div>
        );

      case 'checkbox':
        return (
          <Checkbox
            label={option.label}
            checked={value || false}
            onChange={(event) => handleFilterChange(option.id, event.currentTarget.checked)}
          />
        );

      case 'number':
        return (
          <NumberInput
            placeholder={`Enter ${option.label}`}
            value={value || ''}
            onChange={(newValue) => handleFilterChange(option.id, newValue)}
            min={option.min}
            max={option.max}
            step={option.step}
          />
        );

      case 'text':
        return (
          <TextInput
            placeholder={`Search ${option.label}`}
            value={value || ''}
            onChange={(event) => handleFilterChange(option.id, event.target.value)}
            leftSection={<IconSearch size={16} />}
          />
        );

      default:
        return null;
    }
  };

  const getActiveFilterBadges = () => {
    const badges: Array<{ id: string; label: string; value: string }> = [];

    categories.forEach(category => {
      category.options.forEach(option => {
        const value = filters[option.id];
        if (!value) return;

        let displayValue = '';
        
        if (Array.isArray(value)) {
          if (value.length > 0) {
            displayValue = `${value.length} selected`;
          }
        } else if (typeof value === 'object' && value !== null) {
          const range = value as [number, number];
          displayValue = `$${range[0].toLocaleString()} - $${range[1].toLocaleString()}`;
        } else if (value !== '' && value !== null && value !== undefined) {
          displayValue = String(value);
        }

        if (displayValue) {
          badges.push({
            id: option.id,
            label: option.label,
            value: displayValue
          });
        }
      });
    });

    return badges;
  };

  return (
    <Card className={`p-6 ${className}`}>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <IconFilter size={20} />
            <Text size="lg" fw={600}>Filters</Text>
            {activeFiltersCount > 0 && (
              <Badge color="blue" variant="filled">
                {activeFiltersCount} active
              </Badge>
            )}
          </Group>
          
          <Group gap="xs">
            {activeFiltersCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                leftSection={<IconRefresh size={14} />}
                onClick={clearAllFilters}
              >
                Clear All
              </Button>
            )}
          </Group>
        </Group>

        {/* Active Filters */}
        {activeFiltersCount > 0 && (
          <div className="space-y-2">
            <Text size="sm" fw={500} c="dimmed">
              Active Filters
            </Text>
            <div className="flex flex-wrap gap-2">
              {getActiveFilterBadges().map(badge => (
                <Badge
                  key={badge.id}
                  color="blue"
                  variant="light"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="transparent"
                      onClick={() => clearFilter(badge.id)}
                    >
                      <IconX size={10} />
                    </ActionIcon>
                  }
                >
                  {badge.label}: {badge.value}
                </Badge>
              ))}
            </div>
            <Divider />
          </div>
        )}

        {/* Filter Categories */}
        <ScrollArea.Autosize mah={500}>
          <Stack gap="md">
            {categories.map(category => (
              <Card key={category.id} withBorder p="md">
                <div className="space-y-4">
                  {/* Category Header */}
                  <Button
                    variant="subtle"
                    fullWidth
                    justify="space-between"
                    onClick={() => toggleCategory(category.id)}
                    rightSection={
                      expandedCategories[category.id] 
                        ? <IconChevronUp size={16} />
                        : <IconChevronDown size={16} />
                    }
                  >
                    <Text fw={500}>{category.title}</Text>
                  </Button>

                  {/* Category Options */}
                  <Collapse expanded={expandedCategories[category.id]}>
                    <Stack gap="md">
                      {category.options.map(option => (
                        <div key={option.id} className="space-y-2">
                          <Text size="sm" fw={500}>
                            {option.label}
                          </Text>
                          {renderFilterOption(option)}
                        </div>
                      ))}
                    </Stack>
                  </Collapse>
                </div>
              </Card>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        {/* Footer Actions */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} applied
          </Text>
          
          <Tooltip label="Reset all filters to default">
            <ActionIcon
              variant="outline"
              onClick={clearAllFilters}
              disabled={activeFiltersCount === 0}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Card>
  );
};

// Example usage with predefined categories
export const exampleFilterCategories: FilterCategory[] = [
  {
    id: 'price',
    title: 'Price Range',
    defaultExpanded: true,
    options: [
      {
        id: 'price_range',
        label: 'Price',
        value: [0, 100000],
        type: 'range',
        min: 0,
        max: 100000,
        step: 1000
      }
    ]
  },
  {
    id: 'product_info',
    title: 'Product Information',
    defaultExpanded: true,
    options: [
      {
        id: 'category',
        label: 'Category',
        value: [],
        type: 'multiselect',
        options: [
          { value: 'electronics', label: 'Electronics' },
          { value: 'clothing', label: 'Clothing' },
          { value: 'books', label: 'Books' },
          { value: 'home', label: 'Home & Garden' },
          { value: 'sports', label: 'Sports & Outdoors' }
        ]
      },
      {
        id: 'condition',
        label: 'Condition',
        value: '',
        type: 'select',
        options: [
          { value: 'new', label: 'Brand New' },
          { value: 'like_new', label: 'Like New' },
          { value: 'good', label: 'Good' },
          { value: 'fair', label: 'Fair' }
        ]
      },
      {
        id: 'brand',
        label: 'Brand',
        value: [],
        type: 'multiselect',
        options: [
          { value: 'apple', label: 'Apple' },
          { value: 'samsung', label: 'Samsung' },
          { value: 'nike', label: 'Nike' },
          { value: 'adidas', label: 'Adidas' },
          { value: 'sony', label: 'Sony' }
        ]
      }
    ]
  },
  {
    id: 'features',
    title: 'Features',
    defaultExpanded: false,
    options: [
      {
        id: 'free_shipping',
        label: 'Free Shipping',
        value: false,
        type: 'checkbox'
      },
      {
        id: 'fast_delivery',
        label: 'Fast Delivery',
        value: false,
        type: 'checkbox'
      },
      {
        id: 'eco_friendly',
        label: 'Eco Friendly',
        value: false,
        type: 'checkbox'
      },
      {
        id: 'sale',
        label: 'On Sale',
        value: false,
        type: 'checkbox'
      }
    ]
  },
  {
    id: 'location',
    title: 'Location',
    defaultExpanded: false,
    options: [
      {
        id: 'distance',
        label: 'Distance (miles)',
        value: [0, 100],
        type: 'range',
        min: 0,
        max: 100,
        step: 5
      },
      {
        id: 'city',
        label: 'City',
        value: '',
        type: 'text'
      }
    ]
  },
  {
    id: 'ratings',
    title: 'Customer Ratings',
    defaultExpanded: false,
    options: [
      {
        id: 'min_rating',
        label: 'Minimum Rating',
        value: '',
        type: 'select',
        options: [
          { value: '4', label: '4+ Stars' },
          { value: '3', label: '3+ Stars' },
          { value: '2', label: '2+ Stars' },
          { value: '1', label: '1+ Stars' }
        ]
      },
      {
        id: 'verified_only',
        label: 'Verified Purchases Only',
        value: false,
        type: 'checkbox'
      }
    ]
  }
];

export default AdvancedProductFilter;
