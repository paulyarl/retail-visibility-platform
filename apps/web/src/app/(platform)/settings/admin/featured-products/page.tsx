"use client";

import { useState, useEffect } from 'react';
import { Star, TrendingUp, Store, Package, Eye, ExternalLink, X, Trash2, CheckSquare, Square, Search, Filter, ChevronLeft, ChevronRight, Edit2, Calendar, AlertTriangle } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import Image from 'next/image';
import Link from 'next/link';
import { featuredProductsService } from '@/services/FeaturedProductsService';
import AdminTenantFeaturedManagement from '@/components/admin/AdminTenantFeaturedManagement';
import AdminDirectoryFeaturedManagement from '@/components/admin/AdminDirectoryFeaturedManagement';
import AdminFeaturedApprovalService, { PendingTenant, PendingProduct } from '@/services/AdminFeaturedApprovalService';
import { notifications } from '@mantine/notifications';
import { useToast } from '@/components/ui/use-toast';
import { ToastContainer } from '@/components/ui';

interface FeaturedProduct {
  featured_product_id: string;
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  price_cents: number;
  image_url?: string;
  stock?: number;
  featured_type: string;
  featured_priority: number;
  featured_at: string;
  featured_until?: string;
  auto_unfeature: boolean;
  is_active: boolean;
  admin_approved?: boolean;
  approved_by?: string;
  approved_at?: string;
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
    subscription_status?: string;
  };
}

