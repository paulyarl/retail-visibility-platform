"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, AnimatedCard } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import Image from "next/image";
import PublicFooter from "@/components/PublicFooter";

export default function Home() {
  const { settings } = usePlatformSettings();
  const [stats, setStats] = useState({ 
    total: 0, 
    active: 0, 
    lowStock: 0,
    locations: 0,
    isChain: false,
    organizationName: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Fetch comprehensive dashboard stats
    const fetchStats = async () => {
      try {
        const tenantId = localStorage.getItem('tenantId');
        if (!tenantId) {
          setLoading(false);
          return;
        }
        
        // Fetch tenant info and items in parallel
        const [tenantRes, itemsRes, allTenantsRes] = await Promise.all([
          fetch(`/api/tenants/${tenantId}`),
          fetch(`/api/tenants/${tenantId}/items`),
          fetch('/api/tenants'),
        ]);
        
        let total = 0;
        let active = 0;
        let lowStock = 0;
        let locations = 0;
        let isChain = false;
        let organizationName = null;
        
        // Process items
        if (itemsRes.ok) {
          const items = await itemsRes.json();
          if (Array.isArray(items)) {
            total = items.length;
            active = items.filter((i: any) => i.itemStatus === 'active').length;
            lowStock = items.filter((i: any) => i.stock !== undefined && i.stock < 10).length;
          }
        }
        
        // Process tenant info for chain detection
        if (tenantRes.ok) {
          const tenant = await tenantRes.json();
          if (tenant.organization) {
            isChain = true;
            organizationName = tenant.organization.name;
          }
        }
        
        // Count locations (all tenants for this user)
        if (allTenantsRes.ok) {
          const tenants = await allTenantsRes.json();
          locations = Array.isArray(tenants) ? tenants.length : 0;
        }
        
        setStats({ total, active, lowStock, locations, isChain, organizationName });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);
  
  // Animated counts for metrics
  const inventoryCount = useCountUp(0, stats.total);
  const listingsCount = useCountUp(0, stats.active);
  const lowStockCount = useCountUp(0, stats.lowStock);
  const locationsCount = useCountUp(0, stats.locations);
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {settings?.logoUrl ? (
              <Link href="/">
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={150}
                  height={40}
                  className="h-10 w-auto object-contain cursor-pointer"
                />
              </Link>
            ) : (
              <h1 className="text-2xl font-bold text-neutral-900">
                {settings?.platformName || 'Retail Visibility Platform'}
              </h1>
            )}
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="ghost" size="sm">Settings</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-neutral-900 mb-2">
            Welcome to Your Dashboard
          </h2>
          <p className="text-neutral-600">
            Manage your retail inventory and visibility across platforms
          </p>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/items">
            <AnimatedCard delay={0} className="p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600">Total Inventory</p>
                  <motion.p 
                    className="text-3xl font-bold text-neutral-900 mt-2"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    {inventoryCount}
                  </motion.p>
                  <p className="text-sm text-neutral-500 mt-1">items</p>
                </div>
                <motion.div 
                  className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </motion.div>
              </div>
            </AnimatedCard>
          </Link>

          <AnimatedCard delay={0.1} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Active Listings</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                >
                  {listingsCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">on Google</p>
              </div>
              <motion.div 
                className="h-12 w-12 bg-success rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>

          {/* Low Stock Alerts - Actionable metric */}
          <AnimatedCard delay={0.2} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Low Stock Alerts</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  {lowStockCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">{lowStockCount > 0 ? 'needs attention' : 'all good'}</p>
              </div>
              <motion.div 
                className={`h-12 w-12 ${lowStockCount > 0 ? 'bg-warning' : 'bg-success'} rounded-lg flex items-center justify-center`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>

          {/* Locations Count - Context-aware */}
          <Link href="/tenants">
            <AnimatedCard delay={0.3} className="p-6 cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-600">
                    {stats.isChain ? 'Chain Locations' : 'Your Locations'}
                  </p>
                  <motion.p 
                    className="text-3xl font-bold text-neutral-900 mt-2"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    {locationsCount}
                  </motion.p>
                  <p className="text-sm text-neutral-500 mt-1">
                    {stats.isChain && stats.organizationName ? stats.organizationName : 'manage stores'}
                  </p>
                </div>
                <motion.div 
                  className="h-12 w-12 bg-info rounded-lg flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </motion.div>
              </div>
            </AnimatedCard>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatedCard delay={0.4} hover={false}>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/tenants" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Manage Tenants
                </Button>
              </Link>
              <Link href="/items" className="block">
                <Button variant="secondary" className="w-full justify-start">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  View Inventory
                </Button>
              </Link>
              <Link href="/items?create=true" className="block">
                <Button variant="primary" className="w-full justify-start">
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Product
                </Button>
              </Link>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.5} hover={false}>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Set up your retail visibility platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/tenants" className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:scale-110 transition-transform">
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Create a tenant</p>
                  <p className="text-sm text-neutral-600">Set up your store or business</p>
                </div>
              </Link>
              <Link href="/items?create=true" className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Add inventory items</p>
                  <p className="text-sm text-neutral-600">Upload products with photos</p>
                </div>
              </Link>
              <Link href="/settings/tenant" className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 transition-all">
                  3
                </div>
                <div>
                  <p className="font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">Connect to Google</p>
                  <p className="text-sm text-neutral-600">Sync with Google Merchant Center</p>
                </div>
              </Link>
            </CardContent>
          </AnimatedCard>
        </div>
      </main>
      
      <PublicFooter />
    </div>
  );
}
