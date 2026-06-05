"use client";

import { useState, useEffect } from 'react';
import { Container, Grid, Select, Text, Group, Badge, Pagination, Button, Stack } from '@mantine/core';
import { ProductBucket } from './BucketSection';

interface ProductCategoryOption {
  value: string;
  label: string;
  count: number;
}

interface TrendingProductsContainerProps {
  trendingProducts: any[];
  loading: boolean;
  error: string | null;
}

export function TrendingProductsContainer({ trendingProducts, loading, error }: TrendingProductsContainerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [productCategories, setProductCategories] = useState<ProductCategoryOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 1; // Show 1 product at a time for gallery experience

  // Extract product categories with counts
  useEffect(() => {
    if (!trendingProducts.length) {
      setProductCategories([{ value: 'all', label: 'All Categories', count: 0 }]);
      return;
    }

    // Extract distinct product categories with counts
    const productCategoryMap = new Map<string, number>();
    trendingProducts.forEach(product => {
      const category = product.categoryName || product.category_name || 'General';
      productCategoryMap.set(category, (productCategoryMap.get(category) || 0) + 1);
    });
    
    // Build category options
    const categoryOptions: ProductCategoryOption[] = [
      { value: 'all', label: 'All Categories', count: trendingProducts.length },
      ...Array.from(productCategoryMap.entries())
        .map(([name, count]) => ({ value: name, label: name, count }))
        .sort((a, b) => a.label.localeCompare(b.label))
    ];
    
    setProductCategories(categoryOptions);
  }, [trendingProducts]);

  // Reset page when category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory]);

  // Filter products based on selected category
  const getFilteredProducts = () => {
    if (selectedCategory === 'all') return trendingProducts;
    
    return trendingProducts.filter(product => {
      const productCategory = product.categoryName || product.category_name || 'General';
      return productCategory === selectedCategory;
    });
  };

  const filteredProducts = getFilteredProducts();
  const selectedCategoryData = productCategories.find(cat => cat.value === selectedCategory);
  
  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + productsPerPage);
  
  // Show pagination only when "All Categories" and more than productsPerPage items
  const showPagination = selectedCategory === 'all' && filteredProducts.length > productsPerPage;
  
  // Get current product for gallery display
  const currentProduct = showPagination ? paginatedProducts[0] : (filteredProducts[0] || null);

  return (
    <Container size="xl" py="md">
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Group mb="md">
            <Select
              label="Product Categories"
              placeholder="Select category"
              data={productCategories.map(cat => ({
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
                {selectedCategoryData.count} products
              </Badge>
            </Group>
          )}
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 9 }}>
          <ProductBucket
            products={currentProduct ? [currentProduct] : []}
            loading={loading}
            error={error}
            title="🔥 Trending Products"
            subtitle={selectedCategory === 'all' 
              ? showPagination 
                ? `Product ${currentPage} of ${totalPages}: ${currentProduct?.name || 'Featured Product'}`
                : currentProduct?.name || "Featured Product"
              : `${selectedCategory}: ${currentProduct?.name || 'Featured Product'}`
            }
            maxItems={1}
            onProductClick={(product) => {
              console.log('Product clicked:', product);
              // Handle product click
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
                  Product {currentPage} of {totalPages}
                </Text>
                <Text size="sm" c="blue" fw={500}>
                  {currentProduct?.name || 'Loading...'}
                </Text>
              </Group>
              <Button 
                variant="light" 
                size="sm"
                onClick={() => setCurrentPage(prev => prev < totalPages ? prev + 1 : 1)}
              >
                Next Product →
              </Button>
            </Stack>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
}
