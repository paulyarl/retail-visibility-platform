"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, AnimatedCard } from "@/components/ui";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";

export default function Home() {
  // Animated counts for metrics (will be replaced with real data later)
  const inventoryCount = useCountUp(0, 1500);
  const listingsCount = useCountUp(0, 1500);
  const uploadsCount = useCountUp(0, 1500);
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-neutral-900">
              Retail Visibility Platform
            </h1>
            <div className="flex items-center gap-3">
              <Link href="/settings/tenant">
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
          <AnimatedCard delay={0} className="p-6">
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

          <AnimatedCard delay={0.2} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Feed Status</p>
                <div className="flex items-center gap-2 mt-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                  >
                    <Badge variant="success">Synced</Badge>
                  </motion.div>
                </div>
                <p className="text-sm text-neutral-500 mt-1">Last sync: Never</p>
              </div>
              <motion.div 
                className="h-12 w-12 bg-info rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 360 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={0.3} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-600">Photo Uploads</p>
                <motion.p 
                  className="text-3xl font-bold text-neutral-900 mt-2"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                >
                  {uploadsCount}
                </motion.p>
                <p className="text-sm text-neutral-500 mt-1">100% success</p>
              </div>
              <motion.div 
                className="h-12 w-12 bg-warning rounded-lg flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </motion.div>
            </div>
          </AnimatedCard>
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
              <Button variant="primary" className="w-full justify-start">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Product
              </Button>
            </CardContent>
          </AnimatedCard>

          <AnimatedCard delay={0.5} hover={false}>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Set up your retail visibility platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Create a tenant</p>
                  <p className="text-sm text-neutral-600">Set up your store or business</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Add inventory items</p>
                  <p className="text-sm text-neutral-600">Upload products with photos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-neutral-300 text-neutral-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Connect to Google</p>
                  <p className="text-sm text-neutral-600">Sync with Google Merchant Center</p>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </div>
      </main>
    </div>
  );
}
