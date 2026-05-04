"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button, TextInput, Select, Badge, Table, Tabs } from '@mantine/core';
import { Spinner } from '@/components/ui';
import { notifications } from '@mantine/notifications';
import PageHeader from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { adminCatalogService, GlobalCatalogProduct, CatalogStats, ProductDetail } from '@/services/AdminCatalogSingletonService';

export default function CatalogAdminPage() {
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [products, setProducts] = useState<GlobalCatalogProduct[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [slugType, setSlugType] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [brand, setBrand] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>('products');

  // Options
  const [brands, setBrands] = useState<Array<{ brand: string; product_count: number }>>([]);
  const [categories, setCategories] = useState<Array<{ category: string; product_count: number }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productsResult, statsResult, brandsResult, categoriesResult] = await Promise.all([
        adminCatalogService.getProducts({
          slugType: slugType as 'upc' | 'lpc' | undefined,
          status: status as 'active' | 'inactive' | 'pending' | undefined,
          brand: brand || undefined,
          search: search || undefined,
          page,
          limit: 50
        }),
        adminCatalogService.getCatalogStats(),
        adminCatalogService.getBrands(),
        adminCatalogService.getCategories()
      ]);

      if (productsResult) {
        setProducts(productsResult.products);
      }
      if (statsResult) {
        setStats(statsResult);
      }
      if (brandsResult) {
        setBrands(brandsResult);
      }
      if (categoriesResult) {
        setCategories(categoriesResult);
      }
    } catch (error) {
      console.error('Failed to load catalog data:', error);
    } finally {
      setLoading(false);
    }
  }, [slugType, status, brand, search, page]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, loadData]);

  const handleViewProduct = async (productSlug: string) => {
    setDetailLoading(true);
    try {
      const detail = await adminCatalogService.getProductDetail(productSlug);
      if (detail) {
        setSelectedProduct(detail);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load product details',
        color: 'red'
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveProduct = async (productSlug: string) => {
    try {
      const success = await adminCatalogService.approveProduct(productSlug);
      if (success) {
        notifications.show({
          title: 'Success',
          message: 'Product approved successfully',
          color: 'green'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to approve product',
        color: 'red'
      });
    }
  };

  const handleRejectProduct = async (productSlug: string) => {
    try {
      const success = await adminCatalogService.rejectProduct(productSlug, 'Rejected by admin');
      if (success) {
        notifications.show({
          title: 'Success',
          message: 'Product rejected',
          color: 'orange'
        });
        loadData();
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to reject product',
        color: 'red'
      });
    }
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universal Product Catalog"
        description="Browse and manage the global product catalog"
        icon={
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.totalProducts}</div>
              <div className="text-sm text-gray-500">Products</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.upcProducts}</div>
              <div className="text-sm text-gray-500">UPC</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.lpcProducts}</div>
              <div className="text-sm text-gray-500">LPC</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalBrands}</div>
              <div className="text-sm text-gray-500">Brands</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">{stats.totalCategories}</div>
              <div className="text-sm text-gray-500">Categories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.activeProducts}</div>
              <div className="text-sm text-gray-500">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.pendingProducts}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{stats.merchantSourced}</div>
              <div className="text-sm text-gray-500">Merchant</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="products">Products</Tabs.Tab>
          <Tabs.Tab value="pending">Pending Review</Tabs.Tab>
          <Tabs.Tab value="top-adopted">Top Adopted</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="products" pt="md">
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <TextInput
                    label="Search"
                    placeholder="Search by name, brand, UPC..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select
                  label="Slug Type"
                  placeholder="All types"
                  value={slugType}
                  onChange={(value) => setSlugType(value || '')}
                  data={[
                    { value: '', label: 'All' },
                    { value: 'upc', label: 'UPC' },
                    { value: 'lpc', label: 'LPC' }
                  ]}
                  clearable
                />
                <Select
                  label="Status"
                  placeholder="All statuses"
                  value={status}
                  onChange={(value) => setStatus(value || '')}
                  data={[
                    { value: '', label: 'All' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'pending', label: 'Pending' }
                  ]}
                  clearable
                />
                <Select
                  label="Brand"
                  placeholder="All brands"
                  value={brand}
                  onChange={(value) => setBrand(value || '')}
                  data={[
                    { value: '', label: 'All' },
                    ...brands.slice(0, 50).map(b => ({ value: b.brand, label: `${b.brand} (${b.product_count})` }))
                  ]}
                  searchable
                  clearable
                />
                <Button onClick={loadData} loading={loading}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Catalog Products</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Spinner size="lg" />
                </div>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Brand</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>UPC</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {products.map((product) => (
                      <Table.Tr key={product.id}>
                        <Table.Td>
                          <div className="font-medium">{product.name}</div>
                          <code className="text-xs text-gray-400">{product.product_slug?.substring(0, 30)}...</code>
                        </Table.Td>
                        <Table.Td>{product.brand || '-'}</Table.Td>
                        <Table.Td>
                          {product.category_path?.[0] || '-'}
                        </Table.Td>
                        <Table.Td>
                          <code className="text-xs">{product.gtin_upc || '-'}</code>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={
                            product.status === 'active' ? 'green' :
                            product.status === 'pending' ? 'orange' : 'red'
                          }>
                            {product.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light">
                            {product.source}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => handleViewProduct(product.product_slug)}
                          >
                            View
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="pending" pt="md">
          <Card>
            <CardHeader>
              <CardTitle>Products Pending Review</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Brand</Table.Th>
                    <Table.Th>UPC</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {products.filter(p => p.status === 'pending').map((product) => (
                    <Table.Tr key={product.id}>
                      <Table.Td>{product.name}</Table.Td>
                      <Table.Td>{product.brand || '-'}</Table.Td>
                      <Table.Td><code className="text-xs">{product.gtin_upc || '-'}</code></Table.Td>
                      <Table.Td><Badge variant="light">{product.source}</Badge></Table.Td>
                      <Table.Td>
                        <div className="flex gap-2">
                          <Button size="xs" color="green" onClick={() => handleApproveProduct(product.product_slug)}>
                            Approve
                          </Button>
                          <Button size="xs" color="red" onClick={() => handleRejectProduct(product.product_slug)}>
                            Reject
                          </Button>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </CardContent>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="top-adopted" pt="md">
          <Card>
            <CardHeader>
              <CardTitle>Most Adopted Products</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Slug</Table.Th>
                    <Table.Th>Adoptions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {stats?.topAdoptedProducts?.map((product) => (
                    <Table.Tr key={product.product_slug}>
                      <Table.Td>{product.name}</Table.Td>
                      <Table.Td>
                        <code className="text-xs">{product.product_slug?.substring(0, 40)}...</code>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="blue">{product.adoption_count}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </CardContent>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selectedProduct.name}</CardTitle>
              <Button variant="subtle" onClick={() => setSelectedProduct(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Brand</label>
                  <div className="mt-1">{selectedProduct.brand || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">UPC/GTIN</label>
                  <div className="mt-1 font-mono">{selectedProduct.gtin_upc || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <div className="mt-1">{selectedProduct.category_path?.join(' > ') || '-'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge color={selectedProduct.status === 'active' ? 'green' : 'orange'}>
                      {selectedProduct.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Source</label>
                  <div className="mt-1">{selectedProduct.source}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Adoption Count</label>
                  <div className="mt-1 font-bold text-blue-600">{selectedProduct.adoption_count}</div>
                </div>
              </div>

              {selectedProduct.slug_components && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Slug Components</label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-gray-500">Type:</span> <strong>{selectedProduct.slug_components.type.toUpperCase()}</strong></div>
                      <div><span className="text-gray-500">Category:</span> <strong>{selectedProduct.slug_components.category}</strong></div>
                      <div><span className="text-gray-500">Hash:</span> <code>{selectedProduct.slug_components.name_hash}</code></div>
                      {selectedProduct.slug_components.sku && (
                        <div><span className="text-gray-500">SKU:</span> <strong>{selectedProduct.slug_components.sku}</strong></div>
                      )}
                      {selectedProduct.slug_components.brand && (
                        <div><span className="text-gray-500">Brand:</span> <strong>{selectedProduct.slug_components.brand}</strong></div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedProduct.registry_entries && selectedProduct.registry_entries.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Registry Entries (Tenants)</label>
                  <div className="mt-2 space-y-2">
                    {selectedProduct.registry_entries.slice(0, 10).map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{entry.tenant_name}</span>
                        <span className="text-sm text-gray-500">{entry.original_sku || '-'}</span>
                      </div>
                    ))}
                    {selectedProduct.registry_entries.length > 10 && (
                      <div className="text-sm text-gray-500 text-center">
                        +{selectedProduct.registry_entries.length - 10} more tenants
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
