"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/useTranslation";
import { Card, Button, Badge, Text, Group, Stack, Table, ActionIcon, Modal, TextInput, Textarea, Switch, SimpleGrid, Select } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconEye, IconDownload, IconSettings } from '@tabler/icons-react';
import { digitalDownloadPagesService, type DownloadPage as ServiceDownloadPage, type GetPagesResult, type PreviewTokenResult } from '@/services/DigitalDownloadPagesSingletonService';
import { useAuth } from "@/contexts/AuthContext";
import { notifications } from '@mantine/notifications';
import PageHeader from "@/components/PageHeader";
import { ItemsSingletonService, Item, ProductVariant } from '@/services/ItemsSingletonService';
import { itemsService } from '@/services/ItemsSingletonService';
import { clientLogger } from '@/lib/client-logger';

type DownloadPage = ServiceDownloadPage;

interface CreatePageForm {
  title: string;
  description?: string;
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  brandColor?: string;
  requireAuthentication?: boolean;
  allowMultipleDownloads?: boolean;
  status?: 'draft' | 'published';
  [key: string]: unknown;
}

export default function DigitalDownloadsPage() {
  const { t } = useTranslation();
  const { user, currentTenantId } = useAuth();
  const [pages, setPages] = useState<DownloadPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDigitalItems, setLoadingDigitalItems] = useState(true);
  const [digitalItems, setDigitalItems] = useState<Array<{ id: string; name: string; product_type?: string; digital_delivery_method?: string; item_status?: string; has_variants?: boolean }>>([]);
  const [productDetails, setProductDetails] = useState<Map<string, Item>>(new Map());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<DownloadPage | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemVariants, setItemVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [formData, setFormData] = useState<CreatePageForm>({
    title: '',
    description: '',
    instructions: '',
    thankYouMessage: '',
    supportEmail: '',
    brandColor: '#3B82F6',
    requireAuthentication: true,
    allowMultipleDownloads: true,
    status: 'draft'
  });

  // Get tenant ID from URL params or auth context
  const getTenantId = () => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const tenantIndex = pathParts.indexOf('t') + 1;
      if (tenantIndex < pathParts.length && pathParts[tenantIndex]) {
        return pathParts[tenantIndex];
      }
    }
    return currentTenantId;
  };

  // Fetch product details for download pages
  const fetchProductDetails = async (itemIds: string[]) => {
    const details = new Map<string, Item>();
    
    for (const itemId of itemIds) {
      try {
        const item = await itemsService.getItem(itemId);
        if (item) {
          details.set(itemId, item);
        }
      } catch (error) {
        clientLogger.error(`Failed to fetch product details for ${itemId}:`, { detail: error });
      }
    }
    
    setProductDetails(details);
  };

  // Fetch pages
  const fetchPages = async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    
    try {
      setLoading(true);
      const result = await digitalDownloadPagesService.getDownloadPages(tenantId);
      const fetchedPages = result.pages || [];
      setPages(fetchedPages);
      
      // Fetch product details for all pages
      const itemIds = fetchedPages.map(page => page.item_id).filter(Boolean);
      if (itemIds.length > 0) {
        await fetchProductDetails(itemIds);
      }
    } catch (error) {
      clientLogger.error('Error fetching download pages:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to load download pages',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };


  // Create page for selected item
  const handleCreatePage = async (item: { id: string; name: string; product_type?: string; digital_delivery_method?: string; item_status?: string; has_variants?: boolean }) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    
    // Fetch full item details
    try {
      const fullItem = await itemsService.getItem(item.id);
      if (!fullItem) return;
      setSelectedItem(fullItem);
      
      // Fetch variants if item has them
      if (fullItem.has_variants) {
        setItemVariants(fullItem.variants || []);
        setSelectedVariant(null); // Reset variant selection
      } else {
        setItemVariants([]);
        setSelectedVariant(null);
      }
      
      setFormData({
        title: `Download Page for ${item.name}`,
        description: '',
        instructions: '',
        thankYouMessage: '',
        supportEmail: '',
        brandColor: '#3B82F6',
        requireAuthentication: true,
        allowMultipleDownloads: true,
        status: 'draft'
      });
      setCreateModalOpen(true);
    } catch (error) {
      clientLogger.error('Failed to fetch item details:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to load item details',
        color: 'red'
      });
    }
  };

  // Submit page creation
  const handleSubmitCreatePage = async () => {
    const tenantId = getTenantId();
    if (!tenantId || !selectedItem) return;
    
    try {
      await digitalDownloadPagesService.createDownloadPage(tenantId, {
        ...formData,
        itemId: selectedItem.id
      });

      notifications.show({
        title: 'Success',
        message: 'Download page created successfully',
        color: 'green'
      });
      fetchPages();
      setCreateModalOpen(false);
      setSelectedItem(null);
      setFormData({
        title: '',
        description: '',
        instructions: '',
        thankYouMessage: '',
        supportEmail: '',
        brandColor: '#3B82F6',
        requireAuthentication: true,
        allowMultipleDownloads: true,
        status: 'draft'
      });
      fetchPages();
    } catch (error) {
      clientLogger.error('Error creating page:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to create download page',
        color: 'red'
      });
    }
  };

  // Update page
  const handleUpdatePage = async () => {
    const tenantId = getTenantId();
    if (!selectedPage || !tenantId) return;
    
    try {
      await digitalDownloadPagesService.updateDownloadPage(
        tenantId,
        selectedPage.id,
        formData
      );

      notifications.show({
        title: 'Success',
        message: 'Download page updated successfully',
        color: 'green'
      });
      setEditModalOpen(false);
      setSelectedPage(null);
      fetchPages();
    } catch (error) {
      clientLogger.error('Error updating page:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to update download page',
        color: 'red'
      });
    }
  };

  // Delete page
  const handleDeletePage = async (pageId: string) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    
    try {
      await digitalDownloadPagesService.deleteDownloadPage(tenantId, pageId);

      notifications.show({
        title: 'Success',
        message: 'Download page deleted successfully',
        color: 'green'
      });
      fetchPages();
    } catch (error) {
      clientLogger.error('Error deleting page:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to delete download page',
        color: 'red'
      });
    }
  };

  // Generate preview token
  const handleGeneratePreview = async (page: DownloadPage) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    
    try {
      const result = await digitalDownloadPagesService.generatePreviewToken(tenantId, page.id);

      const previewUrl = result.previewUrl;
      await navigator.clipboard.writeText(previewUrl);
      
      notifications.show({
        title: 'Preview Link Copied',
        message: 'Preview URL has been copied to clipboard',
        color: 'green'
      });
    } catch (error) {
      clientLogger.error('Error generating preview:', { detail: error });
      notifications.show({
        title: 'Error',
        message: 'Failed to generate preview link',
        color: 'red'
      });
    }
  };

  useEffect(() => {
    fetchPages();
    loadDigitalItems();
  }, []);

  const loadDigitalItems = async () => {
    const tenantId = getTenantId();
        if (!tenantId) return;
    
    try {
      setLoadingDigitalItems(true);
      const items = await digitalDownloadPagesService.getDigitalItems(tenantId);
      setDigitalItems(items);
    } catch (error) {
      clientLogger.error('Error loading digital items:', { detail: error });
      setDigitalItems([]);
    } finally {
      setLoadingDigitalItems(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'green';
      case 'draft': return 'yellow';
      case 'archived': return 'gray';
      default: return 'blue';
    }
  };

  // Check if a digital product already has a download page
  const hasDownloadPage = (itemId: string) => {
    // console.log(`Checking if item ${itemId} has download page:`, pages);
    return pages.some(page => page.item_id === itemId);
  };

  return (
    <>
      <PageHeader
        title="Digital Downloads"
        description="Manage download pages for your digital products"
        icon={<IconDownload />}
        backLink={{ href: `/t/${getTenantId()}/settings`, label: 'Settings' }}
        />

      {/* Digital Products Section */}
      <Card shadow="sm" p="lg" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>Digital Products</Text>
            <Badge size="lg">{digitalItems.length}</Badge>
          </Group>

          {loadingDigitalItems ? (
            <Text ta="center" c="dimmed">Loading digital products...</Text>
          ) : digitalItems.length === 0 ? (
            <Stack ta="center" gap="md">
              <Text c="dimmed">No digital products found.</Text>
              <Text size="sm" c="dimmed">
                Create digital products first to enable download pages.
              </Text>
              <Button 
                component="a" 
                href={`/t/${getTenantId()}/items/create`}
                variant='gradient' 
                style={{color: 'white'}}
              >
                Create Digital Product
              </Button>
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {digitalItems.map((item) => (
                <Card 
                  key={item.id} 
                  shadow="sm" 
                  p="md" 
                  withBorder 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCreatePage(item)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Stack gap="xs">
                    <Group justify="space-between" align="start">
                      <Text size="sm" fw={600} lineClamp={2}>
                        {item.name}
                      </Text>
                      <Group gap="xs">
                        <Badge 
                          size="xs" 
                          color={item.item_status === 'active' ? 'green' : 'orange'}
                        >
                          {item.item_status}
                        </Badge>
                        {hasDownloadPage(item.id) ? (
                          <Badge size="xs" color="blue" variant="light">
                            <Group gap={4}>
                              <IconDownload size={10} />
                              <span>Page Exists</span>
                            </Group>
                          </Badge>
                        ) : (
                          <Badge size="xs" color="gray" variant="outline">
                            No Page
                          </Badge>
                        )}
                      </Group>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" variant="light" color="blue">
                        {item.digital_delivery_method?.replace('_', ' ')}
                      </Badge>
                    </Group>
                    <Button 
                      size="sm" 
                      fullWidth 
                      variant={hasDownloadPage(item.id) ? 'outline' : 'gradient'} 
                      style={hasDownloadPage(item.id) ? {} : {color: 'white'}}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreatePage(item);
                      }}
                    >
                      {hasDownloadPage(item.id) ? 'Manage Page' : 'Create Download Page'}
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {/* Download Pages Section */}
      <Card shadow="sm" p="lg" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>Download Pages</Text>
            <Badge size="lg">{pages.length}</Badge>
          </Group>

          {loading ? (
            <Text ta="center" c="dimmed">Loading...</Text>
          ) : pages.length === 0 ? (
            <Text ta="center" c="dimmed">
              No download pages yet. Create your first page to get started.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Variant</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th ta="center">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pages.map((page) => (
                  <Table.Tr key={page.id}>
                    <Table.Td>
                      <Group>
                        <div>
                          <Text size="sm" fw={500}>{page.title}</Text>
                          {page.description && (
                            <Text size="xs" c="dimmed">{page.description}</Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(page.status)} size="sm">
                        {page.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {(() => {
                        const itemId = page.item_id;
                        const item = productDetails.get(itemId);
                        if (item) {
                          return (
                            <Group>
                              {(item.imageUrl || (item.imageGallery && item.imageGallery.length > 0)) && (
                                <img 
                                  src={item.imageUrl || item.imageGallery?.[0]} 
                                  alt={item.name}
                                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                                />
                              )}
                              <div>
                                <Text size="sm" fw={500}>{item.name}</Text>
                                {item.brand && (
                                  <Text size="xs" c="dimmed">{item.brand}</Text>
                                )}
                              </div>
                            </Group>
                          );
                        }
                        return <Text size="sm">Loading...</Text>;
                      })()}
                    </Table.Td>
                    <Table.Td>
                      {page.variant_id ? (
                        <Stack gap="xs">
                          <Text size="sm" fw={500}>{page.variant_name}</Text>
                          <Badge size="xs" color="blue" variant="light">
                            Variant Specific
                          </Badge>
                        </Stack>
                      ) : (
                        <Text size="sm" c="dimmed">All Variants</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(page.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group justify="center" gap="xs">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="blue"
                          onClick={() => handleGeneratePreview(page)}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="yellow"
                          onClick={() => {
                            setSelectedPage(page);
                            setFormData({
                              title: page.title,
                              description: page.description || '',
                              instructions: page.instructions || '',
                              thankYouMessage: page.thank_you_message || '',
                              supportEmail: page.support_email || '',
                              brandColor: page.brand_color || '#3B82F6',
                              requireAuthentication: page.require_authentication || false,
                              allowMultipleDownloads: page.allow_multiple_downloads || false,
                              status: (page.status === 'archived' ? 'draft' : page.status) as 'draft' | 'published'
                            });
                            setEditModalOpen(true);
                          }}
                        >
                          <IconEdit size={14} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeletePage(page.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>

      {/* Create Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setDigitalItems([]);
        }}
        title="Create Download Page"
        size="lg"
      >
        {loadingDigitalItems ? (
          <Stack align="center" gap="md">
            <Text>Loading digital items...</Text>
          </Stack>
        ) : !digitalItems.length ? (
          <Stack align="center" gap="md">
            <Text size="lg" c="dimmed">No Digital Items Available</Text>
            <Text c="dimmed">Please create digital products first before creating download pages.</Text>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Close
            </Button>
          </Stack>
        ) : (
          <Stack gap="md">
            <TextInput
              label="Title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Download Page Title"
            />
            
            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            
            <Textarea
              label="Download Instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              placeholder="Thank you for purchasing! Your files are ready below."
            />
            
            <TextInput
              label="Thank You Message"
              value={formData.thankYouMessage}
              onChange={(e) => setFormData({ ...formData, thankYouMessage: e.target.value })}
              placeholder="Enjoy your digital purchase!"
            />
            
            <Group>
              <TextInput
                label="Support Email"
                type="email"
                value={formData.supportEmail}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                style={{ flex: 1 }}
              />
              
              <TextInput
                label="Brand Color"
                type="color"
                value={formData.brandColor}
                onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                style={{ width: 120 }}
              />
            </Group>
            
            {/* Variant Selection */}
            {itemVariants.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>Product Variants</Text>
                <Text size="xs" c="dimmed">
                  This product has variants. Select which variant this download page is for, or leave unselected to create a page for all variants.
                </Text>
                <Select
                  placeholder="Select a variant (optional)"
                  data={[
                    { value: '', label: 'All Variants (Generic Page)' },
                    ...itemVariants.map(variant => ({
                      value: variant.id,
                      label: `${variant.variant_name} - $${(variant.price_cents / 100).toFixed(2)}`
                    }))
                  ]}
                  value={selectedVariant?.id || ''}
                  onChange={(value: string | null) => {
                    const variant = value ? itemVariants.find(v => v.id === value) || null : null;
                    setSelectedVariant(variant);
                    // Update title based on variant selection
                    if (variant) {
                      setFormData(prev => ({
                        ...prev,
                        title: `Download Page for ${selectedItem?.name} - ${variant.variant_name}`
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        title: `Download Page for ${selectedItem?.name}`
                      }));
                    }
                  }}
                  clearable
                />
              </Stack>
            )}
            
            <Group>
              <Switch
                label="Require Authentication"
                description="Users must be logged in to access downloads"
                checked={formData.requireAuthentication}
                onChange={(e) => setFormData({ ...formData, requireAuthentication: e.currentTarget.checked })}
              />
              
              <Switch
                label="Allow Multiple Downloads"
                description="Users can download files multiple times"
                checked={formData.allowMultipleDownloads}
                onChange={(e) => setFormData({ ...formData, allowMultipleDownloads: e.currentTarget.checked })}
              />
            </Group>
            
            <Switch
              label="Publish Immediately"
              description="Make page available to customers"
              checked={formData.status === 'published'}
              onChange={(e) => setFormData({ ...formData, status: e.currentTarget.checked ? 'published' : 'draft' })}
            />
            
            <Group mt="xl" justify="flex-end">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitCreatePage} variant='gradient' style={{color: 'white'}}>
                Create Page
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Download Page"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          
          <Textarea
            label="Download Instructions"
            value={formData.instructions}
            onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            rows={4}
          />
          
          <TextInput
            label="Thank You Message"
            value={formData.thankYouMessage}
            onChange={(e) => setFormData({ ...formData, thankYouMessage: e.target.value })}
          />
          
          <Group>
            <TextInput
              label="Support Email"
              type="email"
              value={formData.supportEmail}
              onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
              style={{ flex: 1 }}
            />
            
            <TextInput
              label="Brand Color"
              type="color"
              value={formData.brandColor}
              onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
              style={{ width: 120 }}
            />
          </Group>
          
          <Group>
            <Switch
              label="Require Authentication"
              description="Users must be logged in to access downloads"
              checked={formData.requireAuthentication}
              onChange={(e) => setFormData({ ...formData, requireAuthentication: e.currentTarget.checked })}
            />
            
            <Switch
              label="Allow Multiple Downloads"
              description="Users can download files multiple times"
              checked={formData.allowMultipleDownloads}
              onChange={(e) => setFormData({ ...formData, allowMultipleDownloads: e.currentTarget.checked })}
            />
          </Group>
          
          <Switch
            label="Published"
            description="Page is visible to customers"
            checked={formData.status === 'published'}
            onChange={(e) => setFormData({ ...formData, status: e.currentTarget.checked ? 'published' : 'draft' })}
          />
        </Stack>
        
        <Group mt="xl" justify="flex-end">
          <Button variant="outline" onClick={() => setEditModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdatePage} variant='gradient' style={{color: 'white'}}>
            Update Page
          </Button>
        </Group>
      </Modal>
    </>
  );
}
