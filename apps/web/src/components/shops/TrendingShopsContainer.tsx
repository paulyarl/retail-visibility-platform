"use client";

import { useState, useEffect } from 'react';
import { Container, Grid, Select, Text, Group, Badge, Pagination, Button, Stack } from '@mantine/core';
import { ShopBucket } from './BucketSection';

interface ShopCategoryOption {
  value: string;
  label: string;
  count: number;
}

interface TrendingShopsContainerProps {
  trendingShops: any[];
  loading: boolean;
  error: string | null;
}

export function TrendingShopsContainer({ trendingShops, loading, error }: TrendingShopsContainerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [shopCategories, setShopCategories] = useState<ShopCategoryOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const shopsPerPage = 1; // Show 1 shop at a time for gallery experience

  // Extract shop categories with counts
  useEffect(() => {
//    console.log('[TrendingShopsContainer] Received trendingShops:', trendingShops);
    
    if (!trendingShops.length) {
    //  console.log('[TrendingShopsContainer] No trending shops, setting empty categories');
      setShopCategories([{ value: 'all', label: 'All Categories', count: 0 }]);
      return;
    }

    // Log the first shop to see available fields
  /*   if (trendingShops.length > 0) {
      console.log('[TrendingShopsContainer] First shop fields:', Object.keys(trendingShops[0]));
      console.log('[TrendingShopsContainer] First shop data:', trendingShops[0]);
    } */

    // Extract distinct shop categories with counts
    const shopCategoryMap = new Map<string, number>();
   /*  trendingShops.forEach(shop => {
      console.log('[TrendingShopsContainer] Processing shop:', {
        primary_category: shop.primary_category,
        category: shop.category,
        shopCategory: shop.shopCategory,
        allFields: Object.keys(shop)
      });
      
      const category = shop.primary_category || shop.category || shop.shopCategory || 'General';
      shopCategoryMap.set(category, (shopCategoryMap.get(category) || 0) + 1);
    });
    
    console.log('[TrendingShopsContainer] Category map:', Array.from(shopCategoryMap.entries())); */
    
    // Build category options
    const categoryOptions: ShopCategoryOption[] = [
      { value: 'all', label: 'All Categories', count: trendingShops.length },
      ...Array.from(shopCategoryMap.entries())
        .map(([name, count]) => ({ value: name, label: name, count }))
        .sort((a, b) => a.label.localeCompare(b.label))
    ];
    
    //console.log('[TrendingShopsContainer] Final category options:', categoryOptions);
    setShopCategories(categoryOptions);
  }, [trendingShops]);

  // Reset page when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  // Filter shops based on selected category
  const getFilteredShops = () => {
    if (selectedCategory === 'all') return trendingShops;
    
    return trendingShops.filter(shop => {
      const shopCategory = shop.primary_category || shop.category || 'General';
      return shopCategory === selectedCategory;
    });
  };

  const filteredShops = getFilteredShops();
  const selectedCategoryData = shopCategories.find(cat => cat.value === selectedCategory);
  
  // Pagination logic
  const totalPages = Math.ceil(filteredShops.length / shopsPerPage);
  const startIndex = (currentPage - 1) * shopsPerPage;
  const paginatedShops = filteredShops.slice(startIndex, startIndex + shopsPerPage);
  
  // Show pagination only when "All Categories" and more than shopsPerPage items
  const showPagination = selectedCategory === 'all' && filteredShops.length > shopsPerPage;
  
  // Get current shop for gallery display
  const currentShop = showPagination ? paginatedShops[0] : (filteredShops[0] || null);

  return (
    <Container size="xl" py="md">
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Group mb="md">
            <Select
              label="Shop Categories"
              placeholder="Select category"
              data={shopCategories.map(cat => ({
                value: cat.value,
                label: `${cat.label} (${cat.count})`
              }))}
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value || 'all')}
              size="sm"
            />
          </Group>
          
          {selectedCategoryData && (
            <Group mb="md">
              <Badge size="lg" variant="light">
                {selectedCategoryData.count} shops
              </Badge>
            </Group>
          )}
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 9 }}>
          <ShopBucket
            shops={currentShop ? [currentShop] : []}
            loading={loading}
            error={error}
            title="🔥 Trending Shops"
            subtitle={selectedCategory === 'all' 
              ? showPagination 
                ? `Shop ${currentPage} of ${totalPages}: ${currentShop?.name || 'Featured Shop'}`
                : currentShop?.name || "Featured Shop"
              : `${selectedCategory}: ${currentShop?.name || 'Featured Shop'}`
            }
            maxItems={1}
            showViewAll={true}
            viewAllUrl="/shops?sort=trending"
            onShopClick={(shop) => {
              window.location.href = `/shops/${shop.id}`;
            }}
          />
          
          {/* Gallery-style Pagination Controls */}
          {showPagination && (
            <Stack gap="md" mt="xl" align="center">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size="lg"
                color="blue"
                siblings={1}
                boundaries={1}
              />
              <Group gap="xl">
                <Text size="sm" c="dimmed">
                  Shop {currentPage} of {totalPages}
                </Text>
                <Text size="sm" c="blue" fw={500}>
                  {currentShop?.name || 'Loading...'}
                </Text>
              </Group>
              <Button 
                variant="light" 
                size="sm"
                onClick={() => setCurrentPage(prev => prev < totalPages ? prev + 1 : 1)}
              >
                Next Shop →
              </Button>
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
}