interface FeaturingStats {
  totalFeatured: number;
  byTier: Array<{ tier: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  expiringSoon: number;
}

export default function FeaturedProductsManagement() {
  const { toast, toasts, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'store-featured' | 'directory-featured' | 'featured-approval'>('featured-approval');
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedDirectoryTenant, setSelectedDirectoryTenant] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeaturingStats | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [pendingTenants, setPendingTenants] = useState<PendingTenant[]>([]);
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const limit = 20;
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmUnfeature, setConfirmUnfeature] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);
  const [approvingTenant, setApprovingTenant] = useState<string | null>(null);
  const [rejectingTenant, setRejectingTenant] = useState<string | null>(null);
  const [approvingProduct, setApprovingProduct] = useState<string | null>(null);
  const [rejectingProduct, setRejectingProduct] = useState<string | null>(null);
  const [approvalSubTab, setApprovalSubTab] = useState<'tenant' | 'product'>('tenant');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [expirationFilter, setExpirationFilter] = useState<string>('all');
  const [featuredTypeFilter, setFeaturedTypeFilter] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('active');
  const [showFilters, setShowFilters] = useState(false);
  const [uniqueTenants, setUniqueTenants] = useState<Array<{id: string, name: string}>>([]);

  // Featured type options
  const featuredTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'new_arrival', label: 'New Arrivals' },
    { value: 'seasonal', label: 'Seasonal Favorites' },
    { value: 'staff_pick', label: 'Staff Picks' },
    { value: 'sale', label: 'Sale Items' },
    { value: 'bestseller', label: 'Bestsellers' },
    { value: 'clearance', label: 'Clearance' },
    { value: 'trending', label: 'Trending Now' },
    { value: 'featured', label: 'Featured' },
    { value: 'recommended', label: 'Recommended' },
    { value: 'store_selection', label: 'Directory Featured' }
  ];

  // Active status options
  const activeStatusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active Only' },
    { value: 'inactive', label: 'Inactive Only' }
  ];

  useEffect(() => {
    fetchData();
    fetchPendingTenants();
    fetchPendingProducts();
  }, [searchQuery, tierFilter, tenantFilter, expirationFilter, featuredTypeFilter, activeStatusFilter]);

  useEffect(() => {
    if (activeTab === 'featured-approval') {
      fetchPendingTenants();
      fetchPendingProducts();
    }
  }, [activeTab]);

  useEffect(() => {
    // Reset to page 0 when filters change
    if (page !== 0) {
      setPage(0);
    }
  }, [searchQuery, tierFilter, tenantFilter, expirationFilter, featuredTypeFilter, activeStatusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, productsData] = await Promise.all([
        featuredProductsService.getFeaturingStats(),
        featuredProductsService.getFeaturedProducts(limit, page * limit, {
          tenant_id: tenantFilter !== 'all' ? tenantFilter : undefined,
          subscription_tier: tierFilter !== 'all' ? tierFilter : undefined,
          expiration_status: expirationFilter !== 'all' ? expirationFilter : undefined,
          featured_type: featuredTypeFilter !== 'all' ? featuredTypeFilter : undefined,
          is_active: activeStatusFilter !== 'all' ? activeStatusFilter === 'active' : undefined,
        })
      ]);

      setStats(statsData);
      setTotal(productsData?.length || 0);
      
      let allProducts = productsData || [];
      
      // Transform service FeaturedProduct to page FeaturedProduct format
      const transformedProducts = allProducts.map((product: any) => ({
        featured_product_id: product.featured_product_id,
        id: product.id,
        tenant_id: product.tenant_id,
        sku: product.sku,
        name: product.name,
        title: product.title,
        brand: product.brand,
        price_cents: product.price_cents,
        image_url: product.image_url,
        stock: product.stock,
        featured_type: product.featured_type,
        featured_priority: product.featured_priority,
        featured_at: product.featured_at,
        featured_until: product.featured_until,
        auto_unfeature: product.auto_unfeature,
        is_active: product.is_active,
        tenants: product.tenants
      }));

      // Apply search filter if needed
      if (searchQuery) {
        const filtered = transformedProducts.filter(product =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.tenants.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setProducts(filtered);
        setTotal(filtered.length);
      } else {
        setProducts(transformedProducts);
      }

      // Extract unique tenants for filter dropdown
      const tenants = [...new Map(allProducts.map((p: any) => [p.tenants.id, p.tenants])).values()];
      setUniqueTenants(tenants);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingProducts = async () => {
    try {
      const allProducts = await AdminFeaturedApprovalService.getAllFeaturedProducts();
      setPendingProducts(allProducts);
    } catch (error) {
      console.error('Error fetching all featured products:', error);
      setPendingProducts([]);
    }
  };

  const fetchPendingTenants = async () => {
    try {
      // console.log('[DEBUG] Fetching tenants with featured access status...');
      const allTenants = await AdminFeaturedApprovalService.getAllTenantsWithFeaturedAccessStatus();
      // console.log('[DEBUG] Raw API response:', allTenants);
      
      // Log each tenant's approval status
      allTenants.forEach((tenant, index) => {
        // console.log(`[DEBUG] Tenant ${index + 1}: ${tenant.name}`, {
        //   id: tenant.id,
        //   featured_access_approved: tenant.featured_access_approved,
        //   featured_access_approved_by: tenant.featured_access_approved_by,
        //   featured_access_approved_at: tenant.featured_access_approved_at,
        //   featured_access_rejection_reason: tenant.featured_access_rejection_reason
        // });
      });
      
      setPendingTenants(allTenants);
      setPendingTotal(allTenants.length);
    } catch (error) {
      console.error('Error fetching tenants with featured access status:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (dateString: string) => {
    const expirationDate = new Date(dateString);
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return expirationDate <= sevenDaysFromNow;
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      'trial': 'bg-gray-100 text-gray-700',
      'google-only': 'bg-blue-100 text-blue-700',
      'starter': 'bg-green-100 text-green-700',
      'professional': 'bg-purple-100 text-purple-700',
      'enterprise': 'bg-amber-100 text-amber-700',
      'organization': 'bg-red-100 text-red-700'
    };
    return colors[tier] || 'bg-gray-100 text-gray-700';
  };

  const getFeaturedTypeStyle = (type: string) => {
    const styles: Record<string, string> = {
      'new_arrival': 'bg-green-100 text-green-700',
      'seasonal': 'bg-orange-100 text-orange-700',
      'staff_pick': 'bg-purple-100 text-purple-700',
      'sale': 'bg-red-100 text-red-700',
      'bestseller': 'bg-amber-100 text-amber-700',
      'clearance': 'bg-yellow-100 text-yellow-700',
      'trending': 'bg-pink-100 text-pink-700',
      'featured': 'bg-indigo-100 text-indigo-700',
      'recommended': 'bg-teal-100 text-teal-700',
      'store_selection': 'bg-blue-100 text-blue-700'
    };
    return styles[type] || 'bg-gray-100 text-gray-700';
  };

  const getFeaturedTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'new_arrival': 'New Arrival',
      'seasonal': 'Seasonal',
      'staff_pick': 'Staff Pick',
      'sale': 'Sale',
      'bestseller': 'Bestseller',
      'clearance': 'Clearance',
      'trending': 'Trending',
      'featured': 'Featured',
      'recommended': 'Recommended',
      'store_selection': 'Directory Featured'
    };
    return labels[type] || type;
  };

  const getFeaturedAccessStatus = (tenant: PendingTenant) => {
    // DEBUG: Log the tenant data to understand what's happening
    // console.log(`[DEBUG] Tenant: ${tenant.name} (${tenant.id})`, {
    //   featured_access_approved: tenant.featured_access_approved,
    //   featured_access_approved_by: tenant.featured_access_approved_by,
    //   featured_access_approved_at: tenant.featured_access_approved_at,
    //   featured_access_rejection_reason: tenant.featured_access_rejection_reason,
    //   subscription_tier: tenant.subscription_tier,
    //   subscription_status: tenant.subscription_status
    // });
    
    if (tenant.featured_access_approved === true) {
      // console.log(`[DEBUG] ${tenant.name} - APPROVED ✓`);
      return {
        status: 'Approved',
        style: 'bg-green-100 text-green-700',
        icon: '✓'
      };
    } else if (tenant.featured_access_approved === false && tenant.featured_access_rejection_reason) {
      // console.log(`[DEBUG] ${tenant.name} - REJECTED ✗`);
      return {
        status: 'Rejected',
        style: 'bg-red-100 text-red-700',
        icon: '✗'
      };
    } else {
      // console.log(`[DEBUG] ${tenant.name} - PENDING ⏳ (featured_access_approved: ${tenant.featured_access_approved})`);
      // Either null or false without rejection reason = Pending Approval
      return {
        status: 'Pending Approval',
        style: 'bg-orange-100 text-orange-700',
        icon: '⏳'
      };
    }
  };

  const getProductApprovalStatus = (product: PendingProduct) => {
    if (product.admin_approved === false) {
      return {
        status: 'Rejected',
        style: 'bg-red-100 text-red-700',
        icon: '✗'
      };
    } else {
      // true, null, or undefined = Approved (default for featured products)
      return {
        status: 'Approved',
        style: 'bg-green-100 text-green-700',
        icon: '✓'
      };
    }
  };

  const handleUnfeature = async (featuredProductId: string, tenantId: string) => {
    try {
      await featuredProductsService.unfeatureProduct(featuredProductId);
      
      // Remove from pending products list
      setPendingProducts(prev => prev.filter(product => product.id !== featuredProductId));
      
      // Remove from main products list
      setProducts(prev => prev.filter(product => product.id !== featuredProductId));
      
      // Show success notification
      toast('🗑️ Product has been removed from featuring!', { variant: 'info' });
    } catch (error) {
      console.error('Error unfeaturing product:', error);
      notifications.show({
        title: 'Unfeature Failed',
        message: 'Failed to unfeature product. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    }
  };

  const handlePriorityUpdate = async (productId: string, tenantId: string, newPriority: number) => {
    try {
      await platformHomeService.updateProductPriority(tenantId, productId, newPriority);
      await fetchData();
      setUpdatingPriority(null);
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update priority');
    }
  };

  const handleApproveProduct = async (featuredProductId: string) => {
    try {
      setApprovingProduct(featuredProductId);
      
      // Find the product to get tenant info
      const product = pendingProducts.find(p => p.id === featuredProductId);
      if (!product) {
        toast('Product not found', { variant: 'error' });
        return;
      }
      
      // Check if tenant has active subscription
      if (product.tenants?.subscription_status !== 'active') {
        toast(`❌ Cannot approve product - Tenant subscription is ${product.tenants?.subscription_status || 'unknown'}. Only active subscriptions can be approved for featured access.`, { variant: 'error' });
        return;
      }
      
      const updatedProduct = await AdminFeaturedApprovalService.approveProduct(featuredProductId);
      
      if (updatedProduct) {
        // Update the product in the pending products list with new status
        setPendingProducts(prev => prev.map(product => 
          product.id === featuredProductId ? { ...product, ...updatedProduct } : product
        ));
        
        // Update the main products list
        setProducts(prev => prev.map(product => 
          product.id === featuredProductId ? { ...product, ...updatedProduct } : product
        ));

        // Show success notification
        toast('✅ Product has been approved for featuring!', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error approving product:', error);
      notifications.show({
        title: 'Approval Failed',
        message: 'Failed to approve product. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    } finally {
      setApprovingProduct(null);
    }
  };

  const handleRejectProduct = async (featuredProductId: string, reason?: string) => {
    
    try {
      setRejectingProduct(featuredProductId);
      const updatedProduct = await AdminFeaturedApprovalService.rejectProduct(featuredProductId, reason);
      
      if (updatedProduct) {
        // Show success notification
        toast(`❌ Product has been rejected${reason ? ` (${reason})` : ''}!`, { variant: 'error' });
        
        // Update the product in the pending products list with new status
        setPendingProducts(prev => 
          prev.map(product => 
            product.id === featuredProductId ? { ...product, ...updatedProduct } : product
          )
        );
        
        // Update the main products list
        setProducts(prev => 
          prev.map(product => 
            product.id === featuredProductId ? { ...product, ...updatedProduct } : product
          )
        );
      } else {
        // No updated product returned from service
      }
    } catch (error) {
      console.error('Error rejecting product:', error);
      notifications.show({
        title: 'Rejection Failed',
        message: 'Failed to reject product. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    } finally {
      setRejectingProduct(null);
    }
  };

  const handleApproveTenant = async (tenantId: string) => {
    
    try {
      setApprovingTenant(tenantId);
      
      // Find the tenant to check subscription status
      const tenant = pendingTenants.find(t => t.id === tenantId);
      if (!tenant) {
        toast('Tenant not found', { variant: 'error' });
        return;
      }
      
      // Check if tenant has active subscription
      if (tenant.subscription_status !== 'active') {
        toast(`❌ Cannot approve ${tenant.name} - Subscription is ${tenant.subscription_status || 'unknown'}. Only active subscriptions can be approved for featured access.`, { variant: 'error' });
        return;
      }
      
      const updatedTenant = await AdminFeaturedApprovalService.approveTenant(tenantId);
      
      if (updatedTenant) {
        // Refresh the tenants list to get updated approval status
        await fetchPendingTenants();
        
        toast(`✅ ${tenant.name} has been approved for featured access!`, { variant: 'success' });
      } else {
        toast('Failed to approve tenant', { variant: 'error' });
      }
    } catch (error) {
      console.error('Error approving tenant:', error);
      notifications.show({
        title: 'Approval Failed',
        message: 'Failed to approve tenant. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    } finally {
      setApprovingTenant(null);
    }
  };

  const handleRejectTenant = async (tenantId: string, reason?: string) => {
    
    try {
      setRejectingTenant(tenantId);
      const updatedTenant = await AdminFeaturedApprovalService.rejectTenant(tenantId, reason);
      
      if (updatedTenant) {
        // Refresh the tenants list to get updated approval status
        await fetchPendingTenants();

        // Show success notification
        toast(`❌ ${updatedTenant.name} has been rejected${reason ? ` (${reason})` : ''}!`, { variant: 'error' });
      }
    } catch (error) {
      console.error('Error rejecting tenant:', error);
      notifications.show({
        title: 'Rejection Failed',
        message: 'Failed to reject tenant. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    } finally {
      setRejectingTenant(null);
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkUnfeature = async () => {
    if (selectedProducts.size === 0) return;
    
    if (!confirm(`Are you sure you want to unfeature ${selectedProducts.size} product(s)?`)) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedProducts).map(featuredProductId => {
        // The selectedProducts set now contains featured_product_ids
        return featuredProductsService.unfeatureProduct(featuredProductId);
      });

      await Promise.all(promises);
      await fetchData();
      setSelectedProducts(new Set());

      // Show success notification
      notifications.show({
        title: 'Products Unfeatured',
        message: `${selectedProducts.size} product(s) have been removed from featuring`,
        color: 'blue',
        icon: <Trash2 size={16} />,
      });
    } catch (error) {
      console.error('Error bulk unfeaturing:', error);
      notifications.show({
        title: 'Bulk Action Failed',
        message: 'Failed to unfeature some products. Please try again.',
        color: 'red',
        icon: <X size={16} />,
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setTenantFilter('all');
    setExpirationFilter('all');
    setFeaturedTypeFilter('all');
    setActiveStatusFilter('active');
  };

  const hasActiveFilters = searchQuery || tierFilter !== 'all' || tenantFilter !== 'all' || expirationFilter !== 'all' || featuredTypeFilter !== 'all' || activeStatusFilter !== 'active';
  const totalPages = Math.ceil(total / limit);
  const startItem = total > 0 ? page * limit + 1 : 0;
  const endItem = Math.min((page + 1) * limit, total);

  if (loading && page === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading featured products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
          Featured Products Management
        </h1>
        <p className="mt-2 text-gray-600">
          Platform-wide management of featured products across tenants
        </p>
        
        {/* Tab Navigation */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Platform Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('store-featured')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'store-featured'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Store Featured Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab('directory-featured')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'directory-featured'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Premium Featured Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab('featured-approval')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'featured-approval'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Featured Approval
                {pendingProducts.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingProducts.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Featured */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Featured</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalFeatured}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-600 fill-amber-600" />
                  </div>
                </div>
              </div>

              {/* By Tier */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-600">By Tier</p>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  {stats.byTier.slice(0, 3).map((item) => (
                    <div key={item.tier} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{item.tier}:</span>
                      <span className="font-semibold text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Type */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-600">By Type</p>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  {stats.byType.slice(0, 3).map((item) => (
                    <div key={item.type} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{item.type.replace('_', ' ')}:</span>
                      <span className="font-semibold text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    Active
                  </span>
                )}
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products by name, SKU, brand, or tenant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Tenant Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tenant (Location)
                  </label>
                  <select
                    value={tenantFilter}
                    onChange={(e) => setTenantFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Tenants ({uniqueTenants.length})</option>
                    {uniqueTenants.map(tenant => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tier Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Tier
                  </label>
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Tiers</option>
                    <option value="trial">Trial</option>
                    <option value="google-only">Google Only</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="organization">Organization</option>
                  </select>
                </div>

                {/* Expiration Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Status
                  </label>
                  <select
                    value={expirationFilter}
                    onChange={(e) => setExpirationFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Products</option>
                    <option value="expiring">Expiring Soon (7 days)</option>
                    <option value="temporary">Has Expiration Date</option>
                    <option value="permanent">No Expiration</option>
                  </select>
                </div>

                {/* Featured Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Featured Type
                  </label>
                  <select
                    value={featuredTypeFilter}
                    onChange={(e) => setFeaturedTypeFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {featuredTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Active Status
                  </label>
                  <select
                    value={activeStatusFilter}
                    onChange={(e) => setActiveStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    {activeStatusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* By Type */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-600">By Type</p>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {stats?.byType.slice(0, 3).map((item) => (
                      <div key={item.type} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{item.type.replace('_', ' ')}:</span>
                        <span className="font-semibold text-gray-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>

          {/* Bulk Actions Bar */}
          {selectedProducts.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedProducts(new Set())}
                    className="text-sm text-blue-700 hover:text-blue-800"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkUnfeature}
                    disabled={bulkActionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    {bulkActionLoading ? 'Unfeaturing...' : 'Unfeature Selected'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Featured Products Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Featured Products ({total})
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing {startItem}-{endItem} of {total}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(new Set(products.map(p => p.featured_product_id)));
                          } else {
                            setSelectedProducts(new Set());
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Featured Since
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.featured_product_id} className={`hover:bg-gray-50 ${selectedProducts.has(product.featured_product_id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.featured_product_id)}
                          onChange={() => toggleSelectProduct(product.featured_product_id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 bg-gray-100 rounded flex-shrink-0">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                fill
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-cover rounded"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-xs">
                              {product.title || product.name}
                            </p>
                            {product.brand && (
                              <p className="text-xs text-gray-500">{product.brand}</p>
                            )}
                            <p className="text-xs text-gray-500">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {product.tenants.name}
                            </p>
                            <p className="text-xs text-gray-500">{product.tenant_id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getFeaturedTypeStyle(product.featured_type)}`}>
                          {getFeaturedTypeLabel(product.featured_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getTierColor(product.tenants.subscription_tier)}`}>
                          {product.tenants.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {updatingPriority === product.featured_product_id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              defaultValue={product.featured_priority}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                e.target.nextElementSibling!.textContent = value.toString();
                              }}
                              onMouseUp={(e) => {
                                const value = parseInt((e.target as HTMLInputElement).value);
                                handlePriorityUpdate(product.featured_product_id, product.tenant_id, value);
                              }}
                              className="w-20"
                            />
                            <span className="text-sm text-gray-600 w-8">{product.featured_priority}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${product.featured_priority}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{product.featured_priority}</span>
                            <button
                              onClick={() => setUpdatingPriority(product.featured_product_id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(product.featured_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {product.featured_until ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className={isExpiringSoon(product.featured_until) ? 'text-red-600 font-medium' : 'text-gray-900'}>
                              {formatDate(product.featured_until)}
                            </span>
                            {isExpiringSoon(product.featured_until) && (
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">No expiration</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            target="_blank"
                            className="text-gray-600 hover:text-gray-800"
                            title="View product details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/t/${product.tenant_id}/items/${product.id}`}
                            target="_blank"
                            className="text-gray-600 hover:text-gray-800"
                            title="View in tenant dashboard"
                          >
                            <Store className="w-4 h-4" />
                          </Link>
                          {confirmUnfeature === product.featured_product_id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleUnfeature(product.featured_product_id, product.tenant_id)}
                                className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
                                title="Confirm unfeature"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmUnfeature(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                                title="Cancel"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmUnfeature(product.featured_product_id)}
                              className="text-red-600 hover:text-red-800"
                              title="Unfeature this product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Enhanced Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Page {page + 1} of {totalPages}</span>
                    <span>•</span>
                    <span>{total} total products</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (page < 2) {
                          pageNum = i;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`px-3 py-1 text-sm border rounded-lg ${
                              pageNum === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum + 1}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {products.length === 0 && !loading && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {hasActiveFilters ? 'No Products Match Filters' : 'No Featured Products Yet'}
              </h3>
              <p className="text-gray-600">
                {hasActiveFilters 
                  ? 'Try adjusting your filters to see more results'
                  : 'Featured products will appear here once tenants start featuring their products'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'store-featured' && (
        <AdminTenantFeaturedManagement selectedTenant={selectedTenant} setSelectedTenant={setSelectedTenant} pendingTenants={pendingTenants} />
      )}

      {activeTab === 'directory-featured' && (
        <AdminDirectoryFeaturedManagement pendingTenants={pendingTenants} />
      )}

      {activeTab === 'featured-approval' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Featured Approvals</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Review tenant access requests and individual product approvals
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchPendingTenants();
                    fetchPendingProducts();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Refresh All
                </button>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setApprovalSubTab('tenant')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    approvalSubTab === 'tenant'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" />
                    Tenant Approval
                    {pendingTenants.length > 0 && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {pendingTenants.length}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setApprovalSubTab('product')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    approvalSubTab === 'product'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Product Approval
                    {pendingProducts.length > 0 && (
                      <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                        {pendingProducts.length}
                      </span>
                    )}
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {approvalSubTab === 'tenant' && (
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-md font-medium text-gray-900">
                    Tenant Featured Access ({pendingTenants.length})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage tenant access to premium featuring. Smart buttons show relevant actions based on current status.
                  </p>
                </div>
                
                {pendingTenants.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Store className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No tenants found
                    </h3>
                    <p className="text-gray-600">
                      No tenants are available for featured access management.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {pendingTenants.map((tenant) => (
                      <div key={tenant.id} className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-lg font-medium text-gray-900">
                                  {tenant.name}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  Tenant ID: {tenant.id} • 
                                  Tier: {tenant.subscription_tier} • 
                                  Status: {tenant.subscription_status}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getFeaturedAccessStatus(tenant).style}`}>
                                    {getFeaturedAccessStatus(tenant).icon} {getFeaturedAccessStatus(tenant).status}
                                  </span>
                                  {tenant.featured_access_approved === true && tenant.featured_access_approved_at && (
                                    <span className="text-xs text-gray-500">
                                      Approved {formatDate(tenant.featured_access_approved_at)}
                                      {tenant.featured_access_approved_by && ` by ${tenant.featured_access_approved_by.slice(0, 8)}...`}
                                    </span>
                                  )}
                                  {tenant.featured_access_approved === false && tenant.featured_access_rejection_reason && (
                                    <span className="text-xs text-gray-500">
                                      Reason: {tenant.featured_access_rejection_reason}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    Created: {formatDate(tenant.created_at)}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {/* Show Approve button only for rejected or pending approval tenants */}
                                {(tenant.featured_access_approved === false || tenant.featured_access_approved === null) && (
                                  <button
                                    onClick={() => handleApproveTenant(tenant.id)}
                                    disabled={approvingTenant === tenant.id}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    {approvingTenant === tenant.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <CheckSquare className="w-4 h-4" />
                                    )}
                                    Approve
                                  </button>
                                )}
                                {/* Show Reject button for approved or pending approval tenants */}
                                {(tenant.featured_access_approved === true || tenant.featured_access_approved === null) && (
                                  <button
                                    onClick={() => handleRejectTenant(tenant.id)}
                                    disabled={rejectingTenant === tenant.id}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    {rejectingTenant === tenant.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <X className="w-4 h-4" />
                                    )}
                                    Reject
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>
                                  <strong>Users:</strong> {tenant.user_tenants?.length || 0}
                                </span>
                                <span>
                                  <strong>Products:</strong> {tenant.featured_products?.length || 0} featured products
                                </span>
                                <span>
                                  <strong>Service Level:</strong> {tenant.name || 'N/A'}
                                </span>
                              </div>
                              {tenant.user_tenants?.length > 0 && (
                                <div className="mt-2 text-sm text-gray-500">
                                  <strong>Contact:</strong> {tenant.user_tenants[0]?.users?.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {approvalSubTab === 'product' && (
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-md font-medium text-gray-900">
                    All Featured Products ({pendingProducts.length})
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage all featured products. Approve/reject to control visibility, or unfeatured to remove.
                  </p>
                </div>
                
                {pendingProducts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Featured Products</h3>
                    <p className="text-gray-600">
                      No products are currently featured.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {pendingProducts.map((product) => (
                      <div key={product.id} className="p-6">
                        <div className="flex items-start gap-4">
                          {product.inventory_items?.image_url && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={product.inventory_items.image_url}
                                alt={product.inventory_items.name}
                                width={64}
                                height={64}
                                sizes="64px"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-lg font-medium text-gray-900">
                                  {product.inventory_items?.name}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  SKU: {product.inventory_items?.sku} • 
                                  Price: ${(product.inventory_items?.price_cents || 0) / 100}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getProductApprovalStatus(product).style}`}>
                                    {getProductApprovalStatus(product).icon} {getProductApprovalStatus(product).status}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    Store: {product.tenants?.name}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {/* Show Approve button only for rejected products */}
                                {product.admin_approved === false && (
                                  <button
                                    onClick={() => handleApproveProduct(product.id)}
                                    disabled={approvingProduct === product.id}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    {approvingProduct === product.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <CheckSquare className="w-4 h-4" />
                                    )}
                                    Approve
                                  </button>
                                )}
                                {/* Show Reject button for approved products */}
                                {product.admin_approved !== false && (
                                  <button
                                    onClick={() => handleRejectProduct(product.id)}
                                    disabled={rejectingProduct === product.id}
                                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                    {rejectingProduct === product.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <X className="w-4 h-4" />
                                    )}
                                    Reject
                                  </button>
                                )}
                                {/* Unfeatured button for all products */}
                                <button
                                  onClick={() => handleUnfeature(product.id, product.tenants?.id || '')}
                                  disabled={false}
                                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Unfeatured
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <span>
                                  <strong>Tenant:</strong> {product.tenants?.name}
                                </span>
                                <span>
                                  <strong>Featured Type:</strong> {product.featured_type}
                                </span>
                                <span>
                                  <strong>Priority:</strong> {product.featured_priority || 50}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
    <ToastContainer toasts={toasts} onClose={removeToast} />
  </>
  );
}
